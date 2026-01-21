import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { leadsService } from '../api/services/leadsService';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const DEFAULT_PIPELINE_STAGES = [
  { id: 'new', label: 'Yeni Lead', color: '#3b82f6' },
  { id: 'contacted', label: 'İletişime Geçildi', color: '#eab308' },
  { id: 'qualified', label: 'Nitelikli', color: '#a855f7' },
  { id: 'proposal', label: 'Teklif Gönderildi', color: '#f97316' },
  { id: 'negotiation', label: 'Pazarlık', color: '#6366f1' },
  { id: 'won', label: 'Kazanıldı', color: '#22c55e' },
  { id: 'lost', label: 'Kaybedildi', color: '#ef4444' },
];

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

function safeNumber(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatTRY(value) {
  const n = safeNumber(value);
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `₺${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `₺${(n / 1000).toFixed(1)}K`;
  return `₺${Math.round(n)}`;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

const LeadDetailScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const leadId = route?.params?.id ?? route?.params?.leadId ?? route?.params?._id ?? null;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(route?.params?.lead ?? null);
  const [history, setHistory] = useState([]);
  const [calls, setCalls] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [pipelineStageOptions, setPipelineStageOptions] = useState(DEFAULT_PIPELINE_STAGES);
  const [companySettings, setCompanySettings] = useState(null);
  const [activeTab, setActiveTab] = useState('activity');
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [productDraft, setProductDraft] = useState('');

  const fetchLead = useCallback(async () => {
    if (!leadId) return;
    const res = await leadsService.getOne(leadId);
    setLead(res);
  }, [leadId]);

  const fetchHistory = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await leadsService.getHistory(leadId);
      setHistory(normalizeList(res));
    } catch {
      setHistory([]);
    }
  }, [leadId]);

  const fetchCalls = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await leadsService.getCalls(leadId);
      setCalls(normalizeList(res));
    } catch {
      setCalls([]);
    }
  }, [leadId]);

  const fetchConversions = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await apiClient.get('/conversions', { params: { leadId } });
      setConversions(normalizeList(res?.data));
    } catch {
      setConversions([]);
    }
  }, [leadId]);

  const fetchCompanySettings = useCallback(async () => {
    try {
      const res = await apiClient.get('/settings/company');
      setCompanySettings(res?.data ?? null);
      const stages = res?.data?.pipelineStages;
      if (Array.isArray(stages) && stages.length > 0) {
        setPipelineStageOptions(
          stages.map((s) => ({
            id: String(s?.id ?? ''),
            label: String(s?.label ?? s?.name ?? ''),
            color: typeof s?.color === 'string' ? s.color : '#3b82f6',
          })),
        );
      } else {
        setPipelineStageOptions(DEFAULT_PIPELINE_STAGES);
      }
    } catch {
      setCompanySettings(null);
      setPipelineStageOptions(DEFAULT_PIPELINE_STAGES);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([fetchLead(), fetchHistory(), fetchCalls(), fetchConversions(), fetchCompanySettings()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCalls, fetchCompanySettings, fetchConversions, fetchHistory, fetchLead]);

  const updateLead = useCallback(
    async (field, value) => {
      if (!leadId) return;
      setSavingField(true);
      try {
        const res = await leadsService.update(leadId, { [field]: value });
        setLead(res);
        setEditing(null);
        if (field === 'pipelineStage') await fetchHistory();
      } catch {
        Alert.alert('Hata', 'Güncelleme başarısız.');
      } finally {
        setSavingField(false);
      }
    },
    [fetchHistory, leadId],
  );

  const retryConversion = useCallback(
    async (conversionId) => {
      try {
        await apiClient.post(`/conversions/${conversionId}/retry`);
        await fetchConversions();
      } catch {
        Alert.alert('Hata', 'Tekrar deneme başarısız.');
      }
    },
    [fetchConversions],
  );

  const analyzeLeadWithAi = useCallback(async () => {
    if (!leadId) return;
    try {
      setAiAnalyzing(true);
      const res = await apiClient.post('/ai/analyze/lead', { leadId });
      setAiInsight(res?.data ?? null);
    } catch (_e) {
      Alert.alert('Hata', 'AI analizi alınamadı.');
    } finally {
      setAiAnalyzing(false);
    }
  }, [leadId]);

  const handleDelete = useCallback(() => {
    if (!leadId) return;
    Alert.alert('Silinsin mi?', 'Bu lead kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await leadsService.delete(leadId);
            navigation.goBack();
          } catch {
            Alert.alert('Hata', 'Lead silinemedi.');
          }
        },
      },
    ]);
  }, [leadId, navigation]);

  const handleEdit = useCallback(() => {
    navigation.navigate('LeadUpsert', { leadId, lead });
  }, [lead, leadId, navigation]);

  const startEdit = useCallback((field, initialValue) => {
    setEditing(field);
    setEditValue(initialValue === undefined || initialValue === null ? '' : String(initialValue));
  }, []);

  const commitEdit = useCallback(
    async (field) => {
      const next = String(editValue ?? '').trim();
      if (field === 'leadScore' || field === 'estimatedValue') {
        const num = safeNumber(next);
        await updateLead(field, num);
        return;
      }
      await updateLead(field, next);
    },
    [editValue, updateLead],
  );

  const openUrl = useCallback(async (url) => {
    const u = String(url || '').trim();
    if (!u) return;
    try {
      await Linking.openURL(u);
    } catch {
    }
  }, []);

  const title = lead?.name || (lead?.email ? String(lead.email).split('@')[0] : '') || 'Lead';
  const subtitleParts = [lead?.email, lead?.company].filter(Boolean).map(String);
  const subtitle = subtitleParts.join(' • ');

  const pipelineStage = String(lead?.pipelineStage || lead?.stage || lead?.status || 'new');
  const currentStageIndex = pipelineStageOptions.findIndex((s) => String(s.id) === pipelineStage);
  const score = safeNumber(lead?.leadScore ?? lead?.score ?? 0);
  const estimatedValue = safeNumber(lead?.estimatedValue ?? lead?.value ?? lead?.amount ?? 0);
  const tags = toArray(lead?.tags);
  const productsOfInterest = toArray(lead?.productsOfInterest);

  const upsertTags = useCallback(
    async (nextTags) => {
      await updateLead('tags', nextTags);
    },
    [updateLead],
  );

  const upsertProducts = useCallback(
    async (nextProducts) => {
      await updateLead('productsOfInterest', nextProducts);
    },
    [updateLead],
  );

  const addTag = useCallback(async () => {
    const v = String(tagDraft || '').trim();
    if (!v) return;
    const next = Array.from(new Set([...tags, v]));
    setAddingTag(false);
    setTagDraft('');
    await upsertTags(next);
  }, [tagDraft, tags, upsertTags]);

  const removeTag = useCallback(
    async (value) => {
      const next = tags.filter((t) => String(t) !== String(value));
      await upsertTags(next);
    },
    [tags, upsertTags],
  );

  const addProduct = useCallback(async () => {
    const v = String(productDraft || '').trim();
    if (!v) return;
    const next = Array.from(new Set([...productsOfInterest, v]));
    setAddingProduct(false);
    setProductDraft('');
    await upsertProducts(next);
  }, [productDraft, productsOfInterest, upsertProducts]);

  const removeProduct = useCallback(
    async (value) => {
      const next = productsOfInterest.filter((p) => String(p) !== String(value));
      await upsertProducts(next);
    },
    [productsOfInterest, upsertProducts],
  );

  const conversionStatus = useCallback(
    (status) => {
      const s = String(status || '').toLowerCase();
      if (s === 'sent' || s === 'success') return { icon: 'checkmark-circle', color: colors.success, label: 'Başarılı' };
      if (s === 'failed') return { icon: 'close-circle', color: colors.error, label: 'Hatalı' };
      if (s === 'pending') return { icon: 'time', color: colors.warning, label: 'Bekliyor' };
      if (s === 'retry') return { icon: 'refresh-circle', color: colors.primary, label: 'Tekrar deneniyor' };
      return { icon: 'help-circle', color: colors.textSecondary, label: 'Bilinmiyor' };
    },
    [colors.error, colors.primary, colors.success, colors.textSecondary, colors.warning],
  );

  const platformIcon = useCallback((platform) => {
    const p = String(platform || '').toLowerCase();
    if (p === 'meta' || p === 'facebook') return { name: 'logo-facebook', color: '#1877F2' };
    if (p === 'google') return { name: 'logo-google', color: '#4285F4' };
    if (p === 'linkedin') return { name: 'logo-linkedin', color: '#0A66C2' };
    return { name: 'globe-outline', color: colors.textSecondary };
  }, [colors.textSecondary]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Lead bulunamadı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={2}>
                {String(title)}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {String(subtitle)}
                </Text>
              ) : null}
            </View>
            {lead?.landingPageUrl ? (
              <TouchableOpacity style={styles.iconBtn} onPress={() => openUrl(lead.landingPageUrl)} activeOpacity={0.85}>
                <Ionicons name="open-outline" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.actionText}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionText, styles.deleteText]}>Sil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipelineContent}>
            {pipelineStageOptions.map((stage, index) => {
              const isCompleted = currentStageIndex >= 0 ? index < currentStageIndex : false;
              const isCurrent = currentStageIndex >= 0 ? index === currentStageIndex : String(stage.id) === pipelineStage;
              return (
                <View key={String(stage.id)} style={styles.pipelineStep}>
                  <TouchableOpacity
                    onPress={() => updateLead('pipelineStage', stage.id)}
                    activeOpacity={0.85}
                    disabled={savingField}
                    style={[
                      styles.pipelineChip,
                      isCurrent && styles.pipelineChipCurrent,
                      isCompleted && styles.pipelineChipDone,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    ) : (
                      <View
                        style={[
                          styles.pipelineDot,
                          { backgroundColor: isCurrent ? colors.textPrimary : stage.color },
                        ]}
                      />
                    )}
                    <Text style={[styles.pipelineChipText, isCurrent && styles.pipelineChipTextCurrent]} numberOfLines={1}>
                      {String(stage.label)}
                    </Text>
                  </TouchableOpacity>
                  {index < pipelineStageOptions.length - 1 ? (
                    <View
                      style={[
                        styles.pipelineConnector,
                        { backgroundColor: isCompleted ? colors.success : colors.border },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Durum & Skor</Text>
          <View style={styles.kpiRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kpiLabel}>Lead Skoru</Text>
              <Text style={styles.kpiValue}>{String(Math.round(score))}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(Math.max(score, 0), 100)}%` }]} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.kpiEditBtn}
              onPress={() => startEdit('leadScore', score)}
              activeOpacity={0.85}
              disabled={savingField}
            >
              <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.kpiRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kpiLabel}>Tahmini Değer</Text>
              <Text style={styles.kpiValue}>{formatTRY(estimatedValue)}</Text>
            </View>
            <TouchableOpacity
              style={styles.kpiEditBtn}
              onPress={() => startEdit('estimatedValue', estimatedValue)}
              activeOpacity={0.85}
              disabled={savingField}
            >
              <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.aiBtn} onPress={analyzeLeadWithAi} activeOpacity={0.85} disabled={aiAnalyzing}>
            {aiAnalyzing ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color={colors.textPrimary} />
            )}
            <Text style={styles.aiBtnText}>ZigranAI Analiz</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>ZigranAI</Text>
              <Text style={styles.cardSubtitle}>Butonla oluşturulan içgörüler.</Text>
            </View>
          </View>

          {!aiInsight ? (
            <Text style={styles.muted}>Henüz AI analizi yok.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.badgesRow}>
                {aiInsight?.intent ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {aiInsight.intent === 'high' ? 'Yüksek niyet' : aiInsight.intent === 'medium' ? 'Orta niyet' : 'Düşük niyet'}
                    </Text>
                  </View>
                ) : null}
                {aiInsight?.purchaseProbability !== undefined ? (
                  <View style={[styles.badge, styles.badgeSoft]}>
                    <Text style={styles.badgeText}>%{String(Math.round(safeNumber(aiInsight.purchaseProbability)))}</Text>
                  </View>
                ) : null}
              </View>

              {aiInsight?.recommendedNextAction ? (
                <View>
                  <Text style={styles.sectionLabel}>Önerilen aksiyon</Text>
                  <Text style={styles.muted}>{String(aiInsight.recommendedNextAction)}</Text>
                </View>
              ) : null}

              {Array.isArray(aiInsight?.reasoningBullets) && aiInsight.reasoningBullets.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>Gerekçeler</Text>
                  {aiInsight.reasoningBullets.slice(0, 5).map((r, idx) => (
                    <Text key={`${idx}`} style={styles.bullet}>
                      • {String(r)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {Array.isArray(aiInsight?.risks) && aiInsight.risks.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>Riskler</Text>
                  {aiInsight.risks.slice(0, 5).map((r, idx) => (
                    <Text key={`${idx}`} style={styles.bullet}>
                      • {String(r)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {Array.isArray(aiInsight?.nextBestFieldsToCollect) && aiInsight.nextBestFieldsToCollect.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>Toplanacak alanlar</Text>
                  {aiInsight.nextBestFieldsToCollect.slice(0, 5).map((r, idx) => (
                    <Text key={`${idx}`} style={styles.bullet}>
                      • {String(r)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>İletişim Bilgileri</Text>

          <EditableRow
            label="İsim"
            value={lead?.name}
            editing={editing === 'name'}
            editValue={editValue}
            onChangeText={setEditValue}
            onEdit={() => startEdit('name', lead?.name)}
            onCommit={() => commitEdit('name')}
            saving={savingField}
            colors={colors}
            styles={styles}
          />
          <StaticRow label="E-posta" value={lead?.email} colors={colors} styles={styles} />
          <EditableRow
            label="Telefon"
            value={lead?.phone}
            editing={editing === 'phone'}
            editValue={editValue}
            onChangeText={setEditValue}
            onEdit={() => startEdit('phone', lead?.phone)}
            onCommit={() => commitEdit('phone')}
            saving={savingField}
            colors={colors}
            styles={styles}
          />
          <EditableRow
            label="Firma"
            value={lead?.company}
            editing={editing === 'company'}
            editValue={editValue}
            onChangeText={setEditValue}
            onEdit={() => startEdit('company', lead?.company)}
            onCommit={() => commitEdit('company')}
            saving={savingField}
            colors={colors}
            styles={styles}
          />
          <EditableRow
            label="Unvan"
            value={lead?.jobTitle}
            editing={editing === 'jobTitle'}
            editValue={editValue}
            onChangeText={setEditValue}
            onEdit={() => startEdit('jobTitle', lead?.jobTitle)}
            onCommit={() => commitEdit('jobTitle')}
            saving={savingField}
            colors={colors}
            styles={styles}
          />
          <EditableRow
            label="Şehir"
            value={lead?.city}
            editing={editing === 'city'}
            editValue={editValue}
            onChangeText={setEditValue}
            onEdit={() => startEdit('city', lead?.city)}
            onCommit={() => commitEdit('city')}
            saving={savingField}
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>KVKK / İYS</Text>
          <ToggleRow
            label="KVKK Onayı"
            value={!!lead?.kvkkConsent}
            meta={lead?.kvkkConsent ? (lead?.kvkkConsentAt ? formatDate(lead.kvkkConsentAt) : 'Onaylandı') : 'Kapalı'}
            onChange={(v) => updateLead('kvkkConsent', v)}
            disabled={savingField}
            colors={colors}
            styles={styles}
          />
          <ToggleRow
            label="SMS İzni (İYS)"
            value={!!lead?.iysSmsConsent}
            meta={lead?.iysSmsConsent ? (lead?.iysSmsConsentAt ? formatDate(lead.iysSmsConsentAt) : 'Onaylandı') : 'Kapalı'}
            onChange={(v) => updateLead('iysSmsConsent', v)}
            disabled={savingField}
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Etiketler</Text>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setAddingTag((v) => !v);
                setTagDraft('');
              }}
              activeOpacity={0.85}
              disabled={savingField}
            >
              <Ionicons name={addingTag ? 'close' : 'add'} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.chipsWrap}>
            {tags.length > 0 ? (
              tags.map((t) => (
                <TouchableOpacity key={String(t)} style={styles.chip} onPress={() => removeTag(t)} activeOpacity={0.85} disabled={savingField}>
                  <Ionicons name="pricetag" size={14} color={colors.textPrimary} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {String(t)}
                  </Text>
                  <Ionicons name="close" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.muted}>Etiket yok</Text>
            )}
          </View>

          {addingTag ? (
            <View style={styles.inlineForm}>
              <TextInput
                value={tagDraft}
                onChangeText={setTagDraft}
                placeholder="Etiket ekle"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={addTag} activeOpacity={0.85} disabled={savingField}>
                <Text style={styles.primaryBtnText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.metaBlock}>
          <MetaRow label="Oluşturulma" value={formatDate(lead?.createdAt)} styles={styles} />
          <MetaRow label="Son Aktivite" value={lead?.lastActivityAt ? formatDate(lead.lastActivityAt) : '-'} styles={styles} />
          <MetaRow label="Kaynak" value={lead?.source || '-'} styles={styles} />
          {companySettings?.name ? <MetaRow label="Şirket" value={String(companySettings.name)} styles={styles} /> : null}
        </View>

        <View style={styles.tabsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            <TabBtn label="Aktivite & Geçmiş" active={activeTab === 'activity'} onPress={() => setActiveTab('activity')} styles={styles} />
            <TabBtn label="Detaylar & Form" active={activeTab === 'details'} onPress={() => setActiveTab('details')} styles={styles} />
            <TabBtn label="Dönüşümler (CAPI)" active={activeTab === 'conversions'} onPress={() => setActiveTab('conversions')} styles={styles} />
            <TabBtn label="Ürünler" active={activeTab === 'products'} onPress={() => setActiveTab('products')} styles={styles} />
          </ScrollView>
        </View>

        {activeTab === 'activity' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Zaman Çizelgesi</Text>
            <Text style={styles.cardSubtitle}>Aramalar, durum değişiklikleri ve önemli olaylar.</Text>

            {calls.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.sectionLabel}>Son Aramalar</Text>
                <View style={styles.listBlock}>
                  {calls.slice(0, 10).map((call, idx) => (
                    <CallItem key={String(call?.id ?? call?._id ?? idx)} item={call} styles={styles} colors={colors} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>Geçmiş</Text>
              <View style={styles.timeline}>
                {history.length === 0 ? (
                  <Text style={styles.muted}>Henüz kayıt yok.</Text>
                ) : (
                  history.slice(0, 20).map((item, idx) => (
                    <HistoryItem
                      key={String(item?.id ?? item?._id ?? idx)}
                      item={item}
                      stageOptions={pipelineStageOptions}
                      styles={styles}
                    />
                  ))
                )}
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === 'details' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Detaylar & Form</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              <View style={styles.subCard}>
                <Text style={styles.subCardTitle}>Atıf Bilgileri</Text>
                <KeyValueRow k="Kaynak" v={lead?.source} styles={styles} />
                <KeyValueRow k="UTM Source" v={lead?.utmSource} styles={styles} />
                <KeyValueRow k="UTM Medium" v={lead?.utmMedium} styles={styles} />
                <KeyValueRow k="UTM Campaign" v={lead?.utmCampaign} styles={styles} />
                <KeyValueRow k="UTM Term" v={lead?.utmTerm} styles={styles} />
                <KeyValueRow k="UTM Content" v={lead?.utmContent} styles={styles} />
                <KeyValueRow k="Google Click ID" v={lead?.gclid} styles={styles} />
                <KeyValueRow k="Facebook Click ID" v={lead?.fbclid} styles={styles} />
                <KeyValueRow k="MS Click ID" v={lead?.msclkid} styles={styles} />
              </View>

              <View style={styles.subCard}>
                <Text style={styles.subCardTitle}>Form Bilgileri</Text>
                <KeyValueRow k="Form Adı" v={lead?.formName} styles={styles} />
                <KeyValueRow k="Form ID" v={lead?.formId} styles={styles} />
                <LinkRow label="Landing Page" url={lead?.landingPageUrl} onOpen={openUrl} styles={styles} />
                <LinkRow label="Referrer" url={lead?.referrerUrl} onOpen={openUrl} styles={styles} />
              </View>

              {lead?.formData && Object.keys(lead.formData).length > 0 ? (
                <View style={styles.subCard}>
                  <Text style={styles.subCardTitle}>Form Yanıtları</Text>
                  <View style={styles.formGrid}>
                    {Object.entries(lead.formData).map(([k, v]) => (
                      <View key={String(k)} style={styles.formCell}>
                        <Text style={styles.formCellKey} numberOfLines={1}>
                          {String(k).replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.formCellValue}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {activeTab === 'conversions' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conversion API Durumu</Text>
            <Text style={styles.cardSubtitle}>Reklam platformlarına gönderilen olaylar.</Text>

            {conversions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="pulse" size={28} color={colors.textSecondary + '66'} />
                <Text style={styles.muted}>Henüz bir dönüşüm olayı yok.</Text>
              </View>
            ) : (
              <View style={[styles.listBlock, { marginTop: 12 }]}>
                {conversions.map((conv, idx) => {
                  const status = conversionStatus(conv?.status);
                  const platform = platformIcon(conv?.platform);
                  return (
                    <View key={String(conv?.id ?? conv?._id ?? idx)} style={styles.conversionRow}>
                      <View style={styles.conversionTop}>
                        <View style={styles.conversionLeft}>
                          <Ionicons name={safeIoniconName(platform.name, 'globe-outline')} size={16} color={platform.color} />
                          <Text style={styles.conversionPlatform} numberOfLines={1}>
                            {String(conv?.platform || '-')}
                          </Text>
                        </View>
                        <View style={styles.conversionStatus}>
                          <Ionicons name={safeIoniconName(status.icon, 'help-circle-outline')} size={16} color={status.color} />
                          <Text style={[styles.conversionStatusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>

                      <Text style={styles.conversionEvent} numberOfLines={1}>
                        {String(conv?.eventName || '-')}
                      </Text>

                      <View style={styles.conversionBottom}>
                        <Text style={styles.conversionDate} numberOfLines={1}>
                          {conv?.sentAt ? formatDate(conv.sentAt) : '-'}
                        </Text>
                        <View style={styles.conversionActions}>
                          {conv?.payload ? (
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => {
                                setSelectedPayload(conv.payload || null);
                                setPayloadOpen(true);
                              }}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="eye-outline" size={18} color={colors.textPrimary} />
                            </TouchableOpacity>
                          ) : null}
                          {String(conv?.status || '').toLowerCase() === 'failed' ? (
                            <TouchableOpacity style={styles.iconBtn} onPress={() => retryConversion(conv.id)} activeOpacity={0.85}>
                              <Ionicons name="refresh" size={18} color={colors.primary} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      {conv?.error ? (
                        <View style={styles.errorBox}>
                          <Text style={styles.errorText}>Hata: {String(conv.error)}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'products' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>İlgilenilen Ürünler</Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setAddingProduct((v) => !v);
                  setProductDraft('');
                }}
                activeOpacity={0.85}
                disabled={savingField}
              >
                <Ionicons name={addingProduct ? 'close' : 'add'} size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.chipsWrap}>
              {productsOfInterest.length > 0 ? (
                productsOfInterest.map((p) => (
                  <TouchableOpacity
                    key={String(p)}
                    style={styles.chip}
                    onPress={() => removeProduct(p)}
                    activeOpacity={0.85}
                    disabled={savingField}
                  >
                    <Ionicons name="pricetag" size={14} color={colors.textPrimary} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {String(p)}
                    </Text>
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.muted}>Ürün bilgisi bulunmuyor.</Text>
              )}
            </View>

            {addingProduct ? (
              <View style={styles.inlineForm}>
                <TextInput
                  value={productDraft}
                  onChangeText={setProductDraft}
                  placeholder="Ürün ekle"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={addProduct} activeOpacity={0.85} disabled={savingField}>
                  <Text style={styles.primaryBtnText}>Ekle</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={payloadOpen} animationType="slide" transparent onRequestClose={() => setPayloadOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPayloadOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payload Detayı</Text>
            <TouchableOpacity onPress={() => setPayloadOpen(false)} activeOpacity={0.85} style={styles.iconBtn}>
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.payloadBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.payloadText}>{JSON.stringify(selectedPayload, null, 2)}</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editing === 'leadScore' || editing === 'estimatedValue'} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditing(null)} />
        <View style={styles.modalCenter}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <Text style={styles.modalTitle}>{editing === 'leadScore' ? 'Lead Skoru' : 'Tahmini Değer'}</Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setEditing(null)} activeOpacity={0.85} disabled={savingField}>
                <Text style={styles.ghostBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => commitEdit(editing)} activeOpacity={0.85} disabled={savingField}>
                {savingField ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function EditableRow({ label, value, editing, editValue, onChangeText, onEdit, onCommit, saving, colors, styles }) {
  const display = value === undefined || value === null || value === '' ? 'Ekle' : String(value);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{String(label)}</Text>
      <View style={styles.rowRight}>
        {editing ? (
          <TextInput
            value={editValue}
            onChangeText={onChangeText}
            placeholder={String(label)}
            placeholderTextColor={colors.textSecondary}
            style={[styles.rowInput, saving && { opacity: 0.7 }]}
            editable={!saving}
            autoFocus
            onSubmitEditing={onCommit}
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={onEdit} activeOpacity={0.85} disabled={saving} style={styles.rowValueBtn}>
            <Text style={[styles.rowValue, value ? null : styles.rowValueEmpty]} numberOfLines={2}>
              {display}
            </Text>
            <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StaticRow({ label, value, styles }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{String(label)}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue} numberOfLines={2}>
          {String(value)}
        </Text>
      </View>
    </View>
  );
}

function ToggleRow({ label, meta, value, onChange, disabled, styles }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{String(label)}</Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {String(meta)}
          </Text>
        ) : null}
      </View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

function TabBtn({ label, active, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {String(label)}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryItem({ item, stageOptions, styles }) {
  const when = formatDate(item?.createdAt ?? item?.created_at ?? item?.timestamp ?? item?.date);
  const stage = String(item?.stage ?? item?.toStage ?? item?.to ?? item?.newStage ?? item?.newValue ?? '');
  const label = stageOptions.find((s) => String(s.id) === stage)?.label || stage;
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineBody}>
        <Text style={styles.timelineWhen}>{String(when)}</Text>
        <Text style={styles.timelineTitle}>Aşama Değişikliği</Text>
        {label ? <Text style={styles.timelineDesc}>{String(label)} aşamasına geçildi.</Text> : null}
      </View>
    </View>
  );
}

function CallItem({ item, styles, colors }) {
  const when = formatDate(item?.createdAt ?? item?.created_at ?? item?.timestamp ?? item?.date);
  const callType = String(item?.callType ?? item?.type ?? item?.direction ?? '').toLowerCase();
  const outbound = callType.includes('out');
  const icon = outbound ? 'call-outline' : 'call';
  const accent = outbound ? colors.primary : colors.success;
  const subject = item?.subject ?? item?.title ?? 'Arama';
  const description = item?.description ?? item?.note ?? '';
  const duration = item?.duration ?? item?.durationSeconds ?? item?.seconds;
  const status = item?.status ?? item?.result;
  return (
    <View style={styles.callCard}>
      <View style={[styles.callIcon, { backgroundColor: accent + '18', borderColor: accent + '2A' }]}>
        <Ionicons name={safeIoniconName(icon, 'call-outline')} size={16} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.callTopRow}>
          <Text style={styles.callTitle} numberOfLines={1}>
            {String(subject)}
          </Text>
          <Text style={styles.callWhen} numberOfLines={1}>
            {String(when)}
          </Text>
        </View>
        {description ? (
          <Text style={styles.callDesc} numberOfLines={2}>
            {String(description)}
          </Text>
        ) : null}
        <Text style={styles.callMeta} numberOfLines={1}>
          {(duration || duration === 0 ? `${String(duration)} sn` : '').trim()}
          {status ? ` • ${String(status)}` : ''}
        </Text>
      </View>
    </View>
  );
}

function KeyValueRow({ k, v, styles }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey} numberOfLines={1}>
        {String(k)}
      </Text>
      <Text style={styles.kvValue} numberOfLines={2}>
        {v === undefined || v === null || v === '' ? '-' : String(v)}
      </Text>
    </View>
  );
}

function LinkRow({ label, url, onOpen, styles }) {
  const u = String(url || '').trim();
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey} numberOfLines={1}>
        {String(label)}
      </Text>
      {u ? (
        <TouchableOpacity onPress={() => onOpen(u)} activeOpacity={0.85}>
          <Text style={styles.linkText} numberOfLines={2}>
            Link
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.kvValue} numberOfLines={2}>
          -
        </Text>
      )}
    </View>
  );
}

function MetaRow({ label, value, styles }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{String(label)}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
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
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyText: {
      color: colors.textSecondary,
      fontWeight: '800',
    },
    content: {
      padding: 16,
      gap: 12,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    actionText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    deleteBtn: {
      borderColor: colors.error + '33',
    },
    deleteText: {
      color: colors.error,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    cardSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
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
    pipelineContent: {
      paddingVertical: 8,
      gap: 10,
      alignItems: 'center',
    },
    pipelineStep: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pipelineChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      maxWidth: 220,
    },
    pipelineChipCurrent: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '2A',
    },
    pipelineChipDone: {
      backgroundColor: colors.success + '10',
      borderColor: colors.success + '2A',
    },
    pipelineDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    pipelineChipText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      flexShrink: 1,
    },
    pipelineChipTextCurrent: {
      color: colors.primary,
      fontWeight: '900',
    },
    pipelineConnector: {
      height: 2,
      width: 26,
      borderRadius: 999,
      marginHorizontal: 8,
    },
    kpiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
    },
    kpiLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    kpiValue: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      marginTop: 4,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 10,
    },
    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    kpiEditBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    aiBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      backgroundColor: colors.primary + '14',
      marginTop: 12,
    },
    aiBtnText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    muted: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      paddingTop: 10,
      paddingBottom: 14,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeSoft: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '2A',
    },
    badgeText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
      marginBottom: 6,
    },
    bullet: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
    row: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
      flexShrink: 1,
    },
    rowRight: {
      alignItems: 'stretch',
    },
    rowValueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    rowValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'left',
    },
    rowValueEmpty: {
      color: colors.primary,
      fontWeight: '900',
    },
    rowInput: {
      width: '100%',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontWeight: '800',
      textAlign: 'left',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 4,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 10,
      paddingBottom: 4,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      maxWidth: 260,
    },
    chipText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      flexShrink: 1,
      maxWidth: 180,
    },
    inlineForm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 10,
      paddingBottom: 2,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    primaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 84,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontWeight: '900',
    },
    metaBlock: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    metaLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    metaValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      flexShrink: 1,
      textAlign: 'right',
    },
    tabsBar: {
      paddingTop: 2,
    },
    tabsContent: {
      gap: 8,
      paddingVertical: 10,
    },
    tabBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: 220,
    },
    tabBtnActive: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '2A',
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    tabTextActive: {
      color: colors.primary,
    },
    listBlock: {
      gap: 10,
      paddingTop: 12,
      paddingBottom: 4,
    },
    timeline: {
      paddingTop: 10,
      paddingBottom: 2,
    },
    timelineItem: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 10,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    timelineBody: {
      flex: 1,
      minWidth: 0,
    },
    timelineWhen: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    timelineTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      marginTop: 2,
    },
    timelineDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    callCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    callIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    callTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    callTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      flex: 1,
      minWidth: 0,
    },
    callWhen: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    callDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    callMeta: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 6,
    },
    subCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    subCardTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      marginBottom: 8,
    },
    kvRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 4,
      paddingVertical: 10,
    },
    kvKey: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    kvValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'left',
    },
    linkText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    formGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    formCell: {
      flexBasis: '48%',
      flexGrow: 1,
      minWidth: 150,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    formCellKey: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    formCellValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 4,
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    conversionRow: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    conversionTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    conversionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    conversionPlatform: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
      flexShrink: 1,
    },
    conversionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    conversionStatusText: {
      fontSize: 12,
      fontWeight: '900',
    },
    conversionEvent: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    conversionBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    conversionDate: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      flex: 1,
      minWidth: 0,
    },
    conversionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    errorBox: {
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '2A',
      backgroundColor: colors.error + '10',
    },
    errorText: {
      color: colors.error,
      fontSize: 11,
      fontWeight: '800',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#00000066',
    },
    modalSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '75%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
      flex: 1,
      minWidth: 0,
    },
    payloadBox: {
      maxHeight: 520,
    },
    payloadText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    modalCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 12,
    },
    ghostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    ghostBtnText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    stageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingBottom: 12,
    },
    stageChip: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: '100%',
    },
    stageChipActive: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '2A',
    },
    stageText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    stageTextActive: {
      color: colors.primary,
      fontWeight: '900',
    },
  });
}

export default LeadDetailScreen;
