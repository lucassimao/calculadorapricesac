import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { useAdTest } from '../contexts/AdTestContext';
import { getAdUnitId, isRewardedExportEnabled } from '../lib/ads';
import { getNextRewardedChoiceCount, trackEvent } from '../lib/analytics';
import type { ExportFormat } from '../lib/exports/access';
import {
  canUseRewardedExportPlacement,
  REWARDED_EXPORT_TIMEOUT_MS,
  shouldLoadPendingRewardedRequest,
  shouldStartRewardedTimeout,
} from './rewarded-export-state';

interface RewardedExportRequest {
  format: ExportFormat;
  source: string;
  onUnlocked: () => Promise<void>;
}

function formatExportTypeLabel(format: ExportFormat) {
  return format.toUpperCase();
}

function getRewardedErrorKind(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('timeout')) return 'load_timeout';
  if (
    normalized.includes('no fill') ||
    normalized.includes('no-fill') ||
    normalized.includes('no_fill')
  ) {
    return 'no_fill';
  }
  if (normalized.includes('network')) return 'network';
  return 'unknown';
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

  const handleRewardedFailure = useCallback(
    (errorMessage: string) => {
      if (!pendingFormat || handledRequestRef.current) return;

      handledRequestRef.current = true;
      const request = requestRef.current;
      trackEvent('rewarded_export_ad_failed', {
        format: request?.format ?? pendingFormat,
        source: request?.source ?? 'unknown',
        error_kind: getRewardedErrorKind(errorMessage),
        error_message: errorMessage,
      });
      Alert.alert(
        'Anúncio indisponível',
        'Não foi possível carregar o anúncio agora. Tente novamente em instantes ou assine o Premium.',
      );
      clearPending();
      if (!canUseRealRewarded) return;
      load();
    },
    [pendingFormat, clearPending, canUseRealRewarded, load],
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
      handleRewardedFailure('timeout');
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
    handleRewardedFailure(error.message);
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
            trackEvent('rewarded_export_ad_failed', {
              format,
              source,
              stub: true,
              error_kind: 'unknown',
              error_message: 'stub_failure',
            });
            Alert.alert(
              'Anúncio indisponível',
              'Não foi possível carregar o anúncio agora. Tente novamente em instantes ou assine o Premium.',
            );
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
    ],
  );

  return {
    canUseRewardedExport,
    rewardedExportFormat: pendingFormat,
    requestRewardedExport,
  };
}
