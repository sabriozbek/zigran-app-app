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
import { Ionicons } from '@expo/vector-icons';
import { forecastsService } from '../api/services/forecastsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₺0';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);
}

const ForecastsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await forecastsService.getAll();
      setData(Array.isArray(res) ? res : []);
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

  const renderItem = ({ item }) => {
    const period = item?.period || 'Dönem';
    const target = Number(item?.target || 0);
    const actual = Number(item?.actual || 0);
    const pipeline = Number(item?.pipeline || 0);
    
    const progress = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
    const prediction = actual + pipeline;
    const predictionProgress = target > 0 ? Math.min(100, (prediction / target) * 100) : 0;
    
    const status = item?.status || 'open';
    const isClosed = status === 'closed';

    return (
      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.periodText}>{period}</Text>
          <View style={[styles.badge, isClosed ? styles.badgeClosed : styles.badgeOpen]}>
            <Text style={[styles.badgeText, isClosed ? styles.badgeClosedText : styles.badgeOpenText]}>
              {isClosed ? 'Kapandı' : 'Açık'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Hedef</Text>
            <Text style={styles.statValue}>{formatCurrency(target)}</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Gerçekleşen</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{formatCurrency(actual)}</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Pipeline</Text>
            <Text style={styles.statValue}>{formatCurrency(pipeline)}</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: colors.primary }]} />
            {predictionProgress > progress && (
              <View style={[styles.progressBar, { width: `${predictionProgress}%`, backgroundColor: colors.primary, opacity: 0.3, zIndex: -1 }]} />
            )}
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{progress.toFixed(0)}% Gerçekleşen</Text>
            <Text style={styles.progressLabel}>{predictionProgress.toFixed(0)}% Tahmin</Text>
          </View>
        </View>
      </AppCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Öngörüler</Text>
          <Text style={styles.h2}>Satış hedefleri ve tahminler</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="bar-chart-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Öngörü verisi bulunamadı.</Text>
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
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    list: { padding: 16, paddingTop: 4, gap: 12 },
    card: { padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    periodText: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    badgeOpen: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
    badgeOpenText: { color: '#059669', fontSize: 11, fontWeight: '800' },
    badgeClosed: { backgroundColor: colors.surface, borderColor: colors.border },
    badgeClosedText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    statCol: { flex: 1 },
    statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', marginBottom: 4 },
    statValue: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
    progressWrap: { gap: 6 },
    progressBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', position: 'relative' },
    progressBar: { height: '100%', borderRadius: 4, position: 'absolute', left: 0, top: 0 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
  });
}

export default ForecastsScreen;
