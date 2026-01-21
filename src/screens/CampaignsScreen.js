import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const SYNC_JOB_KEY = 'campaigns_sync_job';
const SYNC_POLL_MS = 1500;

function isSyncRunningStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'running' || s === 'in_progress' || s === 'in-progress' || s === 'pending' || s === 'queued' || s === 'processing';
}

function isSyncCompletedStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'completed' || s === 'complete' || s === 'success' || s === 'succeeded' || s === 'done';
}

function isSyncFailedStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'failed' || s === 'error' || s === 'errored' || s === 'failure';
}

export default function CampaignsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncJob, setSyncJob] = useState(null);
  const pollRef = useRef(null);

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

  const storeSyncJob = useCallback(async (job) => {
    setSyncJob(job);
    try {
      await SecureStore.setItemAsync(SYNC_JOB_KEY, JSON.stringify(job || null));
    } catch {}
  }, []);

  const clearStoredSyncJob = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SYNC_JOB_KEY);
    } catch {}
  }, []);

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

  const pollSyncJob = useCallback(
    async (syncId) => {
      try {
        const res = await apiClient.get('/campaigns/sync/status', { params: { syncId } });
        const job = res?.data;
        await storeSyncJob(job);
        if (!isSyncRunningStatus(job?.status ?? job?.state)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          await clearStoredSyncJob();
          fetchCampaigns(dateRange.start, dateRange.end);
          return false;
        }
        return true;
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setSyncing(false);
          await clearStoredSyncJob();
          fetchCampaigns(dateRange.start, dateRange.end);
          return false;
        }
        const errorText = String(e?.message || 'Hata');
        const failed = syncJob ? { ...syncJob, status: 'failed', error: errorText } : { id: String(syncId || ''), status: 'failed', error: errorText };
        await storeSyncJob(failed);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setSyncing(false);
        return false;
      }
    },
    [clearStoredSyncJob, dateRange.end, dateRange.start, fetchCampaigns, storeSyncJob, syncJob],
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
        if (isSyncRunningStatus(parsed?.status ?? parsed?.state)) {
          const syncId = String(parsed?.id || parsed?.syncId || '');
          if (!syncId) return;
          setSyncing(true);
          const stillRunning = await pollSyncJob(syncId);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = stillRunning
            ? setInterval(() => {
                pollSyncJob(syncId);
              }, SYNC_POLL_MS)
            : null;
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
  }, [fetchCampaigns, loadGroups, pollSyncJob]);

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
        syncId = String(startRes?.data?.syncId || startRes?.data?.id || startRes?.data?.jobId || startRes?.data?.job?.id || '');
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

      const stillRunning = await pollSyncJob(syncId);
      pollRef.current = stillRunning
        ? setInterval(() => {
            pollSyncJob(syncId);
          }, SYNC_POLL_MS)
        : null;
    } catch (e) {
      await storeSyncJob({ id: 'unknown', status: 'failed', error: String(e?.message || 'Senkronizasyon hatası'), accounts: [] });
    } finally {
      if (!pollRef.current) setSyncing(false);
    }
  }, [clearStoredSyncJob, dateRange.end, dateRange.start, fetchCampaigns, pollSyncJob, storeSyncJob]);

  const runningAccount = useMemo(() => {
    const list = Array.isArray(syncJob?.accounts) ? syncJob.accounts : [];
    return list.find((a) => isSyncRunningStatus(a?.status ?? a?.state)) || null;
  }, [syncJob?.accounts]);

  const syncProgress = useMemo(() => {
    const total = syncJob?.accounts?.length || 0;
    const completed = (syncJob?.accounts || []).filter((a) => isSyncCompletedStatus(a?.status ?? a?.state)).length;
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

        {syncing || syncJob ? (
          <AppCard style={styles.syncCard}>
            <View style={styles.syncTopRow}>
              <Text style={styles.syncTitle}>Senkronizasyon</Text>
              {!isSyncRunningStatus(syncJob?.status ?? syncJob?.state) ? (
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
              {isSyncRunningStatus(syncJob?.status ?? syncJob?.state) ? (
                <>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.syncStatusText} numberOfLines={1}>
                    {runningAccount ? `${platformLabel(runningAccount.platform)} • ${syncStepLabel(runningAccount.step)}` : 'Devam ediyor'}
                  </Text>
                </>
              ) : isSyncCompletedStatus(syncJob?.status ?? syncJob?.state) ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.syncStatusText}>Tamamlandı</Text>
                </>
              ) : isSyncFailedStatus(syncJob?.status ?? syncJob?.state) ? (
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
          </AppCard>
        ) : null}

        <View style={styles.summaryRow}>
          <AppCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Toplam Harcama</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.totalSpend, 'TRY')}</Text>
          </AppCard>
          <AppCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Toplam Lead</Text>
            <Text style={styles.summaryValue}>{String(totals.totalLeads)}</Text>
          </AppCard>
          <AppCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CPL</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.cpl, 'TRY')}</Text>
          </AppCard>
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
              {activeGroupId === 'all' ? 'Tümü' : nameGroups.find((g) => String(g?.id) === String(activeGroupId))?.name || 'Seçili grup'}
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
                <AppCard key={String(c?.id ?? idx)} style={styles.campaignCard}>
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
                </AppCard>
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

function createStyles(colors) {
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
