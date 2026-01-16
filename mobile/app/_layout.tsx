import { Stack } from 'expo-router';
import { Sentry, sentryInitialized } from '../src/lib/sentry';
import { ExportProvider } from '../src/contexts/ExportContext';

function RootLayout() {
  return (
    <ExportProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ExportProvider>
  );
}

export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;
