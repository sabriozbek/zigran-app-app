import React, { useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

const ONBOARDING_KEY = 'zigran_onboarding_done';
const NOTIFICATIONS_PERMISSION_KEY = 'zigran_notifications_permission';

const LOGO_SOURCE = require('../../assets/icon.png');

const StartupScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const onboardingDone = await SecureStore.getItemAsync(ONBOARDING_KEY);
        if (!onboardingDone) {
          if (!cancelled) navigation.replace('Onboarding');
          return;
        }

        try {
          const stored = await SecureStore.getItemAsync(NOTIFICATIONS_PERMISSION_KEY);
          if (!stored) {
            const existing = await Notifications.getPermissionsAsync();
            const existingStatus = existing?.status;
            if (existingStatus) {
              await SecureStore.setItemAsync(NOTIFICATIONS_PERMISSION_KEY, String(existingStatus));
            }
            if (existingStatus !== 'granted') {
              const req = await Notifications.requestPermissionsAsync();
              const nextStatus = req?.status;
              if (nextStatus) await SecureStore.setItemAsync(NOTIFICATIONS_PERMISSION_KEY, String(nextStatus));
            }
          }
        } catch {}

        const token = await authService.getToken();
        if (!token) {
          if (!cancelled) navigation.replace('Login');
          return;
        }

        await authService.me();
        if (!cancelled) navigation.replace('Main');
      } catch {
        try {
          await authService.logout();
        } catch {}
        if (!cancelled) navigation.replace('Login');
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image source={LOGO_SOURCE} style={styles.logo} />
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: 18,
      resizeMode: 'contain',
    },
  });
}

export default StartupScreen;
