import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { authService } from '../api/authService';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarHeaders, setAvatarHeaders] = useState(null);
  const [profile, setProfile] = useState({
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    position: '',
    avatarUrl: '',
    timezone: 'Europe/Istanbul',
    locale: 'tr',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled([authService.me(), apiClient.get('/settings/profile')]);
        const meRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const profileRes = results[1].status === 'fulfilled' ? results[1].value?.data : null;
        if (!cancelled) {
          setMe(meRes);
          if (profileRes && typeof profileRes === 'object') {
            setProfile((p) => ({
              ...p,
              name: String(profileRes?.name || p.name || ''),
              firstName: String(profileRes?.firstName || p.firstName || ''),
              lastName: String(profileRes?.lastName || p.lastName || ''),
              phone: String(profileRes?.phone || p.phone || ''),
              position: String(profileRes?.position || p.position || ''),
              avatarUrl: String(profileRes?.avatarUrl || p.avatarUrl || ''),
              timezone: String(profileRes?.timezone || p.timezone || 'Europe/Istanbul'),
              locale: String(profileRes?.locale || p.locale || 'tr'),
            }));
          } else if (meRes && typeof meRes === 'object') {
            setProfile((p) => ({
              ...p,
              name: String(meRes?.name || p.name || ''),
              firstName: String(meRes?.firstName || p.firstName || ''),
              lastName: String(meRes?.lastName || p.lastName || ''),
              phone: String(meRes?.phone || p.phone || ''),
              position: String(meRes?.position || p.position || ''),
              avatarUrl: String(meRes?.avatarUrl || p.avatarUrl || ''),
            }));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const user = me?.user ?? me?.profile ?? me?.data?.user ?? me?.data?.profile ?? me?.data ?? me ?? null;
  const fullName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
    profile?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.name ||
    'Kullanıcı';
  const initials = String(fullName).trim().slice(0, 2).toUpperCase().replace(/\s+/g, '');
  const avatarUrl = String(profile?.avatarUrl || '').trim();
  const showAvatar = !!avatarSrc && (avatarSrc.startsWith('http://') || avatarSrc.startsWith('https://') || avatarSrc.startsWith('data:'));

  useEffect(() => {
    let active = true;

    async function loadAvatar() {
      const ref = String(avatarUrl || '').trim();
      if (active) setAvatarHeaders(null);
      if (!ref) {
        if (active) setAvatarSrc('');
        return;
      }
      if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) {
        if (active) setAvatarSrc(ref);
        return;
      }

      const isDocumentRef =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref) || /^[0-9]+$/.test(ref);
      const baseUrl = String(apiClient?.defaults?.baseURL || '').replace(/\/$/, '');
      const rootUrl = baseUrl.replace(/\/api$/i, '');

      if (!isDocumentRef) {
        const normalizedPath = ref.startsWith('/') ? ref : `/${ref}`;
        const shouldUseRoot = /\/uploads\/|\/media\/|\/static\/|\/files\//i.test(normalizedPath) && /\/api$/i.test(baseUrl);
        const absolute = baseUrl ? `${shouldUseRoot ? rootUrl : baseUrl}${normalizedPath}` : ref;
        if (absolute && (absolute.startsWith('http://') || absolute.startsWith('https://'))) {
          if (active) setAvatarSrc(absolute);
        } else {
          if (active) setAvatarSrc(ref);
        }
        return;
      }

      try {
        const token = await authService.getToken();
        const downloadUrl = `${baseUrl}/documents/${ref}/download`;
        if (Platform.OS !== 'web') {
          if (active) {
            setAvatarSrc(downloadUrl);
            setAvatarHeaders(token ? { Authorization: `Bearer ${token}` } : null);
          }
          return;
        }
        const res = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('download_failed');
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (active) setAvatarSrc(typeof dataUrl === 'string' ? dataUrl : '');
      } catch {
        if (active) setAvatarSrc('');
      }
    }

    loadAvatar();
    return () => {
      active = false;
    };
  }, [avatarUrl]);

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return String(value);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.photoCard}>
            <View style={styles.photoCircle}>
              {showAvatar ? (
                <Image source={{ uri: avatarSrc, ...(avatarHeaders ? { headers: avatarHeaders } : {}) }} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <Text style={styles.photoInitials}>{initials || 'PR'}</Text>
              )}
            </View>
            <Text style={styles.title}>{fullName}</Text>
            {user?.email ? <Text style={styles.meta}>{String(user.email)}</Text> : null}
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={() => navigation?.navigate?.('Settings', { tab: 'profile' })}
              >
                <Text style={styles.secondaryButtonText}>Ayarlara Git</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profil Ayarları</Text>
            <Text style={styles.meta}>Sadece kişisel bilgileri güncelle.</Text>

            <Text style={styles.label}>Ad</Text>
            <TextInput
              style={styles.input}
              placeholder="Ad"
              placeholderTextColor={colors.textSecondary}
              value={profile.firstName}
              onChangeText={(t) => setProfile((p) => ({ ...p, firstName: t }))}
            />

            <Text style={styles.label}>Soyad</Text>
            <TextInput
              style={styles.input}
              placeholder="Soyad"
              placeholderTextColor={colors.textSecondary}
              value={profile.lastName}
              onChangeText={(t) => setProfile((p) => ({ ...p, lastName: t }))}
            />

            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              placeholder="Telefon"
              placeholderTextColor={colors.textSecondary}
              value={profile.phone}
              keyboardType="phone-pad"
              onChangeText={(t) => setProfile((p) => ({ ...p, phone: t }))}
            />

            <Text style={styles.label}>Pozisyon</Text>
            <TextInput
              style={styles.input}
              placeholder="Pozisyon"
              placeholderTextColor={colors.textSecondary}
              value={profile.position}
              onChangeText={(t) => setProfile((p) => ({ ...p, position: t }))}
            />

            <Text style={styles.label}>Avatar URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={colors.textSecondary}
              value={profile.avatarUrl}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(t) => setProfile((p) => ({ ...p, avatarUrl: t }))}
            />

            <TouchableOpacity
              style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
              activeOpacity={0.85}
              disabled={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await apiClient.patch('/settings/profile', {
                    name: profile.name,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    phone: profile.phone,
                    position: profile.position,
                    avatarUrl: profile.avatarUrl,
                  });
                  Alert.alert('Kaydedildi', 'Profil ayarları güncellendi.');
                } catch {
                  Alert.alert('Hata', 'Profil kaydetme başarısız.');
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hesap</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>E‑posta</Text>
              <Text style={styles.kvValue}>{String(user?.email || '-')}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Rol</Text>
              <Text style={styles.kvValue}>{String(user?.role || '-')}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Şirket</Text>
              <Text style={styles.kvValue}>{String(user?.company?.name || user?.companyName || me?.companyName || '-')}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Kayıt Tarihi</Text>
              <Text style={styles.kvValue}>{formatDate(user?.createdAt)}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
    },
    content: {
      paddingBottom: 20,
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
    },
    photoCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      gap: 10,
    },
    photoCircle: {
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 4,
      borderColor: colors.background,
      backgroundColor: colors.primary + '12',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoInitials: {
      color: colors.textSecondary,
      fontSize: 32,
      fontWeight: '900',
    },
    photoActions: {
      width: '100%',
      marginTop: 8,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    meta: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    label: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    primaryButton: {
      marginTop: 14,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    secondaryButton: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    kvRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    kvLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    kvValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
  });
}

export default ProfileScreen;
