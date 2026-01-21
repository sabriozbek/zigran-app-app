import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pipelinesService } from '../api/services/pipelinesService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₺0';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);
}

const PIPELINE_STAGES = [
  { id: 'new', label: 'Yeni', color: '#3b82f6' },
  { id: 'contacted', label: 'İletişimde', color: '#eab308' },
  { id: 'qualified', label: 'Nitelikli', color: '#a855f7' },
  { id: 'proposal', label: 'Teklif', color: '#f97316' },
  { id: 'negotiation', label: 'Pazarlık', color: '#6366f1' },
  { id: 'won', label: 'Kazanıldı', color: '#22c55e' },
  { id: 'lost', label: 'Kaybedildi', color: '#ef4444' },
];

function normalizeStage(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'new';
  if (PIPELINE_STAGES.some((s) => s.id === raw)) return raw;
  if (raw.includes('won') || raw.includes('kazan')) return 'won';
  if (raw.includes('lost') || raw.includes('kayb')) return 'lost';
  if (raw.includes('proposal') || raw.includes('teklif')) return 'proposal';
  if (raw.includes('qualif') || raw.includes('nitel')) return 'qualified';
  if (raw.includes('contact') || raw.includes('ileti')) return 'contacted';
  if (raw.includes('nego') || raw.includes('pazar')) return 'negotiation';
  return 'new';
}

function getDealId(item, index) {
  return String(item?.id ?? item?._id ?? item?.dealId ?? item?.deal_id ?? index);
}

const PipelinesScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const dragPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragMetaRef = useRef({ active: false, startX: 0, startY: 0, item: null });
  const [dragging, setDragging] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOrigin, setDragOrigin] = useState({ x: 16, y: 140 });
  const columnRefs = useRef({});

  const fetchData = useCallback(async () => {
    try {
      const res = await pipelinesService.getAll();
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

  const moveDealToStage = useCallback(
    async (item, nextStageId) => {
      const dealId = item?.id ?? item?._id ?? item?.dealId ?? item?.deal_id;
      if (!dealId) return;

      const prevStage = normalizeStage(item?.pipelineStage ?? item?.stage ?? item?.status);
      if (prevStage === nextStageId) return;

      setData((prev) =>
        prev.map((d, idx) => {
          const id = getDealId(d, idx);
          if (id !== String(dealId)) return d;
          return { ...d, stage: nextStageId, pipelineStage: nextStageId, status: nextStageId };
        }),
      );

      setUpdatingId(String(dealId));
      try {
        await pipelinesService.update(dealId, { stage: nextStageId, pipelineStage: nextStageId, status: nextStageId });
      } catch {
        await fetchData();
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchData],
  );

  const measureInWindowAsync = useCallback((ref) => {
    return new Promise((resolve) => {
      if (!ref || typeof ref.measureInWindow !== 'function') {
        resolve(null);
        return;
      }
      ref.measureInWindow((x, y, w, h) => resolve({ x, y, w, h }));
    });
  }, []);

  const findDropStage = useCallback(
    async (pageX, pageY) => {
      const entries = Object.entries(columnRefs.current || {});
      for (const [stageId, ref] of entries) {
        const m = await measureInWindowAsync(ref);
        if (!m) continue;
        const withinX = pageX >= m.x && pageX <= m.x + m.w;
        const withinY = pageY >= m.y && pageY <= m.y + m.h;
        if (withinX && withinY) return stageId;
      }
      return null;
    },
    [measureInWindowAsync],
  );

  const stopDragging = useCallback(() => {
    dragMetaRef.current = { active: false, startX: 0, startY: 0, item: null };
    dragPan.setValue({ x: 0, y: 0 });
    setDragging(false);
    setDragItem(null);
    setDragOrigin({ x: 16, y: 140 });
  }, [dragPan]);

  const startDragging = useCallback(
    (item, evt) => {
      if (!item) return;
      const pageX = evt?.nativeEvent?.pageX;
      const pageY = evt?.nativeEvent?.pageY;
      if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
      dragMetaRef.current = { active: true, startX: pageX, startY: pageY, item };
      dragPan.setValue({ x: 0, y: 0 });
      setDragOrigin({ x: Math.max(12, pageX - 135), y: Math.max(80, pageY - 60) });
      setDragItem(item);
      setDragging(true);
    },
    [dragPan],
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        dragPan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: async (_, gesture) => {
        const meta = dragMetaRef.current;
        if (!meta?.active || !meta?.item) {
          stopDragging();
          return;
        }
        const dropX = gesture.moveX;
        const dropY = gesture.moveY;
        const nextStage = await findDropStage(dropX, dropY);
        const item = meta.item;
        stopDragging();
        if (nextStage) await moveDealToStage(item, nextStage);
      },
      onPanResponderTerminate: () => {
        stopDragging();
      },
    });
  }, [dragPan, findDropStage, moveDealToStage, stopDragging]);

  const dealsByStage = useMemo(() => {
    const grouped = {};
    for (const s of PIPELINE_STAGES) grouped[s.id] = [];
    for (let i = 0; i < data.length; i += 1) {
      const item = data[i];
      const stageId = normalizeStage(item?.pipelineStage ?? item?.stage ?? item?.status);
      if (!grouped[stageId]) grouped[stageId] = [];
      grouped[stageId].push(item);
    }
    return grouped;
  }, [data]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Satış Fırsatları</Text>
          <Text style={styles.h2}>Sürükle-bırak ile etap değiştir</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView
          style={styles.flex}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentInsetAdjustmentBehavior="always"
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
            {PIPELINE_STAGES.map((stage) => {
              const list = dealsByStage[stage.id] || [];
              return (
                <View
                  key={stage.id}
                  style={styles.column}
                  ref={(r) => {
                    if (r) columnRefs.current[stage.id] = r;
                  }}
                >
                  <View style={styles.columnHeader}>
                    <View style={styles.columnHeaderLeft}>
                      <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
                      <Text style={styles.columnTitle} numberOfLines={1}>
                        {stage.label}
                      </Text>
                    </View>
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{String(list.length)}</Text>
                    </View>
                  </View>

                  <View style={styles.columnBody}>
                    {list.length === 0 ? (
                      <View style={styles.emptyCol}>
                        <Text style={styles.emptyColText}>—</Text>
                      </View>
                    ) : (
                      list.map((item, idx) => {
                        const title = item?.title || item?.name || 'Fırsat';
                        const value = item?.value ?? item?.amount ?? 0;
                        const company = item?.companyName || item?.company;
                        const dealId = getDealId(item, idx);
                        const isUpdating = updatingId && String(dealId) === String(updatingId);
                        return (
                          <AppCard
                            key={dealId}
                            style={[styles.card, isUpdating && { opacity: 0.65 }]}
                            onPress={() => navigation.navigate('LeadDetail', { id: item?.id ?? item?._id })}
                          >
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onLongPress={(e) => startDragging(item, e)}
                              delayLongPress={180}
                              disabled={Boolean(isUpdating)}
                            >
                              <View style={styles.cardRow}>
                                <View style={styles.iconBox}>
                                  <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                                </View>
                                <View style={styles.cardInfo}>
                                  <Text style={styles.cardTitle} numberOfLines={1}>
                                    {String(title)}
                                  </Text>
                                  {company ? (
                                    <Text style={styles.cardSub} numberOfLines={1}>
                                      {String(company)}
                                    </Text>
                                  ) : null}
                                  <View style={styles.metaRow}>
                                    <Text style={[styles.valueText, { color: colors.success }]} numberOfLines={1}>
                                      {formatCurrency(value)}
                                    </Text>
                                  </View>
                                </View>
                                <Ionicons
                                  name="chevron-forward"
                                  size={18}
                                  color={colors.textSecondary}
                                  style={{ opacity: 0.5 }}
                                />
                              </View>
                            </TouchableOpacity>
                          </AppCard>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {data.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="swap-horizontal-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Fırsat bulunamadı.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {dragging && dragItem ? (
        <View style={styles.dragOverlay} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.dragCard,
              { left: dragOrigin.x, top: dragOrigin.y },
              {
                transform: [
                  { translateX: dragPan.x },
                  { translateY: dragPan.y },
                ],
              },
            ]}
          >
            <View style={styles.dragCardInner}>
              <Text style={styles.dragTitle} numberOfLines={1}>
                {String(dragItem?.title || dragItem?.name || 'Fırsat')}
              </Text>
              <Text style={styles.dragSub} numberOfLines={1}>
                {String(dragItem?.companyName || dragItem?.company || '')}
              </Text>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: { padding: 16 },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    board: { paddingHorizontal: 16, paddingBottom: 18, gap: 12 },
    column: {
      width: 290,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
    },
    columnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    columnHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    stageDot: { width: 10, height: 10, borderRadius: 999 },
    columnTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 13, flex: 1 },
    countPill: {
      minWidth: 28,
      paddingHorizontal: 10,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    columnBody: { paddingTop: 12, gap: 10 },
    card: { padding: 0 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1, gap: 4 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    cardSub: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    valueText: { fontSize: 13, fontWeight: '900' },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
    emptyCol: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    emptyColText: { color: colors.textSecondary, fontWeight: '900' },
    dragOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: 'transparent',
    },
    dragCard: {
      position: 'absolute',
      width: 270,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    dragCardInner: { padding: 14, gap: 6 },
    dragTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 14 },
    dragSub: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
  });
}

export default PipelinesScreen;
