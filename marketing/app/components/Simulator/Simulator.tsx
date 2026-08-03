'use client';

import { useMemo, useState } from 'react';
import styles from './Simulator.module.css';
import { DEFAULT_INPUTS, type SimulatorInputs } from './types';
import { buildScenarios } from './buildScenarios';
import { sampleBalances } from './format';
import { InputsForm } from './InputsForm';
import { ResultsComparison } from './ResultsComparison';
import { BalanceChart } from './BalanceChart';
import { TablePreview } from './TablePreview';
import { UnlockCTA } from './UnlockCTA';
import { captureMarketingEvent } from '../../lib/analytics';
import {
  generateAmortizationSchedule,
  calculateLoanSummary,
  validateScenario,
} from '@loan-engine/calculations';

export function Simulator() {
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_INPUTS);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleInputChange = (next: SimulatorInputs) => {
    if (!hasInteracted) {
      captureMarketingEvent('simulator_interacted');
      setHasInteracted(true);
    }
    setInputs(next);
  };

  const model = useMemo(() => {
    const { sac, price } = buildScenarios(inputs);
    // validateScenario has no system-specific rules, so validating `sac` covers both systems.
    const errors = [...validateScenario(sac).errors];
    // The engine accepts a 0% rate; for this lite calculator an empty/zero rate is invalid input.
    if (inputs.annualRate <= 0) {
      errors.push('Informe uma taxa de juros maior que zero.');
    }
    if (errors.length > 0) {
      return { errors, result: null };
    }
    const sacSchedule = generateAmortizationSchedule(sac);
    const priceSchedule = generateAmortizationSchedule(price);
    return {
      errors: [],
      result: {
        sacSummary: calculateLoanSummary(sacSchedule, sac),
        priceSummary: calculateLoanSummary(priceSchedule, price),
        sacSchedule,
        sacBalances: sampleBalances(sacSchedule, 30),
        priceBalances: sampleBalances(priceSchedule, 30),
      },
    };
  }, [inputs]);

  return (
    <div className={styles.simulator}>
      {/* InputsForm renders the validation message (role="alert") when errors is non-empty. */}
      <InputsForm value={inputs} onChange={handleInputChange} errors={model.errors} />
      {model.result && (
        <>
          <ResultsComparison sac={model.result.sacSummary} price={model.result.priceSummary} />
          <BalanceChart
            sacBalances={model.result.sacBalances}
            priceBalances={model.result.priceBalances}
          />
          <TablePreview rows={model.result.sacSchedule} />
        </>
      )}
      <UnlockCTA />
    </div>
  );
}
