import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';
import { smsService } from '../api/services/smsService';

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

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SmsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [activeTab, setActiveTab] = useState('send');

  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [logsLoading, setLogsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState([]);

  const loadLogs = useCallback(async () => {
    const res = await smsService.listLogs({ limit: 50, offset: 0 });
    const items = normalizeList(res?.items ?? res);
    setLogs(items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadLogs();
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter((l) => String(l?.status || '').toLowerCase() === 'sent').length;
    const failed = logs.filter((l) => String(l?.status || '').toLowerCase() === 'failed').length;
    return { total, sent, failed };
  }, [logs]);

  const canSend = useMemo(() => {
    return !!String(to || '').trim() && !!String(message || '').trim();
  }, [message, to]);

  const sendNow = useCallback(async () => {
    const dest = String(to || '').trim();
    const body = String(message || '').trim();
    if (!dest || !body) {
      Alert.alert('Eksik bilgi', 'Alıcı ve mesaj zorunlu.');
      return;
    }
    setSending(true);
    try {
      const res = await smsService.send({ to: dest, message: body });
      if (res?.ok) {
        Alert.alert('Başarılı', 'SMS gönderildi.');
        setTo('');
        setMessage('');
        setActiveTab('logs');
        await loadLogs();
      } else {
        Alert.alert('Hata', String(res?.error || 'SMS gönderilemedi.'));
      }
    } catch {
      Alert.alert('Hata', 'SMS gönderilemedi.');
    } finally {
      setSending(false);
    }
  }, [loadLogs, message, to]);

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>SMS</Text>
              <Text style={styles.meta}>Toplu / tekil gönderim yapın ve teslimat raporlarını izleyin.</Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
              {[
                { key: 'send', label: 'Gönder', icon: 'send-outline' },
                { key: 'logs', label: 'Raporlar', icon: 'stats-chart-outline' },
              ].map((t) => {
                const active = t.key === activeTab;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.85}
                    onPress={() => setActiveTab(t.key)}
                    style={[styles.tabPill, active ? styles.tabPillActive : null]}
                  >
                    <Ionicons name={safeIoniconName(t.icon, 'ellipse-outline')} size={14} color={active ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </AppCard>

        <View style={styles.metricsRow}>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Toplam</Text>
            <Text style={styles.metricValue}>{String(stats.total)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Gönderildi</Text>
            <Text style={styles.metricValue}>{String(stats.sent)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Hatalı</Text>
            <Text style={[styles.metricValue, { color: stats.failed ? colors.danger : colors.textPrimary }]}>{String(stats.failed)}</Text>
          </AppCard>
        </View>
      </View>
    );
  }, [
    activeTab,
    colors.danger,
    colors.textPrimary,
    colors.textSecondary,
    onRefresh,
    stats.failed,
    stats.sent,
    stats.total,
    styles.headerCard,
    styles.headerTop,
    styles.iconBtn,
    styles.metricCard,
    styles.metricLabel,
    styles.metricValue,
    styles.metricsRow,
    styles.meta,
    styles.title,
    styles.tabPill,
    styles.tabPillActive,
    styles.tabPillText,
    styles.tabPillTextActive,
    styles.tabsInner,
    styles.tabsRow,
  ]);

  const body = useMemo(() => {
    if (activeTab === 'send') {
      return (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Toplu / Tekil SMS</Text>
          <Text style={styles.meta}>Telefon numarasını girin ve mesajınızı gönderin.</Text>

          <Text style={styles.label}>Alıcı</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="+90 5xx xxx xx xx"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Mesaj</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Mesajınızı yazın…"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.inputMultiline]}
            multiline
          />

          <View style={styles.counterRow}>
            <Text style={styles.smallMuted}>Karakter: {String(message.length)}</Text>
            <Text style={styles.smallMuted}>Tahmini SMS: {String(Math.max(1, Math.ceil(message.length / 155)))}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (!canSend || sending) ? styles.disabled : null]}
            activeOpacity={0.85}
            disabled={!canSend || sending}
            onPress={sendNow}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Gönder</Text>}
          </TouchableOpacity>
        </AppCard>
      );
    }

    if (logsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    return (
      <View style={{ gap: 10 }}>
        {logs.length === 0 ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Kayıt yok</Text>
            <Text style={styles.meta}>Henüz SMS gönderimi yapılmadı.</Text>
          </AppCard>
        ) : null}

        <FlatList
          data={logs}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const l = item || {};
            const status = String(l?.status || '').toLowerCase();
            const ok = status === 'sent';
            const fail = status === 'failed';
            return (
              <AppCard style={styles.logCard}>
                <View style={styles.logTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.logTo} numberOfLines={1}>
                      {String(l?.to || '—')}
                    </Text>
                    <Text style={styles.logBody} numberOfLines={3}>
                      {String(l?.body || l?.message || '—')}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, ok ? styles.statusOk : fail ? styles.statusFail : styles.statusPending]}>
                    <Text style={[styles.statusText, ok ? styles.statusTextOk : fail ? styles.statusTextFail : styles.statusTextPending]}>
                      {ok ? 'Gönderildi' : fail ? 'Hatalı' : 'Bekliyor'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.smallMuted}>Tarih: {formatDate(l?.createdAt ?? l?.created_at)}</Text>
                {fail && l?.error ? <Text style={[styles.smallMuted, { color: colors.danger }]} numberOfLines={2}>Hata: {String(l?.error)}</Text> : null}
              </AppCard>
            );
          }}
        />
      </View>
    );
  }, [
    activeTab,
    canSend,
    colors.danger,
    colors.primary,
    colors.textSecondary,
    logs,
    logsLoading,
    message,
    sendNow,
    sending,
    styles.card,
    styles.center,
    styles.counterRow,
    styles.disabled,
    styles.input,
    styles.inputMultiline,
    styles.label,
    styles.logBody,
    styles.logCard,
    styles.logTo,
    styles.logTop,
    styles.meta,
    styles.primaryButton,
    styles.primaryButtonText,
    styles.sectionTitle,
    styles.smallMuted,
    styles.statusFail,
    styles.statusOk,
    styles.statusPending,
    styles.statusPill,
    styles.statusText,
    styles.statusTextFail,
    styles.statusTextOk,
    styles.statusTextPending,
    to,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {header}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 28, gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },

    headerCard: { padding: 14 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    tabsRow: { marginTop: 2 },
    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    metricsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    metricCard: { flex: 1, minWidth: 110, paddingVertical: 12 },
    metricLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    metricValue: { color: colors.textPrimary, fontWeight: '900', fontSize: 18, marginTop: 6 },

    card: { padding: 14 },
    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    meta: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    label: { marginTop: 12, marginBottom: 8, color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
    counterRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    smallMuted: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },

    primaryButton: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    disabled: { opacity: 0.6 },

    logCard: { padding: 12 },
    logTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
    logTo: { color: colors.textPrimary, fontWeight: '900' },
    logBody: { marginTop: 4, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    statusOk: { backgroundColor: colors.success + '12', borderColor: colors.success + '40' },
    statusFail: { backgroundColor: colors.danger + '12', borderColor: colors.danger + '40' },
    statusPending: { backgroundColor: isDark ? colors.surface : colors.background, borderColor: colors.border },
    statusText: { fontWeight: '900', fontSize: 12 },
    statusTextOk: { color: colors.success },
    statusTextFail: { color: colors.danger },
    statusTextPending: { color: colors.textSecondary },
  });
}
