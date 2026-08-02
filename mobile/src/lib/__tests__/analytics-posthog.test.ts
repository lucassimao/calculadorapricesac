import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setAnalyticsPremiumPersonProperties,
  setAnalyticsProfessionalPersonProperties,
} from '../analytics';

const posthog = vi.hoisted(() => ({
  identify: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.2.0',
      extra: { posthogApiKey: 'phc_test_key' },
    },
  },
}));

vi.mock('expo-application', () => ({
  getInstallationTimeAsync: vi.fn(async () => new Date(0)),
}));

vi.mock('posthog-react-native', () => ({
  PostHog: class {
    getDistinctId() {
      return 'distinct-test-user';
    }

    identify(distinctId: string, properties: Record<string, unknown>) {
      posthog.identify(distinctId, properties);
    }

    register(properties: Record<string, unknown>) {
      posthog.register(properties);
    }
  },
}));

describe('PostHog person property transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identifies the active distinct ID with the complete professional profile shape', () => {
    expect(
      setAnalyticsProfessionalPersonProperties({
        name: 'Prime Credito',
        email: 'contato@prime.example',
        phone: '11999990000',
        registration: 'CRECI 123',
        website: 'prime.example',
      }),
    ).toBe(true);

    expect(posthog.identify).toHaveBeenCalledWith('distinct-test-user', {
      name: 'Prime Credito',
      email: 'contato@prime.example',
      phone: '11999990000',
      registration: 'CRECI 123',
      website: 'prime.example',
    });
  });

  it('keeps premium and professional person-property updates separate', () => {
    setAnalyticsPremiumPersonProperties({ is_premium: true, first_app_version: '1.2.0' });
    setAnalyticsProfessionalPersonProperties({
      name: 'Prime Credito',
      email: '',
      phone: '11999990000',
      registration: '',
      website: '',
    });

    expect(posthog.identify).toHaveBeenNthCalledWith(1, 'distinct-test-user', {
      is_premium: true,
      first_app_version: '1.2.0',
    });
    expect(posthog.identify).toHaveBeenNthCalledWith(2, 'distinct-test-user', {
      name: 'Prime Credito',
      email: '',
      phone: '11999990000',
      registration: '',
      website: '',
    });
  });
});
