import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const DEFAULT_TIMEZONES = [
  'Europe/Istanbul',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo',
];

const NOTIFICATIONS_PERMISSION_KEY = 'zigran_notifications_permission';

const SettingsScreen = ({ navigation, route }) => {
  const { colors, isDark, toggleTheme, paletteId, palettes, setPaletteId } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState(String(route?.params?.tab || 'profile'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    position: '',
    avatarUrl: '',
    timezone: 'Europe/Istanbul',
    locale: 'tr',
    emailPrefs: { digest: true, notifications: true },
  });
  const [company, setCompany] = useState({
    logoUrl: '',
    primaryColor: '#2563EB',
    timezone: 'Europe/Istanbul',
    locale: 'tr',
    currency: 'TRY',
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSendingTest, setSmtpSendingTest] = useState(false);
  const [smtpVerifyMsg, setSmtpVerifyMsg] = useState('');
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'Zigran',
    fromEmail: 'noreply@zigran.com',
  });
  const [smtpLogs, setSmtpLogs] = useState([]);
  const [smtpTestTo, setSmtpTestTo] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const tabs = useMemo(() => {
    return [
      { key: 'profile', label: 'Profil' },
      { key: 'security', label: 'Güvenlik' },
      { key: 'notifications', label: 'Bildirimler' },
      { key: 'appearance', label: 'Görünüm' },
      { key: 'api', label: 'API' },
      { key: 'email', label: 'E‑posta' },
      { key: 'company', label: 'Şirket' },
    ];
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const r = await apiClient.get('/settings/profile');
      const d = r?.data || {};
      setProfile((p) => ({
        ...p,
        name: String(d?.name || p.name || ''),
        firstName: String(d?.firstName || p.firstName || ''),
        lastName: String(d?.lastName || p.lastName || ''),
        phone: String(d?.phone || p.phone || ''),
        position: String(d?.position || p.position || ''),
        avatarUrl: String(d?.avatarUrl || p.avatarUrl || ''),
        timezone: String(d?.timezone || p.timezone || 'Europe/Istanbul'),
        locale: String(d?.locale || p.locale || 'tr'),
        emailPrefs: { ...(p.emailPrefs || {}), ...(d?.emailPrefs || {}) },
      }));
    } catch {}
  }, []);

  const fetchCompany = useCallback(async () => {
    try {
      const r = await apiClient.get('/settings/company');
      const d = r?.data || {};
      setCompany((p) => ({
        ...p,
        logoUrl: String(d?.logoUrl || p.logoUrl || ''),
        primaryColor: String(d?.primaryColor || p.primaryColor || '#2563EB'),
        timezone: String(d?.timezone || p.timezone || 'Europe/Istanbul'),
        locale: String(d?.locale || p.locale || 'tr'),
        currency: String(d?.currency || p.currency || 'TRY'),
      }));
    } catch {}
  }, []);

  const fetchSmtp = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const r = await apiClient.get('/email/smtp');
      const d = r?.data || {};
      setSmtp((p) => ({
        ...p,
        host: String(d?.host || ''),
        port: typeof d?.port === 'number' ? d.port : parseInt(String(d?.port || 587), 10) || 587,
        secure: !!d?.secure,
        user: String(d?.user || ''),
        pass: String(d?.pass || ''),
        fromName: String(d?.fromName || 'Zigran'),
        fromEmail: String(d?.fromEmail || 'noreply@zigran.com'),
      }));
    } catch {}
    finally {
      setSmtpLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await apiClient.get('/email/logs');
      const list = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.data) ? r.data.data : [];
      setSmtpLogs(list);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchProfile(), fetchCompany()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCompany, fetchProfile]);

  useEffect(() => {
    if (activeTab !== 'email') return;
    fetchSmtp();
    fetchLogs();
  }, [activeTab, fetchLogs, fetchSmtp]);

  useEffect(() => {
    const requested = String(route?.params?.tab || '').trim();
    if (requested) setActiveTab(requested);
  }, [route?.params?.tab]);

  const saveProfile = useCallback(async () => {
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
  }, [profile]);

  const saveAccount = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch('/settings/profile', {
        timezone: String(profile.timezone || 'Europe/Istanbul').trim(),
        locale: String(profile.locale || 'tr').trim(),
      });
      await fetchProfile();
      Alert.alert('Kaydedildi', 'Hesap bilgileri güncellendi.');
    } catch {
      Alert.alert('Hata', 'Hesap bilgileri kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [fetchProfile, profile.locale, profile.timezone]);

  const savePrefs = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch('/settings/profile', { emailPrefs: profile.emailPrefs });
      Alert.alert('Kaydedildi', 'Tercihler güncellendi.');
    } catch {
      Alert.alert('Hata', 'Tercihler kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [profile.emailPrefs]);

  const setEmailPref = useCallback((key, value) => {
    setProfile((p) => ({ ...p, emailPrefs: { ...(p.emailPrefs || {}), [key]: !!value } }));
  }, []);

  const handlePrefToggle = useCallback((key, nextValue) => {
    if (key !== 'notifications' || !nextValue) {
      setEmailPref(key, nextValue);
      return;
    }

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing?.status;
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req?.status;
        }

        if (status) {
          try {
            await SecureStore.setItemAsync(NOTIFICATIONS_PERMISSION_KEY, String(status));
          } catch {}
        }

        if (status === 'granted') {
          setEmailPref('notifications', true);
          return;
        }
      } catch {}

      setEmailPref('notifications', false);
      Alert.alert('İzin gerekli', 'Bildirimleri açmak için bildirim izni vermelisiniz.', [
        { text: 'Kapat', style: 'cancel' },
        { text: 'Ayarlar', onPress: () => Linking.openSettings?.() },
      ]);
    })();
  }, [setEmailPref]);

  const saveCompany = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.patch('/settings/company', company);
      Alert.alert('Kaydedildi', 'Şirket ayarları güncellendi.');
    } catch {
      Alert.alert('Hata', 'Şirket ayarlarını kaydetme başarısız.');
    } finally {
      setSaving(false);
    }
  }, [company]);

  const changePassword = useCallback(async () => {
    const currentPassword = String(passwordForm.currentPassword || '');
    const newPassword = String(passwordForm.newPassword || '');
    const confirmPassword = String(passwordForm.confirmPassword || '');
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Eksik bilgi', 'Tüm alanlar zorunlu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor.');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiClient.patch('/settings/profile/password', { currentPassword, newPassword, confirmPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      Alert.alert('Güncellendi', 'Şifreniz değiştirildi.');
    } catch {
      Alert.alert('Hata', 'Şifre değiştirilemedi.');
    } finally {
      setPasswordSaving(false);
    }
  }, [passwordForm]);

  const saveSmtp = useCallback(async () => {
    if (!String(smtp.host || '').trim() || !String(smtp.user || '').trim() || !String(smtp.pass || '').trim() || !smtp.port) {
      Alert.alert('Eksik bilgi', 'Sunucu, port, kullanıcı ve şifre zorunlu.');
      return;
    }
    setSmtpSaving(true);
    try {
      const r = await apiClient.patch('/email/smtp', smtp);
      if (r?.data?.ok) {
        Alert.alert('Kaydedildi', 'SMTP ayarları güncellendi.');
      } else {
        Alert.alert('Hata', 'SMTP ayarları kaydedilemedi.');
      }
    } catch {
      Alert.alert('Hata', 'SMTP ayarları kaydedilemedi.');
    } finally {
      setSmtpSaving(false);
    }
  }, [smtp]);

  const sendSmtpTest = useCallback(async () => {
    setSmtpSendingTest(true);
    try {
      const to = (smtpTestTo || '').trim();
      if (!to) {
        Alert.alert('Eksik bilgi', 'Test e‑posta alıcısı gerekli.');
        return;
      }
      const html = `<div style="font-family:sans-serif">SMTP testi başarılıysa bu e‑posta size ulaştı.<br/>Gönderen: ${String(smtp.fromName || '')} &lt;${String(smtp.fromEmail || '')}&gt;</div>`;
      const r = await apiClient.post('/email/send', { to, subject: 'SMTP Test', html });
      if (r?.data?.ok) {
        Alert.alert('Gönderildi', 'Test e‑posta gönderildi.');
        fetchLogs();
      } else {
        Alert.alert('Hata', 'Test e‑posta gönderme başarısız.');
      }
    } catch {
      Alert.alert('Hata', 'Test e‑posta gönderme başarısız.');
    } finally {
      setSmtpSendingTest(false);
    }
  }, [fetchLogs, smtp.fromEmail, smtp.fromName, smtpTestTo]);

  const verifySmtp = useCallback(async () => {
    setSmtpVerifyMsg('');
    try {
      const r = await apiClient.post('/email/verify', {});
      setSmtpVerifyMsg(r?.data?.ok ? 'Bağlantı başarılı' : `Bağlantı başarısız: ${String(r?.data?.message || r?.data?.error || '')}`);
    } catch {
      setSmtpVerifyMsg('Bağlantı başarısız');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {tabs.map((t) => {
              const active = t.key === activeTab;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabPill, active ? styles.tabPillActive : null]}
                  activeOpacity={0.85}
                  onPress={() => setActiveTab(t.key)}
                >
                  <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'profile' ? (
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
                onPress={saveProfile}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {activeTab === 'security' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Güvenlik</Text>
              <Text style={styles.meta}>Şifre ve hesap güvenliği ayarları.</Text>

              <Text style={styles.label}>Mevcut Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor={colors.textSecondary}
                value={passwordForm.currentPassword}
                secureTextEntry
                onChangeText={(t) => setPasswordForm((p) => ({ ...p, currentPassword: t }))}
              />

              <Text style={styles.label}>Yeni Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={passwordForm.newPassword}
                secureTextEntry
                onChangeText={(t) => setPasswordForm((p) => ({ ...p, newPassword: t }))}
              />

              <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={passwordForm.confirmPassword}
                secureTextEntry
                onChangeText={(t) => setPasswordForm((p) => ({ ...p, confirmPassword: t }))}
              />

              <TouchableOpacity
                style={[styles.primaryButton, passwordSaving ? styles.buttonDisabled : null]}
                activeOpacity={0.85}
                disabled={passwordSaving}
                onPress={changePassword}
              >
                <Text style={styles.primaryButtonText}>{passwordSaving ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {activeTab === 'notifications' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bildirimler</Text>
              <Text style={styles.meta}>E‑posta tercihleri.</Text>

              {[
                { key: 'digest', title: 'Özet E‑posta', subtitle: 'Günlük/haftalık özetler' },
                { key: 'notifications', title: 'Bildirimler', subtitle: 'Önemli güncellemeler' },
                { key: 'marketing', title: 'Pazarlama', subtitle: 'Kampanya ve duyurular' },
                { key: 'security', title: 'Güvenlik', subtitle: 'Güvenlik uyarıları' },
              ].map((item) => (
                <View key={item.key} style={styles.row}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={safeIoniconName('notifications-outline', 'notifications-outline')} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.textBlock}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                  </View>
                  <Switch
                    value={!!profile?.emailPrefs?.[item.key]}
                    onValueChange={(v) => handlePrefToggle(item.key, v)}
                    trackColor={{ false: colors.border, true: colors.primary + '55' }}
                    thumbColor={isDark ? colors.primary : colors.surface}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
                activeOpacity={0.85}
                disabled={saving}
                onPress={savePrefs}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {activeTab === 'appearance' ? (
            <View style={{ gap: 10 }}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name="moon-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.textBlock}>
                  <Text style={styles.title}>Gece Modu</Text>
                  <Text style={styles.subtitle}>Koyu tema</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.primary + '55' }}
                  thumbColor={isDark ? colors.primary : colors.surface}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Renk Paleti</Text>
                <View style={styles.palettesGrid}>
                  {palettes.map((p) => {
                    const active = p.id === paletteId;
                    const accent = isDark ? p.dark : p.light;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.paletteChip, active ? styles.paletteChipActive : null]}
                        onPress={() => setPaletteId(p.id)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.paletteSwatches}>
                          <View style={[styles.swatch, { backgroundColor: accent.primary }]} />
                          <View style={[styles.swatch, { backgroundColor: accent.secondary }]} />
                        </View>
                        <Text style={[styles.paletteName, active ? styles.paletteNameActive : null]} numberOfLines={1}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {activeTab === 'api' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>API</Text>
              <Text style={styles.meta}>Uygulama API bilgileri.</Text>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Base URL</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {String(apiClient?.defaults?.baseURL || '')}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Yetkilendirme</Text>
                <Text style={styles.kvValue}>Bearer Token</Text>
              </View>
            </View>
          ) : null}

          {activeTab === 'email' ? (
            <View style={{ gap: 10 }}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>SMTP</Text>
                <Text style={styles.meta}>E‑posta gönderimi için SMTP ayarları.</Text>

                {smtpLoading ? <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} /> : null}

                <Text style={styles.label}>Sunucu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="smtp.example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={smtp.host}
                  onChangeText={(t) => setSmtp((p) => ({ ...p, host: t }))}
                />

                <Text style={styles.label}>Port</Text>
                <TextInput
                  style={styles.input}
                  placeholder="587"
                  placeholderTextColor={colors.textSecondary}
                  value={String(smtp.port)}
                  keyboardType="number-pad"
                  onChangeText={(t) => setSmtp((p) => ({ ...p, port: parseInt(String(t || '0'), 10) || 0 }))}
                />

                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.textBlock}>
                    <Text style={styles.title}>Güvenli (SSL/TLS)</Text>
                    <Text style={styles.subtitle}>Secure bağlantı</Text>
                  </View>
                  <Switch
                    value={!!smtp.secure}
                    onValueChange={(v) => setSmtp((p) => ({ ...p, secure: !!v }))}
                    trackColor={{ false: colors.border, true: colors.primary + '55' }}
                    thumbColor={isDark ? colors.primary : colors.surface}
                  />
                </View>

                <Text style={styles.label}>Kullanıcı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="user@example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={smtp.user}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(t) => setSmtp((p) => ({ ...p, user: t }))}
                />

                <Text style={styles.label}>Şifre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  value={smtp.pass}
                  secureTextEntry
                  onChangeText={(t) => setSmtp((p) => ({ ...p, pass: t }))}
                />

                <Text style={styles.label}>From Adı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Zigran"
                  placeholderTextColor={colors.textSecondary}
                  value={smtp.fromName}
                  onChangeText={(t) => setSmtp((p) => ({ ...p, fromName: t }))}
                />

                <Text style={styles.label}>From E‑posta</Text>
                <TextInput
                  style={styles.input}
                  placeholder="noreply@zigran.com"
                  placeholderTextColor={colors.textSecondary}
                  value={smtp.fromEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={(t) => setSmtp((p) => ({ ...p, fromEmail: t }))}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, smtpSaving ? styles.buttonDisabled : null]}
                  activeOpacity={0.85}
                  disabled={smtpSaving}
                  onPress={saveSmtp}
                >
                  <Text style={styles.primaryButtonText}>{smtpSaving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Test E‑posta Alıcısı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="to@example.com"
                  placeholderTextColor={colors.textSecondary}
                  value={smtpTestTo}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setSmtpTestTo}
                />

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, smtpSendingTest ? styles.buttonDisabled : null]}
                    activeOpacity={0.85}
                    disabled={smtpSendingTest}
                    onPress={sendSmtpTest}
                  >
                    <Text style={styles.secondaryButtonText}>{smtpSendingTest ? 'Gönderiliyor...' : 'Test e‑posta gönder'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={verifySmtp}>
                    <Text style={styles.secondaryButtonText}>Bağlantıyı test et</Text>
                  </TouchableOpacity>
                </View>

                {smtpVerifyMsg ? <Text style={styles.meta}>{smtpVerifyMsg}</Text> : null}
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Son E‑posta Logları</Text>
                  <TouchableOpacity style={styles.ghostButton} activeOpacity={0.85} onPress={fetchLogs}>
                    <Text style={styles.ghostButtonText}>Yenile</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.table}>
                  {smtpLogs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Log yok</Text>
                    </View>
                  ) : (
                    smtpLogs.slice(0, 5).map((l, idx) => (
                      <View key={String(l?.id ?? idx)} style={[styles.logRow, idx === 0 ? styles.logRowFirst : null]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.logTitle} numberOfLines={1}>
                            {String(l?.subject || 'E‑posta')}
                          </Text>
                          <Text style={styles.logMeta} numberOfLines={1}>
                            {String(l?.to || '')}
                          </Text>
                        </View>
                        <Text style={styles.logDate} numberOfLines={1}>
                          {l?.createdAt ? new Date(l.createdAt).toLocaleString('tr-TR') : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {activeTab === 'company' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Şirket</Text>
              <Text style={styles.meta}>Şirket ayarlarını güncelle.</Text>

              <Text style={styles.label}>Logo URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor={colors.textSecondary}
                value={company.logoUrl}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(t) => setCompany((p) => ({ ...p, logoUrl: t }))}
              />

              <Text style={styles.label}>Primary Color</Text>
              <TextInput
                style={styles.input}
                placeholder="#2563EB"
                placeholderTextColor={colors.textSecondary}
                value={company.primaryColor}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(t) => setCompany((p) => ({ ...p, primaryColor: t }))}
              />

              <Text style={styles.label}>Timezone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {DEFAULT_TIMEZONES.map((tz) => {
                  const active = tz === company.timezone;
                  return (
                    <TouchableOpacity
                      key={tz}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      activeOpacity={0.85}
                      onPress={() => setCompany((p) => ({ ...p, timezone: tz }))}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{tz}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.label}>Locale</Text>
              <View style={styles.chipsRow}>
                {['tr', 'en'].map((lc) => {
                  const active = lc === company.locale;
                  return (
                    <TouchableOpacity
                      key={lc}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      activeOpacity={0.85}
                      onPress={() => setCompany((p) => ({ ...p, locale: lc }))}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{lc.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Currency</Text>
              <View style={styles.chipsRow}>
                {['TRY', 'USD', 'EUR'].map((c) => {
                  const active = c === company.currency;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      activeOpacity={0.85}
                      onPress={() => setCompany((p) => ({ ...p, currency: c }))}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
                activeOpacity={0.85}
                disabled={saving}
                onPress={saveCompany}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => navigation?.navigate?.('Company')}>
                <Text style={styles.secondaryButtonText}>Şirketim’e Git</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportRow}
                activeOpacity={0.85}
                onPress={() => Linking.openURL('mailto:support@zigran.com')}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={safeIoniconName('help-circle-outline', 'help-circle-outline')} size={18} color={colors.primary} />
                </View>
                <View style={styles.textBlock}>
                  <Text style={styles.title}>Destek</Text>
                  <Text style={styles.subtitle}>support@zigran.com</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : null}

          {activeTab === 'profile' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hesap</Text>
              <Text style={styles.meta}>Timezone ve dil.</Text>

              <Text style={styles.label}>Timezone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {DEFAULT_TIMEZONES.map((tz) => {
                  const active = tz === profile.timezone;
                  return (
                    <TouchableOpacity
                      key={tz}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      activeOpacity={0.85}
                      onPress={() => setProfile((p) => ({ ...p, timezone: tz }))}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{tz}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.label}>Locale</Text>
              <View style={styles.chipsRow}>
                {['tr', 'en'].map((lc) => {
                  const active = lc === profile.locale;
                  return (
                    <TouchableOpacity
                      key={lc}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      activeOpacity={0.85}
                      onPress={() => setProfile((p) => ({ ...p, locale: lc }))}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{lc.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
                activeOpacity={0.85}
                disabled={saving}
                onPress={saveAccount}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
    },
    content: {
      padding: 16,
      gap: 10,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 2,
    },
    tabPill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabPillActive: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '33',
    },
    tabPillText: {
      color: colors.textSecondary,
      fontWeight: '900',
      fontSize: 12,
    },
    tabPillTextActive: {
      color: colors.primary,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 10,
    },
    row: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    supportRow: {
      marginTop: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    section: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    palettesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    paletteChip: {
      width: '48%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    paletteChipActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    paletteSwatches: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paletteName: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    paletteNameActive: {
      color: colors.textPrimary,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
    },
    textBlock: {
      flex: 1,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    label: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      marginTop: 6,
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
      marginTop: 6,
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
      marginTop: 6,
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
    actionsRow: {
      marginTop: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    kvRow: {
      marginTop: 10,
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
      maxWidth: '70%',
      textAlign: 'right',
    },
    chipsRow: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    chipTextActive: {
      color: colors.primary,
    },
    ghostButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ghostButtonText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    table: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      overflow: 'hidden',
    },
    emptyBox: {
      padding: 14,
      backgroundColor: colors.background,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    logRowFirst: {
      borderTopWidth: 0,
    },
    logTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    logMeta: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    logDate: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}

export default SettingsScreen;
