import { useEffect, useState } from 'react';
import { loadPremiumStatus, savePremiumStatus, subscribePremiumStatus } from '../lib/storage/premium';

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPremiumStatus()
      .then((status) => setIsPremium(status))
      .finally(() => setLoading(false));

    const unsubscribe = subscribePremiumStatus((value) => {
      setIsPremium(value);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const markPremium = async (value: boolean) => {
    setIsPremium(value);
    await savePremiumStatus(value);
  };

  return { isPremium, loading, markPremium };
}
