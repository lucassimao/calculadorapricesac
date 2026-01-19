import { useColorScheme } from 'react-native';

/**
 * Theme color definitions with WCAG AA compliant contrast ratios.
 *
 * Contrast requirements:
 * - Normal text: 4.5:1 minimum
 * - Large text (18px+ or 14px+ bold): 3:1 minimum
 * - UI components: 3:1 minimum
 */

export const lightColors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',

  // Text - WCAG AA compliant on white background
  text: '#111827', // ~16:1 ratio
  textSecondary: '#374151', // ~8:1 ratio
  textTertiary: '#4B5563', // ~6:1 ratio (improved from #6B7280)
  textInverse: '#FFFFFF',

  // Borders
  border: '#D1D5DB', // Improved visibility
  borderLight: '#E5E7EB',

  // Primary (blue) - 4.5:1 contrast on white
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',

  // Success (green) - 3:1 contrast for UI
  success: '#16A34A', // Darker green for better contrast
  successLight: '#DCFCE7',
  successDark: '#059669',

  // Warning (orange) - 3:1 contrast for UI
  warning: '#EA580C', // Darker orange for better contrast
  warningLight: '#FEF3C7',
  warningDark: '#C2410C',

  // Error (red) - 4.5:1 contrast on white
  error: '#DC2626', // Darker red for text use
  errorLight: '#FEE2E2',
  errorDark: '#B91C1C',

  // Alternate rows
  rowAlt: '#F9FAFB',

  // Chart colors - sufficient contrast on light backgrounds
  chartLine1: '#1D4ED8', // Darker blue for visibility
  chartLine2: '#DC2626', // Darker red for visibility
  chartBar1: '#EA580C', // Darker orange
  chartBar2: '#16A34A', // Darker green

  // Tab bar
  tabActive: '#2563EB',
  tabInactive: '#4B5563', // Improved contrast
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#0F172A', // Slightly darker for better contrast
  backgroundSecondary: '#1E293B',
  backgroundTertiary: '#334155',

  // Text - WCAG AA compliant on dark background
  text: '#F8FAFC', // ~15:1 ratio
  textSecondary: '#E2E8F0', // ~12:1 ratio
  textTertiary: '#94A3B8', // ~7:1 ratio
  textInverse: '#0F172A',

  // Borders
  border: '#475569',
  borderLight: '#334155',

  // Primary (blue) - bright for dark mode
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  primaryDark: '#60A5FA',

  // Success (green) - bright for dark mode
  success: '#22C55E',
  successLight: '#14532D',
  successDark: '#4ADE80',

  // Warning (orange) - bright for dark mode
  warning: '#FB923C',
  warningLight: '#78350F',
  warningDark: '#FDBA74',

  // Error (red) - bright for dark mode
  error: '#F87171',
  errorLight: '#7F1D1D',
  errorDark: '#FCA5A5',

  // Alternate rows
  rowAlt: '#1E293B',

  // Chart colors - high visibility on dark backgrounds
  chartLine1: '#60A5FA',
  chartLine2: '#F87171',
  chartBar1: '#FB923C',
  chartBar2: '#4ADE80',

  // Tab bar
  tabActive: '#60A5FA',
  tabInactive: '#94A3B8',
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
