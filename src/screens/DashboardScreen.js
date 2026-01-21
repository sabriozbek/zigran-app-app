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
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../api/authService';
import apiClient from '../api/client';
import { tasksService } from '../api/services/tasksService';
import { leadsService } from '../api/services/leadsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

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

function formatTRY(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `₺${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `₺${(n / 1000).toFixed(1)}K`;
  return `₺${Math.round(n)}`;
}

function isTaskDone(task) {
  if (typeof task?.completed === 'boolean') return task.completed;
  const status = String(task?.status ?? task?.state ?? '').toLowerCase();
  return status === 'done' || status === 'completed' || status === 'success';
}

function dateKeyTR(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDayLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { weekday: 'short' });
}

function safeNumber(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildLeadChart(leads, days) {
  const today = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.push({ date: d, key: dateKeyTR(d), label: formatShortDayLabel(d), leads: 0 });
  }

  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  leads.forEach((l) => {
    const dt = l?.createdAt ?? l?.created_at ?? l?.created ?? l?.timestamp;
    const key = dateKeyTR(dt);
    const idx = key ? indexByKey.get(key) : undefined;
    if (idx !== undefined) buckets[idx].leads += 1;
  });

  return buckets.map((b) => ({ name: b.label || '', leads: b.leads }));
}

const PIPELINE_STAGES = [
  { id: 'new', label: 'Yeni Lead', color: '#3b82f6' },
  { id: 'contacted', label: 'İletişime Geçildi', color: '#eab308' },
  { id: 'qualified', label: 'Nitelikli', color: '#a855f7' },
  { id: 'proposal', label: 'Teklif Gönderildi', color: '#f97316' },
  { id: 'won', label: 'Kazanıldı', color: '#22c55e' },
  { id: 'lost', label: 'Kaybedildi', color: '#ef4444' },
];

function normalizePipelineStage(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'new';
  if (raw.includes('won') || raw.includes('kazan')) return 'won';
  if (raw.includes('lost') || raw.includes('kayb')) return 'lost';
  if (raw.includes('proposal') || raw.includes('teklif')) return 'proposal';
  if (raw.includes('qualified') || raw.includes('nitel')) return 'qualified';
  if (raw.includes('contact') || raw.includes('ileti')) return 'contacted';
  if (PIPELINE_STAGES.some((s) => s.id === raw)) return raw;
  return 'new';
}

const DashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState([]);
  const [range, setRange] = useState('7days');
  const [chartData, setChartData] = useState([]);
  const [pipelineCounts, setPipelineCounts] = useState({});
  const [allLeads, setAllLeads] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarHeaders, setAvatarHeaders] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const fetchData = useCallback(async () => {
    const results = await Promise.allSettled([
      apiClient.get('/analytics/dashboard'),
      leadsService.getAll({ limit: 250 }),
      tasksService.getAll({ limit: 250 }),
      authService.me(),
    ]);

    const analytics = results[0].status === 'fulfilled' ? results[0].value?.data : null;
    const leads = results[1].status === 'fulfilled' ? normalizeList(results[1].value) : [];
    const tasksRes = results[2].status === 'fulfilled' ? normalizeList(results[2].value) : [];
    const me = results[3].status === 'fulfilled' ? results[3].value : null;

    setProfile(me?.user ?? me?.profile ?? me?.data?.user ?? me?.data?.profile ?? me?.data ?? me ?? null);

    const sortedLeads = [...leads].sort((a, b) => {
      const ta = new Date(a?.createdAt ?? a?.created_at ?? 0).getTime();
      const tb = new Date(b?.createdAt ?? b?.created_at ?? 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    setAllLeads(sortedLeads);
    const pendingTasks = tasksRes.filter((t) => !isTaskDone(t));
    const sortedTasks = [...pendingTasks, ...tasksRes.filter((t) => isTaskDone(t))].slice(0, 250);

    setRecentLeads(sortedLeads.slice(0, 5));
    setTasks(sortedTasks.slice(0, 5));

    const counts = {};
    sortedLeads.forEach((l) => {
      const stage = normalizePipelineStage(l?.pipelineStage ?? l?.stage ?? l?.status);
      counts[stage] = (counts[stage] || 0) + 1;
    });
    setPipelineCounts(counts);

    const revenueCandidate = leads.reduce((acc, l) => {
      const v = l?.estimatedValue ?? l?.value ?? l?.amount ?? l?.revenue ?? l?.price;
      return acc + safeNumber(v);
    }, 0);

    const wonCount = leads.filter((l) => normalizePipelineStage(l?.pipelineStage ?? l?.stage ?? l?.status) === 'won').length;

    const fallbackStats = [
      { title: 'Toplam Lead', value: String(leads.length), icon: 'Users' },
      { title: 'Bekleyen Görev', value: String(pendingTasks.length), icon: 'Activity' },
      { title: 'Kazanılan', value: String(wonCount), icon: 'TrendingUp' },
      { title: 'Tahmini Ciro', value: revenueCandidate > 0 ? formatTRY(revenueCandidate) : '—', icon: 'DollarSign' },
    ];

    const apiStats = Array.isArray(analytics?.stats) ? analytics.stats : null;
    setStats(apiStats && apiStats.length > 0 ? apiStats : fallbackStats);
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

  const iconForStat = useCallback((icon) => {
    const key = String(icon || '');
    if (key === 'Users') return { name: 'people', color: colors.primary };
    if (key === 'FileText') return { name: 'document-text', color: colors.secondary };
    if (key === 'MousePointerClick') return { name: 'navigate', color: colors.warning };
    if (key === 'DollarSign') return { name: 'cash', color: colors.success };
    if (key === 'TrendingUp') return { name: 'trending-up', color: colors.success };
    if (key === 'Activity') return { name: 'pulse', color: colors.primary };
    return { name: 'stats-chart', color: colors.textSecondary };
  }, [colors.primary, colors.secondary, colors.success, colors.textSecondary, colors.warning]);

  const chart = useMemo(() => {
    const days = range === '30days' ? 30 : 7;
    return buildLeadChart(allLeads, days);
  }, [allLeads, range]);

  useEffect(() => {
    setChartData(chart);
  }, [chart]);

  const StatCard = useCallback(
    ({ title, value, icon, idx }) => {
      const conf = iconForStat(icon);
      const accent = conf.color;
      return (
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: accent + '18', borderColor: accent + '28' }]}>
            <Ionicons name={safeIoniconName(conf.name, 'stats-chart')} size={18} color={accent} />
          </View>
          <View style={styles.statBody}>
            <Text style={styles.statTitle} numberOfLines={1}>
              {String(title)}
            </Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {String(value)}
            </Text>
          </View>
        </View>
      );
    },
    [iconForStat, styles.statBody, styles.statCard, styles.statIconWrap, styles.statTitle, styles.statValue],
  );

  const maxChart = useMemo(() => {
    const m = Math.max(0, ...chartData.map((d) => safeNumber(d?.leads)));
    return m > 0 ? m : 1;
  }, [chartData]);

  const userDisplayName = useMemo(() => {
    const first = String(profile?.firstName || '').trim();
    const last = String(profile?.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const email = String(profile?.email || '').trim();
    if (email) return email;
    return 'Kullanıcı';
  }, [profile]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [profile]);

  useEffect(() => {
    let active = true;
    async function loadAvatar() {
      const url =
        profile?.avatarUrl ??
        profile?.photoUrl ??
        profile?.picture ??
        profile?.photo ??
        profile?.avatar ??
        '';
      const ref = String(url || '').trim();
      if (active) setAvatarHeaders(null);
      if (!ref) {
        if (active) setAvatarSrc('');
        return;
      }
      if (ref.startsWith('http') || ref.startsWith('data:')) {
        if (active) setAvatarSrc(ref);
        return;
      }
      // Check if it's a UUID or ID
      const isDoc = /^[0-9a-f-]{10,}$/i.test(ref) || /^[0-9]+$/.test(ref);
      if (!isDoc) {
        if (active) setAvatarSrc(ref);
        return;
      }
      try {
        const baseUrl = String(apiClient?.defaults?.baseURL || '').replace(/\/$/, '');
        const token = await authService.getToken();
        const downloadUrl = `${baseUrl}/documents/${ref}/download`;
        if (Platform.OS !== 'web') {
          if (active) {
            setAvatarSrc(downloadUrl);
            setAvatarHeaders(token ? { Authorization: `Bearer ${token}` } : null);
          }
          return;
        }
        const res = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('fail');
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        if (active) setAvatarSrc(typeof dataUrl === 'string' ? dataUrl : '');
      } catch {
        if (active) setAvatarSrc('');
      }
    }
    loadAvatar();
    return () => {
      active = false;
    };
  }, [profile]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatar}>
              {avatarSrc && !avatarBroken ? (
                <Image
                  source={
                    Platform.OS !== 'web' && avatarHeaders
                      ? { uri: avatarSrc, headers: avatarHeaders }
                      : { uri: avatarSrc }
                  }
                  style={styles.headerAvatarImg}
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <Text style={styles.headerAvatarText}>
                  {String(userDisplayName || 'K').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Kontrol Paneli</Text>
              <Text style={styles.pageSubtitle} numberOfLines={2}>
                Hoş geldin, <Text style={styles.pageSubtitleStrong}>{userDisplayName}</Text>. İşte bugünkü performansın.
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.datePill}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={styles.datePillText}>
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>

        <AppCard>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Hızlı İşlemler</Text>
              <Text style={styles.cardSubtitle}>Sık kullanılan aksiyonlar</Text>
            </View>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('LeadUpsert')}
              activeOpacity={0.85}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '2A' }]}>
                <Ionicons name="person-add" size={18} color={colors.primary} />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>
                Yeni Lead
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Leads')} activeOpacity={0.85}>
              <View
                style={[
                  styles.quickActionIconWrap,
                  { backgroundColor: colors.secondary + '14', borderColor: colors.secondary + '2A' },
                ]}
              >
                <Ionicons name="funnel" size={18} color={colors.secondary} />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>
                Leadler
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Tasks')} activeOpacity={0.85}>
              <View
                style={[
                  styles.quickActionIconWrap,
                  { backgroundColor: colors.warning + '14', borderColor: colors.warning + '2A' },
                ]}
              >
                <Ionicons name="checkbox" size={18} color={colors.warning} />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>
                Görevler
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('Conversions')}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.quickActionIconWrap,
                  { backgroundColor: colors.success + '14', borderColor: colors.success + '2A' },
                ]}
              >
                <Ionicons name="trending-up" size={18} color={colors.success} />
              </View>
              <Text style={styles.quickActionText} numberOfLines={1}>
                Dönüşümler
              </Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        <View style={styles.statsGrid}>
          {stats.map((s, idx) => (
            <StatCard key={String(s?.title ?? idx)} title={s?.title} value={s?.value} icon={s?.icon} idx={idx} />
          ))}
        </View>

        <AppCard>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Performans Özeti</Text>
              <Text style={styles.cardSubtitle}>Lead kazanımı ve genel trafik analizi</Text>
            </View>
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                style={[styles.segmentBtn, range === '7days' && styles.segmentBtnActive]}
                onPress={() => setRange('7days')}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, range === '7days' && styles.segmentTextActive]}>7 Gün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, range === '30days' && styles.segmentBtnActive]}
                onPress={() => setRange('30days')}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, range === '30days' && styles.segmentTextActive]}>30 Gün</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartWrap}>
            {chartData.map((d, idx) => {
              const value = safeNumber(d?.leads);
              const h = Math.max(2, Math.round((value / maxChart) * 140));
              return (
                <View key={`${String(d?.name)}-${idx}`} style={styles.chartBarItem}>
                  <View style={[styles.chartBar, { height: h, backgroundColor: colors.secondary }]} />
                  <Text style={styles.chartLabel} numberOfLines={1}>
                    {String(d?.name || '')}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </AppCard>

        <AppCard>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Pipeline</Text>
              <Text style={styles.cardSubtitle}>Mevcut aşamalara göre lead dağılımı</Text>
            </View>
          </View>
          <View style={styles.pipelineWrap}>
            {PIPELINE_STAGES.map((stage) => {
              const count = pipelineCounts[stage.id] || 0;
              const total = PIPELINE_STAGES.reduce((acc, s) => acc + (pipelineCounts[s.id] || 0), 0);
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <View key={stage.id} style={styles.pipelineRow}>
                  <View style={styles.pipelineRowHeader}>
                    <View style={styles.pipelineLeft}>
                      <View style={[styles.pipelineDot, { backgroundColor: stage.color }]} />
                      <Text style={styles.pipelineLabel} numberOfLines={1}>
                        {stage.label}
                      </Text>
                    </View>
                    <Text style={styles.pipelineMeta}>
                      {String(count)} ({String(percent)}%)
                    </Text>
                  </View>
                  <View style={styles.pipelineTrack}>
                    <View style={[styles.pipelineFill, { width: `${percent}%`, backgroundColor: stage.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </AppCard>

        <View style={styles.gridRow}>
          <AppCard style={styles.gridCol}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Son Lead’ler</Text>
                <Text style={styles.cardSubtitle}>En son sisteme düşen potansiyel müşteriler</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Leads')} activeOpacity={0.8}>
                <Text style={styles.seeAll}>Tümünü Gör</Text>
              </TouchableOpacity>
            </View>

            {recentLeads.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="people" size={28} color={colors.textSecondary + '66'} />
                <Text style={styles.emptyText}>Henüz lead bulunmuyor.</Text>
              </View>
            ) : (
              recentLeads.slice(0, 3).map((lead, idx) => {
                const name = lead?.name ?? lead?.email ?? 'Lead';
                const email = lead?.email ?? '';
                const stageId = normalizePipelineStage(lead?.pipelineStage ?? lead?.stage ?? lead?.status);
                const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
                return (
                  <TouchableOpacity
                    key={String(lead?.id ?? lead?._id ?? idx)}
                    style={styles.leadRow}
                    onPress={() => navigation.navigate('LeadDetail', { id: lead?.id ?? lead?._id })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.leadAvatar}>
                      <Text style={styles.leadAvatarText}>{String(name).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.leadName} numberOfLines={1}>
                        {String(name)}
                      </Text>
                      {email ? (
                        <Text style={styles.leadEmail} numberOfLines={1}>
                          {String(email)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.leadRight}>
                      <View style={styles.stagePill}>
                        <View style={[styles.stageDot, { backgroundColor: stage?.color || colors.textSecondary }]} />
                        <Text style={styles.stagePillText} numberOfLines={1}>
                          {stage?.label || stageId}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </AppCard>

          <AppCard style={styles.gridCol}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Görevler</Text>
                <Text style={styles.cardSubtitle}>Takip etmen gereken işler</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Tasks')} activeOpacity={0.8} style={styles.iconGhostBtn}>
                <Ionicons name="open-outline" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {tasks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="checkmark-circle" size={28} color={colors.textSecondary + '66'} />
                <Text style={styles.emptyText}>Bekleyen görev yok.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {tasks.slice(0, 3).map((t, idx) => {
                  const done = isTaskDone(t);
                  const due = t?.dueDate ? new Date(t.dueDate).toLocaleDateString('tr-TR') : 'Tarih yok';
                  return (
                    <View key={String(t?.id ?? t?._id ?? idx)} style={styles.taskRow}>
                      <View style={[styles.taskDot, done && styles.taskDotDone]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.taskTitle} numberOfLines={1}>
                          {String(t?.title ?? t?.name ?? 'Görev')}
                        </Text>
                        <Text style={styles.taskMeta} numberOfLines={1}>
                          {String(due)}
                          {t?.priority ? ` • ${String(t.priority)}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </AppCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: 20,
      gap: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarImg: {
      width: 48,
      height: 48,
      borderRadius: 16,
      resizeMode: 'cover',
    },
    headerAvatarText: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.primary,
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    pageSubtitle: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    pageSubtitleStrong: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    datePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    datePillText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
      columnGap: 10,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
      minHeight: 84,
    },
    statIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statBody: {
      flex: 1,
    },
    statTitle: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '800',
    },
    statValue: {
      marginTop: 4,
      fontSize: 17,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickActionBtn: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    quickActionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionText: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 13,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    cardSubtitle: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    segmentWrap: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: 'transparent',
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    segmentTextActive: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    chartWrap: {
      alignItems: 'flex-end',
      gap: 10,
      paddingTop: 8,
      paddingBottom: 2,
    },
    chartBarItem: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    chartBar: {
      width: 18,
      borderRadius: 8,
    },
    chartLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: '800',
    },
    pipelineWrap: {
      gap: 12,
    },
    pipelineRow: {
      gap: 8,
    },
    pipelineRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    pipelineLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    pipelineDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    pipelineLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    pipelineMeta: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    pipelineTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.background,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pipelineFill: {
      height: '100%',
      borderRadius: 999,
    },
    gridRow: {
      flexDirection: 'column',
      gap: 12,
    },
    gridCol: {
      width: '100%',
      minWidth: 0,
    },
    seeAll: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '900',
    },
    iconGhostBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyBox: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    emptyText: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 12,
    },
    leadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.background,
    },
    leadAvatar: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    leadAvatarText: {
      color: colors.primary,
      fontWeight: '900',
    },
    leadName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    leadEmail: {
      marginTop: 3,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    leadRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stagePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 150,
    },
    stageDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    stagePillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    taskDot: {
      marginTop: 4,
      width: 14,
      height: 14,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.textSecondary + '44',
      backgroundColor: 'transparent',
    },
    taskDotDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    taskTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    taskMeta: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    fullBtn: {
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullBtnText: {
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 12,
    },
  });
}

export default DashboardScreen;
