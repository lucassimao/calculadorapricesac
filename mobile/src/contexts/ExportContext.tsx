import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ExportFormat = 'pdf' | 'xlsx' | 'csv';
type ExportHandler = (format: ExportFormat) => Promise<void>;

interface ExportContextValue {
  /** Whether export is available (calculator has data loaded) */
  canExport: boolean;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Whether user has premium access */
  isPremium: boolean;
  /** Register the export handler from the calculator */
  registerExportHandler: (handler: ExportHandler, premium: boolean) => void;
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

  const registerExportHandler = useCallback((handler: ExportHandler, premium: boolean) => {
    setExportHandler(() => handler);
    setIsPremium(premium);
  }, []);

  const unregisterExportHandler = useCallback(() => {
    setExportHandler(null);
  }, []);

  const triggerExport = useCallback(async (format: ExportFormat) => {
    if (exportHandler) {
      await exportHandler(format);
    }
  }, [exportHandler]);

  return (
    <ExportContext.Provider
      value={{
        canExport: exportHandler !== null,
        isExporting,
        isPremium,
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
