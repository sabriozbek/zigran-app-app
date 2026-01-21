import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callsService } from '../api/services/callsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const CallsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await callsService.getAll();
      setData(normalizeList(res));
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

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [fetchData, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const filteredData = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) => {
      const haystack = [
        item?.subject,
        item?.description,
        item?.contactName,
        item?.companyName,
        item?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, query]);

  const renderItem = ({ item }) => {
    const subject = item?.subject || 'Arama';
    const contact = item?.contactName || item?.contact_name || 'Bilinmeyen Kişi';
    const duration = item?.duration ? `${item.duration} sn` : null;
    const status = item?.status || item?.state || 'planned';
    const date = item?.createdAt || item?.created_at || item?.date;
    
    // Simple formatting for date
    const dateStr = date ? new Date(date).toLocaleDateString('tr-TR') : '';

    let iconName = 'call-outline';
    let iconColor = colors.textPrimary;
    
    if (status === 'missed') {
      iconName = 'call';
      iconColor = colors.danger || '#ef4444';
    } else if (status === 'completed') {
      iconName = 'call';
      iconColor = colors.primary; // '#22c55e'
    }

    return (
      <AppCard style={styles.card} onPress={() => navigation.navigate('CallDetail', { id: item?.id, call: item })}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBox, { backgroundColor: iconColor + '14' }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{subject}</Text>
            <Text style={styles.cardSub}>
              {contact} {dateStr ? `• ${dateStr}` : ''}
            </Text>
            
            <View style={styles.metaRow}>
              <View style={[styles.badge, styles.badgeOutline]}>
                <Text style={[styles.badgeText, styles.badgeOutlineText]}>{status}</Text>
              </View>
              {duration ? (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{duration}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ opacity: 0.5 }} />
        </View>
      </AppCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Aramalar</Text>
          <Text style={styles.h2}>Çağrı kayıtları ve planlamalar</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddCall')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Yeni Arama</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ara: konu, kişi, telefon..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="call-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Kayıtlı arama bulunamadı.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    searchRow: { paddingHorizontal: 16, marginBottom: 12 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    list: { padding: 16, paddingTop: 4, gap: 12 },
    card: { padding: 0 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
    iconBox: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardInfo: { flex: 1, gap: 4 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    cardSub: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, alignItems: 'center' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeOutline: {},
    badgeText: { fontSize: 10, fontWeight: '800' },
    badgeOutlineText: { color: colors.textSecondary },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
  });
}

export default CallsScreen;
