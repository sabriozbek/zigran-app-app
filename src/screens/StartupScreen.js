import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, NativeModules, Platform, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../api/authService';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const ONBOARDING_KEY = 'zigran_onboarding_done';
const NOTIFICATIONS_PERMISSION_KEY = 'zigran_notifications_permission';
const PUSH_TOKENS_KEY = 'zigran_push_tokens_cache';

const LOGO_SOURCE = require('../../assets/icon.png');

const isExpoGo =
  String(NativeModules?.ExponentConstants?.appOwnership || NativeModules?.ExpoConstants?.appOwnership || '').toLowerCase() === 'expo';

function readExpoManifest() {
  const constants = NativeModules?.ExponentConstants || NativeModules?.ExpoConstants || {};
  const manifest = constants?.manifest ?? constants?.manifest2 ?? constants?.expoConfig ?? constants?.appConfig ?? null;
  if (manifest && typeof manifest === 'object') return manifest;
  if (typeof manifest === 'string') {
    try {
      const parsed = JSON.parse(manifest);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

function getEasProjectId() {
  const manifest = readExpoManifest();
  const id = manifest?.extra?.eas?.projectId ?? manifest?.extra?.easProjectId ?? manifest?.extra?.projectId ?? '';
  return typeof id === 'string' ? id : '';
}

async function requestWithFallbackStatuses(steps, extraStatuses) {
  const extra = Array.isArray(extraStatuses) ? new Set(extraStatuses.map((x) => Number(x))) : new Set();
  let lastError;
  for (const step of steps) {
    try {
      const response = await apiClient.request(step);
      return response?.data;
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status);
      const canFallback = status === 404 || status === 405 || status === 501 || extra.has(status);
      if (!canFallback) throw err;
    }
  }
  throw lastError;
}

function extractApiErrorMessage(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  let msg = '';
  if (typeof data === 'string') msg = data;
  else if (data && typeof data === 'object') {
    if (typeof data.message === 'string') msg = data.message;
    else if (typeof data.error === 'string') msg = data.error;
    else if (typeof data.detail === 'string') msg = data.detail;
    else if (Array.isArray(data.errors) && data.errors.length) msg = String(data.errors[0]?.message || data.errors[0] || '');
  }
  if (!msg && typeof err?.message === 'string') msg = err.message;
  msg = String(msg || '').trim();
  if (status && msg) return `${status}: ${msg}`;
  if (status) return String(status);
  return msg;
}

function isIgnorablePushRegisterStatus(status) {
  const s = Number(status);
  return s === 404 || s === 405 || s === 501;
}

async function registerPushTokens() {
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    if (existing?.status !== 'granted') return { ok: false, reason: 'Bildirim izni yok' };

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance?.MAX ?? 4,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch {}
    }

    let devicePushToken = '';
    try {
      const token = await Notifications.getDevicePushTokenAsync();
      if (typeof token?.data === 'string') devicePushToken = token.data;
    } catch {}

    let expoPushToken = '';
    try {
      const projectId = getEasProjectId();
      const token = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      if (typeof token?.data === 'string') expoPushToken = token.data;
    } catch {}

    const corePayload = {
      platform: Platform.OS,
      devicePushToken: devicePushToken || undefined,
      expoPushToken: expoPushToken || undefined,
    };
    const token = expoPushToken || devicePushToken || '';
    const payload = {
      ...corePayload,
      ...(token ? { token, pushToken: token } : {}),
      ...(expoPushToken ? { expoToken: expoPushToken } : {}),
      ...(Platform.OS === 'android' && devicePushToken ? { fcmToken: devicePushToken } : {}),
      ...(Platform.OS === 'ios' && devicePushToken ? { apnsToken: devicePushToken } : {}),
    };
    if (!payload.devicePushToken && !payload.expoPushToken && !payload.token) {
      return { ok: false, reason: 'Push token alınamadı (emülatör olabilir)' };
    }

    let cached = '';
    try {
      cached = (await SecureStore.getItemAsync(PUSH_TOKENS_KEY)) || '';
    } catch {}
    const next = JSON.stringify(corePayload);
    if (cached === next) return { ok: true, payload: corePayload };

    const steps = [
      { method: 'post', url: '/notifications/push-tokens', data: payload },
      { method: 'post', url: '/notifications/register', data: payload },
      { method: 'post', url: '/push/register', data: payload },
      { method: 'post', url: '/devices/push-token', data: payload },
      { method: 'post', url: '/devices/push-tokens', data: payload },
      ...(token
        ? [
            { method: 'post', url: '/notifications/register', data: { token, platform: Platform.OS } },
            { method: 'post', url: '/push/register', data: { token, platform: Platform.OS } },
            { method: 'post', url: '/devices/push-token', data: { token, platform: Platform.OS } },
          ]
        : []),
    ];
    try {
      await requestWithFallbackStatuses(steps, [400, 409, 415, 422]);
    } catch (err) {
      const status = err?.response?.status;
      if (!isIgnorablePushRegisterStatus(status)) {
        const reason = extractApiErrorMessage(err) || 'Kayıt isteği başarısız';
        return { ok: false, reason };
      }
    }

    try {
      await SecureStore.setItemAsync(PUSH_TOKENS_KEY, next);
    } catch {}
    return { ok: true, payload: corePayload };
  } catch (err) {
    const reason = extractApiErrorMessage(err) || 'Kayıt isteği başarısız';
    return { ok: false, reason };
  }
}

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
          if (!stored && !isExpoGo) {
            const Notifications = await import('expo-notifications');
            const existing = await Notifications.getPermissionsAsync();
            const existingStatus = existing?.status;
            if (existingStatus) await SecureStore.setItemAsync(NOTIFICATIONS_PERMISSION_KEY, String(existingStatus));
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
        registerPushTokens().catch(() => {});
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
