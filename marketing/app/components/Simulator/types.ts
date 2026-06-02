export interface SimulatorInputs {
  /** Valor do imóvel, em reais. */
  propertyValue: number;
  /** Entrada, em reais. */
  downPayment: number;
  /** Taxa de juros anual, em % (ex.: 11.5 = 11,5% a.a.). */
  annualRate: number;
  /** Prazo, em anos. */
  termYears: number;
}

export const DEFAULT_INPUTS: SimulatorInputs = {
  propertyValue: 400000,
  downPayment: 80000,
  annualRate: 11.5,
  termYears: 30,
};
