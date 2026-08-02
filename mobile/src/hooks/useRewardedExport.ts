import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { useAdTest } from '../contexts/AdTestContext';
import { getAdUnitId, isRewardedExportEnabled } from '../lib/ads';
import { getNextRewardedChoiceCount, trackEvent, type RewardedFailureKind } from '../lib/analytics';
import type { ExportFormat } from '../lib/exports/access';
import {
  grantRewardedCourtesyExport,
  isCourtesyEligibleRewardedFailure,
} from '../lib/storage/rewarded-courtesy';
import {
  canUseRewardedExportPlacement,
  classifyRewardedFailure,
  REWARDED_EXPORT_TIMEOUT_MS,
  shouldLoadPendingRewardedRequest,
  shouldStartRewardedTimeout,
} from './rewarded-export-state';

interface RewardedExportRequest {
  format: ExportFormat;
  source: string;
  onUnlocked: () => Promise<boolean>;
}

function formatExportTypeLabel(format: ExportFormat) {
  return format.toUpperCase();
}

function confirmCourtesyExport() {
  return new Promise<void>((resolve) => {
    Alert.alert(
      'Hoje é por nossa conta 🎁',
      'Não encontramos um anúncio agora, então liberamos esta exportação grátis. No Premium, você exporta sempre, sem anúncios e sem marca d’água.',
      [{ text: 'Exportar grátis', onPress: () => resolve() }],
      { cancelable: false },
    );
  });
}

