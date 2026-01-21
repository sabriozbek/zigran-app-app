import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { activityService } from '../api/services/activityService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function iconForType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('lead')) return 'funnel-outline';
  if (t.includes('form')) return 'document-text-outline';
  if (t.includes('task')) return 'checkbox-outline';
  if (t.includes('deal') || t.includes('offer')) return 'pricetag-outline';
  if (t.includes('message')) return 'chatbubble-ellipses-outline';
  if (t.includes('conversion')) return 'swap-horizontal-outline';
  return 'notifications-outline';
}

const NotificationsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await activityService.list({ limit: 50 });
    setData(normalizeList(res));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchData();
      } catch (_e) {
        if (!cancelled) setData([]);
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

  const handleClear = useCallback(() => {
    Alert.alert('Temizle', 'Tüm bildirimler silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await activityService.clearAll();
            setData([]);
          } catch {
            Alert.alert('Hata', 'Bildirimler temizlenemedi.');
          }
        },
      },
    ]);
  }, []);

  const renderItem = ({ item }) => {
    const type = item?.type || item?.event || 'Bildirim';
    const description = item?.description || item?.message || '';
    const createdAt = item?.createdAt || item?.timestamp || item?.date;
    const icon = iconForType(type);
    const isUnread =
      typeof item?.isRead === 'boolean'
        ? item.isRead === false
        : typeof item?.read === 'boolean'
          ? item.read === false
          : false;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={async () => {
          const id = item?.id ?? item?._id ?? item?.uuid;
          if (!id || !isUnread) return;
          setData((prev) =>
            prev.map((x) => {
              const xid = x?.id ?? x?._id ?? x?.uuid;
              if (String(xid) !== String(id)) return x;
              return { ...x, isRead: true, read: true };
            }),
          );
          try {
            await activityService.markAsRead(id);
          } catch {}
        }}
        style={[styles.card, isUnread && styles.cardUnread]}
      >
        <View style={[styles.iconWrap, isUnread && styles.iconWrapUnread]}>
          <Ionicons name={safeIoniconName(icon, 'notifications-outline')} size={18} color={isUnread ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {String(type)}
            </Text>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          {description ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {String(description)}
            </Text>
          ) : null}
          {createdAt ? (
            <Text style={styles.meta} numberOfLines={1}>
              {new Date(createdAt).toLocaleString('tr-TR')}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.topTitle}>Bildirimler</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.clearText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id ?? item?._id ?? item?.uuid ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Bildirim yok.</Text>}
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
    topRow: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    topTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    list: {
      padding: 16,
    },
    card: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      borderRadius: 14,
      marginBottom: 12,
    },
    cardUnread: {
      borderColor: colors.primary + '44',
      backgroundColor: colors.primary + '08',
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: colors.primary + '12',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
    },
    iconWrapUnread: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '44',
    },
    content: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
    },
    subtitle: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    meta: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 20,
      color: colors.textSecondary,
      fontWeight: '700',
    },
  });
}

export default NotificationsScreen;
