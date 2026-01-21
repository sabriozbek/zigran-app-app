import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppCard from '../components/AppCard';
import { segmentsService } from '../api/services/segmentsService';
import { useTheme } from '../theme/ThemeContext';

const PIPELINE_STAGES = [
  { id: 'new', label: 'New Lead', color: '#3b82f6' },
  { id: 'contacted', label: 'Contacted', color: '#eab308' },
  { id: 'qualified', label: 'Qualified', color: '#a855f7' },
  { id: 'proposal', label: 'Proposal', color: '#f97316' },
  { id: 'won', label: 'Won', color: '#22c55e' },
  { id: 'lost', label: 'Lost', color: '#ef4444' },
];

const DEFAULT_RULES_FORM = {
  operator: 'and',
  tags: [],
  tagsOperator: 'any',
  pipelineStages: [],
  company: '',
  dateFrom: '',
  dateTo: '',
  utmSource: [],
  utmCampaign: [],
  minLeadScore: undefined,
  maxLeadScore: undefined,
  jobTitle: '',
};

const TEMPLATES = [
  {
    id: 'leads',
    name: 'Potansiyel Müşteriler',
    icon: 'radio-button-on-outline',
    desc: 'Yüksek skorlu, henüz satış yapılmamış leadler.',
    type: 'B2B',
    rules: { minLeadScore: 50, pipelineStages: ['new', 'contacted'] },
  },
  {
    id: 'vip',
    name: 'VIP Müşteriler',
    icon: 'people-outline',
    desc: 'Sadık ve yüksek değerli müşteriler.',
    type: 'B2C',
    rules: { tags: ['vip'], tagsOperator: 'any' },
  },
  {
    id: 'risk',
    name: 'Riskli Grup',
    icon: 'pulse-outline',
    desc: 'Son 30 gündür aktivitesi olmayanlar.',
    type: 'Other',
    rules: { dateTo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  },
  {
    id: 'ecommerce',
    name: 'Sepeti Terk Edenler',
    icon: 'cart-outline',
    desc: 'Sepetinde ürün bırakıp almayanlar.',
    type: 'E-commerce',
    rules: { tags: ['abandoned-cart'], tagsOperator: 'any' },
  },
  {
    id: 'b2b_decision',
    name: 'Karar Vericiler',
    icon: 'briefcase-outline',
    desc: 'CEO, CTO, Yönetici gibi ünvanlara sahip kişiler.',
    type: 'B2B',
    rules: { jobTitle: 'CEO,CTO,Yönetici,Patron,Director,Founder,Kurucu' },
  },
  {
    id: 'new_signups',
    name: 'Yeni Kayıtlar',
    icon: 'add-outline',
    desc: 'Son 7 gün içinde kaydolan kullanıcılar.',
    type: 'SaaS',
    rules: { dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  },
  {
    id: 'churn_risk',
    name: 'Churn Riski',
    icon: 'pulse-outline',
    desc: 'Düşük kullanım oranına sahip müşteriler.',
    type: 'SaaS',
    rules: { maxLeadScore: 20 },
  },
  {
    id: 'high_value',
    name: 'Yüksek Değerli',
    icon: 'people-outline',
    desc: 'Yüksek harcama potansiyeli olan kurumsal müşteriler.',
    type: 'B2B',
    rules: { tags: ['enterprise', 'high-budget'], tagsOperator: 'any' },
  },
  {
    id: 'newsletter',
    name: 'Bülten Aboneleri',
    icon: 'mail-outline',
    desc: 'Sadece bülten üyeliği olan kullanıcılar.',
    type: 'Marketing',
    rules: { tags: ['newsletter'], tagsOperator: 'all' },
  },
];

export default function SegmentsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [template, setTemplate] = useState('');
  const [pendingRules, setPendingRules] = useState(null);
  const [openDetails, setOpenDetails] = useState({});
  const [loadingLeads, setLoadingLeads] = useState({});
  const [leadEmail, setLeadEmail] = useState('');
  const [openRules, setOpenRules] = useState(null);
  const [rulesForm, setRulesForm] = useState(DEFAULT_RULES_FORM);
  const [newTagText, setNewTagText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [createBusy, setCreateBusy] = useState(false);
  const [rulesBusy, setRulesBusy] = useState(false);

  const filteredSegments = useMemo(() => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return segments;
    return (segments || []).filter((s) => {
      const name = String(s?.name || '').toLowerCase();
      const desc = String(s?.description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [q, segments]);

  const viewSegments = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredSegments.slice(start, end);
  }, [filteredSegments, page, pageSize]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await segmentsService.summary();
      setSegments(Array.isArray(data) ? data : []);
    } catch (_e) {
      Alert.alert('Hata', 'Segmentler yüklenemedi.');
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchLeads = useCallback(async (segId) => {
    setLoadingLeads((prev) => ({ ...prev, [segId]: true }));
    try {
      const items = await segmentsService.getLeads(segId);
      const leads = Array.isArray(items) ? items : [];
      setSegments((prev) => prev.map((s) => (s?.id === segId ? { ...s, leads } : s)));
    } catch {
      setSegments((prev) => prev.map((s) => (s?.id === segId ? { ...s, leads: [] } : s)));
    } finally {
      setLoadingLeads((prev) => ({ ...prev, [segId]: false }));
    }
  }, []);

  const toggleDetails = useCallback(
    (segId) => {
      setOpenDetails((prev) => {
        const next = !prev?.[segId];
        if (next) fetchLeads(segId);
        return { ...(prev || {}), [segId]: next };
      });
    },
    [fetchLeads],
  );

  const applyTemplate = useCallback((t) => {
    setForm({ name: t?.name || '', description: t?.desc || '' });
    setTemplate(t?.id || '');
    setPendingRules(t?.rules ? t.rules : null);
  }, []);

  const createSegment = useCallback(async () => {
    const name = String(form?.name || '').trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const res = await segmentsService.create({ name, description: String(form?.description || '').trim() });
      if (pendingRules && res?.id) {
        await segmentsService.patchRules(res.id, pendingRules);
      }
      setForm({ name: '', description: '' });
      setTemplate('');
      setPendingRules(null);
      setOpenNew(false);
      fetchAll();
    } catch (_e) {
      Alert.alert('Hata', 'Segment oluşturulamadı.');
    } finally {
      setCreateBusy(false);
    }
  }, [fetchAll, form, pendingRules]);

  const removeSegment = useCallback(
    (id) => {
      Alert.alert('Silinsin mi?', 'Bu segment silinecek.', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await segmentsService.delete(id);
              fetchAll();
            } catch {
              Alert.alert('Hata', 'Segment silinemedi.');
            }
          },
        },
      ]);
    },
    [fetchAll],
  );

  const openRulesDialog = useCallback((s) => {
    const r = s?.rules || {};
    setOpenRules(s?.id || null);
    setRulesForm({
      operator: r?.operator || 'and',
      tags: Array.isArray(r?.tags) ? r.tags : [],
      tagsOperator: r?.tagsOperator || 'any',
      pipelineStages: Array.isArray(r?.pipelineStages)
        ? r.pipelineStages
        : r?.pipelineStage
          ? [r.pipelineStage]
          : [],
      company: r?.company || '',
      dateFrom: r?.dateFrom || '',
      dateTo: r?.dateTo || '',
      utmSource: Array.isArray(r?.utmSource) ? r.utmSource : [],
      utmCampaign: Array.isArray(r?.utmCampaign) ? r.utmCampaign : [],
      minLeadScore: typeof r?.minLeadScore === 'number' ? r.minLeadScore : undefined,
      maxLeadScore: typeof r?.maxLeadScore === 'number' ? r.maxLeadScore : undefined,
      jobTitle: r?.jobTitle || '',
    });
    setNewTagText('');
  }, []);

  const saveRules = useCallback(async () => {
    if (!openRules) return;
    setRulesBusy(true);
    try {
      await segmentsService.patchRules(openRules, rulesForm);
      const segId = openRules;
      setOpenRules(null);
      fetchAll();
      if (openDetails?.[segId]) fetchLeads(segId);
    } catch {
      Alert.alert('Hata', 'Kurallar kaydedilemedi.');
    } finally {
      setRulesBusy(false);
    }
  }, [fetchAll, fetchLeads, openDetails, openRules, rulesForm]);

  const addLead = useCallback(
    async (segId) => {
      const email = String(leadEmail || '').trim();
      if (!email) return;
      try {
        await segmentsService.addLead(segId, email);
        setLeadEmail('');
        setSegments((prev) =>
          prev.map((s) => (s?.id === segId ? { ...s, leadCount: s?.rules ? s?.leadCount : (s?.leadCount || 0) + 1 } : s)),
        );
        if (openDetails?.[segId]) fetchLeads(segId);
      } catch {
        Alert.alert('Hata', 'Lead eklenemedi.');
      }
    },
    [fetchLeads, leadEmail, openDetails],
  );

  const removeLead = useCallback(async (segId, leadId) => {
    try {
      await segmentsService.removeLead(segId, leadId);
      setSegments((prev) =>
        prev.map((s) => {
          if (s?.id !== segId) return s;
          const nextLeads = (s?.leads || []).filter((l) => l?.id !== leadId);
          return {
            ...s,
            leadCount: s?.rules ? s?.leadCount : Math.max(0, (s?.leadCount || 0) - 1),
            leads: nextLeads,
          };
        }),
      );
    } catch {
      Alert.alert('Hata', 'Lead kaldırılamadı.');
    }
  }, []);

  const downloadLeadsCsv = useCallback(async (segId) => {
    try {
      const seg = (segments || []).find((s) => s?.id === segId);
      const name = String(seg?.name || 'segment')
        .trim()
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 80);

      const items = await segmentsService.getLeads(segId);
      const leads = Array.isArray(items) ? items : [];
      const headers = [
        'id',
        'name',
        'email',
        'phone',
        'company',
        'jobTitle',
        'pipelineStage',
        'source',
        'leadScore',
        'createdAt',
      ];

      const escape = (v) => {
        const s = v === null || typeof v === 'undefined' ? '' : String(v);
        const needsQuotes = /[",\n\r]/.test(s);
        const cleaned = s.replaceAll('"', '""');
        return needsQuotes ? `"${cleaned}"` : cleaned;
      };

      const rows = [headers.join(','), ...leads.map((l) => headers.map((h) => escape(l?.[h])).join(','))].join('\n');
      await Share.share({ title: `${name}_leads.csv`, message: rows });
    } catch {
      Alert.alert('Hata', 'CSV indirilemedi.');
    }
  }, [segments]);

  const rulesSummaryText = useCallback((rules) => {
    if (!rules) return '';
    const parts = [];
    const op = rules?.operator === 'or' ? 'OR (Veya)' : 'AND (Ve)';
    parts.push(`Mantık: ${op}`);

    const stages = Array.isArray(rules?.pipelineStages)
      ? rules.pipelineStages
          .map((id) => PIPELINE_STAGES.find((ps) => ps.id === id)?.label || id)
          .filter(Boolean)
      : [];
    if (stages.length > 0) parts.push(`Pipeline: ${stages.join(', ')}`);

    if (rules?.company) parts.push(`Şirket: ${rules.company}`);
    if (rules?.jobTitle) parts.push(`Ünvan: ${String(rules.jobTitle)}`);

    if (Array.isArray(rules?.tags) && rules.tags.length > 0) {
      const tagOp = rules.tagsOperator === 'all' ? 'Tümü' : 'Herhangi';
      parts.push(`Etiket (${tagOp}): ${rules.tags.join(', ')}`);
    }

    if (Array.isArray(rules?.utmSource) && rules.utmSource.length > 0) parts.push(`UTM Source: ${rules.utmSource.join(', ')}`);
    if (Array.isArray(rules?.utmCampaign) && rules.utmCampaign.length > 0) parts.push(`UTM Campaign: ${rules.utmCampaign.join(', ')}`);

    const min = typeof rules?.minLeadScore === 'number' ? rules.minLeadScore : null;
    const max = typeof rules?.maxLeadScore === 'number' ? rules.maxLeadScore : null;
    if (min !== null || max !== null) {
      if (min !== null && max !== null) parts.push(`Skor: ${min}–${max}`);
      else if (min !== null) parts.push(`Skor: ≥ ${min}`);
      else if (max !== null) parts.push(`Skor: ≤ ${max}`);
    }

    if (rules?.dateFrom || rules?.dateTo) {
      const from = rules?.dateFrom ? rules.dateFrom : '—';
      const to = rules?.dateTo ? rules.dateTo : '—';
      parts.push(`Tarih: ${from} → ${to}`);
    }

    return parts.join(' • ');
  }, []);

  const pageInfoText = useMemo(() => `Sayfa ${page}`, [page]);

  const canPrev = page > 1;
  const canNext = viewSegments.length >= pageSize;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Segmentasyon</Text>
              <Text style={styles.meta}>Müşterileri gruplandır, toplu e‑posta gönderimlerinde kullan</Text>
            </View>
            <TouchableOpacity style={styles.primaryButtonSmall} onPress={() => setOpenNew(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.primaryButtonSmallText}>Yeni Segment</Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Yükleniyor…</Text>
          </View>
        ) : null}

        <AppCard style={styles.filterCard}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ara"
              placeholderTextColor={colors.textSecondary}
              value={q}
              onChangeText={(t) => {
                setQ(t);
                setPage(1);
              }}
            />
            <Text style={styles.pageText}>{pageInfoText}</Text>
          </View>
        </AppCard>

        <View style={styles.list}>
          {viewSegments.map((s) => {
            const segId = s?.id;
            const open = !!openDetails?.[segId];
            const leadCount = typeof s?.leadCount === 'number' ? s.leadCount : (s?.leads || []).length;
            const contactCount = typeof s?.contactCount === 'number' ? s.contactCount : null;
            const rules = s?.rules || null;
            const summary = rulesSummaryText(rules);
            const vip = Array.isArray(rules?.tags) && rules.tags.includes('vip');
            const risk = Array.isArray(rules?.tags) && rules.tags.includes('risk');

            return (
              <AppCard key={String(segId || s?.name)} style={styles.segCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {String(s?.name || '')}
                      </Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{leadCount} lead</Text>
                      </View>
                      {contactCount !== null ? (
                        <View style={[styles.badge, styles.badgeOutline]}>
                          <Text style={[styles.badgeText, styles.badgeOutlineText]}>{contactCount} kişi</Text>
                        </View>
                      ) : null}
                      {vip ? (
                        <View style={[styles.badge, styles.badgeVip]}>
                          <Text style={[styles.badgeText, styles.badgeVipText]}>VIP</Text>
                        </View>
                      ) : null}
                      {risk ? (
                        <View style={[styles.badge, styles.badgeRisk]}>
                          <Text style={[styles.badgeText, styles.badgeRiskText]}>Risk</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.cardDesc} numberOfLines={1}>
                      {s?.description ? String(s.description) : 'Açıklama yok'}
                    </Text>

                    <View style={styles.ruleBadgesRow}>
                      {typeof rules?.minLeadScore === 'number' ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgeBlue]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgeBlueText]}>Score &gt; {rules.minLeadScore}</Text>
                        </View>
                      ) : null}
                      {rules?.dateTo ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgeOrange]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgeOrangeText]}>İnaktif</Text>
                        </View>
                      ) : null}
                      {Array.isArray(rules?.pipelineStages) && rules.pipelineStages.length > 0 ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgePurple]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgePurpleText]}>Pipeline</Text>
                        </View>
                      ) : null}
                      {rules?.jobTitle ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgeGreen]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgeGreenText]}>
                            Ünvan: {String(rules.jobTitle)}
                          </Text>
                        </View>
                      ) : null}
                      {rules?.company ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgeIndigo]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgeIndigoText]}>
                            Şirket: {String(rules.company)}
                          </Text>
                        </View>
                      ) : null}
                      {Array.isArray(rules?.tags) && rules.tags.length > 0 ? (
                        <View style={[styles.ruleBadge, styles.ruleBadgePink]}>
                          <Text style={[styles.ruleBadgeText, styles.ruleBadgePinkText]}>
                            Etiket: {rules.tagsOperator === 'all' ? 'Tümü' : 'Herhangi'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {summary ? <Text style={styles.rulesSummary}>{summary}</Text> : null}
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => openRulesDialog(s)} activeOpacity={0.85}>
                      <Text style={styles.ghostBtnText}>Kurallar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => navigation.navigate('Email', { segmentId: segId })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="mail-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.ghostBtnText}>E‑posta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={() => navigation.navigate('Automations', { segmentId: segId })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="sparkles-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.ghostBtnText}>Otomasyon</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} onPress={() => downloadLeadsCsv(segId)} activeOpacity={0.85}>
                      <Ionicons name="download-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.ghostBtnText}>İndir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.outlineBtn} onPress={() => toggleDetails(segId)} activeOpacity={0.85}>
                      <Text style={styles.outlineBtnText}>{open ? 'Gizle' : 'Detay'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconDangerBtn} onPress={() => removeSegment(segId)} activeOpacity={0.85}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger || '#ef4444'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {open ? (
                  <View style={styles.detailsWrap}>
                    <View style={styles.addLeadRow}>
                      <TextInput
                        style={styles.addLeadInput}
                        placeholder="Lead e‑posta ile manuel ekle"
                        placeholderTextColor={colors.textSecondary}
                        value={leadEmail}
                        onChangeText={setLeadEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <TouchableOpacity style={styles.addLeadBtn} onPress={() => addLead(segId)} activeOpacity={0.85}>
                        <Text style={styles.addLeadBtnText}>Ekle</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.stagePillsRow}>
                      {PIPELINE_STAGES.map((ps) => {
                        const c = (s?.leads || []).filter((l) => l?.pipelineStage === ps.id).length;
                        if (c === 0) return null;
                        return (
                          <View key={ps.id} style={[styles.stagePill, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <View style={[styles.stageDot, { backgroundColor: ps.color }]} />
                            <Text style={styles.stagePillText}>{ps.label}</Text>
                            <Text style={styles.stagePillCount}>{c}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.leadsBox}>
                      {loadingLeads?.[segId] ? (
                        <View style={styles.leadsLoading}>
                          <ActivityIndicator color={colors.primary} />
                          <Text style={styles.loadingText}>Yükleniyor…</Text>
                        </View>
                      ) : (s?.leads || []).length === 0 ? (
                        <Text style={styles.emptyText}>Bu segmentte henüz kayıtlı kişi yok.</Text>
                      ) : (
                        <View style={styles.leadsList}>
                          {(s?.leads || []).map((l) => {
                            const stage = PIPELINE_STAGES.find((ps) => ps.id === l?.pipelineStage);
                            return (
                              <View key={String(l?.id || l?.email)} style={styles.leadRow}>
                                <View style={styles.leadLeft}>
                                  <View style={[styles.stageDot, { backgroundColor: stage?.color || colors.border }]} />
                                  <View style={styles.leadTextBlock}>
                                    <Text style={styles.leadName} numberOfLines={1}>
                                      {l?.name ? String(l.name) : String(l?.email || '')}
                                    </Text>
                                    <Text style={styles.leadSub} numberOfLines={1}>
                                      {l?.company ? String(l.company) : String(l?.email || '')}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.leadRight}>
                                  <View style={[styles.badge, styles.badgeOutline]}>
                                    <Text style={[styles.badgeText, styles.badgeOutlineText]} numberOfLines={1}>
                                      {l?.source ? String(l.source) : 'Manual'}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.smallGhostBtn}
                                    onPress={() => navigation.navigate('LeadDetail', { id: l?.id })}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={styles.smallGhostBtnText}>Git</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.smallGhostBtn} onPress={() => removeLead(segId, l?.id)} activeOpacity={0.85}>
                                    <Text style={styles.smallDangerText}>Kaldır</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.inactiveRow}>
                    <View style={styles.activeDot} />
                    <Text style={styles.inactiveText}>Aktif segment • Son güncelleme: Bugün</Text>
                  </View>
                )}
              </AppCard>
            );
          })}
        </View>

        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.outlineBtn, !canPrev ? styles.btnDisabled : null]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            activeOpacity={0.85}
          >
            <Text style={styles.outlineBtnText}>Önceki</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineBtn, !canNext ? styles.btnDisabled : null]}
            onPress={() => setPage((p) => p + 1)}
            disabled={!canNext}
            activeOpacity={0.85}
          >
            <Text style={styles.outlineBtnText}>Sonraki</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={openNew} animationType="fade" transparent onRequestClose={() => setOpenNew(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenNew(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <Text style={styles.modalTitle}>Yeni Segment Oluştur</Text>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={false}>
              <View style={styles.templatesGrid}>
                <TouchableOpacity
                  style={[styles.templateCard, !template ? styles.templateCardActive : styles.templateCardMuted]}
                  onPress={() => {
                    setTemplate('');
                    setPendingRules(null);
                    setForm({ name: '', description: '' });
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.templateHeader}>
                    <View style={[styles.templateIconWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="add" size={20} color={colors.textPrimary} />
                    </View>
                  </View>
                  <Text style={styles.templateName}>Özel Segment</Text>
                  <Text style={styles.templateDesc}>Kendi kurallarınızı sıfırdan oluşturun.</Text>
                </TouchableOpacity>

                {TEMPLATES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.templateCard, template === t.id ? styles.templateCardActive : styles.templateCardMuted]}
                    onPress={() => applyTemplate(t)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.templateHeader}>
                      <View style={[styles.templateIconWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Ionicons name={t.icon} size={20} color={colors.textPrimary} />
                      </View>
                      <View style={[styles.badge, styles.badgeOutline]}>
                        <Text style={[styles.badgeText, styles.badgeOutlineText]}>{t.type}</Text>
                      </View>
                    </View>
                    <Text style={styles.templateName}>
                      {t.name}
                    </Text>
                    <Text style={styles.templateDesc}>
                      {t.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Segment Adı</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn. Yüksek Potansiyelli Müşteriler"
                  placeholderTextColor={colors.textSecondary}
                  value={form.name}
                  onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Açıklama</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Segmentin amacı nedir?"
                  placeholderTextColor={colors.textSecondary}
                  value={form.description}
                  onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => setOpenNew(false)} activeOpacity={0.85}>
                <Text style={styles.modalOutlineText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, !String(form?.name || '').trim() || createBusy ? styles.btnDisabled : null]}
                onPress={createSegment}
                disabled={!String(form?.name || '').trim() || createBusy}
                activeOpacity={0.85}
              >
                {createBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!openRules} animationType="fade" transparent onRequestClose={() => setOpenRules(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenRules(null)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <Text style={styles.modalTitle}>Kurallar</Text>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Kurallar Mantığı</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, rulesForm.operator === 'and' ? styles.toggleBtnActive : null]}
                    onPress={() => setRulesForm((p) => ({ ...p, operator: 'and' }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.toggleText, rulesForm.operator === 'and' ? styles.toggleTextActive : null]}>AND (Ve)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, rulesForm.operator === 'or' ? styles.toggleBtnActive : null]}
                    onPress={() => setRulesForm((p) => ({ ...p, operator: 'or' }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.toggleText, rulesForm.operator === 'or' ? styles.toggleTextActive : null]}>OR (Veya)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Pipeline Aşamaları</Text>
                <View style={styles.checkboxGrid}>
                  {PIPELINE_STAGES.map((ps) => {
                    const checked = (rulesForm.pipelineStages || []).includes(ps.id);
                    return (
                      <TouchableOpacity
                        key={ps.id}
                        style={styles.checkboxRow}
                        onPress={() => {
                          setRulesForm((prev) => {
                            const set = new Set(prev.pipelineStages || []);
                            if (set.has(ps.id)) set.delete(ps.id);
                            else set.add(ps.id);
                            return { ...prev, pipelineStages: Array.from(set) };
                          });
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                          {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                        </View>
                        <Text style={styles.checkboxText}>{ps.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.twoColInputs}>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Şirket</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(rulesForm.company || '')}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, company: t }))}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Ünvan (Job Title)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(rulesForm.jobTitle || '')}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, jobTitle: t }))}
                    placeholder="CEO, Manager, Founder..."
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Etiketler (Tags)</Text>
                <View style={styles.tagsWrap}>
                  {(rulesForm.tags || []).map((t, i) => (
                    <View key={`${t}-${i}`} style={styles.tagPill}>
                      <Text style={styles.tagText}>{String(t)}</Text>
                      <TouchableOpacity
                        style={styles.tagX}
                        onPress={() => {
                          const next = [...(rulesForm.tags || [])];
                          next.splice(i, 1);
                          setRulesForm((p) => ({ ...p, tags: next }));
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.tagXText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.tagInputRow}>
                    <TextInput
                      style={styles.tagInput}
                      placeholder="+ Ekle"
                      placeholderTextColor={colors.textSecondary}
                      value={newTagText}
                      onChangeText={setNewTagText}
                      onSubmitEditing={() => {
                        const val = String(newTagText || '').trim();
                        if (!val) return;
                        setRulesForm((p) => ({ ...p, tags: [...(p.tags || []), val] }));
                        setNewTagText('');
                      }}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Etiket Operatörü</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, (rulesForm.tagsOperator || 'any') === 'any' ? styles.toggleBtnActive : null]}
                    onPress={() => setRulesForm((p) => ({ ...p, tagsOperator: 'any' }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.toggleText, (rulesForm.tagsOperator || 'any') === 'any' ? styles.toggleTextActive : null]}>Any (Veya)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, (rulesForm.tagsOperator || 'any') === 'all' ? styles.toggleBtnActive : null]}
                    onPress={() => setRulesForm((p) => ({ ...p, tagsOperator: 'all' }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.toggleText, (rulesForm.tagsOperator || 'any') === 'all' ? styles.toggleTextActive : null]}>All (Ve)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.twoColInputs}>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Lead Skor Min</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={typeof rulesForm.minLeadScore === 'number' ? String(rulesForm.minLeadScore) : ''}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, minLeadScore: t ? Number(t) : undefined }))}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Lead Skor Max</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="number-pad"
                    value={typeof rulesForm.maxLeadScore === 'number' ? String(rulesForm.maxLeadScore) : ''}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, maxLeadScore: t ? Number(t) : undefined }))}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.twoColInputs}>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Tarih Başlangıç</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(rulesForm.dateFrom || '')}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, dateFrom: t }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>Tarih Bitiş</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(rulesForm.dateTo || '')}
                    onChangeText={(t) => setRulesForm((p) => ({ ...p, dateTo: t }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.twoColInputs}>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>UTM Source (virgül ile)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={(rulesForm.utmSource || []).join(',')}
                    onChangeText={(t) =>
                      setRulesForm((p) => ({ ...p, utmSource: String(t || '').split(',').map((x) => x.trim()).filter(Boolean) }))
                    }
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalSectionHalf}>
                  <Text style={styles.modalLabel}>UTM Campaign (virgül ile)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={(rulesForm.utmCampaign || []).join(',')}
                    onChangeText={(t) =>
                      setRulesForm((p) => ({
                        ...p,
                        utmCampaign: String(t || '').split(',').map((x) => x.trim()).filter(Boolean),
                      }))
                    }
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => setOpenRules(null)} activeOpacity={0.85}>
                <Text style={styles.modalOutlineText}>Kapat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, rulesBusy ? styles.btnDisabled : null]}
                onPress={saveRules}
                disabled={rulesBusy}
                activeOpacity={0.85}
              >
                {rulesBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  const danger = colors.danger || '#ef4444';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 24 },
    headerCard: { padding: 14 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    primaryButtonSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    primaryButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    loadingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    filterCard: { padding: 12, marginTop: 12 },
    searchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    pageText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    list: { gap: 12 },
    segCard: { padding: 14 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    cardHeaderLeft: { flex: 1 },
    titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
    cardTitle: { fontSize: 16, fontWeight: '900', color: colors.textPrimary, maxWidth: '100%' },
    cardDesc: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    badge: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: colors.textPrimary },
    badgeOutline: { backgroundColor: colors.surface },
    badgeOutlineText: { color: colors.textSecondary },
    badgeVip: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
    badgeVipText: { color: '#fff' },
    badgeRisk: { backgroundColor: danger, borderColor: danger },
    badgeRiskText: { color: '#fff' },
    ruleBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    ruleBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    ruleBadgeText: { fontSize: 10, fontWeight: '800' },
    ruleBadgeBlue: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
    ruleBadgeBlueText: { color: '#2563eb' },
    ruleBadgeOrange: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
    ruleBadgeOrangeText: { color: '#ea580c' },
    ruleBadgePurple: { borderColor: '#e9d5ff', backgroundColor: '#faf5ff' },
    ruleBadgePurpleText: { color: '#7c3aed' },
    ruleBadgeGreen: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
    ruleBadgeGreenText: { color: '#15803d' },
    ruleBadgeIndigo: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
    ruleBadgeIndigoText: { color: '#4338ca' },
    ruleBadgePink: { borderColor: '#fbcfe8', backgroundColor: '#fdf2f8' },
    ruleBadgePinkText: { color: '#be185d' },
    rulesSummary: { marginTop: 10, color: colors.textSecondary, fontSize: 11, fontWeight: '700', lineHeight: 16 },
    cardHeaderRight: { alignItems: 'flex-end', gap: 8 },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghostBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
    outlineBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    iconDangerBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsWrap: { marginTop: 12, gap: 12 },
    addLeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    addLeadInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    addLeadBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    addLeadBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    stagePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stagePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
    stageDot: { width: 8, height: 8, borderRadius: 4 },
    stagePillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    stagePillCount: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },
    leadsBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface },
    leadsLoading: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
    emptyText: { padding: 16, textAlign: 'center', color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    leadsList: {},
    leadRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    leadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    leadTextBlock: { flex: 1, gap: 2 },
    leadName: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    leadSub: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    leadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    smallGhostBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    smallGhostBtnText: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },
    smallDangerText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
    inactiveRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
    inactiveText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    paginationRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
    btnDisabled: { opacity: 0.55 },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: 0.45 },
    modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    modalCard: { width: '100%', maxWidth: 640, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    modalTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
    modalBody: { paddingHorizontal: 16 },
    modalBodyContent: { paddingBottom: 16 },
    templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    templateCard: { width: '48%', borderWidth: 1, borderRadius: 16, padding: 12 },
    templateCardMuted: { borderColor: colors.border, backgroundColor: colors.background },
    templateCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    templateIconWrap: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    templateName: { color: colors.textPrimary, fontSize: 13, fontWeight: '900', marginBottom: 4 },
    templateDesc: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    modalSection: { marginTop: 14, gap: 8 },
    modalLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    modalFooter: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
    modalOutlineBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    modalOutlineText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    modalPrimaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
    modalPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    toggleRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
    toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    toggleText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    toggleTextActive: { color: colors.primary },
    checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    checkboxRow: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkboxText: { color: colors.textPrimary, fontWeight: '800', fontSize: 12 },
    twoColInputs: { flexDirection: 'row', gap: 10 },
    modalSectionHalf: { flex: 1, gap: 8, marginTop: 14 },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, minHeight: 44, alignItems: 'center' },
    tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tagText: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },
    tagX: { paddingHorizontal: 4, paddingVertical: 2 },
    tagXText: { color: danger, fontSize: 14, fontWeight: '900' },
    tagInputRow: { minWidth: 90 },
    tagInput: { paddingVertical: 6, paddingHorizontal: 8, color: colors.textPrimary, fontWeight: '800' },
  });
}
