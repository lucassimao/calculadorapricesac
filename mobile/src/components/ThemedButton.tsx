import { useMemo } from 'react';
import { Pressable, PressableProps, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../lib/theme';

interface ThemedButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

export function ThemedButton({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  ...props
}: ThemedButtonProps) {
  const { colors, isDark } = useTheme();
  const isDisabled = disabled || loading;

  const buttonStyles = useMemo(() => {
    const baseStyles = {
      primary: {
        backgroundColor: isDisabled ? (isDark ? '#1E3A5F' : '#93C5FD') : colors.primary,
        borderColor: 'transparent',
      },
      secondary: {
        backgroundColor: 'transparent',
        borderColor: isDisabled ? colors.borderLight : colors.border,
      },
      destructive: {
        backgroundColor: isDisabled ? (isDark ? '#7F1D1D' : '#FECACA') : colors.error,
        borderColor: 'transparent',
      },
    };
    return baseStyles[variant];
  }, [variant, isDisabled, colors, isDark]);

  const textStyles = useMemo(() => {
    const baseStyles = {
      primary: {
        color: isDisabled ? (isDark ? '#93C5FD' : '#1D4ED8') : colors.textInverse,
      },
      secondary: {
        color: isDisabled ? colors.textTertiary : colors.textSecondary,
      },
      destructive: {
        color: isDisabled ? (isDark ? '#FCA5A5' : '#991B1B') : colors.textInverse,
      },
    };
    return baseStyles[variant];
  }, [variant, isDisabled, colors, isDark]);

  const sizeStyles = useMemo(() => {
    const sizes = {
      small: { paddingVertical: 8, paddingHorizontal: 12 },
      medium: { paddingVertical: 12, paddingHorizontal: 16 },
      large: { paddingVertical: 14, paddingHorizontal: 20 },
    };
    return sizes[size];
  }, [size]);

  const textSizeStyles = useMemo(() => {
    const sizes = {
      small: { fontSize: 13 },
      medium: { fontSize: 15 },
      large: { fontSize: 16 },
    };
    return sizes[size];
  }, [size]);

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        sizeStyles,
        buttonStyles,
        variant === 'secondary' && styles.buttonOutline,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator size="small" color={textStyles.color} style={styles.loader} />
        )}
        <Text style={[styles.text, textSizeStyles, textStyles]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loader: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  },
});
