import { Stack } from 'expo-router';
import { Sentry, sentryInitialized } from '../src/lib/sentry';

function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;
