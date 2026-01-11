import { useColorScheme } from 'react-native';

export const lightColors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',

  // Text
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Primary (blue)
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',

  // Success (green)
  success: '#22C55E',
  successLight: '#DCFCE7',
  successDark: '#059669',

  // Warning (orange/yellow)
  warning: '#F97316',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',

  // Error (red)
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorDark: '#DC2626',

  // Alternate rows
  rowAlt: '#FAFAFA',

  // Chart colors
  chartLine1: '#2563EB',
  chartLine2: '#EF4444',
  chartBar1: '#F97316',
  chartBar2: '#22C55E',

  // Tab bar
  tabActive: '#2563EB',
  tabInactive: '#6B7280',
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#111827',
  backgroundSecondary: '#1F2937',
  backgroundTertiary: '#374151',

  // Text
  text: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textTertiary: '#9CA3AF',
  textInverse: '#111827',

  // Borders
  border: '#374151',
  borderLight: '#4B5563',

  // Primary (blue) - slightly lighter for dark mode
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  primaryDark: '#60A5FA',

  // Success (green)
  success: '#22C55E',
  successLight: '#14532D',
  successDark: '#4ADE80',

  // Warning (orange/yellow)
  warning: '#FB923C',
  warningLight: '#78350F',
  warningDark: '#FDBA74',

  // Error (red)
  error: '#F87171',
  errorLight: '#7F1D1D',
  errorDark: '#FCA5A5',

  // Alternate rows
  rowAlt: '#1F2937',

  // Chart colors - brighter for dark mode
  chartLine1: '#60A5FA',
  chartLine2: '#F87171',
  chartBar1: '#FB923C',
  chartBar2: '#4ADE80',

  // Tab bar
  tabActive: '#60A5FA',
  tabInactive: '#9CA3AF',
};

export type ThemeColors = typeof lightColors;

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
  };
}
