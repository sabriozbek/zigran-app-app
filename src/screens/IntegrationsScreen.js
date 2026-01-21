import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Linking, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';
import { integrationsService } from '../api/services/integrationsService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  if (!s) return false;
  return s === 'true' || s === '1' || s === 'yes' || s === 'connected' || s === 'active';
}

function pickString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function extractUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const u = extractUrl(item);
      if (u) return u;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const direct =
    value.url ??
    value.uri ??
    value.href ??
    value.link ??
    value.redirectUrl ??
    value.redirect_url ??
    value.authUrl ??
    value.auth_url ??
    value.connectUrl ??
    value.connect_url ??
    value.oauthUrl ??
    value.oauth_url;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return extractUrl(value.data ?? value.result ?? value.payload);
}

const DEFAULT_PROVIDERS = [
  { key: 'google', title: 'Google', subtitle: 'Analytics, Search Console, Ads entegrasyonları', icon: 'logo-google', category: 'analytics', accent: '#2563eb' },
  { key: 'meta', title: 'Meta', subtitle: 'Facebook/Instagram reklam hesapları', icon: 'logo-facebook', category: 'ads', accent: '#1877F2' },
  { key: 'linkedin', title: 'LinkedIn', subtitle: 'LinkedIn Ads entegrasyonu', icon: 'logo-linkedin', category: 'ads', accent: '#0A66C2' },
  { key: 'ga4', title: 'GA4', subtitle: 'Google Analytics 4 ölçüm verileri', icon: 'stats-chart-outline', category: 'analytics', accent: '#f97316' },
  { key: 'search_console', title: 'Search Console', subtitle: 'Organik arama performansı', icon: 'search-outline', category: 'analytics', accent: '#16a34a' },
  { key: 'youtube', title: 'YouTube', subtitle: 'Kanal ve video analitiği', icon: 'logo-youtube', category: 'analytics', accent: '#FF0000' },
  { key: 'smtp', title: 'SMTP', subtitle: 'E-posta gönderimi için SMTP ayarı', icon: 'mail-outline', category: 'messaging', accent: '#7c3aed' },
  { key: 'twilio', title: 'Twilio', subtitle: 'SMS ve WhatsApp altyapısı', icon: 'chatbox-ellipses-outline', category: 'messaging', accent: '#0ea5e9' },
  { key: 'whatsapp', title: 'WhatsApp', subtitle: 'WhatsApp Business mesajlaşma', icon: 'logo-whatsapp', category: 'messaging', accent: '#25D366' },
];

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  const load = useCallback(async () => {
    const raw = await integrationsService.list();
    const list = normalizeList(raw);
    setItems(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const merged = useMemo(() => {
    const byKey = new Map();
    for (const it of items) {
      const key = pickString(it?.key, it?.provider, it?.type, it?.name, it?.id).toLowerCase();
      if (!key) continue;
      byKey.set(key, it);
    }
    return DEFAULT_PROVIDERS.map((p) => {
      const raw = byKey.get(p.key) || byKey.get(p.key.replace('_', '')) || null;
      const connected = asBool(raw?.connected ?? raw?.isConnected ?? raw?.active ?? raw?.enabled ?? raw?.status);
      const lastSync = pickString(raw?.lastSyncAt, raw?.last_sync_at, raw?.syncedAt, raw?.synced_at, raw?.updatedAt, raw?.updated_at);
      const err = pickString(raw?.error, raw?.lastError, raw?.last_error, raw?.message);
      const accounts = normalizeList(raw?.accounts ?? raw?.adAccounts ?? raw?.items).length;
      const connectUrl = extractUrl(raw?.connectUrl ?? raw?.oauthUrl ?? raw?.authUrl ?? raw?.url);
      return {
        ...p,
        raw,
        connected,
        lastSync,
        err,
        accounts,
        connectUrl,
      };
    });
  }, [items]);

  const visible = useMemo(() => {
    if (activeTab === 'all') return merged;
    return merged.filter((m) => m.category === activeTab);
  }, [activeTab, merged]);

  const connect = useCallback(
    async (item) => {
      try {
        const res = await integrationsService.connect(item.key);
        const url = extractUrl(res) || extractUrl(item?.connectUrl);
        if (url) {
          await Linking.openURL(url);
          return;
        }
        Alert.alert('Bağlantı', 'Bağlantı linki alınamadı. Entegrasyon ayarlarınızı kontrol edin.');
      } catch {
        Alert.alert('Hata', 'Bağlantı başlatılamadı.');
      }
    },
    [],
  );

  const disconnect = useCallback(async (item) => {
    Alert.alert('Bağlantı Kesilsin mi?', `${String(item?.title || 'Entegrasyon')}`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kes',
        style: 'destructive',
        onPress: async () => {
          try {
            await integrationsService.disconnect(item.key);
            await onRefresh();
          } catch {
            Alert.alert('Hata', 'Bağlantı kesilemedi.');
          }
        },
      },
    ]);
  }, [onRefresh]);

  const syncNow = useCallback(
    async (item) => {
      try {
        await integrationsService.sync(item.key);
        Alert.alert('Senkronizasyon', 'Senkronizasyon başlatıldı.');
        await onRefresh();
      } catch {
        Alert.alert('Hata', 'Senkronizasyon başlatılamadı.');
      }
    },
    [onRefresh],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Entegrasyonlar</Text>
              <Text style={styles.meta}>Reklam, analitik ve mesajlaşma kaynaklarını bağlayın; senkron durumunu izleyin.</Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
              <Ionicons name={safeIoniconName('refresh', 'refresh')} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
              {[
                { key: 'all', label: 'Tümü', icon: 'grid-outline' },
                { key: 'ads', label: 'Reklam', icon: 'megaphone-outline' },
                { key: 'analytics', label: 'Analitik', icon: 'stats-chart-outline' },
                { key: 'messaging', label: 'Mesajlaşma', icon: 'chatbubbles-outline' },
              ].map((t) => {
                const active = t.key === activeTab;
                return (
                  <TouchableOpacity key={t.key} activeOpacity={0.9} onPress={() => setActiveTab(t.key)} style={[styles.tabPill, active ? styles.tabPillActive : null]}>
                    <Ionicons name={safeIoniconName(t.icon, 'ellipse-outline')} size={14} color={active ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </AppCard>

        {visible.length === 0 ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Entegrasyon yok</Text>
            <Text style={styles.meta}>Bu kategoride bir entegrasyon bulunamadı.</Text>
          </AppCard>
        ) : null}

        <View style={styles.grid}>
          {visible.map((it) => {
            const statusColor = it.connected ? colors.success : colors.textSecondary;
            return (
              <AppCard key={it.key} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: it.accent + '14', borderColor: it.accent + '33' }]}>
                    <Ionicons name={safeIoniconName(it.icon, 'link-outline')} size={18} color={it.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={styles.smallMuted} numberOfLines={2}>
                      {it.subtitle}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '12', borderColor: statusColor + '3A' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{it.connected ? 'Bağlı' : 'Bağlı Değil'}</Text>
                  </View>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Hesap</Text>
                  <Text style={styles.kvValue}>{it.accounts ? String(it.accounts) : '—'}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Son Senk.</Text>
                  <Text style={styles.kvValue} numberOfLines={1}>
                    {it.lastSync ? String(it.lastSync) : '—'}
                  </Text>
                </View>
                {it.err ? (
                  <View style={[styles.warnBox, { borderColor: colors.error + '35', backgroundColor: colors.error + '10' }]}>
                    <Ionicons name={safeIoniconName('alert-circle-outline', 'alert-circle-outline')} size={16} color={colors.error} />
                    <Text style={[styles.warnText, { color: colors.error }]} numberOfLines={2}>
                      {it.err}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  {it.connected ? (
                    <>
                      <TouchableOpacity style={[styles.outlineBtn, styles.outlineBtnWide]} onPress={() => syncNow(it)} activeOpacity={0.85}>
                        <Ionicons name={safeIoniconName('sync-outline', 'sync-outline')} size={16} color={colors.textPrimary} />
                        <Text style={styles.outlineBtnText}>Senkronize</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.dangerBtn, styles.outlineBtnWide]} onPress={() => disconnect(it)} activeOpacity={0.85}>
                        <Ionicons name={safeIoniconName('unlink-outline', 'unlink-outline')} size={16} color={colors.error} />
                        <Text style={[styles.outlineBtnText, { color: colors.error }]}>Bağlantı Kes</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => connect(it)} activeOpacity={0.85}>
                      <Ionicons name={safeIoniconName('link-outline', 'link-outline')} size={16} color="#fff" />
                      <Text style={styles.primaryBtnText}>Bağla</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </AppCard>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 28, gap: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 10, color: colors.textSecondary, fontWeight: '700' },

    headerCard: { padding: 14 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13, fontWeight: '700', lineHeight: 18 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    tabsRow: { marginTop: 12 },
    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },

    grid: { gap: 12 },
    card: { padding: 14 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    iconWrap: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    smallMuted: { marginTop: 4, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    statusText: { fontWeight: '900', fontSize: 12 },

    kvRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    kvLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    kvValue: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },

    warnBox: { marginTop: 10, borderWidth: 1, borderRadius: 14, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
    warnText: { flex: 1, minWidth: 0, fontWeight: '800', fontSize: 12, lineHeight: 16 },

    actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

    outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 12 },
    outlineBtnWide: { flex: 1, minWidth: 140 },
    outlineBtnText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    dangerBtn: { borderColor: colors.error + '3A', backgroundColor: colors.error + '10' },
  });
}

