import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import apiClient from '../api/client';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const ConversionsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await apiClient.get('/conversions/logs');
      setData(normalizeList(response?.data));
    } catch {
      setData([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const normalized = useMemo(() => {
    return data.map((item) => {
      const event =
        item?.event ||
        item?.type ||
        item?.name ||
        (item?.payload?.event ? String(item.payload.event) : 'Conversion');
      const platform = item?.platform || item?.provider || item?.source || item?.channel || '';
      const status = item?.status || item?.result || item?.state || '';
      const timestamp = item?.createdAt || item?.timestamp || item?.date || item?.created_at;
      const ts = timestamp ? new Date(timestamp).getTime() : NaN;
      return { raw: item, event: String(event), platform: String(platform), status: String(status), ts };
    });
  }, [data]);

  const summary = useMemo(() => {
    let ok = 0;
    let fail = 0;
    let last24 = 0;
    const now = Date.now();
    for (const it of normalized) {
      const s = String(it.status || '').toLowerCase();
      const isOk = s.includes('ok') || s.includes('success') || s.includes('sent') || s.includes('delivered');
      const isFail = s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('invalid');
      if (isOk) ok += 1;
      if (isFail) fail += 1;
      if (Number.isFinite(it.ts) && now - it.ts < 24 * 60 * 60 * 1000) last24 += 1;
    }
    return { total: normalized.length, ok, fail, last24 };
  }, [normalized]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return normalized.filter((it) => {
      const s = String(it.status || '').toLowerCase();
      const isOk = s.includes('ok') || s.includes('success') || s.includes('sent') || s.includes('delivered');
      const isFail = s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('invalid');
      if (filter === 'success' && !isOk) return false;
      if (filter === 'failed' && !isFail) return false;
      if (!q) return true;
      const hay = `${it.event} ${it.platform} ${it.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [filter, normalized, query]);

  const statusBadge = useCallback(
    (status) => {
      const s = String(status || '').toLowerCase();
      const isOk = s.includes('ok') || s.includes('success') || s.includes('sent') || s.includes('delivered');
      const isFail = s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('invalid');
      if (isOk) return { bg: colors.success + '14', border: colors.success + '2A', text: colors.success, icon: 'checkmark-circle' };
      if (isFail) return { bg: colors.error + '14', border: colors.error + '2A', text: colors.error, icon: 'close-circle' };
      return { bg: colors.primary + '10', border: colors.primary + '2A', text: colors.primary, icon: 'pulse' };
    },
    [colors.error, colors.primary, colors.success],
  );

  const renderItem = ({ item }) => {
    const badge = statusBadge(item.status);
    const when = Number.isFinite(item.ts) ? new Date(item.ts).toLocaleString('tr-TR') : '';

    return (
      <AppCard style={styles.card} onPress={() => setSelected(item)} accessibilityLabel={item.event}>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.event}
            </Text>
            <View style={styles.metaRow}>
              {item.platform ? (
                <View style={styles.metaPill}>
                  <Ionicons name="globe-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {item.platform}
                  </Text>
                </View>
              ) : null}
              {when ? (
                <View style={styles.metaPill}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaPillText} numberOfLines={1}>
                    {when}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {item.status ? (
            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Ionicons name={badge.icon} size={14} color={badge.text} />
              <Text style={[styles.badgeText, { color: badge.text }]} numberOfLines={1}>
                {item.status}
              </Text>
            </View>
          ) : null}
        </View>
      </AppCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.raw?.id ?? item?.raw?._id ?? item?.raw?.uuid ?? index)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.h1}>Dönüşümler</Text>
                  <Text style={styles.h2} numberOfLines={2}>
                    Conversion API logları ve teslimat durumları
                  </Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
                  <Text style={styles.summaryLabel}>Toplam</Text>
                  <Text style={styles.summaryValue}>{String(summary.total)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.success + '12', borderColor: colors.success + '2A' }]}>
                  <Text style={[styles.summaryLabel, { color: colors.success }]}>Başarılı</Text>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>{String(summary.ok)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: colors.error + '12', borderColor: colors.error + '2A' }]}>
                  <Text style={[styles.summaryLabel, { color: colors.error }]}>Hatalı</Text>
                  <Text style={[styles.summaryValue, { color: colors.error }]}>{String(summary.fail)}</Text>
                </View>
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Ara: event, platform, durum..."
                  placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')} activeOpacity={0.85}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.filtersRow}>
                {[
                  { key: 'all', label: 'Tümü' },
                  { key: 'success', label: 'Başarılı' },
                  { key: 'failed', label: 'Hatalı' },
                ].map((t) => {
                  const active = filter === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      onPress={() => setFilter(t.key)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="pulse" size={30} color={colors.textSecondary + '66'} />
              <Text style={styles.emptyText}>Kayıt bulunamadı.</Text>
            </View>
          }
        />
      )}

      {selected ? (
        <View style={styles.detailSheet}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setSelected(null)} activeOpacity={1} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {String(selected.event || 'Detay')}
              </Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSelected(null)} activeOpacity={0.85}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Platform</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {selected.platform ? String(selected.platform) : '—'}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Durum</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {selected.status ? String(selected.status) : '—'}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Zaman</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {Number.isFinite(selected.ts) ? new Date(selected.ts).toLocaleString('tr-TR') : '—'}
                </Text>
              </View>

              <View style={styles.payloadBox}>
                <Text style={styles.payloadTitle}>Payload</Text>
                <Text style={styles.payloadText}>{JSON.stringify(selected.raw ?? {}, null, 2)}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: { padding: 16, paddingBottom: 28, gap: 12 },
    header: { gap: 12, paddingBottom: 6 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { marginTop: 4, fontSize: 13, fontWeight: '700', color: colors.textSecondary, lineHeight: 18 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 4,
    },
    summaryLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
    summaryValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
    clearBtn: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '900' },
    chipTextActive: { color: colors.primary },
    card: {
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2 ?? colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: '100%',
    },
    metaPillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    badge: {
      maxWidth: 140,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '900',
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginTop: 10,
    },
    emptyText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
    detailSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'flex-end',
    },
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheetCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      maxHeight: '78%',
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
    sheetTitle: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
    kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
    kvLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '900' },
    kvValue: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    payloadBox: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2 ?? colors.background,
      borderRadius: 14,
      padding: 12,
    },
    payloadTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900', marginBottom: 8 },
    payloadText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  });
}

export default ConversionsScreen;
