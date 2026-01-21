import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const PACKAGE_LEVELS = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

const PlaceholderScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const title = route?.params?.title ? String(route.params.title) : 'Sayfa';
  const subtitle = route?.params?.subtitle ? String(route.params.subtitle) : 'Yakında';
  const screen = String(route?.name || '');

  if (screen === 'Products') return <ProductsView navigation={navigation} colors={colors} />;
  if (screen === 'PriceLists') return <PriceListsView navigation={navigation} colors={colors} />;
  if (screen === 'Offers') return <OffersView navigation={navigation} colors={colors} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
};

export function ModulesView({ navigation, colors }) {
  const styles = useMemo(() => createModulesStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authService.me();
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const company = me?.company ?? me?.tenant ?? me?.organization ?? null;
  const user = me?.user ?? me?.profile ?? me?.data ?? me ?? null;
  const trialEndsAtRaw = company?.trialEndsAt ?? company?.trial_ends_at ?? company?.trialEndAt ?? null;
  const planRaw = company?.plan ?? company?.package ?? company?.subscription ?? 'free';
  const planId = String(planRaw?.id ?? planRaw?.name ?? planRaw ?? 'free')
    .trim()
    .toLowerCase();
  const trialActive = trialEndsAtRaw ? new Date(trialEndsAtRaw) > new Date() : false;
  const userPlan = trialActive && planId === 'free' ? 'pro' : ['free', 'starter', 'pro', 'enterprise'].includes(planId) ? planId : 'free';
  const userLevel = PACKAGE_LEVELS[userPlan] ?? 0;
  const companyName = company?.name || company?.companyName || '';

  const modules = useMemo(
    () => [
      {
        id: 'crm',
        title: 'CRM (Lead & Kişiler)',
        description: 'Müşteri ilişkilerinizi yönetin. Lead takibi ve satış süreci.',
        icon: 'people-outline',
        status: 'active',
        route: 'Leads',
        requiredPackage: 'free',
      },
      {
        id: 'forms',
        title: 'Form Oluşturucu',
        description: 'Sürükle-bırak editör ile lead toplama formları oluşturun.',
        icon: 'document-text-outline',
        status: 'active',
        route: 'Forms',
        requiredPackage: 'starter',
      },
      {
        id: 'email',
        title: 'E-Posta Pazarlama',
        description: 'E-posta kampanyaları oluşturun ve performansı analiz edin.',
        icon: 'mail-outline',
        status: 'active',
        route: 'Email',
        requiredPackage: 'starter',
      },
      {
        id: 'sms',
        title: 'SMS Gönderimi',
        description: 'Toplu SMS gönderin ve teslimat raporlarını inceleyin.',
        icon: 'chatbox-ellipses-outline',
        status: 'active',
        route: 'Sms',
        requiredPackage: 'starter',
      },
      {
        id: 'ads',
        title: 'Reklam Yönetimi',
        description: 'Google, Meta ve LinkedIn reklamlarınızı tek yerden yönetin.',
        icon: 'megaphone-outline',
        status: 'active',
        route: 'AdsAccounts',
        requiredPackage: 'pro',
      },
      {
        id: 'segments',
        title: 'Segmentasyon',
        description: 'Müşterileri davranışlarına göre akıllı segmentlere ayırın.',
        icon: 'layers-outline',
        status: 'active',
        route: 'Segments',
        requiredPackage: 'pro',
      },
      {
        id: 'automation',
        title: 'Otomasyon',
        description: 'Tetikleyiciler ve aksiyonlar ile iş akışlarını hızlandırın.',
        icon: 'shuffle-outline',
        status: 'active',
        route: 'Automations',
        requiredPackage: 'pro',
      },
      {
        id: 'analytics',
        title: 'Gelişmiş Analitik',
        description: 'Özelleştirilebilir raporlar ve gerçek zamanlı metrikler.',
        icon: 'bar-chart-outline',
        status: 'active',
        route: 'Analytics',
        requiredPackage: 'pro',
      },
      {
        id: 'appointments',
        title: 'Randevular',
        description: 'Randevuları planlayın ve takvim entegrasyonu yapın.',
        icon: 'calendar-outline',
        status: 'active',
        route: 'Booking',
        requiredPackage: 'enterprise',
      },
      {
        id: 'calls',
        title: 'Aramalar',
        description: 'Aramaları yönetin ve çağrı raporlarını inceleyin.',
        icon: 'call-outline',
        status: 'active',
        route: 'Calls',
        requiredPackage: 'enterprise',
      },
    ],
    [],
  );

  const openModule = useCallback(
    (m) => {
      const reqLevel = PACKAGE_LEVELS[m.requiredPackage] ?? 0;
      const allowedByPlan = userLevel >= reqLevel;
      const allowedByStatus = m.status === 'active';
      if (allowedByPlan && allowedByStatus) {
        navigation.navigate(m.route);
        return;
      }
      setSelected(m);
    },
    [navigation, userLevel],
  );

  const badgeFor = useCallback(
    (m) => {
      if (m.status === 'coming_soon') return { label: 'Yakında', color: colors.textSecondary };
      const reqLevel = PACKAGE_LEVELS[m.requiredPackage] ?? 0;
      if (userLevel < reqLevel) return { label: 'Kilitli', color: colors.warning };
      return { label: 'Aktif', color: colors.success };
    },
    [colors.success, colors.textSecondary, colors.warning, userLevel],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.h1}>Modüller</Text>
        <Text style={styles.h2} numberOfLines={2}>
          {companyName ? `${companyName} • ${String(user?.email || '')}` : String(user?.email || 'Modül kataloğu')}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {modules.map((m) => {
            const badge = badgeFor(m);
            return (
              <TouchableOpacity key={m.id} style={styles.card} onPress={() => openModule(m)} activeOpacity={0.85}>
                <View style={styles.cardTopRow}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={safeIoniconName(m.icon, 'cube-outline')} size={18} color={colors.primary} />
                  </View>
                  <View style={[styles.badge, { borderColor: badge.color + '33', backgroundColor: badge.color + '12' }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {m.description}
                </Text>
                <View style={styles.cardFooterRow}>
                  <View style={styles.planPill}>
                    <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.planText}>{String(m.requiredPackage).toUpperCase()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{selected?.title || 'Modül'}</Text>
          <Text style={styles.modalDesc}>{selected?.description || ''}</Text>
          <View style={styles.modalInfoRow}>
            <View style={styles.modalPill}>
              <Text style={styles.modalPillText}>Paket: {String(selected?.requiredPackage || '').toUpperCase()}</Text>
            </View>
            <View style={styles.modalPill}>
              <Text style={styles.modalPillText}>Plan: {String(userPlan).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setSelected(null)} activeOpacity={0.85}>
              <Text style={styles.modalGhostText}>Kapat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setSelected(null);
                navigation.navigate('Packages');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalPrimaryText}>Paketleri Gör</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export function CampaignsView({ navigation, colors }) {
  const styles = useMemo(() => createCampaignsStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncJob, setSyncJob] = useState(null);
  const pollRef = useRef(null);
  const SYNC_JOB_KEY = 'campaigns_sync_job';

  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupKeywords, setNewGroupKeywords] = useState('');
  const [nameGroups, setNameGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('all');
  const [filters, setFilters] = useState({ status: [], platform: [], minSpend: '', maxSpend: '' });

  const loadGroups = useCallback(async () => {
    let localGroups = [];
    try {
      const raw = await SecureStore.getItemAsync('campaign_name_groups');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) localGroups = parsed;
    } catch {}

    try {
      const res = await apiClient.get('/settings/company');
      const serverGroups = Array.isArray(res?.data?.campaignNameGroups) ? res.data.campaignNameGroups : [];
      if (serverGroups.length > 0) {
        setNameGroups(serverGroups);
        try {
          await SecureStore.deleteItemAsync('campaign_name_groups');
        } catch {}
        return;
      }
      if (localGroups.length > 0) setNameGroups(localGroups);
    } catch {
      if (localGroups.length > 0) setNameGroups(localGroups);
    }
  }, []);

  const persistGroups = useCallback(async (next) => {
    setNameGroups(next);
    try {
      await apiClient.patch('/settings/company', { campaignNameGroups: next });
      return;
    } catch {}
    try {
      await SecureStore.setItemAsync('campaign_name_groups', JSON.stringify(next));
    } catch {}
  }, []);

  const fetchCampaigns = useCallback(async (startDate, endDate) => {
    setLoading(true);
    try {
      let url = '/campaigns';
      if (startDate && endDate) url = `/campaigns/insights?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await apiClient.get(url);
      setCampaigns(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const storeSyncJob = useCallback(
    async (job) => {
      setSyncJob(job);
      try {
        await SecureStore.setItemAsync(SYNC_JOB_KEY, JSON.stringify(job || null));
      } catch {}
    },
    [SYNC_JOB_KEY],
  );

  const clearStoredSyncJob = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SYNC_JOB_KEY);
    } catch {}
  }, [SYNC_JOB_KEY]);

  const pollSyncJob = useCallback(
    async (syncId) => {
      try {
        const res = await apiClient.get('/campaigns/sync/status', { params: { syncId } });
        const job = res?.data;
        await storeSyncJob(job);
        if (job?.status !== 'running') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          await clearStoredSyncJob();
          fetchCampaigns(dateRange.start, dateRange.end);
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          await clearStoredSyncJob();
          fetchCampaigns(dateRange.start, dateRange.end);
          return;
        }
        const next = (prev) =>
          prev ? { ...prev, status: 'failed', error: String(e?.message || 'Hata') } : { id: String(syncId || ''), status: 'failed', error: String(e?.message || 'Hata') };
        setSyncJob(next);
        try {
          await SecureStore.setItemAsync(SYNC_JOB_KEY, JSON.stringify(next(syncJob)));
        } catch {}
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setSyncing(false);
      }
    },
    [SYNC_JOB_KEY, clearStoredSyncJob, dateRange.end, dateRange.start, fetchCampaigns, storeSyncJob, syncJob],
  );

  useEffect(() => {
    fetchCampaigns();
    loadGroups();
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SYNC_JOB_KEY);
        if (cancelled) return;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed) return;
        setSyncJob(parsed);
        if (String(parsed?.status) === 'running') {
          const syncId = String(parsed?.id || parsed?.syncId || '');
          if (!syncId) return;
          setSyncing(true);
          await pollSyncJob(syncId);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(() => {
            pollSyncJob(syncId);
          }, 1000);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [SYNC_JOB_KEY, fetchCampaigns, loadGroups, pollSyncJob]);

  useEffect(() => {
    if (dateRange.start && dateRange.end) fetchCampaigns(dateRange.start, dateRange.end);
  }, [dateRange.end, dateRange.start, fetchCampaigns]);

  const toggleStatus = useCallback((value) => {
    setFilters((prev) => {
      const current = prev.status;
      const next = current.includes(value) ? current.filter((s) => s !== value) : [...current, value];
      return { ...prev, status: next };
    });
  }, []);

  const togglePlatform = useCallback((value) => {
    setFilters((prev) => {
      const current = prev.platform;
      const next = current.includes(value) ? current.filter((p) => p !== value) : [...current, value];
      return { ...prev, platform: next };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ status: [], platform: [], minSpend: '', maxSpend: '' });
    setSearchQuery('');
    setActiveGroupId('all');
    setActiveTab('all');
  }, []);

  const visibleCampaigns = useMemo(() => {
    const filtered = campaigns.filter((c) => {
      const name = String(c?.name || '').toLowerCase();
      if (searchQuery && !name.includes(String(searchQuery).toLowerCase())) return false;

      if (activeGroupId !== 'all') {
        const group = nameGroups.find((g) => String(g?.id) === String(activeGroupId));
        const keywords = Array.isArray(group?.keywords) ? group.keywords.map((k) => String(k || '').trim()).filter(Boolean) : [];
        if (!keywords.length) return false;
        const ok = keywords.some((k) => name.includes(k.toLowerCase()));
        if (!ok) return false;
      }

      const status = String(c?.status || '').toUpperCase();
      if (filters.status.length > 0 && !filters.status.includes(status)) return false;

      const platform = String(c?.platform || '').toLowerCase();
      if (filters.platform.length > 0) {
        const isMeta = platform === 'meta';
        const metaSelected = filters.platform.includes('facebook') || filters.platform.includes('instagram');
        if (isMeta && metaSelected) {
        } else if (!filters.platform.some((p) => String(p).toLowerCase() === platform)) {
          return false;
        }
      }

      const spend = Number(c?.spend) || 0;
      if (filters.minSpend && spend < Number(filters.minSpend)) return false;
      if (filters.maxSpend && spend > Number(filters.maxSpend)) return false;
      return true;
    });

    const byObjective = (list, objectivePredicate) => list.filter((c) => objectivePredicate(String(c?.objective || '')));
    if (activeTab === 'sales')
      return byObjective(filtered, (o) => ['OUTCOME_SALES', 'SHOPPING', 'PERFORMANCE_MAX', 'SMART'].includes(o) || o.includes('SALES'));
    if (activeTab === 'leads')
      return byObjective(filtered, (o) => ['OUTCOME_LEADS', 'SEARCH', 'MULTI_CHANNEL', 'LOCAL'].includes(o) || o.includes('LEAD'));
    if (activeTab === 'traffic') return byObjective(filtered, (o) => ['OUTCOME_TRAFFIC', 'DISCOVERY'].includes(o) || o.includes('TRAFFIC'));
    if (activeTab === 'awareness')
      return byObjective(filtered, (o) => ['OUTCOME_AWARENESS', 'OUTCOME_ENGAGEMENT', 'DISPLAY', 'VIDEO'].includes(o));
    return filtered;
  }, [activeGroupId, activeTab, campaigns, filters.maxSpend, filters.minSpend, filters.platform, filters.status, nameGroups, searchQuery]);

  const totals = useMemo(() => {
    const totalSpend = visibleCampaigns.reduce((acc, c) => acc + (Number(c?.spend) || 0), 0);
    const totalLeads = visibleCampaigns.reduce((acc, c) => acc + (Number(c?.leads) || 0), 0);
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    return { totalSpend, totalLeads, cpl };
  }, [visibleCampaigns]);

  const formatCurrency = useCallback((amount, currency) => {
    const finalAmount = Number(amount) || 0;
    let safeCurrency = currency;
    if (!safeCurrency || safeCurrency === 'UNK' || safeCurrency === 'unk') safeCurrency = 'TRY';
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: safeCurrency, minimumFractionDigits: 2 }).format(finalAmount);
    } catch {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(finalAmount);
    }
  }, []);

  const platformLabel = useCallback((platform) => {
    const p = String(platform || '').trim().toLowerCase();
    if (p === 'meta' || p === 'facebook' || p === 'instagram') return 'Meta';
    if (p === 'google') return 'Google Ads';
    if (p === 'linkedin') return 'LinkedIn Ads';
    if (p === 'ga4') return 'Google Analytics 4';
    if (p === 'search_console' || p === 'search-console') return 'Google Search Console';
    if (p === 'youtube') return 'YouTube';
    return platform;
  }, []);

  const platformIcon = useCallback(
    (platform) => {
      const p = String(platform || '').toLowerCase();
      if (p === 'facebook' || p === 'meta') return { name: 'logo-facebook', bg: '#2563eb' };
      if (p === 'instagram') return { name: 'logo-instagram', bg: '#db2777' };
      if (p === 'google' || p === 'ga4' || p === 'search_console' || p === 'search-console') return { name: 'logo-google', bg: colors.surface };
      if (p === 'linkedin') return { name: 'logo-linkedin', bg: colors.surface };
      if (p === 'youtube') return { name: 'logo-youtube', bg: '#dc2626' };
      return { name: 'search-outline', bg: colors.surface };
    },
    [colors.surface],
  );

  const syncStepLabel = useCallback((step) => {
    const map = {
      starting: 'Başlatılıyor',
      fetch_campaigns: 'Kampanyalar çekiliyor',
      save_campaigns: 'Kampanyalar kaydediliyor',
      fetch_ad_groups: 'Reklam grupları çekiliyor',
      save_ad_groups: 'Reklam grupları kaydediliyor',
      fetch_ads: 'Reklamlar çekiliyor',
      save_ads: 'Reklamlar kaydediliyor',
      completed: 'Tamamlandı',
      failed: 'Hata',
    };
    if (!step) return 'Bekleniyor';
    return map[step] || String(step);
  }, []);

  const syncData = useCallback(async () => {
    setSyncing(true);
    try {
      let syncId = '';
      try {
        const startRes = await apiClient.post('/campaigns/sync/start');
        syncId = String(startRes?.data?.syncId || '');
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          await apiClient.post('/campaigns/sync');
          await storeSyncJob({
            id: 'legacy',
            status: 'completed',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            accounts: [],
          });
          setSyncing(false);
          await clearStoredSyncJob();
          fetchCampaigns(dateRange.start, dateRange.end);
          return;
        }
        throw e;
      }

      if (!syncId) throw new Error('Sync ID alınamadı');

      await storeSyncJob({ id: syncId, status: 'running', startedAt: new Date().toISOString(), accounts: [] });

      if (pollRef.current) clearInterval(pollRef.current);

      await pollSyncJob(syncId);
      pollRef.current = setInterval(() => {
        pollSyncJob(syncId);
      }, 1000);
    } catch (e) {
      await storeSyncJob({ id: 'unknown', status: 'failed', error: String(e?.message || 'Senkronizasyon hatası'), accounts: [] });
    } finally {
      if (!pollRef.current) setSyncing(false);
    }
  }, [clearStoredSyncJob, dateRange.end, dateRange.start, fetchCampaigns, pollSyncJob, storeSyncJob]);

  const runningAccount = useMemo(() => {
    const list = Array.isArray(syncJob?.accounts) ? syncJob.accounts : [];
    return list.find((a) => a?.status === 'running') || null;
  }, [syncJob?.accounts]);

  const syncProgress = useMemo(() => {
    const total = syncJob?.accounts?.length || 0;
    const completed = (syncJob?.accounts || []).filter((a) => a?.status === 'completed').length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [syncJob?.accounts]);

  const addGroup = useCallback(async () => {
    const name = String(newGroupName || '').trim();
    const keywords = String(newGroupKeywords || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (!name || keywords.length === 0) {
      Alert.alert('Eksik bilgi', 'Grup adı ve en az bir anahtar kelime girin.');
      return;
    }
    const next = [...nameGroups, { id: String(Date.now()), name, keywords }];
    await persistGroups(next);
    setNewGroupName('');
    setNewGroupKeywords('');
    setGroupDialogOpen(false);
  }, [nameGroups, newGroupKeywords, newGroupName, persistGroups]);

  const removeGroup = useCallback(
    async (id) => {
      const next = nameGroups.filter((g) => String(g?.id) !== String(id));
      await persistGroups(next);
      if (String(activeGroupId) === String(id)) setActiveGroupId('all');
    },
    [activeGroupId, nameGroups, persistGroups],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>Kampanyalar</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Tüm platformlardaki reklam kampanyalarınızı takip edin ve optimize edin.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={syncData} activeOpacity={0.85} disabled={syncing}>
              <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.outlineBtnText}>{syncing ? 'Senkronize...' : 'Senkronize Et'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => Alert.alert('Yakında', 'Yeni kampanya oluşturma bu sürümde aktif değil.')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {(syncing || syncJob) ? (
          <View style={styles.syncCard}>
            <View style={styles.syncTopRow}>
              <Text style={styles.syncTitle}>Senkronizasyon</Text>
              {syncJob?.status !== 'running' ? (
                <TouchableOpacity
                  onPress={async () => {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    setSyncing(false);
                    setSyncJob(null);
                    await clearStoredSyncJob();
                  }}
                  style={styles.iconBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.syncStatusRow}>
              {syncJob?.status === 'running' ? (
                <>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.syncStatusText} numberOfLines={1}>
                    {runningAccount
                      ? `${platformLabel(runningAccount.platform)} • ${syncStepLabel(runningAccount.step)}`
                      : 'Devam ediyor'}
                  </Text>
                </>
              ) : syncJob?.status === 'completed' ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.syncStatusText}>Tamamlandı</Text>
                </>
              ) : syncJob?.status === 'failed' ? (
                <>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={styles.syncStatusText}>Hata</Text>
                </>
              ) : null}
            </View>

            {syncJob?.accounts?.length ? (
              <>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {syncProgress.completed}/{syncProgress.total} hesap
                  </Text>
                  <Text style={styles.progressText}>%{syncProgress.percent}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${syncProgress.percent}%` }]} />
                </View>
              </>
            ) : null}

            {syncJob?.error ? <Text style={styles.syncErrorText}>{String(syncJob.error)}</Text> : null}
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Toplam Harcama</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.totalSpend, 'TRY')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Toplam Lead</Text>
            <Text style={styles.summaryValue}>{String(totals.totalLeads)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CPL</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.cpl, 'TRY')}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'sales', label: 'Satış' },
            { key: 'leads', label: 'Lead' },
            { key: 'traffic', label: 'Trafik' },
            { key: 'awareness', label: 'Bilinirlik' },
          ].map((t) => {
            const active = t.key === activeTab;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabChip, active ? styles.tabChipActive : null]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.filtersRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Kampanya ara"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFiltersOpen(true)} activeOpacity={0.85}>
            <Ionicons name="filter" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.rangeRow}>
          <View style={styles.rangeCol}>
            <Text style={styles.rangeLabel}>Başlangıç</Text>
            <TextInput
              value={dateRange.start}
              onChangeText={(t) => setDateRange((p) => ({ ...p, start: t }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={styles.rangeInput}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.rangeCol}>
            <Text style={styles.rangeLabel}>Bitiş</Text>
            <TextInput
              value={dateRange.end}
              onChangeText={(t) => setDateRange((p) => ({ ...p, end: t }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              style={styles.rangeInput}
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.groupPicker} onPress={() => setGroupsOpen(true)} activeOpacity={0.85}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.groupPickerLabel}>İsim Grupları</Text>
            <Text style={styles.groupPickerValue} numberOfLines={1}>
              {activeGroupId === 'all'
                ? 'Tümü'
                : nameGroups.find((g) => String(g?.id) === String(activeGroupId))?.name || 'Seçili grup'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 18 }} />
        ) : visibleCampaigns.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Kampanya bulunamadı.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleCampaigns.map((c, idx) => {
              const p = platformIcon(c?.platform);
              const status = String(c?.status || '-');
              return (
                <View key={String(c?.id ?? idx)} style={styles.campaignCard}>
                  <View style={styles.cTop}>
                    <View style={[styles.pIconWrap, { backgroundColor: p.bg }]}>
                      <Ionicons name={safeIoniconName(p.name, 'globe-outline')} size={14} color={p.bg === colors.surface ? colors.textPrimary : '#fff'} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cName} numberOfLines={2}>
                        {String(c?.name || 'Kampanya')}
                      </Text>
                      <Text style={styles.cMeta} numberOfLines={1}>
                        {platformLabel(c?.platform)} • {String(c?.objective || '-')}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText} numberOfLines={1}>
                        {status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsGrid}>
                    <Metric label="Harcama" value={formatCurrency(c?.spend, c?.currency)} styles={styles} />
                    <Metric label="Lead" value={String(c?.leads ?? 0)} styles={styles} />
                    <Metric label="Gösterim" value={String(c?.impressions ?? 0)} styles={styles} />
                    <Metric label="Tıklama" value={String(c?.clicks ?? 0)} styles={styles} />
                    <Metric label="Dönüşüm" value={String(c?.conversions ?? 0)} styles={styles} />
                    <Metric label="Satış" value={String(c?.sales ?? 0)} styles={styles} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersOpen(false)} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtreler</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setFiltersOpen(false)} activeOpacity={0.85}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <Text style={styles.sheetSectionTitle}>Durum</Text>
            <View style={styles.chipRow}>
              {['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'].map((s) => {
                const active = filters.status.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    onPress={() => toggleStatus(s)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sheetSectionTitle, { marginTop: 12 }]}>Platform</Text>
            <View style={styles.chipRow}>
              {['facebook', 'instagram', 'google', 'linkedin', 'youtube', 'meta'].map((p) => {
                const active = filters.platform.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    onPress={() => togglePlatform(p)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sheetSectionTitle, { marginTop: 12 }]}>Harcama</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeCol}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  value={filters.minSpend}
                  onChangeText={(t) => setFilters((p) => ({ ...p, minSpend: t }))}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.rangeInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.rangeCol}>
                <Text style={styles.rangeLabel}>Max</Text>
                <TextInput
                  value={filters.maxSpend}
                  onChangeText={(t) => setFilters((p) => ({ ...p, maxSpend: t }))}
                  placeholder="99999"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.rangeInput}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={clearFilters} activeOpacity={0.85}>
                <Text style={styles.ghostText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryWideBtn} onPress={() => setFiltersOpen(false)} activeOpacity={0.85}>
                <Text style={styles.primaryWideText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={groupsOpen} transparent animationType="slide" onRequestClose={() => setGroupsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGroupsOpen(false)} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>İsim Grupları</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setGroupDialogOpen(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setGroupsOpen(false)} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <TouchableOpacity
              style={[styles.groupRow, activeGroupId === 'all' ? styles.groupRowActive : null]}
              onPress={() => {
                setActiveGroupId('all');
                setGroupsOpen(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.groupName, activeGroupId === 'all' ? styles.groupNameActive : null]}>Tümü</Text>
            </TouchableOpacity>

            {nameGroups.map((g) => {
              const active = String(g?.id) === String(activeGroupId);
              return (
                <View key={String(g?.id)} style={styles.groupRowWrap}>
                  <TouchableOpacity
                    style={[styles.groupRow, active ? styles.groupRowActive : null]}
                    onPress={() => {
                      setActiveGroupId(String(g?.id));
                      setGroupsOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.groupName, active ? styles.groupNameActive : null]} numberOfLines={1}>
                        {String(g?.name || 'Grup')}
                      </Text>
                      <Text style={styles.groupKeywords} numberOfLines={1}>
                        {(Array.isArray(g?.keywords) ? g.keywords : []).join(', ')}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.trashBtn} onPress={() => removeGroup(g?.id)} activeOpacity={0.85}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={groupDialogOpen} transparent animationType="fade" onRequestClose={() => setGroupDialogOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGroupDialogOpen(false)} />
        <KeyboardAvoidingView
          style={styles.modalCard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
        >
          <Text style={styles.modalTitle}>Yeni Grup</Text>
          <Text style={styles.modalDesc}>Anahtar kelimeleri virgülle ayırın.</Text>
          <Text style={styles.rangeLabel}>Grup Adı</Text>
          <TextInput
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="Örn: Black Friday"
            placeholderTextColor={colors.textSecondary}
            style={styles.rangeInput}
          />
          <Text style={[styles.rangeLabel, { marginTop: 10 }]}>Anahtar Kelimeler</Text>
          <TextInput
            value={newGroupKeywords}
            onChangeText={setNewGroupKeywords}
            placeholder="black friday, bf, indirim"
            placeholderTextColor={colors.textSecondary}
            style={styles.rangeInput}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setGroupDialogOpen(false)} activeOpacity={0.85}>
              <Text style={styles.modalGhostText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={addGroup} activeOpacity={0.85}>
              <Text style={styles.modalPrimaryText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value, styles }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {String(value)}
      </Text>
    </View>
  );
}

function formatMoneyTRY(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return `₺${Math.round(n).toLocaleString('tr-TR')}`;
  } catch {
    return `₺${Math.round(n)}`;
  }
}

function formatDateTR(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return String(value);
  }
}

function ProductsView({ navigation, colors }) {
  const styles = useMemo(() => createInventoryStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [draftName, setDraftName] = useState('');
  const [draftSku, setDraftSku] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftStock, setDraftStock] = useState('');
  const [draftActive, setDraftActive] = useState(true);

  const [items, setItems] = useState(() => [
    { id: 'p1', name: 'Zigran Starter', sku: 'ZG-STR', price: 1490, stock: 12, active: true, updatedAt: new Date().toISOString() },
    { id: 'p2', name: 'Zigran Pro', sku: 'ZG-PRO', price: 2990, stock: 5, active: true, updatedAt: new Date().toISOString() },
    { id: 'p3', name: 'Kurulum Hizmeti', sku: 'SVC-SETUP', price: 4500, stock: 999, active: true, updatedAt: new Date().toISOString() },
    { id: 'p4', name: 'Danışmanlık (Saatlik)', sku: 'SVC-CONS', price: 1200, stock: 50, active: false, updatedAt: new Date().toISOString() },
  ]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (items || []).filter((p) => {
      if (tab === 'active' && !p.active) return false;
      if (tab === 'archived' && p.active) return false;
      if (!q) return true;
      const hay = `${p.name || ''} ${p.sku || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, tab]);

  const stats = useMemo(() => {
    const total = (items || []).length;
    const active = (items || []).filter((x) => x.active).length;
    const lowStock = (items || []).filter((x) => Number(x.stock) > 0 && Number(x.stock) <= 5).length;
    const inventoryValue = (items || []).reduce((acc, x) => acc + (Number(x.price) || 0) * Math.max(0, Number(x.stock) || 0), 0);
    return { total, active, lowStock, inventoryValue };
  }, [items]);

  const resetDraft = useCallback(() => {
    setDraftName('');
    setDraftSku('');
    setDraftPrice('');
    setDraftStock('');
    setDraftActive(true);
    setEditing(null);
  }, []);

  const openCreate = useCallback(() => {
    resetDraft();
    setUpsertOpen(true);
  }, [resetDraft]);

  const openEdit = useCallback(
    (p) => {
      setEditing(p);
      setDraftName(String(p?.name || ''));
      setDraftSku(String(p?.sku || ''));
      setDraftPrice(String(p?.price ?? ''));
      setDraftStock(String(p?.stock ?? ''));
      setDraftActive(!!p?.active);
      setUpsertOpen(true);
    },
    [],
  );

  const save = useCallback(() => {
    const name = String(draftName || '').trim();
    if (!name) return;
    const sku = String(draftSku || '').trim();
    const price = Number(draftPrice);
    const stock = Number(draftStock);
    const safePrice = Number.isFinite(price) ? price : 0;
    const safeStock = Number.isFinite(stock) ? stock : 0;
    const now = new Date().toISOString();

    setItems((prev) => {
      const list = prev || [];
      if (editing?.id) {
        return list.map((x) =>
          String(x.id) === String(editing.id)
            ? { ...x, name, sku, price: safePrice, stock: safeStock, active: !!draftActive, updatedAt: now }
            : x,
        );
      }
      const id = `p_${Math.random().toString(36).slice(2, 10)}`;
      return [{ id, name, sku, price: safePrice, stock: safeStock, active: !!draftActive, updatedAt: now }, ...list];
    });
    setUpsertOpen(false);
    resetDraft();
  }, [draftActive, draftName, draftPrice, draftSku, draftStock, editing?.id, resetDraft]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>Ürünler</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Ürün kataloğunu yönetin, stok ve fiyatları takip edin.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('PriceLists')} activeOpacity={0.85}>
              <Ionicons name="pricetags-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={openCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Toplam</Text>
            <Text style={styles.statValue}>{String(stats.total)}</Text>
            <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
              Ürün sayısı
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Aktif</Text>
            <Text style={styles.statValue}>{String(stats.active)}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              Satışta olanlar
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.warning }]}>Kritik</Text>
            <Text style={styles.statValue}>{String(stats.lowStock)}</Text>
            <Text style={[styles.statHint, { color: colors.warning }]} numberOfLines={1}>
              Düşük stok
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Stok Değeri</Text>
            <Text style={styles.statValue}>{formatMoneyTRY(stats.inventoryValue)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Tahmini toplam
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ürün adı veya SKU ara"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.85} style={styles.searchClearBtn}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'active', label: 'Aktif' },
            { key: 'archived', label: 'Arşiv' },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabChip, active ? styles.tabChipActive : null]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabChipText, active ? styles.tabChipTextActive : null]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle}>Katalog</Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                Fiyat, stok ve durum bilgileri
              </Text>
            </View>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => navigation.navigate('Offers')} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineBtnSmallText}>Teklif</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sonuç bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((p) => {
                const stock = Number(p.stock) || 0;
                const isLow = stock > 0 && stock <= 5;
                const status = p.active ? { bg: colors.success + '14', border: colors.success + '33', fg: colors.success, label: 'Aktif' } : { bg: colors.warning + '14', border: colors.warning + '33', fg: colors.warning, label: 'Arşiv' };
                return (
                  <TouchableOpacity key={String(p.id)} style={styles.row} onPress={() => openEdit(p)} activeOpacity={0.85}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {String(p.name || 'Ürün')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {p.sku ? String(p.sku) : 'SKU yok'} • {formatMoneyTRY(p.price)}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.pill, { backgroundColor: status.bg, borderColor: status.border }]}>
                          <Text style={[styles.pillText, { color: status.fg }]} numberOfLines={1}>
                            {status.label}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: (isLow ? colors.warning : colors.textSecondary) + '12', borderColor: (isLow ? colors.warning : colors.textSecondary) + '22' }]}>
                          <Text style={[styles.pillText, { color: isLow ? colors.warning : colors.textSecondary }]} numberOfLines={1}>
                            Stok: {String(stock)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ opacity: 0.6 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={upsertOpen} transparent animationType="fade" onRequestClose={() => setUpsertOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUpsertOpen(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Ürünü Düzenle' : 'Yeni Ürün'}</Text>
              <TouchableOpacity onPress={() => setUpsertOpen(false)} activeOpacity={0.85} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <Text style={styles.label}>Ürün Adı</Text>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Örn: Kurulum Paketi"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>SKU</Text>
                    <TextInput
                      value={draftSku}
                      onChangeText={setDraftSku}
                      placeholder="ZG-0001"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Stok</Text>
                    <TextInput
                      value={draftStock}
                      onChangeText={setDraftStock}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Fiyat (₺)</Text>
                <TextInput
                  value={draftPrice}
                  onChangeText={setDraftPrice}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  keyboardType="numeric"
                />

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.toggleTitle}>Aktif</Text>
                    <Text style={styles.toggleHint} numberOfLines={2}>
                      Arşive alırsanız listelerde gizlenir.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switchPill, draftActive ? styles.switchPillOn : null]}
                    onPress={() => setDraftActive((v) => !v)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.switchDot, draftActive ? styles.switchDotOn : null]} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalGhostBtn}
                  onPress={() => {
                    setUpsertOpen(false);
                    resetDraft();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalGhostText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={save} activeOpacity={0.85} disabled={!String(draftName || '').trim()}>
                  <Text style={styles.modalPrimaryText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PriceListsView({ navigation, colors }) {
  const styles = useMemo(() => createInventoryStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [draftName, setDraftName] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('TRY');
  const [draftDefault, setDraftDefault] = useState(false);

  const [items, setItems] = useState(() => [
    { id: 'l1', name: 'Standart Liste', currency: 'TRY', isDefault: true, updatedAt: new Date().toISOString(), rules: 0 },
    { id: 'l2', name: 'Kurumsal İndirimi', currency: 'TRY', isDefault: false, updatedAt: new Date().toISOString(), rules: 3 },
    { id: 'l3', name: 'USD Liste', currency: 'USD', isDefault: false, updatedAt: new Date().toISOString(), rules: 1 },
  ]);

  const stats = useMemo(() => {
    const total = (items || []).length;
    const currencies = Array.from(new Set((items || []).map((x) => String(x.currency || '')))).filter(Boolean).length;
    const rules = (items || []).reduce((acc, x) => acc + (Number(x.rules) || 0), 0);
    const def = (items || []).find((x) => x.isDefault) || null;
    return { total, currencies, rules, def };
  }, [items]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (items || []).filter((l) => {
      if (tab === 'default' && !l.isDefault) return false;
      if (tab === 'custom' && l.isDefault) return false;
      if (!q) return true;
      return String(l.name || '').toLowerCase().includes(q);
    });
  }, [items, query, tab]);

  const resetDraft = useCallback(() => {
    setDraftName('');
    setDraftCurrency('TRY');
    setDraftDefault(false);
    setEditing(null);
  }, []);

  const openCreate = useCallback(() => {
    resetDraft();
    setUpsertOpen(true);
  }, [resetDraft]);

  const openEdit = useCallback((l) => {
    setEditing(l);
    setDraftName(String(l?.name || ''));
    setDraftCurrency(String(l?.currency || 'TRY'));
    setDraftDefault(!!l?.isDefault);
    setUpsertOpen(true);
  }, []);

  const save = useCallback(() => {
    const name = String(draftName || '').trim();
    if (!name) return;
    const currency = String(draftCurrency || 'TRY').trim().toUpperCase();
    const now = new Date().toISOString();
    setItems((prev) => {
      let list = prev || [];
      if (draftDefault) list = list.map((x) => ({ ...x, isDefault: false }));
      if (editing?.id) {
        return list.map((x) =>
          String(x.id) === String(editing.id) ? { ...x, name, currency, isDefault: !!draftDefault, updatedAt: now } : x,
        );
      }
      const id = `l_${Math.random().toString(36).slice(2, 10)}`;
      return [{ id, name, currency, isDefault: !!draftDefault, updatedAt: now, rules: 0 }, ...list];
    });
    setUpsertOpen(false);
    resetDraft();
  }, [draftCurrency, draftDefault, draftName, editing?.id, resetDraft]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>Fiyat Listeleri</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Para birimi, kural ve varsayılan liste ayarlarını yönetin.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Products')} activeOpacity={0.85}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={openCreate} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Liste</Text>
            <Text style={styles.statValue}>{String(stats.total)}</Text>
            <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
              Toplam fiyat listesi
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Para Birimi</Text>
            <Text style={styles.statValue}>{String(stats.currencies)}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              Aktif birimler
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.warning }]}>Kural</Text>
            <Text style={styles.statValue}>{String(stats.rules)}</Text>
            <Text style={[styles.statHint, { color: colors.warning }]} numberOfLines={1}>
              İndirim / artış
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Varsayılan</Text>
            <Text style={styles.statValue}>{stats.def?.name ? String(stats.def.name) : '—'}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Yeni teklifler için
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Liste adı ara"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.85} style={styles.searchClearBtn}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'default', label: 'Varsayılan' },
            { key: 'custom', label: 'Özel' },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabChip, active ? styles.tabChipActive : null]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabChipText, active ? styles.tabChipTextActive : null]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle}>Listeler</Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                Kural setleri ve para birimleri
              </Text>
            </View>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => navigation.navigate('Offers')} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineBtnSmallText}>Teklif</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Liste bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((l) => {
                const pill = l.isDefault
                  ? { bg: colors.primary + '14', border: colors.primary + '33', fg: colors.primary, label: 'Varsayılan' }
                  : { bg: colors.textSecondary + '12', border: colors.textSecondary + '22', fg: colors.textSecondary, label: 'Özel' };
                return (
                  <TouchableOpacity key={String(l.id)} style={styles.row} onPress={() => openEdit(l)} activeOpacity={0.85}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="pricetags-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {String(l.name || 'Fiyat Listesi')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {String(l.currency || 'TRY')} • Güncelleme: {formatDateTR(l.updatedAt)}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.pillText, { color: pill.fg }]} numberOfLines={1}>
                            {pill.label}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
                            Kural: {String(l.rules ?? 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ opacity: 0.6 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={upsertOpen} transparent animationType="fade" onRequestClose={() => setUpsertOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUpsertOpen(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Listeyi Düzenle' : 'Yeni Liste'}</Text>
              <TouchableOpacity onPress={() => setUpsertOpen(false)} activeOpacity={0.85} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <Text style={styles.label}>Liste Adı</Text>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Örn: Kurumsal Liste"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Para Birimi</Text>
                    <View style={styles.chipRow}>
                      {['TRY', 'USD', 'EUR'].map((c) => {
                        const active = String(draftCurrency) === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.chip, active ? styles.chipActive : null]}
                            onPress={() => setDraftCurrency(c)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{c}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.toggleTitle}>Varsayılan Yap</Text>
                    <Text style={styles.toggleHint} numberOfLines={2}>
                      Yeni teklifler bu listeyi baz alır.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switchPill, draftDefault ? styles.switchPillOn : null]}
                    onPress={() => setDraftDefault((v) => !v)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.switchDot, draftDefault ? styles.switchDotOn : null]} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalGhostBtn}
                  onPress={() => {
                    setUpsertOpen(false);
                    resetDraft();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalGhostText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={save} activeOpacity={0.85} disabled={!String(draftName || '').trim()}>
                  <Text style={styles.modalPrimaryText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function OffersView({ navigation, colors }) {
  const styles = useMemo(() => createInventoryStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTotal, setDraftTotal] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('TRY');
  const [draftStatus, setDraftStatus] = useState('draft');
  const [items, setItems] = useState(() => [
    { id: 'o1', customer: 'Acme Ltd.', title: 'Web Site + CRM Kurulumu', total: 24900, currency: 'TRY', status: 'sent', createdAt: new Date().toISOString() },
    { id: 'o2', customer: 'Nova Yazılım', title: 'Danışmanlık Paketi', total: 12000, currency: 'TRY', status: 'draft', createdAt: new Date().toISOString() },
    { id: 'o3', customer: 'Globex', title: 'Zigran Pro (Yıllık)', total: 1990, currency: 'USD', status: 'won', createdAt: new Date().toISOString() },
  ]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (items || []).filter((o) => {
      if (tab !== 'all' && String(o.status) !== tab) return false;
      if (!q) return true;
      const hay = `${o.customer || ''} ${o.title || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, tab]);

  const stats = useMemo(() => {
    const total = (items || []).length;
    const draft = (items || []).filter((x) => x.status === 'draft').length;
    const sent = (items || []).filter((x) => x.status === 'sent').length;
    const won = (items || []).filter((x) => x.status === 'won').length;
    return { total, draft, sent, won };
  }, [items]);

  const resetDraft = useCallback(() => {
    setDraftCustomer('');
    setDraftTitle('');
    setDraftTotal('');
    setDraftCurrency('TRY');
    setDraftStatus('draft');
  }, []);

  const create = useCallback(() => {
    const customer = String(draftCustomer || '').trim();
    const title = String(draftTitle || '').trim();
    if (!customer || !title) return;
    const total = Number(draftTotal);
    const safeTotal = Number.isFinite(total) ? total : 0;
    const currency = String(draftCurrency || 'TRY').trim().toUpperCase();
    const status = String(draftStatus || 'draft');
    const id = `o_${Math.random().toString(36).slice(2, 10)}`;
    setItems((prev) => [{ id, customer, title, total: safeTotal, currency, status, createdAt: new Date().toISOString() }, ...(prev || [])]);
    setUpsertOpen(false);
    resetDraft();
  }, [draftCurrency, draftCustomer, draftStatus, draftTitle, draftTotal, resetDraft]);

  const shareOffer = useCallback(async (offer) => {
    const msg = `${String(offer?.customer || '')}\n${String(offer?.title || '')}\nTutar: ${String(offer?.currency || 'TRY')} ${String(offer?.total ?? 0)}\nDurum: ${String(offer?.status || '')}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  }, []);

  const statusPill = useCallback(
    (status) => {
      const s = String(status || '');
      if (s === 'won') return { bg: colors.success + '14', border: colors.success + '33', fg: colors.success, label: 'Kazanıldı' };
      if (s === 'sent') return { bg: colors.primary + '14', border: colors.primary + '33', fg: colors.primary, label: 'Gönderildi' };
      if (s === 'lost') return { bg: colors.error + '14', border: colors.error + '33', fg: colors.error, label: 'Kaybedildi' };
      return { bg: colors.textSecondary + '12', border: colors.textSecondary + '22', fg: colors.textSecondary, label: 'Taslak' };
    },
    [colors.error, colors.primary, colors.success, colors.textSecondary],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>Teklifler</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Teklif oluşturun, durumunu takip edin ve müşteriye gönderin.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Products')} activeOpacity={0.85}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                resetDraft();
                setUpsertOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam</Text>
            <Text style={styles.statValue}>{String(stats.total)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Tüm teklifler
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.textSecondary + '12', borderColor: colors.textSecondary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taslak</Text>
            <Text style={styles.statValue}>{String(stats.draft)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Düzenlenebilir
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Gönderildi</Text>
            <Text style={styles.statValue}>{String(stats.sent)}</Text>
            <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
              Müşteriye iletildi
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Kazanıldı</Text>
            <Text style={styles.statValue}>{String(stats.won)}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              Satışa dönen
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Müşteri veya teklif ara"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.85} style={styles.searchClearBtn}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'draft', label: 'Taslak' },
            { key: 'sent', label: 'Gönderildi' },
            { key: 'won', label: 'Kazanıldı' },
            { key: 'lost', label: 'Kaybedildi' },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabChip, active ? styles.tabChipActive : null]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabChipText, active ? styles.tabChipTextActive : null]} numberOfLines={1}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle}>Son Teklifler</Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                Durum, tarih ve toplam tutar
              </Text>
            </View>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => navigation.navigate('PriceLists')} activeOpacity={0.85}>
              <Ionicons name="pricetags-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineBtnSmallText}>Fiyat</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Teklif bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((o) => {
                const pill = statusPill(o.status);
                return (
                  <View key={String(o.id)} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {String(o.customer || 'Müşteri')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {String(o.title || 'Teklif')} • {String(o.currency || 'TRY')} {String(o.total ?? 0)}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.pillText, { color: pill.fg }]} numberOfLines={1}>
                            {pill.label}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatDateTR(o.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => shareOffer(o)} activeOpacity={0.85} style={styles.iconActionBtn}>
                      <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={upsertOpen} transparent animationType="fade" onRequestClose={() => setUpsertOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUpsertOpen(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Teklif</Text>
              <TouchableOpacity onPress={() => setUpsertOpen(false)} activeOpacity={0.85} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <Text style={styles.label}>Müşteri</Text>
                <TextInput
                  value={draftCustomer}
                  onChangeText={setDraftCustomer}
                  placeholder="Örn: Acme Ltd."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <Text style={styles.label}>Başlık</Text>
                <TextInput
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="Örn: Zigran Pro Yıllık"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Tutar</Text>
                    <TextInput
                      value={draftTotal}
                      onChangeText={setDraftTotal}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Para Birimi</Text>
                    <View style={styles.chipRow}>
                      {['TRY', 'USD', 'EUR'].map((c) => {
                        const active = String(draftCurrency) === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[styles.chip, active ? styles.chipActive : null]}
                            onPress={() => setDraftCurrency(c)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{c}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Durum</Text>
                <View style={styles.chipRow}>
                  {[
                    { key: 'draft', label: 'Taslak' },
                    { key: 'sent', label: 'Gönderildi' },
                    { key: 'won', label: 'Kazanıldı' },
                    { key: 'lost', label: 'Kaybedildi' },
                  ].map((s) => {
                    const active = String(draftStatus) === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.chip, active ? styles.chipActive : null]}
                        onPress={() => setDraftStatus(s.key)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalGhostBtn}
                  onPress={() => {
                    setUpsertOpen(false);
                    resetDraft();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalGhostText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={create}
                  activeOpacity={0.85}
                  disabled={!String(draftCustomer || '').trim() || !String(draftTitle || '').trim()}
                >
                  <Text style={styles.modalPrimaryText}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
  });
}

function createInventoryStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 22, gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    h1: { color: colors.textPrimary, fontSize: 24, fontWeight: '900' },
    h2: { marginTop: 6, color: colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    outlineBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
    statLabel: { fontSize: 11, fontWeight: '900' },
    statValue: { fontSize: 20, fontWeight: '900', color: colors.textPrimary },
    statHint: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, opacity: 0.9 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, fontWeight: '800', fontSize: 13, paddingVertical: 0 },
    searchClearBtn: {
      width: 32,
      height: 32,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tabChip: {
      flexGrow: 1,
      flexBasis: '30%',
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabChipText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    tabChipTextActive: { color: '#fff' },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 12 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    cardSubtitle: { marginTop: 4, color: colors.textSecondary, fontSize: 12, fontWeight: '700', lineHeight: 16 },
    outlineBtnSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    outlineBtnSmallText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    list: { gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + '22',
      backgroundColor: colors.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    rowMeta: { marginTop: 2, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    rowBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
    pillText: { fontSize: 11, fontWeight: '900' },
    iconActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { paddingVertical: 14, alignItems: 'center' },
    emptyText: { color: colors.textSecondary, fontWeight: '800' },
    modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.55)' },
    modalWrap: { flex: 1, justifyContent: 'center', padding: 14 },
    modalCard: { maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', flex: 1, minWidth: 0 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    formGrid: { gap: 10 },
    formRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    label: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 13,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    chipTextActive: { color: '#fff' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 },
    toggleTitle: { color: colors.textPrimary, fontWeight: '900' },
    toggleHint: { marginTop: 2, color: colors.textSecondary, fontWeight: '700', fontSize: 12, lineHeight: 16 },
    switchPill: { width: 52, height: 32, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 4, justifyContent: 'center' },
    switchPillOn: { borderColor: colors.primary + '55', backgroundColor: colors.primary + '22' },
    switchDot: { width: 24, height: 24, borderRadius: 999, backgroundColor: colors.textSecondary + '66', transform: [{ translateX: 0 }] },
    switchDotOn: { backgroundColor: colors.primary, transform: [{ translateX: 20 }] },
    modalFooter: { flexDirection: 'row', gap: 10, marginTop: 10 },
    modalGhostBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    modalGhostText: { color: colors.textPrimary, fontWeight: '900' },
    modalPrimaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    modalPrimaryText: { color: '#fff', fontWeight: '900' },
  });
}

function createModulesStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    top: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
    },
    h1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    h2: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    grid: {
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '900',
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    planPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    planText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      marginTop: 'auto',
      margin: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    modalDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    modalInfoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    modalPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalPillText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: '900',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 6,
    },
    modalGhostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalGhostText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    modalPrimaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    modalPrimaryText: {
      color: '#fff',
      fontWeight: '900',
    },
  });
}

function createCampaignsStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 22,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    h1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    h2: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    outlineBtnText: {
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 12,
    },
    primaryBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    syncTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    syncTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    syncStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    syncStatusText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      flexShrink: 1,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    progressBar: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    syncErrorText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '800',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
      gap: 6,
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    tabsRow: {
      paddingVertical: 2,
      gap: 8,
    },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabChipActive: {
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '14',
    },
    tabText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '900',
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    filterBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    rangeCol: {
      flex: 1,
      gap: 6,
    },
    rangeLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    rangeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    groupPicker: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    groupPickerLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    groupPickerValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 2,
    },
    empty: {
      paddingVertical: 22,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontWeight: '800',
    },
    list: {
      gap: 12,
      marginTop: 2,
    },
    campaignCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    cTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    cMeta: {
      marginTop: 2,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCell: {
      width: '31%',
      minWidth: 100,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      backgroundColor: colors.background,
      gap: 4,
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.55)',
    },
    sheet: {
      marginTop: 'auto',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxHeight: '85%',
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    sheetContent: {
      padding: 16,
      paddingBottom: 24,
    },
    sheetSectionTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: {
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '14',
    },
    filterChipText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    filterChipTextActive: {
      color: colors.primary,
      fontWeight: '900',
    },
    sheetActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 16,
    },
    ghostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    ghostText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    primaryWideBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    primaryWideText: {
      color: '#fff',
      fontWeight: '900',
    },
    groupRowWrap: {
      marginTop: 10,
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    groupRowActive: {
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '14',
    },
    groupName: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    groupNameActive: {
      color: colors.primary,
    },
    groupKeywords: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 2,
    },
    trashBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '33',
      backgroundColor: colors.error + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCard: {
      marginTop: 'auto',
      margin: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    modalDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 6,
    },
    modalGhostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalGhostText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    modalPrimaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    modalPrimaryText: {
      color: '#fff',
      fontWeight: '900',
    },
  });
}

export default PlaceholderScreen;