export function useRewardedExport(isPremium: boolean) {
  const { loading: adTestLoading, stubModeEnabled, showRewardedStub } = useAdTest();
  const rewardedEnabled = isRewardedExportEnabled();
  const rewardedUnitId = rewardedEnabled && !stubModeEnabled ? getAdUnitId('rewarded') : null;
  const { isLoaded, isOpened, isClosed, isEarnedReward, error, load, show } =
    useRewardedAd(rewardedUnitId);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const requestRef = useRef<RewardedExportRequest | null>(null);
  const handledRequestRef = useRef(false);
  const rewardEarnedRef = useRef(false);
  const openedTrackedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canUseRewardedExport = canUseRewardedExportPlacement({
    enabled: rewardedEnabled,
    adTestLoading,
    isPremium,
    stubModeEnabled,
    rewardedUnitId,
  });
  const canUseRealRewarded = canUseRewardedExport && !stubModeEnabled;

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingFormat(null);
    requestRef.current = null;
    handledRequestRef.current = false;
    rewardEarnedRef.current = false;
    openedTrackedRef.current = false;
  }, []);

  const resolveRewardedFailure = useCallback(
    async ({
      request,
      errorKind,
      errorCode,
      errorMessage,
      stub = false,
    }: {
      request: RewardedExportRequest | null;
      errorKind: RewardedFailureKind;
      errorCode?: string;
      errorMessage: string;
      stub?: boolean;
    }) => {
      trackEvent('rewarded_export_ad_failed', {
        format: request?.format ?? pendingFormat ?? 'pdf',
        source: request?.source ?? 'unknown',
        error_kind: errorKind,
        ...(errorCode ? { error_code: errorCode } : {}),
        error_message: errorMessage,
        ...(stub ? { stub: true } : {}),
      });

      if (request && isCourtesyEligibleRewardedFailure(errorKind)) {
        const courtesyResult = await grantRewardedCourtesyExport(async () => {
          await confirmCourtesyExport();
          return request.onUnlocked();
        });
        if (courtesyResult !== 'cap_reached') return;
      }

      Alert.alert(
        'Anúncio indisponível',
        'Não foi possível carregar o anúncio agora. Tente novamente em instantes ou assine o Premium.',
      );
    },
    [pendingFormat],
  );

  const handleRewardedFailure = useCallback(
    (errorKind: RewardedFailureKind, errorMessage: string, errorCode?: string) => {
      if (!pendingFormat || handledRequestRef.current) return;

      handledRequestRef.current = true;
      const request = requestRef.current;
      void (async () => {
        try {
          await resolveRewardedFailure({ request, errorKind, errorCode, errorMessage });
        } finally {
          clearPending();
          if (canUseRealRewarded) load();
        }
      })();
    },
    [pendingFormat, resolveRewardedFailure, clearPending, canUseRealRewarded, load],
  );

  useEffect(() => {
    if (!canUseRealRewarded || pendingFormat) return;
    if (isLoaded || isOpened) return;
    load();
  }, [canUseRealRewarded, pendingFormat, isLoaded, isOpened, load]);

  useEffect(() => {
    if (
      !shouldLoadPendingRewardedRequest({
        pendingFormat,
        canUseRealRewarded,
        isLoaded,
        isOpened,
      })
    )
      return;
    load();
  }, [pendingFormat, canUseRealRewarded, isLoaded, isOpened, load]);

  useEffect(() => {
    if (!pendingFormat || !isLoaded || isOpened || !canUseRealRewarded) return;
    show();
  }, [pendingFormat, isLoaded, isOpened, canUseRealRewarded, show]);

  useEffect(() => {
    if (!shouldStartRewardedTimeout({ pendingFormat, canUseRealRewarded, isOpened })) return;

    timeoutRef.current = setTimeout(() => {
      handleRewardedFailure('load_timeout', 'Rewarded ad load timed out', 'load-timeout');
    }, REWARDED_EXPORT_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pendingFormat, canUseRealRewarded, isOpened, handleRewardedFailure]);

  useEffect(() => {
    if (!pendingFormat || !isOpened || openedTrackedRef.current) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    openedTrackedRef.current = true;
    const request = requestRef.current;
    trackEvent('rewarded_export_ad_opened', {
      format: request?.format ?? pendingFormat,
      source: request?.source ?? 'unknown',
    });
  }, [pendingFormat, isOpened]);

  useEffect(() => {
    if (!pendingFormat || !isEarnedReward) return;
    rewardEarnedRef.current = true;
    const request = requestRef.current;
    trackEvent('rewarded_export_ad_reward_earned', {
      format: request?.format ?? pendingFormat,
      source: request?.source ?? 'unknown',
    });
  }, [pendingFormat, isEarnedReward]);

  useEffect(() => {
    if (!pendingFormat || !error) return;
    const { errorKind, errorCode } = classifyRewardedFailure(error);
    handleRewardedFailure(errorKind, error.message, errorCode);
  }, [pendingFormat, error, handleRewardedFailure]);

  useEffect(() => {
    if (!pendingFormat || !isClosed || handledRequestRef.current) return;
    handledRequestRef.current = true;
    const request = requestRef.current;
    void (async () => {
      try {
        if (!request) return;

        if (!rewardEarnedRef.current) {
          trackEvent('rewarded_export_ad_cancelled', {
            format: request.format,
            source: request.source,
          });
          Alert.alert(
            'Exportação não liberada',
            'Conclua o anúncio para exportar grátis ou assine o Premium para liberar exportações ilimitadas.',
          );
          return;
        }

        trackEvent('rewarded_export_unlocked', {
          format: request.format,
          source: request.source,
        });
        await request.onUnlocked();
      } finally {
        clearPending();
        if (!canUseRealRewarded) return;
        load();
      }
    })();
  }, [pendingFormat, isClosed, clearPending, canUseRealRewarded, load]);

  const requestRewardedExport = useCallback(
    async ({ format, source, onUnlocked }: RewardedExportRequest) => {
      if (!canUseRewardedExport || pendingFormat) return false;

      requestRef.current = { format, source, onUnlocked };
      setPendingFormat(format);
      rewardEarnedRef.current = false;
      handledRequestRef.current = false;
      openedTrackedRef.current = false;

      trackEvent('rewarded_export_requested', {
        format,
        source,
        export_type: formatExportTypeLabel(format),
      });
      trackEvent('rewarded_ad_chosen_over_premium', {
        source,
        nth_time: await getNextRewardedChoiceCount(),
      });

      if (stubModeEnabled) {
        const stubResult = await showRewardedStub();

        try {
          if (stubResult === 'earned') {
            rewardEarnedRef.current = true;
            trackEvent('rewarded_export_ad_opened', { format, source, stub: true });
            trackEvent('rewarded_export_ad_reward_earned', { format, source, stub: true });
            trackEvent('rewarded_export_unlocked', { format, source, stub: true });
            await onUnlocked();
          } else if (stubResult === 'cancelled') {
            trackEvent('rewarded_export_ad_opened', { format, source, stub: true });
            trackEvent('rewarded_export_ad_cancelled', { format, source, stub: true });
            Alert.alert(
              'Exportação não liberada',
              'Conclua o anúncio para exportar grátis ou assine o Premium para liberar exportações ilimitadas.',
            );
          } else if (stubResult === 'error') {
            await resolveRewardedFailure({
              request: { format, source, onUnlocked },
              errorKind: 'unknown',
              errorCode: 'stub-failure',
              errorMessage: 'stub_failure',
              stub: true,
            });
          } else if (stubResult === 'no-fill') {
            await resolveRewardedFailure({
              request: { format, source, onUnlocked },
              errorKind: 'no_fill',
              errorCode: 'googleMobileAds/error-code-no-fill',
              errorMessage: 'stub_no_fill',
              stub: true,
            });
          } else {
            return false;
          }
        } finally {
          clearPending();
        }

        return true;
      }

      if (!isLoaded && !isOpened) {
        load();
      }

      return true;
    },
    [
      canUseRewardedExport,
      pendingFormat,
      stubModeEnabled,
      showRewardedStub,
      clearPending,
      isLoaded,
      isOpened,
      load,
      resolveRewardedFailure,
    ],
  );

  return {
    canUseRewardedExport,
    rewardedExportFormat: pendingFormat,
    requestRewardedExport,
  };
}
