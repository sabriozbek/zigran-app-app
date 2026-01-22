import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';
import { automationsService } from '../api/services/automationsService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function safeJsonParse(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function safeInt(value) {
  const n = typeof value === 'number' ? value : parseInt(String(value || '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function buildId(prefix) {
  const rnd = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now().toString(16)}_${rnd}`;
}

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit' });
}

const TRIGGER_TYPES = [
  { key: 'lead_created', label: 'Lead Oluştu' },
  { key: 'lead_updated', label: 'Lead Güncellendi' },
  { key: 'pipeline_stage_changed', label: 'Pipeline Değişti' },
  { key: 'form_submit', label: 'Form Dolduruldu' },
  { key: 'meeting_booked', label: 'Toplantı Alındı' },
  { key: 'custom', label: 'Özel' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'inactive', label: 'Pasif' },
];

const ACTION_TYPES = [
  { key: 'send_email_template', label: 'Şablon E-Posta', icon: 'mail-outline' },
  { key: 'send_email', label: 'E-Posta', icon: 'send-outline' },
  { key: 'send_conversion', label: 'Conversion', icon: 'trending-up-outline' },
  { key: 'update_pipeline', label: 'Pipeline Güncelle', icon: 'swap-horizontal-outline' },
  { key: 'route_to_team', label: 'Takıma Yönlendir', icon: 'people-outline' },
  { key: 'notify_slack', label: 'Slack Bildirim', icon: 'chatbubble-ellipses-outline' },
  { key: 'add_custom_audience', label: 'Custom Audience', icon: 'people-circle-outline' },
  { key: 'send_webhook', label: 'Webhook', icon: 'link-outline' },
  { key: 'create_task', label: 'Görev Oluştur', icon: 'checkbox-outline' },
];

const FLOW_TEMPLATES = [
  {
    key: 'lead_welcome',
    label: 'Yeni Lead → Hoşgeldin E-postası',
    triggerType: 'lead_created',
    triggerParamsText: '',
    conditions: { pipeline_stage_is: '', form_id_is: '', segment_id: '', no_form_submission_since_minutes: '', no_activity_since_minutes: '' },
    actions: [
      { type: 'send_email_template', params: { templateId: 'TEMPLATE_ID', to: '', variables: {} } },
      { type: 'create_task', params: { title: 'Yeni lead ile 24 saat içinde iletişime geç', dueDate: '' } },
    ],
  },
  {
    key: 'no_activity',
    label: 'Aktivite Yok → Slack Bildirim + Görev',
    triggerType: 'lead_updated',
    triggerParamsText: '',
    conditions: { no_activity_since_minutes: '1440' },
    actions: [
      { type: 'notify_slack', params: { webhookUrl: '', text: 'Lead uzun süredir aktivitesiz.' } },
      { type: 'create_task', params: { title: 'Aktivitesiz lead kontrolü', dueDate: '' } },
    ],
  },
];

function actionLabel(type) {
  const t = ACTION_TYPES.find((x) => x.key === type);
  return t?.label || String(type || 'Action');
}

function actionIcon(type) {
  const t = ACTION_TYPES.find((x) => x.key === type);
  return t?.icon || 'flash-outline';
}

function normalizeRuleTriggerLabel(triggerType) {
  const t = TRIGGER_TYPES.find((x) => x.key === triggerType);
  return t?.label || (triggerType ? String(triggerType) : '—');
}

function normalizeRuleToDraft(rule) {
  const triggerType = String(rule?.trigger?.type || 'lead_created');
  const triggerParamsText = rule?.trigger?.params ? JSON.stringify(rule.trigger.params, null, 2) : '';
  const conditions = rule?.trigger?.conditions || {};
  const actions = Array.isArray(rule?.actions) ? rule.actions : [];
  return {
    id: rule?.id ?? null,
    name: String(rule?.name || ''),
    active: rule?.active !== false,
    triggerType,
    triggerParamsText,
    conditions: {
      pipeline_stage_is: conditions?.pipeline_stage_is ?? '',
      form_id_is: conditions?.form_id_is ?? '',
      segment_id: conditions?.segment_id ?? '',
      no_form_submission_since_minutes: conditions?.no_form_submission_since_minutes ?? '',
      no_activity_since_minutes: conditions?.no_activity_since_minutes ?? '',
    },
    actions: actions.map((a) => {
      const params = a?.params || {};
      const type = String(a?.type || 'send_email_template');
      const base = { localId: buildId('act'), type };
      if (type === 'send_email_template') {
        return { ...base, templateId: String(params?.templateId || ''), to: String(params?.to || ''), variablesText: JSON.stringify(params?.variables || {}, null, 2) };
      }
      if (type === 'send_email') {
        return { ...base, to: String(params?.to || ''), subject: String(params?.subject || ''), html: String(params?.html || '') };
      }
      if (type === 'send_conversion') {
        return { ...base, eventName: String(params?.eventName || '') };
      }
      if (type === 'update_pipeline') {
        return { ...base, stage: String(params?.stage || '') };
      }
      if (type === 'route_to_team') {
        return { ...base, teamId: String(params?.teamId || '') };
      }
      if (type === 'notify_slack') {
        return { ...base, webhookUrl: String(params?.webhookUrl || ''), text: String(params?.text || '') };
      }
      if (type === 'add_custom_audience') {
        const emails = Array.isArray(params?.emails) ? params.emails : [];
        return { ...base, adAccountId: String(params?.adAccountId || ''), emailsText: emails.join('\n') };
      }
      if (type === 'send_webhook') {
        return { ...base, url: String(params?.url || ''), bodyText: JSON.stringify(params?.body || {}, null, 2) };
      }
      if (type === 'create_task') {
        return { ...base, title: String(params?.title || ''), dueDate: String(params?.dueDate || ''), assignedTo: String(params?.assignedTo || ''), delayMinutes: String(params?.delayMinutes || ''), delaySeconds: String(params?.delaySeconds || ''), conditionsText: JSON.stringify(params?.conditions || {}, null, 2) };
      }
      return { ...base, paramsText: JSON.stringify(params || {}, null, 2) };
    }),
  };
}

function emptyDraft() {
  return {
    id: null,
    name: '',
    active: true,
    triggerType: 'lead_created',
    triggerParamsText: '',
    conditions: { pipeline_stage_is: '', form_id_is: '', segment_id: '', no_form_submission_since_minutes: '', no_activity_since_minutes: '' },
    actions: [{ localId: buildId('act'), type: 'send_email_template', templateId: 'TEMPLATE_ID', to: '', variablesText: JSON.stringify({}, null, 2) }],
  };
}

export default function AutomationsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const pushToast = useCallback(
    (type, message) => {
      const toast = { type: type || 'success', message: String(message || '') };
      if (!toast.message) return;
      const parent = navigation?.getParent?.();
      if (parent?.setParams) parent.setParams({ toast });
      else navigation?.setParams?.({ toast });
    },
    [navigation],
  );

  const [activeTab, setActiveTab] = useState('flows');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft());

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');

  const [executeType, setExecuteType] = useState('lead_created');
  const [executeLeadId, setExecuteLeadId] = useState('');
  const [executePayloadText, setExecutePayloadText] = useState('');
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    const res = await automationsService.list();
    const list = Array.isArray(res) ? res : [];
    list.sort((a, b) => {
      const ad = new Date(a?.updatedAt ?? a?.createdAt ?? 0).getTime();
      const bd = new Date(b?.updatedAt ?? b?.createdAt ?? 0).getTime();
      return bd - ad;
    });
    setItems(list);
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

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((r) => r?.active !== false).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return items.filter((r) => {
      const isActive = r?.active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
      const triggerType = String(r?.trigger?.type || '');
      if (triggerFilter !== 'all' && triggerType !== triggerFilter) return false;
      if (!q) return true;
      const hay = `${String(r?.name || '')} ${triggerType} ${JSON.stringify(r?.trigger?.params || {})}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter, triggerFilter]);

  const openNew = useCallback(() => {
    setDraft(emptyDraft());
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((rule) => {
    setDraft(normalizeRuleToDraft(rule));
    setEditorOpen(true);
  }, []);

  const openDetail = useCallback((rule) => {
    setSelected(rule || null);
    setDetailOpen(true);
  }, []);

  const applyFlowTemplate = useCallback((tpl) => {
    const actions = (tpl?.actions || []).map((a) => normalizeRuleToDraft({ name: '', active: true, trigger: { type: tpl.triggerType, params: null }, actions: [a] }).actions[0]);
    setDraft((p) => ({
      ...p,
      name: tpl?.label || p.name,
      triggerType: tpl?.triggerType || p.triggerType,
      triggerParamsText: tpl?.triggerParamsText || '',
      conditions: {
        pipeline_stage_is: String(tpl?.conditions?.pipeline_stage_is ?? ''),
        form_id_is: String(tpl?.conditions?.form_id_is ?? ''),
        segment_id: String(tpl?.conditions?.segment_id ?? ''),
        no_form_submission_since_minutes: String(tpl?.conditions?.no_form_submission_since_minutes ?? ''),
        no_activity_since_minutes: String(tpl?.conditions?.no_activity_since_minutes ?? ''),
      },
      actions: actions.length ? actions : p.actions,
    }));
  }, []);

  const compileTriggerConditions = useCallback((c) => {
    const next = {};
    const pipeline = String(c?.pipeline_stage_is || '').trim();
    const formId = String(c?.form_id_is || '').trim();
    const segmentId = String(c?.segment_id || '').trim();
    const noSub = String(c?.no_form_submission_since_minutes || '').trim();
    const noAct = String(c?.no_activity_since_minutes || '').trim();
    if (pipeline) next.pipeline_stage_is = pipeline;
    if (formId) next.form_id_is = formId;
    if (segmentId) next.segment_id = segmentId;
    if (noSub) next.no_form_submission_since_minutes = safeInt(noSub);
    if (noAct) next.no_activity_since_minutes = safeInt(noAct);
    return Object.keys(next).length ? next : undefined;
  }, []);

  const compileActions = useCallback((actions) => {
    const out = [];
    for (const a of actions || []) {
      const type = String(a?.type || '').trim();
      if (!type) continue;
      if (type === 'send_email_template') {
        const parsed = safeJsonParse(a?.variablesText);
        if (!parsed.ok) throw new Error('variables_json');
        out.push({
          type,
          params: {
            templateId: String(a?.templateId || '').trim(),
            to: String(a?.to || '').trim() || undefined,
            variables: parsed.value || {},
          },
        });
        continue;
      }
      if (type === 'send_email') {
        out.push({ type, params: { to: String(a?.to || '').trim(), subject: String(a?.subject || '').trim(), html: String(a?.html || '').trim() } });
        continue;
      }
      if (type === 'send_conversion') {
        out.push({ type, params: { eventName: String(a?.eventName || '').trim() || undefined } });
        continue;
      }
      if (type === 'update_pipeline') {
        out.push({ type, params: { stage: String(a?.stage || '').trim() } });
        continue;
      }
      if (type === 'route_to_team') {
        out.push({ type, params: { teamId: String(a?.teamId || '').trim() } });
        continue;
      }
      if (type === 'notify_slack') {
        out.push({ type, params: { webhookUrl: String(a?.webhookUrl || '').trim(), text: String(a?.text || '').trim() } });
        continue;
      }
      if (type === 'add_custom_audience') {
        const emails = String(a?.emailsText || '')
          .split(/\r?\n|,/g)
          .map((s) => s.trim())
          .filter(Boolean);
        out.push({ type, params: { adAccountId: String(a?.adAccountId || '').trim(), emails } });
        continue;
      }
      if (type === 'send_webhook') {
        const parsed = safeJsonParse(a?.bodyText);
        if (!parsed.ok) throw new Error('body_json');
        out.push({ type, params: { url: String(a?.url || '').trim(), body: parsed.value || {} } });
        continue;
      }
      if (type === 'create_task') {
        const cond = safeJsonParse(a?.conditionsText);
        if (!cond.ok) throw new Error('task_conditions_json');
        out.push({
          type,
          params: {
            title: String(a?.title || '').trim(),
            dueDate: String(a?.dueDate || '').trim() || undefined,
            assignedTo: String(a?.assignedTo || '').trim() || undefined,
            delayMinutes: String(a?.delayMinutes || '').trim() ? safeInt(a.delayMinutes) : undefined,
            delaySeconds: String(a?.delaySeconds || '').trim() ? safeInt(a.delaySeconds) : undefined,
            conditions: cond.value || undefined,
          },
        });
        continue;
      }

      const parsed = safeJsonParse(a?.paramsText);
      if (!parsed.ok) throw new Error('params_json');
      out.push({ type, params: parsed.value || {} });
    }
    return out;
  }, []);

  const save = useCallback(async () => {
    const name = String(draft?.name || '').trim();
    if (!name) {
      Alert.alert('Eksik bilgi', 'Otomasyon adı zorunlu.');
      return;
    }
    const triggerType = String(draft?.triggerType || '').trim();
    if (!triggerType) {
      Alert.alert('Eksik bilgi', 'Trigger tipi zorunlu.');
      return;
    }

    const triggerParams = safeJsonParse(draft?.triggerParamsText);
    if (!triggerParams.ok) {
      Alert.alert('Hata', 'Trigger params JSON geçersiz.');
      return;
    }

    let actions = [];
    try {
      actions = compileActions(draft?.actions || []);
    } catch (e) {
      const code = String(e?.message || '');
      if (code === 'variables_json') Alert.alert('Hata', 'Variables JSON formatı geçersiz.');
      else if (code === 'body_json') Alert.alert('Hata', 'Webhook body JSON formatı geçersiz.');
      else if (code === 'task_conditions_json') Alert.alert('Hata', 'Görev koşulları JSON formatı geçersiz.');
      else Alert.alert('Hata', 'Action parametreleri geçersiz.');
      return;
    }
    if (!actions.length) {
      Alert.alert('Eksik bilgi', 'En az 1 action ekleyin.');
      return;
    }

    const conditions = compileTriggerConditions(draft?.conditions || {});
    const trigger = {
      type: triggerType,
      params: triggerParams.value || undefined,
      conditions,
    };

    setEditorSaving(true);
    try {
      if (draft?.id) {
        await automationsService.update(draft.id, { name, active: !!draft.active, trigger, actions });
      } else {
        await automationsService.create({ name, active: !!draft.active, trigger, actions });
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Otomasyon kaydedilemedi.';
      Alert.alert('Hata', String(msg));
    } finally {
      setEditorSaving(false);
    }
  }, [compileActions, compileTriggerConditions, draft, load]);

  const confirmRemove = useCallback(
    (rule) => {
      Alert.alert('Otomasyon Silinsin mi?', `${String(rule?.name || 'Otomasyon')}`, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await automationsService.remove(rule?.id);
              setDetailOpen(false);
              await load();
            } catch (err) {
              const msg = err?.response?.data?.message || err?.message || 'Silme başarısız.';
              Alert.alert('Hata', String(msg));
            }
          },
        },
      ]);
    },
    [load],
  );

  const toggleActive = useCallback(
    async (rule) => {
      const next = !(rule?.active !== false);
      try {
        await automationsService.update(rule?.id, { active: next });
        await load();
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Durum güncellenemedi.';
        Alert.alert('Hata', String(msg));
      }
    },
    [load],
  );

  const duplicate = useCallback(
    async (rule) => {
      try {
        const name = `${String(rule?.name || 'Otomasyon')} (kopya)`;
        await automationsService.create({
          name,
          active: rule?.active !== false,
          trigger: rule?.trigger,
          actions: Array.isArray(rule?.actions) ? rule.actions : [],
        });
        await load();
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Kopyalama başarısız.';
        Alert.alert('Hata', String(msg));
      }
    },
    [load],
  );

  const execute = useCallback(async () => {
    const type = String(executeType || '').trim();
    if (!type) {
      Alert.alert('Eksik bilgi', 'Event tipi zorunlu.');
      return;
    }
    const payloadParsed = safeJsonParse(executePayloadText);
    if (!payloadParsed.ok) {
      Alert.alert('Hata', 'Payload JSON geçersiz.');
      return;
    }
    setExecuting(true);
    try {
      await automationsService.execute({
        type,
        leadId: String(executeLeadId || '').trim() || undefined,
        payload: payloadParsed.value || undefined,
      });
      pushToast('success', 'Çalıştırma tetiklendi.');
    } catch {
      Alert.alert('Hata', 'Çalıştırma başarısız.');
    } finally {
      setExecuting(false);
    }
  }, [executeLeadId, executePayloadText, executeType, pushToast]);

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Otomasyonlar</Text>
              <Text style={styles.meta}>Trigger → koşul → aksiyon akışlarını yönetin ve test edin.</Text>
            </View>
            <TouchableOpacity style={styles.primaryButtonSmall} activeOpacity={0.85} onPress={openNew}>
              <Ionicons name={safeIoniconName('add', 'add')} size={16} color="#fff" />
              <Text style={styles.primaryButtonSmallText}>Yeni Akış</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsRow}>
            {[
              { key: 'flows', label: 'Akışlar', icon: 'flash-outline' },
              { key: 'test', label: 'Test', icon: 'play-outline' },
            ].map((t) => {
              const active = t.key === activeTab;
              return (
                <TouchableOpacity key={t.key} activeOpacity={0.9} onPress={() => setActiveTab(t.key)} style={[styles.tabPill, active ? styles.tabPillActive : null]}>
                  <Ionicons name={safeIoniconName(t.icon, 'ellipse-outline')} size={14} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AppCard>

        <View style={styles.metricsRow}>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Toplam</Text>
            <Text style={styles.metricValue}>{String(stats.total)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Aktif</Text>
            <Text style={styles.metricValue}>{String(stats.active)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pasif</Text>
            <Text style={styles.metricValue}>{String(stats.inactive)}</Text>
          </AppCard>
        </View>

        {activeTab === 'flows' ? (
          <>
            <AppCard style={styles.filterCard}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Akış ara (isim, trigger, param)"
                placeholderTextColor={colors.textSecondary}
                style={styles.searchInput}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {STATUS_FILTERS.map((f) => {
                  const active = f.key === statusFilter;
                  return (
                    <TouchableOpacity key={f.key} activeOpacity={0.9} onPress={() => setStatusFilter(f.key)} style={[styles.filterPill, active ? styles.filterPillActive : null]}>
                      <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity
                  key="all"
                  activeOpacity={0.9}
                  onPress={() => setTriggerFilter('all')}
                  style={[styles.filterPill, triggerFilter === 'all' ? styles.filterPillActive : null]}
                >
                  <Text style={[styles.filterText, triggerFilter === 'all' ? styles.filterTextActive : null]}>Tüm Trigger</Text>
                </TouchableOpacity>
                {TRIGGER_TYPES.map((t) => {
                  const active = t.key === triggerFilter;
                  return (
                    <TouchableOpacity key={t.key} activeOpacity={0.9} onPress={() => setTriggerFilter(t.key)} style={[styles.filterPill, active ? styles.filterPillActive : null]}>
                      <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </AppCard>

            {items.length === 0 ? (
              <AppCard>
                <Text style={styles.sectionTitle}>Akış yok</Text>
                <Text style={styles.meta}>Yeni akış ekleyerek başlayın.</Text>
              </AppCard>
            ) : null}

            <FlatList
              data={visibleItems}
              keyExtractor={(item, idx) => String(item?.id ?? idx)}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const r = item || {};
                const isActive = r?.active !== false;
                const triggerType = String(r?.trigger?.type || '');
                const label = normalizeRuleTriggerLabel(triggerType);
                const actions = Array.isArray(r?.actions) ? r.actions : [];
                const actionPreview = actions.slice(0, 2).map((a) => actionLabel(a?.type));
                const updatedAt = r?.updatedAt ?? r?.updated_at ?? r?.createdAt ?? r?.created_at;
                return (
                  <AppCard style={styles.ruleCard} onPress={() => openDetail(r)} accessibilityLabel={`${String(r?.name || 'Otomasyon')} detayı`}>
                    <View style={styles.ruleTop}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.ruleName} numberOfLines={1}>
                          {String(r?.name || 'Otomasyon')}
                        </Text>
                        <Text style={styles.ruleMeta} numberOfLines={1}>
                          {label} • Güncelleme: {formatDate(updatedAt)}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, isActive ? styles.statusOk : styles.statusMuted]}>
                        <Text style={[styles.statusText, isActive ? styles.statusTextOk : styles.statusTextMuted]}>{isActive ? 'Aktif' : 'Pasif'}</Text>
                      </View>
                    </View>

                    <View style={styles.ruleMid}>
                      <View style={styles.chipRow}>
                        <View style={styles.chip}>
                          <Ionicons name={safeIoniconName('flash-outline', 'flash-outline')} size={14} color={colors.textSecondary} />
                          <Text style={styles.chipText} numberOfLines={1}>
                            {String(actions.length)} action
                          </Text>
                        </View>
                        {actionPreview.map((p) => (
                          <View key={p} style={styles.chip}>
                            <Text style={styles.chipText} numberOfLines={1}>
                              {p}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.ruleActions}>
                        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => openEdit(r)}>
                          <Ionicons name={safeIoniconName('create-outline', 'create-outline')} size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => duplicate(r)}>
                          <Ionicons name={safeIoniconName('copy-outline', 'copy-outline')} size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => toggleActive(r)}>
                          <Ionicons name={safeIoniconName(isActive ? 'pause-outline' : 'play-outline', 'pause-outline')} size={16} color={isActive ? colors.warning : colors.success} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => confirmRemove(r)}>
                          <Ionicons name={safeIoniconName('trash-outline', 'trash-outline')} size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </AppCard>
                );
              }}
            />
          </>
        ) : (
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>Manuel Çalıştır</Text>
            <Text style={styles.meta}>Sistemdeki aktif otomasyonları test için tetikleyin.</Text>

            <Text style={styles.label}>Event</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {TRIGGER_TYPES.map((t) => {
                const active = t.key === executeType;
                return (
                  <TouchableOpacity key={t.key} activeOpacity={0.9} onPress={() => setExecuteType(t.key)} style={[styles.pill, active ? styles.pillActive : null]}>
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Lead ID (opsiyonel)</Text>
            <TextInput value={executeLeadId} onChangeText={setExecuteLeadId} placeholder="uuid" placeholderTextColor={colors.textSecondary} style={styles.input} autoCapitalize="none" />

            <Text style={styles.label}>Payload (JSON)</Text>
            <TextInput value={executePayloadText} onChangeText={setExecutePayloadText} placeholder="{}" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultiline]} multiline autoCapitalize="none" />

            <TouchableOpacity style={[styles.primaryButton, executing ? styles.disabled : null]} activeOpacity={0.9} onPress={execute} disabled={executing}>
              {executing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Çalıştır</Text>}
            </TouchableOpacity>
          </AppCard>
        )}
      </ScrollView>

      <Modal visible={detailOpen} animationType="slide" transparent onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Otomasyon Detayı</Text>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.9} onPress={() => setDetailOpen(false)}>
              <Ionicons name={safeIoniconName('close', 'close')} size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 10 }}>
              <AppCard style={styles.detailCard}>
                <Text style={styles.detailTitle} numberOfLines={2}>
                  {String(selected?.name || 'Otomasyon')}
                </Text>
                <Text style={styles.detailMeta}>
                  {normalizeRuleTriggerLabel(selected?.trigger?.type)} • {selected?.active !== false ? 'Aktif' : 'Pasif'}
                </Text>
                <Text style={styles.smallMuted}>Güncelleme: {formatDate(selected?.updatedAt ?? selected?.createdAt)}</Text>

                <View style={styles.detailActionsRow}>
                  <TouchableOpacity style={styles.primaryButtonSmall} activeOpacity={0.9} onPress={() => openEdit(selected)}>
                    <Ionicons name={safeIoniconName('create-outline', 'create-outline')} size={16} color="#fff" />
                    <Text style={styles.primaryButtonSmallText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButtonSmall} activeOpacity={0.9} onPress={() => duplicate(selected)}>
                    <Text style={styles.secondaryButtonSmallText}>Kopyala</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButtonSmall} activeOpacity={0.9} onPress={() => toggleActive(selected)}>
                    <Text style={styles.secondaryButtonSmallText}>{selected?.active !== false ? 'Pasifleştir' : 'Aktifleştir'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.dangerButtonSmall]} activeOpacity={0.9} onPress={() => confirmRemove(selected)}>
                  <Text style={styles.dangerButtonSmallText}>Sil</Text>
                </TouchableOpacity>
              </AppCard>

              <AppCard style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Trigger</Text>
                <Text style={styles.smallMuted} numberOfLines={2}>
                  Tip: {normalizeRuleTriggerLabel(selected?.trigger?.type)}
                </Text>
                {selected?.trigger?.params ? (
                  <Text style={styles.codeBlock}>{JSON.stringify(selected.trigger.params, null, 2)}</Text>
                ) : (
                  <Text style={styles.smallMuted}>Param yok.</Text>
                )}
                {selected?.trigger?.conditions ? (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Koşullar</Text>
                    <Text style={styles.codeBlock}>{JSON.stringify(selected.trigger.conditions, null, 2)}</Text>
                  </>
                ) : null}
              </AppCard>

              <AppCard style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Actions</Text>
                {(Array.isArray(selected?.actions) ? selected.actions : []).length === 0 ? (
                  <Text style={styles.smallMuted}>Action yok.</Text>
                ) : (
                  (selected.actions || []).map((a, idx) => (
                    <View key={`${String(a?.type)}_${idx}`} style={styles.actionRow}>
                      <View style={[styles.actionIcon, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                        <Ionicons name={safeIoniconName(actionIcon(a?.type), 'flash-outline')} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {actionLabel(a?.type)}
                        </Text>
                        <Text style={styles.smallMuted} numberOfLines={2}>
                          {a?.params ? JSON.stringify(a.params) : '—'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </AppCard>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{draft?.id ? 'Otomasyonu Düzenle' : 'Yeni Otomasyon'}</Text>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => setEditorOpen(false)}>
              <Ionicons name={safeIoniconName('close', 'close')} size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Ad *</Text>
            <TextInput value={draft.name} onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))} placeholder="Otomasyon adı" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Durum</Text>
            <View style={styles.toggleRow}>
              {[
                { key: true, label: 'Aktif' },
                { key: false, label: 'Pasif' },
              ].map((t) => {
                const active = t.key === !!draft.active;
                return (
                  <TouchableOpacity
                    key={String(t.key)}
                    activeOpacity={0.85}
                    onPress={() => setDraft((p) => ({ ...p, active: t.key }))}
                    style={[styles.togglePill, active ? styles.togglePillActive : null]}
                  >
                    <Text style={[styles.toggleText, active ? styles.toggleTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Trigger</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {TRIGGER_TYPES.map((t) => {
                const active = t.key === draft.triggerType;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.85}
                    onPress={() => setDraft((p) => ({ ...p, triggerType: t.key }))}
                    style={[styles.pill, active ? styles.pillActive : null]}
                  >
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Trigger Params (JSON)</Text>
            <TextInput
              value={draft.triggerParamsText}
              onChangeText={(v) => setDraft((p) => ({ ...p, triggerParamsText: v }))}
              placeholder="{}"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.inputMultilineSmall]}
              multiline
              autoCapitalize="none"
            />

            <AppCard style={styles.builderCard}>
              <Text style={styles.sectionTitle}>Koşullar (opsiyonel)</Text>
              <Text style={styles.meta}>Koşul kontrolü ile uyumlu.</Text>

              <Text style={styles.label}>pipeline_stage_is</Text>
              <TextInput
                value={String(draft?.conditions?.pipeline_stage_is ?? '')}
                onChangeText={(v) => setDraft((p) => ({ ...p, conditions: { ...(p.conditions || {}), pipeline_stage_is: v } }))}
                placeholder="Örn: qualified"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>form_id_is</Text>
              <TextInput
                value={String(draft?.conditions?.form_id_is ?? '')}
                onChangeText={(v) => setDraft((p) => ({ ...p, conditions: { ...(p.conditions || {}), form_id_is: v } }))}
                placeholder="Form ID"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>segment_id</Text>
              <TextInput
                value={String(draft?.conditions?.segment_id ?? '')}
                onChangeText={(v) => setDraft((p) => ({ ...p, conditions: { ...(p.conditions || {}), segment_id: v } }))}
                placeholder="Segment ID"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>no_form_submission_since_minutes</Text>
                  <TextInput
                    value={String(draft?.conditions?.no_form_submission_since_minutes ?? '')}
                    onChangeText={(v) => setDraft((p) => ({ ...p, conditions: { ...(p.conditions || {}), no_form_submission_since_minutes: v } }))}
                    placeholder="Örn: 1440"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>no_activity_since_minutes</Text>
                  <TextInput
                    value={String(draft?.conditions?.no_activity_since_minutes ?? '')}
                    onChangeText={(v) => setDraft((p) => ({ ...p, conditions: { ...(p.conditions || {}), no_activity_since_minutes: v } }))}
                    placeholder="Örn: 60"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </AppCard>

            <AppCard style={styles.builderCard}>
              <Text style={styles.sectionTitle}>Akış Şablonları</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {FLOW_TEMPLATES.map((t) => (
                  <TouchableOpacity key={t.key} activeOpacity={0.9} onPress={() => applyFlowTemplate(t)} style={styles.pill}>
                    <Text style={styles.pillText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </AppCard>

            <AppCard style={styles.builderCard}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <Text style={styles.meta}>Sürükle-bırak yerine sırayla hareket ettirin.</Text>

              {draft.actions.map((a, idx) => {
                const type = String(a?.type || '');
                return (
                  <View key={a.localId || String(idx)} style={styles.actionCard}>
                    <View style={styles.actionCardTop}>
                      <View style={[styles.actionIcon, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '30' }]}>
                        <Ionicons name={safeIoniconName(actionIcon(type), 'flash-outline')} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.actionTitle} numberOfLines={1}>
                          {actionLabel(type)}
                        </Text>
                        <Text style={styles.smallMuted} numberOfLines={1}>
                          #{idx + 1}
                        </Text>
                      </View>
                      <View style={styles.actionCardBtns}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          activeOpacity={0.9}
                          onPress={() => {
                            if (idx <= 0) return;
                            setDraft((p) => {
                              const next = p.actions.slice();
                              const tmp = next[idx - 1];
                              next[idx - 1] = next[idx];
                              next[idx] = tmp;
                              return { ...p, actions: next };
                            });
                          }}
                        >
                          <Ionicons name={safeIoniconName('arrow-up-outline', 'arrow-up-outline')} size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          activeOpacity={0.9}
                          onPress={() => {
                            if (idx >= draft.actions.length - 1) return;
                            setDraft((p) => {
                              const next = p.actions.slice();
                              const tmp = next[idx + 1];
                              next[idx + 1] = next[idx];
                              next[idx] = tmp;
                              return { ...p, actions: next };
                            });
                          }}
                        >
                          <Ionicons name={safeIoniconName('arrow-down-outline', 'arrow-down-outline')} size={16} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          activeOpacity={0.9}
                          onPress={() => setDraft((p) => ({ ...p, actions: p.actions.filter((x) => x.localId !== a.localId) }))}
                        >
                          <Ionicons name={safeIoniconName('trash-outline', 'trash-outline')} size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.label}>Tip</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                      {ACTION_TYPES.map((t) => {
                        const active = t.key === type;
                        return (
                          <TouchableOpacity
                            key={t.key}
                            activeOpacity={0.9}
                            onPress={() => {
                              setDraft((p) => {
                                const next = p.actions.slice();
                                const prev = next[idx] || {};
                                const updated = { localId: prev.localId || buildId('act'), type: t.key };
                                if (t.key === 'send_email_template') Object.assign(updated, { templateId: 'TEMPLATE_ID', to: '', variablesText: JSON.stringify({}, null, 2) });
                                else if (t.key === 'send_email') Object.assign(updated, { to: '', subject: '', html: '' });
                                else if (t.key === 'send_conversion') Object.assign(updated, { eventName: '' });
                                else if (t.key === 'update_pipeline') Object.assign(updated, { stage: '' });
                                else if (t.key === 'route_to_team') Object.assign(updated, { teamId: '' });
                                else if (t.key === 'notify_slack') Object.assign(updated, { webhookUrl: '', text: '' });
                                else if (t.key === 'add_custom_audience') Object.assign(updated, { adAccountId: '', emailsText: '' });
                                else if (t.key === 'send_webhook') Object.assign(updated, { url: '', bodyText: JSON.stringify({}, null, 2) });
                                else if (t.key === 'create_task') Object.assign(updated, { title: '', dueDate: '', assignedTo: '', delayMinutes: '', delaySeconds: '', conditionsText: JSON.stringify({}, null, 2) });
                                next[idx] = updated;
                                return { ...p, actions: next };
                              });
                            }}
                            style={[styles.pill, active ? styles.pillActive : null]}
                          >
                            <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{t.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {type === 'send_email_template' ? (
                      <>
                        <Text style={styles.label}>templateId *</Text>
                        <TextInput
                          value={String(a?.templateId || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, templateId: v } : x)) }))}
                          placeholder="TEMPLATE_ID"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>to (opsiyonel)</Text>
                        <TextInput
                          value={String(a?.to || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, to: v } : x)) }))}
                          placeholder="ornek@domain.com"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <Text style={styles.label}>variables (JSON)</Text>
                        <TextInput
                          value={String(a?.variablesText || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, variablesText: v } : x)) }))}
                          placeholder="{}"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'send_email' ? (
                      <>
                        <Text style={styles.label}>to *</Text>
                        <TextInput
                          value={String(a?.to || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, to: v } : x)) }))}
                          placeholder="ornek@domain.com"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <Text style={styles.label}>subject *</Text>
                        <TextInput
                          value={String(a?.subject || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, subject: v } : x)) }))}
                          placeholder="Konu"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                        />
                        <Text style={styles.label}>html *</Text>
                        <TextInput
                          value={String(a?.html || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, html: v } : x)) }))}
                          placeholder="<html>...</html>"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultiline]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'send_conversion' ? (
                      <>
                        <Text style={styles.label}>eventName</Text>
                        <TextInput
                          value={String(a?.eventName || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, eventName: v } : x)) }))}
                          placeholder="AutomationEvent"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'update_pipeline' ? (
                      <>
                        <Text style={styles.label}>stage *</Text>
                        <TextInput
                          value={String(a?.stage || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, stage: v } : x)) }))}
                          placeholder="qualified"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'route_to_team' ? (
                      <>
                        <Text style={styles.label}>teamId *</Text>
                        <TextInput
                          value={String(a?.teamId || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, teamId: v } : x)) }))}
                          placeholder="TEAM_ID"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'notify_slack' ? (
                      <>
                        <Text style={styles.label}>webhookUrl *</Text>
                        <TextInput
                          value={String(a?.webhookUrl || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, webhookUrl: v } : x)) }))}
                          placeholder="https://hooks.slack.com/services/..."
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>text *</Text>
                        <TextInput
                          value={String(a?.text || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, text: v } : x)) }))}
                          placeholder="Mesaj"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                        />
                      </>
                    ) : null}

                    {type === 'add_custom_audience' ? (
                      <>
                        <Text style={styles.label}>adAccountId *</Text>
                        <TextInput
                          value={String(a?.adAccountId || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, adAccountId: v } : x)) }))}
                          placeholder="AD_ACCOUNT_ID"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>emails (satır satır)</Text>
                        <TextInput
                          value={String(a?.emailsText || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, emailsText: v } : x)) }))}
                          placeholder="a@b.com\nc@d.com"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'send_webhook' ? (
                      <>
                        <Text style={styles.label}>url *</Text>
                        <TextInput
                          value={String(a?.url || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, url: v } : x)) }))}
                          placeholder="https://example.com/webhook"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>body (JSON)</Text>
                        <TextInput
                          value={String(a?.bodyText || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, bodyText: v } : x)) }))}
                          placeholder="{}"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type === 'create_task' ? (
                      <>
                        <Text style={styles.label}>title *</Text>
                        <TextInput
                          value={String(a?.title || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, title: v } : x)) }))}
                          placeholder="Görev başlığı"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                        />
                        <View style={styles.twoColRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>delayMinutes</Text>
                            <TextInput
                              value={String(a?.delayMinutes || '')}
                              onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, delayMinutes: v } : x)) }))}
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                              style={styles.input}
                              keyboardType="number-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>delaySeconds</Text>
                            <TextInput
                              value={String(a?.delaySeconds || '')}
                              onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, delaySeconds: v } : x)) }))}
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                              style={styles.input}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>
                        <Text style={styles.label}>dueDate</Text>
                        <TextInput
                          value={String(a?.dueDate || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, dueDate: v } : x)) }))}
                          placeholder="2026-01-31T10:00:00Z"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>assignedTo</Text>
                        <TextInput
                          value={String(a?.assignedTo || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, assignedTo: v } : x)) }))}
                          placeholder="User ID"
                          placeholderTextColor={colors.textSecondary}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                        <Text style={styles.label}>conditions (JSON)</Text>
                        <TextInput
                          value={String(a?.conditionsText || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, conditionsText: v } : x)) }))}
                          placeholder="{}"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}

                    {type && !ACTION_TYPES.some((x) => x.key === type) ? (
                      <>
                        <Text style={styles.label}>params (JSON)</Text>
                        <TextInput
                          value={String(a?.paramsText || '')}
                          onChangeText={(v) => setDraft((p) => ({ ...p, actions: p.actions.map((x) => (x.localId === a.localId ? { ...x, paramsText: v } : x)) }))}
                          placeholder="{}"
                          placeholderTextColor={colors.textSecondary}
                          style={[styles.input, styles.inputMultilineSmall]}
                          multiline
                          autoCapitalize="none"
                        />
                      </>
                    ) : null}
                  </View>
                );
              })}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {ACTION_TYPES.map((t) => (
                  <TouchableOpacity
                    key={`add_${t.key}`}
                    activeOpacity={0.9}
                    onPress={() => {
                      setDraft((p) => {
                        const next = p.actions.slice();
                        const localId = buildId('act');
                        const a = { localId, type: t.key };
                        if (t.key === 'send_email_template') Object.assign(a, { templateId: 'TEMPLATE_ID', to: '', variablesText: JSON.stringify({}, null, 2) });
                        else if (t.key === 'send_email') Object.assign(a, { to: '', subject: '', html: '' });
                        else if (t.key === 'send_conversion') Object.assign(a, { eventName: '' });
                        else if (t.key === 'update_pipeline') Object.assign(a, { stage: '' });
                        else if (t.key === 'route_to_team') Object.assign(a, { teamId: '' });
                        else if (t.key === 'notify_slack') Object.assign(a, { webhookUrl: '', text: '' });
                        else if (t.key === 'add_custom_audience') Object.assign(a, { adAccountId: '', emailsText: '' });
                        else if (t.key === 'send_webhook') Object.assign(a, { url: '', bodyText: JSON.stringify({}, null, 2) });
                        else if (t.key === 'create_task') Object.assign(a, { title: '', dueDate: '', assignedTo: '', delayMinutes: '', delaySeconds: '', conditionsText: JSON.stringify({}, null, 2) });
                        next.push(a);
                        return { ...p, actions: next };
                      });
                    }}
                    style={styles.addPill}
                  >
                    <Ionicons name={safeIoniconName('add', 'add')} size={14} color={colors.primary} />
                    <Text style={styles.addPillText}>{t.label} ekle</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </AppCard>

            <TouchableOpacity style={[styles.primaryButton, editorSaving ? styles.disabled : null]} activeOpacity={0.85} onPress={save} disabled={editorSaving}>
              {editorSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Kaydet</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors, isDark) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 28, gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 10, color: colors.textSecondary, fontWeight: '700' },

    headerCard: { padding: 14, gap: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    title: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    meta: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },
    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },

    primaryButtonSmall: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', gap: 8, alignItems: 'center' },
    primaryButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    secondaryButtonSmall: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonSmallText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    dangerButtonSmall: { marginTop: 10, backgroundColor: colors.danger + '14', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.danger + '40' },
    dangerButtonSmallText: { color: colors.danger, fontWeight: '900', fontSize: 12 },

    tabsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    tabPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    metricsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    metricCard: { flex: 1, minWidth: 150, paddingVertical: 12 },
    metricLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    metricValue: { color: colors.textPrimary, fontWeight: '900', fontSize: 18, marginTop: 6 },

    card: { padding: 14 },
    label: { marginTop: 12, marginBottom: 8, color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    inputMultilineSmall: { minHeight: 90, textAlignVertical: 'top' },
    inputMultiline: { minHeight: 190, textAlignVertical: 'top' },

    pillRow: { gap: 8, paddingBottom: 2 },
    pill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    pillTextActive: { color: '#fff' },

    filterCard: { padding: 12, gap: 10 },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    filterRow: { gap: 8, paddingRight: 12 },
    filterPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    filterTextActive: { color: '#fff' },

    toggleRow: { flexDirection: 'row', gap: 8 },
    togglePill: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    togglePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    toggleText: { color: colors.textSecondary, fontWeight: '900' },
    toggleTextActive: { color: '#fff' },

    primaryButton: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    disabled: { opacity: 0.6 },

    ruleCard: { padding: 12 },
    ruleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    ruleName: { color: colors.textPrimary, fontWeight: '900', fontSize: 14 },
    ruleMeta: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    ruleMid: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, paddingRight: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, maxWidth: 170 },
    chipText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
    ruleActions: { flexDirection: 'row', gap: 8 },
    smallMuted: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },

    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    statusOk: { backgroundColor: colors.success + '12', borderColor: colors.success + '40' },
    statusMuted: { backgroundColor: isDark ? colors.surface : colors.background, borderColor: colors.border },
    statusText: { fontWeight: '900', fontSize: 12 },
    statusTextOk: { color: colors.success },
    statusTextMuted: { color: colors.textSecondary },

    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    modalOverlay: { flex: 1, backgroundColor: '#000', opacity: 0.3 },
    modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '10%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    modalBody: { padding: 16, paddingBottom: 28 },

    builderCard: { padding: 12, marginTop: 12 },
    twoColRow: { flexDirection: 'row', gap: 10 },

    actionCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 },
    actionCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    actionIcon: { width: 36, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    actionTitle: { color: colors.textPrimary, fontWeight: '900' },
    actionCardBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },

    addPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.primary + '55', backgroundColor: colors.primary + '10' },
    addPillText: { color: colors.primary, fontWeight: '900', fontSize: 12 },

    detailCard: { padding: 14 },
    detailTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    detailMeta: { marginTop: 6, color: colors.textSecondary, fontWeight: '800' },
    detailActionsRow: { marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    codeBlock: { marginTop: 10, fontFamily: undefined, color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, fontWeight: '700' },
    actionRow: { marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  });
}
