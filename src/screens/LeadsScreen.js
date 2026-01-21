import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { leadsService } from '../api/services/leadsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeSources(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  const values = new Set();
  list.forEach((v) => {
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'string' || typeof v === 'number') {
      values.add(String(v));
      return;
    }
    const maybeSource = v?.source ?? v?.name ?? v?.key ?? v?.value;
    if (maybeSource !== undefined && maybeSource !== null && maybeSource !== '') values.add(String(maybeSource));
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

const LeadsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tümü');
  const [sourceFilter, setSourceFilter] = useState('Tümü');
  const [sourceOptions, setSourceOptions] = useState(['Tümü']);

  const fetchData = useCallback(async () => {
    try {
      const res = await leadsService.getAll();
      setData(normalizeList(res));
    } catch {
      setData([]);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await leadsService.getSources();
      const sources = normalizeSources(res);
      setSourceOptions(['Tümü', ...sources]);
    } catch {
      setSourceOptions(['Tümü']);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.allSettled([fetchData(), fetchSources()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchData, fetchSources]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      Promise.allSettled([fetchData(), fetchSources()]).catch(() => {});
    });
    return unsubscribe;
  }, [fetchData, fetchSources, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([fetchData(), fetchSources()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, fetchSources]);

  const statusOptions = useMemo(() => {
    const values = new Set();
    data.forEach((item) => {
      const v = item?.status ?? item?.stage;
      if (v === undefined || v === null || v === '') return;
      values.add(String(v));
    });
    return ['Tümü', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'tr-TR'))];
  }, [data]);

  const filteredData = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((item) => {
      const status = item?.status ?? item?.stage;
      if (statusFilter !== 'Tümü' && String(status ?? '') !== statusFilter) return false;
      if (sourceFilter !== 'Tümü' && String(item?.source ?? '') !== sourceFilter) return false;
      if (!q) return true;

      const haystack = [
        item?.name,
        item?.fullName,
        item?.companyName,
        item?.company,
        item?.email,
        item?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query, statusFilter, sourceFilter]);

  const handleNavigateDetail = useCallback(
    (item) => {
      navigation.navigate('LeadDetail', {
        id: item?.id ?? item?._id ?? item?.uuid ?? item?.leadId,
        lead: item,
      });
    },
    [navigation],
  );

  const handleCreate = useCallback(() => {
    navigation.navigate('LeadUpsert');
  }, [navigation]);

  const handleSync = useCallback(() => {
    setLoading(true);
    (async () => {
      try {
        await leadsService.syncAccounts();
      } catch {
      } finally {
        await Promise.allSettled([fetchData(), fetchSources()]);
        setLoading(false);
      }
    })();
  }, [fetchData, fetchSources]);

  const renderItem = ({ item }) => {
    const title =
      item?.name ||
      item?.fullName ||
      item?.companyName ||
      item?.email ||
      item?.phone ||
      'Lead';
    const subtitleParts = [];
    if (item?.email) subtitleParts.push(String(item.email));
    if (item?.phone) subtitleParts.push(String(item.phone));
    const subtitle = subtitleParts.join(' • ');
    const score = item?.score ?? item?.leadScore;
    const status = item?.status ?? item?.stage;

    return (
      <AppCard style={styles.card} onPress={() => handleNavigateDetail(item)}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {String(title)}
          </Text>
          {(status || status === 0) && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {String(status)}
              </Text>
            </View>
          )}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {(score || score === 0) && (
          <Text style={styles.meta} numberOfLines={1}>
            Skor: {String(score)}
          </Text>
        )}
      </AppCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Satış Fırsatları</Text>
          <Text style={styles.h2}>Potansiyel müşterilerinizi takip edin</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleCreate}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Yeni Fırsat</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            String(item?.id ?? item?._id ?? item?.uuid ?? item?.leadId ?? index)
          }
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.toolbar}>
              <View style={styles.searchRow}>
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Ara: isim, firma, e-posta, telefon"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {query ? (
                    <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.8} style={styles.clearBtn}>
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity onPress={handleSync} activeOpacity={0.85} style={styles.syncBtn}>
                  <Ionicons name="sync-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                {statusOptions.map((s) => {
                  const active = s === statusFilter;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatusFilter(s)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
                {sourceOptions.map((s) => {
                  const active = s === sourceFilter;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSourceFilter(s)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="funnel-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Lead bulunamadı.</Text>
            </View>
          }
        />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    addBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
    list: {
      padding: 16,
      paddingTop: 0,
    },
    toolbar: {
      marginBottom: 12,
      gap: 10,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    clearBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    syncBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filtersRow: {
      gap: 10,
      paddingRight: 10,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary + '44',
      backgroundColor: colors.primary + '14',
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    chipTextActive: {
      color: colors.primary,
    },
    card: {
      marginBottom: 12,
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    meta: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    badge: {
      maxWidth: 130,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.secondary + '1A',
      borderWidth: 1,
      borderColor: colors.secondary + '33',
    },
    badgeText: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
  });
}

export default LeadsScreen;
