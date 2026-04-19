import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ExportFormat } from '../lib/exports/access';

type ExportHandler = (format: ExportFormat) => Promise<void>;

interface ExportContextValue {
  /** Whether export is available (calculator has data loaded) */
  canExport: boolean;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Whether export can be unlocked via rewarded ad */
  canUseRewardedExport: boolean;
  /** Register the export handler from the calculator */
  registerExportHandler: (
    handler: ExportHandler,
    options: { isPremium: boolean; canUseRewardedExport: boolean },
  ) => void;
  /** Unregister the export handler */
  unregisterExportHandler: () => void;
  /** Trigger an export with the specified format */
  triggerExport: (format: ExportFormat) => Promise<void>;
  /** Set exporting state */
  setIsExporting: (value: boolean) => void;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export function ExportProvider({ children }: { children: ReactNode }) {
  const [exportHandler, setExportHandler] = useState<ExportHandler | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [canUseRewardedExport, setCanUseRewardedExport] = useState(false);

  const registerExportHandler = useCallback(
    (handler: ExportHandler, options: { isPremium: boolean; canUseRewardedExport: boolean }) => {
      setExportHandler(() => handler);
      setIsPremium(options.isPremium);
      setCanUseRewardedExport(options.canUseRewardedExport);
    },
    [],
  );

  const unregisterExportHandler = useCallback(() => {
    setExportHandler(null);
    setCanUseRewardedExport(false);
  }, []);

  const triggerExport = useCallback(
    async (format: ExportFormat) => {
      if (exportHandler) {
        await exportHandler(format);
      }
    },
    [exportHandler],
  );

  return (
    <ExportContext.Provider
      value={{
        canExport: exportHandler !== null,
        isExporting,
        isPremium,
        canUseRewardedExport,
        registerExportHandler,
        unregisterExportHandler,
        triggerExport,
        setIsExporting,
      }}
    >
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
}
