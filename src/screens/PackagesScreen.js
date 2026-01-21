import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const PackagesScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const response = await apiClient.get('/plans');
    setData(normalizeList(response?.data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchData();
      } catch {
        setData([]);
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

  const renderItem = ({ item }) => {
    const name = item?.name || item?.title || item?.code || 'Paket';
    const price = item?.price ?? item?.monthlyPrice ?? item?.amount;
    const currency = item?.currency || 'TRY';
    const features = Array.isArray(item?.features) ? item.features : [];
    const badge = item?.popular ? 'Popüler' : item?.status ? String(item.status) : '';

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {String(name)}
          </Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        {price !== undefined && price !== null ? (
          <Text style={styles.price}>
            {String(price)} {String(currency)}
          </Text>
        ) : null}
        {features.length > 0 ? (
          <View style={styles.features}>
            {features.slice(0, 4).map((f, idx) => (
              <Text key={String(idx)} style={styles.featureText} numberOfLines={1}>
                {String(f)}
              </Text>
            ))}
            {features.length > 4 ? (
              <Text style={styles.featureMore}>+{features.length - 4} özellik</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id ?? item?._id ?? item?.uuid ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Paket bulunamadı.</Text>}
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
    list: {
      padding: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      borderRadius: 14,
      marginBottom: 12,
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
    price: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '900',
      color: colors.primary,
    },
    features: {
      marginTop: 10,
      gap: 6,
    },
    featureText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    featureMore: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    badge: {
      maxWidth: 140,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary + '10',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
    },
    badgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 20,
      color: colors.textSecondary,
      fontWeight: '700',
    },
  });
}

export default PackagesScreen;
