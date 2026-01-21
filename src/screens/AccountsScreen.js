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
import { accountsService } from '../api/services/accountsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const AccountsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await accountsService.getAll();
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
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
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
        item?.name,
        item?.companyName,
        item?.industry,
        item?.website,
        item?.email,
        item?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, query]);

  const renderItem = ({ item }) => {
    const name = item?.name || item?.companyName || 'İsimsiz Firma';
    const industry = item?.industry || item?.sector;
    const website = item?.website;
    const location = item?.location || item?.city || item?.address;
    const initials = name.slice(0, 2).toUpperCase();

    return (
      <AppCard style={styles.card} onPress={() => navigation.navigate('AccountDetail', { id: item?.id, account: item })}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, styles.avatarSquare]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{name}</Text>
            {industry ? (
              <Text style={styles.cardSub}>
                {industry} {location ? `• ${location}` : ''}
              </Text>
            ) : location ? (
              <Text style={styles.cardSub}>{location}</Text>
            ) : null}

            <View style={styles.metaRow}>
              {website ? (
                <View style={styles.metaItem}>
                  <Ionicons name="globe-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{website}</Text>
                </View>
              ) : null}
              {item?.phone ? (
                <View style={styles.metaItem}>
                  <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{item.phone}</Text>
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
          <Text style={styles.h1}>Firmalar</Text>
          <Text style={styles.h2}>Kurumsal müşteri hesaplarınız</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddAccount')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Yeni Firma</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ara: firma adı, sektör, web..."
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
              <Ionicons name="business-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Henüz kayıtlı firma yok.</Text>
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
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.secondary + '14',
      borderWidth: 1,
      borderColor: colors.secondary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSquare: { borderRadius: 12 },
    avatarText: { color: colors.secondary, fontSize: 16, fontWeight: '900' },
    cardInfo: { flex: 1, gap: 4 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    cardSub: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
  });
}

export default AccountsScreen;
