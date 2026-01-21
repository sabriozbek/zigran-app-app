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

const AdsAccountsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const response = await apiClient.get('/ads/accounts');
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
    const name = item?.name || item?.accountName || item?.id || 'Hesap';
    const platform = item?.platform || item?.provider || item?.type;
    const status = item?.status || item?.state;

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>
            {String(name)}
          </Text>
          {platform ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {String(platform)}
              </Text>
            </View>
          ) : null}
        </View>
        {status ? (
          <Text style={styles.meta} numberOfLines={1}>
            Durum: {String(status)}
          </Text>
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
          ListEmptyComponent={<Text style={styles.emptyText}>Bağlı reklam hesabı yok.</Text>}
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
    meta: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    badge: {
      maxWidth: 140,
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
    emptyText: {
      textAlign: 'center',
      marginTop: 20,
      color: colors.textSecondary,
      fontWeight: '700',
    },
  });
}

export default AdsAccountsScreen;
