import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';
import { analyticsService } from '../api/services/analyticsService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function safeNumber(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTRY(v) {
  const n = safeNumber(v);
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function formatInt(v) {
  return Math.round(safeNumber(v)).toLocaleString('tr-TR');
}

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit' });
}

const TABS = [
  { key: 'overview', label: 'Genel', icon: 'grid-outline' },
  { key: 'funnel', label: 'Funnel', icon: 'funnel-outline' },
  { key: 'pipeline', label: 'Pipeline', icon: 'swap-vertical-outline' },
  { key: 'ads', label: 'Reklam', icon: 'megaphone-outline' },
  { key: 'forms', label: 'Formlar', icon: 'document-text-outline' },
  { key: 'meetings', label: 'Toplantı', icon: 'calendar-outline' },
  { key: 'ga4', label: 'GA4', icon: 'analytics-outline' },
  { key: 'search', label: 'Search', icon: 'search-outline' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
];

export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [forms, setForms] = useState(null);
  const [meetings, setMeetings] = useState(null);
  const [ads, setAds] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [ga4, setGa4] = useState(null);
  const [searchConsole, setSearchConsole] = useState(null);
  const [youtube, setYoutube] = useState(null);

  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      analyticsService.dashboard(),
      analyticsService.funnel(),
      analyticsService.forms(),
      analyticsService.meetings(),
      analyticsService.ads(),
      analyticsService.pipeline(),
      analyticsService.ga4(),
      analyticsService.searchConsole(),
      analyticsService.youtube(10),
    ]);

    const nextErrors = {};
    const take = (idx) => (results[idx].status === 'fulfilled' ? results[idx].value : null);
    const errMsg = (idx) => {
      const r = results[idx];
      if (r.status === 'fulfilled') return null;
      const msg = r?.reason?.response?.data?.message || r?.reason?.message || 'Hata';
      return String(msg);
    };

    const dash = take(0);
    const fun = take(1);
    const form = take(2);
    const meet = take(3);
    const ad = take(4);
    const pipe = take(5);
    const g = take(6);
    const sc = take(7);
    const yt = take(8);

    if (!dash) nextErrors.dashboard = errMsg(0);
    if (!fun) nextErrors.funnel = errMsg(1);
    if (!form) nextErrors.forms = errMsg(2);
    if (!meet) nextErrors.meetings = errMsg(3);
    if (!ad) nextErrors.ads = errMsg(4);
    if (!pipe) nextErrors.pipeline = errMsg(5);
    if (!g) nextErrors.ga4 = errMsg(6);
    if (!sc) nextErrors.search = errMsg(7);
    if (!yt) nextErrors.youtube = errMsg(8);

    setErrors(nextErrors);
    setDashboard(dash);
    setFunnel(fun);
    setForms(form);
    setMeetings(meet);
    setAds(ad);
    setPipeline(pipe);
    setGa4(g);
    setSearchConsole(sc);
    setYoutube(yt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const SummaryCard = useCallback(
    ({ title, value, subtitle, icon, accent }) => {
      const color = accent || colors.primary;
      return (
        <AppCard style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={[styles.summaryIcon, { backgroundColor: color + '18', borderColor: color + '30' }]}>
              <Ionicons name={safeIoniconName(icon, 'stats-chart-outline')} size={16} color={color} />
            </View>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {String(title)}
            </Text>
          </View>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {String(value)}
          </Text>
          {subtitle ? (
            <Text style={styles.summarySubtitle} numberOfLines={2}>
              {String(subtitle)}
            </Text>
          ) : null}
        </AppCard>
      );
    },
    [colors.primary, styles.summaryCard, styles.summaryIcon, styles.summarySubtitle, styles.summaryTitle, styles.summaryTop, styles.summaryValue],
  );

  const BarRow = useCallback(
    ({ label, value, max, color }) => {
      const v = safeNumber(value);
      const m = Math.max(1, safeNumber(max));
      const pct = Math.max(0, Math.min(1, v / m));
      const barColor = color || colors.primary;
      return (
        <View style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>
            {String(label)}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={styles.barValue} numberOfLines={1}>
            {formatInt(v)}
          </Text>
        </View>
      );
    },
    [colors.primary, styles.barFill, styles.barLabel, styles.barRow, styles.barTrack, styles.barValue],
  );

  const header = useMemo(() => {
    const hasErrors = Object.keys(errors || {}).length > 0;
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.headerCard}>
          <Text style={styles.title}>Analitik</Text>
          <Text style={styles.meta}>Entegrasyonlardan ve CRM verilerinden birleşik performans paneli.</Text>
          {hasErrors ? (
            <View style={styles.warnBox}>
              <Ionicons name={safeIoniconName('alert-circle-outline', 'alert-circle-outline')} size={16} color={colors.warning} />
              <Text style={styles.warnText} numberOfLines={3}>
                Bazı paneller yüklenemedi. Entegrasyonlar eksik olabilir.
              </Text>
            </View>
          ) : null}
        </AppCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
          {TABS.map((t) => {
            const active = t.key === activeTab;
            return (
              <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => setActiveTab(t.key)} style={[styles.tabPill, active ? styles.tabPillActive : null]}>
                <Ionicons name={safeIoniconName(t.icon, 'ellipse-outline')} size={14} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [
    activeTab,
    colors.textSecondary,
    colors.warning,
    errors,
    styles.headerCard,
    styles.meta,
    styles.tabPill,
    styles.tabPillActive,
    styles.tabPillText,
    styles.tabPillTextActive,
    styles.tabsInner,
    styles.title,
    styles.warnBox,
    styles.warnText,
  ]);

  const content = useMemo(() => {
    if (activeTab === 'overview') {
      const stats = Array.isArray(dashboard?.stats) ? dashboard.stats : [];
      const chartData = Array.isArray(dashboard?.chartData) ? dashboard.chartData : [];
      const max = Math.max(1, ...chartData.map((d) => safeNumber(d?.leads ?? d?.count)));
      return (
        <View style={{ gap: 10 }}>
          {errors?.dashboard ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Genel Panel</Text>
              <Text style={styles.meta}>{String(errors.dashboard)}</Text>
            </AppCard>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                {stats.map((s, idx) => (
                  <SummaryCard key={String(idx)} title={s?.title || '—'} value={s?.value || '—'} subtitle={s?.description} icon={String(s?.icon || 'stats-chart-outline')} />
                ))}
              </View>

              {chartData.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Lead Trend</Text>
                  <Text style={styles.meta}>Son günler (CRM lead oluşturma)</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {chartData.slice(-14).map((d, idx) => (
                      <BarRow key={String(d?.date ?? idx)} label={String(d?.date ?? '—')} value={d?.leads ?? d?.count} max={max} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeTab === 'funnel') {
      const f = funnel?.funnel || null;
      return (
        <View style={{ gap: 10 }}>
          {errors?.funnel ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Funnel</Text>
              <Text style={styles.meta}>{String(errors.funnel)}</Text>
            </AppCard>
          ) : (
            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Dönüşüm Hunisi</Text>
              <Text style={styles.meta}>Ziyaret → Lead → Toplantı → Deal</Text>
              <View style={styles.summaryGrid}>
                <SummaryCard title="Ziyaret" value={formatInt(f?.visits)} icon="globe-outline" />
                <SummaryCard title="Lead" value={formatInt(f?.leads)} icon="people-outline" />
                <SummaryCard title="Toplantı" value={formatInt(f?.meetings)} icon="calendar-outline" />
                <SummaryCard title="Deal" value={formatInt(f?.deals)} icon="briefcase-outline" />
              </View>
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Lead → Toplantı</Text>
                  <Text style={styles.kpiValue}>{`${Math.round(safeNumber(f?.conversionRates?.leadToMeeting) * 100)}%`}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Toplantı → Deal</Text>
                  <Text style={styles.kpiValue}>{`${Math.round(safeNumber(f?.conversionRates?.meetingToDeal) * 100)}%`}</Text>
                </View>
              </View>
            </AppCard>
          )}
        </View>
      );
    }

    if (activeTab === 'pipeline') {
      const summary = pipeline?.summary || null;
      const stages = Array.isArray(pipeline?.stages) ? pipeline.stages : [];
      const forecast = Array.isArray(pipeline?.forecast) ? pipeline.forecast : [];
      const maxStage = Math.max(1, ...stages.map((s) => safeNumber(s?.count)));
      const maxForecast = Math.max(1, ...forecast.map((s) => safeNumber(s?.weightedValue ?? s?.value)));
      return (
        <View style={{ gap: 10 }}>
          {errors?.pipeline ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Pipeline</Text>
              <Text style={styles.meta}>{String(errors.pipeline)}</Text>
            </AppCard>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <SummaryCard title="Açık Fırsat" value={formatInt(summary?.count)} icon="layers-outline" />
                <SummaryCard title="Toplam Değer" value={formatTRY(summary?.totalValue)} icon="cash-outline" />
                <SummaryCard title="Ağırlıklı" value={formatTRY(summary?.weightedValue)} icon="analytics-outline" />
                <SummaryCard title="Win Rate (30g)" value={`${Math.round(safeNumber(summary?.winRate))}%`} icon="trophy-outline" />
              </View>

              {stages.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Aşamalar</Text>
                  <Text style={styles.meta}>Lead sayısı ve toplam değer</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {stages
                      .slice()
                      .sort((a, b) => safeNumber(b?.count) - safeNumber(a?.count))
                      .slice(0, 12)
                      .map((s, idx) => (
                        <BarRow key={String(s?.stage ?? idx)} label={String(s?.stage || '—')} value={s?.count} max={maxStage} />
                      ))}
                  </View>
                </AppCard>
              ) : null}

              {forecast.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Tahmin (6 Ay)</Text>
                  <Text style={styles.meta}>Ağırlıklı değer (forecast)</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {forecast.slice(0, 6).map((f, idx) => (
                      <BarRow key={String(f?.month ?? idx)} label={String(f?.month || '—')} value={f?.weightedValue ?? f?.value} max={maxForecast} color={colors.secondary} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeTab === 'forms') {
      const topForms = Array.isArray(forms?.topForms) ? forms.topForms : [];
      const daily = Array.isArray(forms?.daily) ? forms.daily : [];
      const maxDaily = Math.max(1, ...daily.map((d) => safeNumber(d?.count)));
      return (
        <View style={{ gap: 10 }}>
          {errors?.forms ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Form Performansı</Text>
              <Text style={styles.meta}>{String(errors.forms)}</Text>
            </AppCard>
          ) : (
            <>
              <AppCard style={styles.card}>
                <Text style={styles.sectionTitle}>Top Formlar</Text>
                <Text style={styles.meta}>En çok doldurulan formlar</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {topForms.slice(0, 10).map((f, idx) => (
                    <BarRow key={String(f?.formId ?? idx)} label={String(f?.formName || f?.name || '—')} value={f?.count} max={Math.max(1, ...topForms.map((x) => safeNumber(x?.count)))} />
                  ))}
                </View>
              </AppCard>

              {daily.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Günlük Doldurma</Text>
                  <Text style={styles.meta}>Son 14 gün</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {daily.slice(-14).map((d, idx) => (
                      <BarRow key={String(d?.date ?? idx)} label={String(d?.date || '—')} value={d?.count} max={maxDaily} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeTab === 'ads') {
      const byObjective = Array.isArray(ads?.byObjective) ? ads.byObjective : Array.isArray(ads?.objectives) ? ads.objectives : [];
      const topAds = Array.isArray(ads?.topAds) ? ads.topAds : [];
      const maxObj = Math.max(1, ...byObjective.map((o) => safeNumber(o?.leads ?? o?.clicks ?? o?.impressions)));
      return (
        <View style={{ gap: 10 }}>
          {errors?.ads ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Reklam Performansı</Text>
              <Text style={styles.meta}>{String(errors.ads)}</Text>
            </AppCard>
          ) : (
            <>
              <AppCard style={styles.card}>
                <Text style={styles.sectionTitle}>Hedef Bazlı</Text>
                <Text style={styles.meta}>Objective / platform kırılımı</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {byObjective.slice(0, 12).map((o, idx) => (
                    <BarRow
                      key={`${String(o?.objective ?? 'obj')}-${String(o?.platform ?? idx)}`}
                      label={`${String(o?.platform || '').toUpperCase()} • ${String(o?.objective || '—')}`}
                      value={o?.leads ?? o?.clicks ?? o?.impressions}
                      max={maxObj}
                      color={colors.secondary}
                    />
                  ))}
                </View>
              </AppCard>

              {topAds.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Top Reklamlar</Text>
                  <Text style={styles.meta}>Lead / satış üreten reklamlar</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {topAds.slice(0, 10).map((a, idx) => (
                      <BarRow key={String(a?.name ?? idx)} label={String(a?.name || '—')} value={a?.leads ?? a?.sales} max={Math.max(1, ...topAds.map((x) => safeNumber(x?.leads ?? x?.sales)))} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeTab === 'meetings') {
      const items = Array.isArray(meetings?.items) ? meetings.items : Array.isArray(meetings?.top) ? meetings.top : [];
      return (
        <View style={{ gap: 10 }}>
          {errors?.meetings ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Toplantı Performansı</Text>
              <Text style={styles.meta}>{String(errors.meetings)}</Text>
            </AppCard>
          ) : (
            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Toplantılar</Text>
              <Text style={styles.meta}>Yaklaşan / son toplantılar</Text>
              {items.length === 0 ? (
                <Text style={[styles.meta, { marginTop: 10 }]}>Veri yok.</Text>
              ) : (
                <FlatList
                  data={items.slice(0, 12)}
                  keyExtractor={(it, idx) => String(it?.id ?? idx)}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  renderItem={({ item }) => (
                    <AppCard style={styles.listCard}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {String(item?.title || item?.name || 'Toplantı')}
                      </Text>
                      <Text style={styles.smallMuted} numberOfLines={2}>
                        {formatDate(item?.startAt ?? item?.start_at ?? item?.createdAt)} • {String(item?.status || '').toUpperCase() || '—'}
                      </Text>
                    </AppCard>
                  )}
                />
              )}
            </AppCard>
          )}
        </View>
      );
    }

    if (activeTab === 'ga4') {
      const overview = ga4?.overview || null;
      const daily = Array.isArray(ga4?.daily) ? ga4.daily : [];
      const maxDaily = Math.max(1, ...daily.map((d) => safeNumber(d?.sessions)));
      return (
        <View style={{ gap: 10 }}>
          {errors?.ga4 ? (
            <AppCard>
              <Text style={styles.sectionTitle}>GA4</Text>
              <Text style={styles.meta}>{String(errors.ga4)}</Text>
            </AppCard>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <SummaryCard title="Session" value={formatInt(overview?.sessions)} icon="walk-outline" />
                <SummaryCard title="Kullanıcı" value={formatInt(overview?.totalUsers)} icon="person-outline" />
                <SummaryCard title="Görüntüleme" value={formatInt(overview?.pageViews)} icon="eye-outline" />
                <SummaryCard title="Conversion" value={formatInt(overview?.conversions)} icon="flash-outline" />
              </View>

              {daily.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Günlük Session</Text>
                  <Text style={styles.meta}>Son 30 gün</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {daily.slice(-14).map((d, idx) => (
                      <BarRow key={String(d?.date ?? idx)} label={String(d?.date || '—')} value={d?.sessions} max={maxDaily} color={colors.primary} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeTab === 'search') {
      const summary = searchConsole?.summary || null;
      const topQueries = Array.isArray(searchConsole?.topQueries) ? searchConsole.topQueries : [];
      const topPages = Array.isArray(searchConsole?.topPages) ? searchConsole.topPages : [];
      return (
        <View style={{ gap: 10 }}>
          {errors?.search ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Search Console</Text>
              <Text style={styles.meta}>{String(errors.search)}</Text>
            </AppCard>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <SummaryCard title="Tıklama" value={formatInt(summary?.clicks)} icon="navigate-outline" />
                <SummaryCard title="Gösterim" value={formatInt(summary?.impressions)} icon="eye-outline" />
                <SummaryCard title="CTR" value={`${Math.round(safeNumber(summary?.ctr) * 100)}%`} icon="trending-up-outline" />
                <SummaryCard title="Ortalama Sıra" value={String(Number(safeNumber(summary?.position)).toFixed(1))} icon="list-outline" />
              </View>

              {topQueries.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Top Sorgular</Text>
                  <Text style={styles.meta}>En iyi performanslı aramalar</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {topQueries.slice(0, 10).map((q, idx) => (
                      <BarRow key={String(q?.query ?? idx)} label={String(q?.query || '—')} value={q?.clicks ?? q?.impressions} max={Math.max(1, ...topQueries.map((x) => safeNumber(x?.clicks ?? x?.impressions)))} />
                    ))}
                  </View>
                </AppCard>
              ) : null}

              {topPages.length > 0 ? (
                <AppCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Top Sayfalar</Text>
                  <Text style={styles.meta}>Sayfa bazlı performans</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {topPages.slice(0, 10).map((p, idx) => (
                      <BarRow key={String(p?.page ?? p?.path ?? idx)} label={String(p?.page || p?.path || '—')} value={p?.clicks ?? p?.impressions} max={Math.max(1, ...topPages.map((x) => safeNumber(x?.clicks ?? x?.impressions)))} />
                    ))}
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      );
    }

    const overview = youtube?.overview || null;
    const topVideos = Array.isArray(youtube?.topVideos) ? youtube.topVideos : [];
    return (
      <View style={{ gap: 10 }}>
        {errors?.youtube ? (
          <AppCard>
            <Text style={styles.sectionTitle}>YouTube</Text>
            <Text style={styles.meta}>{String(errors.youtube)}</Text>
          </AppCard>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCard title="Abone" value={formatInt(overview?.subscribers)} icon="people-outline" />
              <SummaryCard title="Görüntüleme" value={formatInt(overview?.views)} icon="eye-outline" />
              <SummaryCard title="Video" value={formatInt(overview?.videos)} icon="videocam-outline" />
              <SummaryCard title="Beğeni" value={formatInt(overview?.likes)} icon="heart-outline" />
            </View>

            <AppCard style={styles.card}>
              <Text style={styles.sectionTitle}>Top Videolar</Text>
              <Text style={styles.meta}>Son yüklenenler / en çok izlenenler</Text>
              {topVideos.length === 0 ? (
                <Text style={[styles.meta, { marginTop: 10 }]}>Veri yok.</Text>
              ) : (
                <FlatList
                  data={topVideos.slice(0, 12)}
                  keyExtractor={(v, idx) => String(v?.id ?? idx)}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  renderItem={({ item }) => (
                    <AppCard style={styles.listCard}>
                      <Text style={styles.listTitle} numberOfLines={2}>
                        {String(item?.title || 'Video')}
                      </Text>
                      <Text style={styles.smallMuted} numberOfLines={1}>
                        {formatDate(item?.publishedAt)} • {formatInt(item?.views)} görüntüleme
                      </Text>
                    </AppCard>
                  )}
                />
              )}
            </AppCard>
          </>
        )}
      </View>
    );
  }, [
    activeTab,
    ads,
    colors.primary,
    colors.secondary,
    dashboard,
    errors,
    funnel,
    forms,
    ga4,
    meetings,
    pipeline,
    searchConsole,
    styles.card,
    styles.kpi,
    styles.kpiLabel,
    styles.kpiRow,
    styles.kpiValue,
    styles.listCard,
    styles.listTitle,
    styles.meta,
    styles.sectionTitle,
    styles.smallMuted,
    styles.summaryGrid,
    youtube,
  ]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Yükleniyor…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {header}
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 28, gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 10, color: colors.textSecondary, fontWeight: '700' },

    headerCard: { padding: 14, gap: 8 },
    title: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    meta: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    warnBox: { marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.warning + '40', backgroundColor: colors.warning + '10' },
    warnText: { color: colors.textSecondary, fontWeight: '800', flex: 1, minWidth: 0 },

    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    card: { padding: 14 },
    listCard: { padding: 12 },
    listTitle: { color: colors.textPrimary, fontWeight: '900' },
    smallMuted: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },

    summaryGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    summaryCard: { flex: 1, minWidth: 160, padding: 12 },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryIcon: { width: 34, height: 34, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    summaryTitle: { color: colors.textSecondary, fontWeight: '900', fontSize: 12, flex: 1, minWidth: 0 },
    summaryValue: { marginTop: 10, color: colors.textPrimary, fontWeight: '900', fontSize: 18 },
    summarySubtitle: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    kpiRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    kpi: { flex: 1, minWidth: 150, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? colors.surface : colors.background },
    kpiLabel: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    kpiValue: { marginTop: 8, color: colors.textPrimary, fontWeight: '900', fontSize: 18 },

    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: { width: 86, color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
    barTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: isDark ? '#1f2a44' : '#e9eef7', overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 999 },
    barValue: { width: 54, textAlign: 'right', color: colors.textPrimary, fontWeight: '900', fontSize: 11 },
  });
}
