export type ExportSheetOutcome =
  | 'blocked_busy'
  | 'blocked_unavailable'
  | 'blocked_validation'
  | 'cancel'
  | 'dismiss'
  | 'export'
  | 'upgrade';

export interface IosExportSheetSelection {
  buttonIndex: number;
  cancelButtonIndex: number;
  premiumButtonIndex: number;
  hasPremiumOption: boolean;
  optionCount: number;
}

export function resolveIosExportSheetOutcome({
  buttonIndex,
  cancelButtonIndex,
  premiumButtonIndex,
  hasPremiumOption,
  optionCount,
}: IosExportSheetSelection): ExportSheetOutcome {
  if (!Number.isSafeInteger(buttonIndex) || buttonIndex < 0 || buttonIndex >= optionCount) {
    return 'dismiss';
  }
  if (buttonIndex === cancelButtonIndex) return 'cancel';
  if (hasPremiumOption && buttonIndex === premiumButtonIndex) return 'upgrade';
  return 'export';
}

export function shouldTrackExportSheetAbandoned(outcome: ExportSheetOutcome) {
  return outcome === 'cancel' || outcome === 'dismiss';
}

export function claimExportClick(lock: { current: boolean }, isAlreadyBusy: boolean) {
  if (isAlreadyBusy || lock.current) return false;
  lock.current = true;
  return true;
}

export function canStartExportAttempt(validationErrorCount: number) {
  return validationErrorCount === 0;
}
