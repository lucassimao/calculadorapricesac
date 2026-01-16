import { Redirect } from 'expo-router';

/**
 * This is a placeholder screen for the Export tab.
 * The actual export functionality is handled by an action sheet in the tab bar.
 * If somehow navigated to, redirect back to the calculator.
 */
export default function ExportActionScreen() {
  return <Redirect href="/(tabs)/calculator" />;
}
