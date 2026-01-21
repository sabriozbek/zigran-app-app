import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function AppCard({ children, style, onPress, disabled, accessibilityLabel }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  if (typeof onPress === 'function') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

function createStyles(colors, isDark) {
  const shadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.12 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: isDark ? 1 : 2,
    },
    default: {},
  });

  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 14,
      ...shadow,
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
  });
}
