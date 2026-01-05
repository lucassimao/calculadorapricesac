import { useEffect, useState } from 'react';
import { loadPremiumStatus, savePremiumStatus } from '../lib/storage/premium';

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPremiumStatus()
      .then((status) => setIsPremium(status))
      .finally(() => setLoading(false));
  }, []);

  const markPremium = async (value: boolean) => {
    setIsPremium(value);
    await savePremiumStatus(value);
  };

  return { isPremium, loading, markPremium };
}
