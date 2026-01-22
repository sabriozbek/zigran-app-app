import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService } from '../api/services/analyticsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₺0';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);
}

function monthLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const d = new Date(`${raw}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(d);
  } catch {
    return raw;
  }
}

function PipelineBarChart({ data, colors, styles, onSelect, selectedKey }) {
  const height = 220;
  const maxValue = Math.max(
    1,
    ...(Array.isArray(data) ? data : []).flatMap((d) => [Number(d?.value || 0), Number(d?.weightedValue || 0)]),
  );

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <View style={[styles.chartEmpty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Ionicons name="bar-chart-outline" size={34} color={colors.border} />
        <Text style={[styles.chartEmptyText, { color: colors.textSecondary }]}>Grafik verisi yok.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.chartWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.primary + '55' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Toplam</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Ağırlıklı Tahmin</Text>
        </View>
      </View>

      <View style={[styles.chartArea, { height }]}>
        {(data || []).map((d) => {
          const key = String(d?.key ?? d?.name ?? '');
          const total = Math.max(0, Number(d?.value || 0));
          const weighted = Math.max(0, Number(d?.weightedValue || 0));
          const totalH = Math.round((total / maxValue) * height);
          const weightedH = Math.round((weighted / maxValue) * height);
          const active = selectedKey && key && selectedKey === key;
          return (
            <TouchableOpacity
              key={key || String(Math.random())}
              style={styles.group}
              activeOpacity={0.85}
              onPress={() => (onSelect ? onSelect({ key, ...d }) : null)}
            >
              <View style={styles.barsRow}>
                <View style={[styles.bar, { height: totalH, backgroundColor: colors.primary + '55', opacity: active ? 1 : 0.9 }]} />
                <View style={[styles.bar, { height: weightedH, backgroundColor: colors.primary, opacity: active ? 1 : 0.9 }]} />
              </View>
              <Text style={[styles.axisLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {String(d?.name ?? '')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ForecastsScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const fetchData = useCallback(async () => {
    const res = await analyticsService.pipeline();
    const nextSummary = (res && typeof res === 'object' ? res.summary : null) || null;
    const nextForecast = Array.isArray(res?.forecast) ? res.forecast : [];
    setSummary(nextSummary);
    setForecast(nextForecast);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
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

  const chartData = useMemo(() => {
    return (forecast || []).map((f) => {
      const month = String(f?.month ?? f?.period ?? f?.date ?? '').trim();
      const name = monthLabel(month) || month || '—';
      return {
        key: month || name,
        name,
        value: Number(f?.value || 0),
        weightedValue: Number(f?.weightedValue || 0),
      };
    });
  }, [forecast]);

  const totalForecast = Number(summary?.weightedValue || 0);
  const pipelineValue = Number(summary?.totalValue || 0);
  const targetCompletion = pipelineValue > 0 ? (totalForecast / pipelineValue) * 100 : 0;
  const winRate = Number(summary?.winRate || 0);

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.h1}>Öngörüler</Text>
            <Text style={styles.h2}>Satış hedeflerinizi ve tahminlerinizi takip edin.</Text>
          </View>

          <View style={styles.kpiGrid}>
            <AppCard style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <Text style={styles.kpiTitle}>Toplam Tahmin</Text>
                <Ionicons name="trending-up-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.kpiValue}>{formatCurrency(totalForecast)}</Text>
              <Text style={styles.kpiHint}>Ağırlıklı pipeline tahmini</Text>
            </AppCard>

            <AppCard style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <Text style={styles.kpiTitle}>Hedef Gerçekleşme</Text>
                <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.kpiValue}>{`${Math.round(targetCompletion)}%`}</Text>
              <Text style={styles.kpiHint}>Tahmin / pipeline oranı</Text>
            </AppCard>

            <AppCard style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <Text style={styles.kpiTitle}>Pipeline Değeri</Text>
                <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.kpiValue}>{formatCurrency(pipelineValue)}</Text>
              <Text style={styles.kpiHint}>Açık lead toplam değeri</Text>
            </AppCard>

            <AppCard style={styles.kpiCard}>
              <View style={styles.kpiTop}>
                <Text style={styles.kpiTitle}>Kazanma Oranı</Text>
                <Ionicons name="arrow-up-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.kpiValue}>{`${winRate.toFixed(1)}%`}</Text>
              <Text style={styles.kpiHint}>Son 30 gün kapatma oranı</Text>
            </AppCard>
          </View>

          <View style={styles.tabsRow}>
            {[
              { key: 'overview', label: 'Genel Bakış' },
              { key: 'analytics', label: 'Analiz' },
              { key: 'reports', label: 'Raporlar' },
            ].map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.85}
                  style={[styles.tabPill, active ? { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' } : null]}
                >
                  <Text style={[styles.tabText, active ? { color: colors.primary } : { color: colors.textSecondary }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'overview' ? (
            <AppCard style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Satış Tahmini</Text>
                {selectedPoint ? (
                  <TouchableOpacity style={styles.clearSelectionBtn} onPress={() => setSelectedPoint(null)} activeOpacity={0.85}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {selectedPoint ? (
                <View style={[styles.tooltip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {String(selectedPoint?.name || '')}
                  </Text>
                  <Text style={[styles.tooltipLine, { color: colors.textSecondary }]} numberOfLines={1}>
                    Toplam: {formatCurrency(Number(selectedPoint?.value || 0))}
                  </Text>
                  <Text style={[styles.tooltipLine, { color: colors.textSecondary }]} numberOfLines={1}>
                    Ağırlıklı: {formatCurrency(Number(selectedPoint?.weightedValue || 0))}
                  </Text>
                </View>
              ) : null}

              <PipelineBarChart
                data={chartData}
                colors={colors}
                styles={styles}
                onSelect={(p) => setSelectedPoint(p)}
                selectedKey={selectedPoint?.key}
              />
            </AppCard>
          ) : (
            <AppCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{tab === 'analytics' ? 'Detaylı Analiz' : 'Raporlar'}</Text>
              <Text style={styles.sectionHint}>Bu modül yakında eklenecek.</Text>
            </AppCard>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 28, gap: 14 },
    header: { gap: 6, paddingTop: 6 },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    kpiCard: { padding: 14, width: '48%' },
    kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    kpiTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    kpiValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    kpiHint: { marginTop: 4, color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
    tabPill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabText: { fontSize: 12, fontWeight: '900' },
    sectionCard: { padding: 14 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
    sectionHint: { marginTop: 8, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    tooltip: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
    tooltipTitle: { fontSize: 13, fontWeight: '900' },
    tooltipLine: { marginTop: 4, fontSize: 12, fontWeight: '800' },
    clearSelectionBtn: { padding: 2 },
    chartWrap: { borderWidth: 1, borderRadius: 16, padding: 12 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendSwatch: { width: 10, height: 10, borderRadius: 3 },
    legendText: { fontSize: 12, fontWeight: '800' },
    chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
    group: { flex: 1, minWidth: 42, alignItems: 'center', gap: 8 },
    barsRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 6, justifyContent: 'center' },
    bar: { width: 10, borderRadius: 6 },
    axisLabel: { fontSize: 11, fontWeight: '800' },
    chartEmpty: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 10 },
    chartEmptyText: { fontSize: 12, fontWeight: '800' },
  });
}

export default ForecastsScreen;
