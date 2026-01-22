import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';
import { ticketsService } from '../api/services/ticketsService';
import apiClient from '../api/client';
import { authService } from '../api/authService';
import { leadsService } from '../api/services/leadsService';
import { contactsService } from '../api/services/contactsService';
import { accountsService } from '../api/services/accountsService';
import { emailService } from '../api/services/emailService';
import { activityService } from '../api/services/activityService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function normalizeStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return 'open';
  if (s === 'open' || s === 'new') return 'open';
  if (s === 'in_progress' || s === 'in-progress' || s === 'processing') return 'in_progress';
  if (s === 'pending' || s === 'waiting') return 'waiting';
  if (s === 'resolved') return 'resolved';
  if (s === 'closed' || s === 'done' || s === 'completed') return 'closed';
  return s;
}

function pickText(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function normalizePriority(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return 'normal';
  if (s === 'low' || s === 'düşük' || s === 'dusuk') return 'low';
  if (s === 'high' || s === 'yüksek' || s === 'yuksek') return 'high';
  if (s === 'critical' || s === 'kritik') return 'critical';
  if (s === 'normal' || s === 'medium' || s === 'orta') return 'normal';
  return s;
}

function priorityUi(priority, colors) {
  const p = normalizePriority(priority);
  if (p === 'critical') return { label: 'Kritik', color: colors.error, icon: 'warning-outline' };
  if (p === 'high') return { label: 'Yüksek', color: colors.warning, icon: 'arrow-up-outline' };
  if (p === 'low') return { label: 'Düşük', color: colors.textSecondary, icon: 'arrow-down-outline' };
  return { label: 'Normal', color: colors.primary, icon: 'remove-outline' };
}

function normalizePriorityKey(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return 'medium';
  if (s === 'low' || s === 'düşük' || s === 'dusuk') return 'low';
  if (s === 'medium' || s === 'normal' || s === 'orta') return 'medium';
  if (s === 'high' || s === 'yüksek' || s === 'yuksek') return 'high';
  if (s === 'urgent' || s === 'acil' || s === 'kritik') return 'urgent';
  return s;
}

function priorityLabelTr(value) {
  const p = normalizePriorityKey(value);
  if (p === 'low') return 'Düşük';
  if (p === 'medium') return 'Orta';
  if (p === 'high') return 'Yüksek';
  if (p === 'urgent') return 'Acil';
  return String(value || 'Orta');
}

function statusLabelTr(value) {
  const s = normalizeStatus(value);
  if (s === 'open') return 'Açık';
  if (s === 'in_progress') return 'İşlemde';
  if (s === 'waiting') return 'Beklemede';
  if (s === 'resolved') return 'Çözüldü';
  if (s === 'closed') return 'Kapalı';
  return String(value || 'Bilinmiyor');
}

function stripHtmlToText(html) {
  const raw = String(html || '');
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export default function TicketsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ subject: '', description: '', priority: 'medium', assignedToId: '', leadId: '', contactId: '', accountId: '' });
  const [creating, setCreating] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState(null);
  const [detailTab, setDetailTab] = useState('customer');

  const [listsLoading, setListsLoading] = useState(false);
  const [lists, setLists] = useState({ users: [], leads: [], contacts: [], accounts: [] });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOnSelect, setPickerOnSelect] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const [internalAssignee, setInternalAssignee] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [activities, setActivities] = useState([]);
  const [activityNote, setActivityNote] = useState('');
  const [loggingActivity, setLoggingActivity] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([ticketsService.list({ limit: 250, offset: 0 }), authService.me()]);
    const ticketsRes = results[0].status === 'fulfilled' ? results[0].value : [];
    const meRes = results[1].status === 'fulfilled' ? results[1].value : null;
    const list = normalizeList(ticketsRes?.items ?? ticketsRes);
    setItems(list);
    setMe(meRes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const results = await Promise.allSettled([
        apiClient.get('/users'),
        apiClient.get('/settings/company/users'),
        leadsService.getAll({ limit: 250 }),
        contactsService.getAll({ limit: 250 }),
        accountsService.getAll({ limit: 250 }),
      ]);

      const usersPrimary = results[0].status === 'fulfilled' ? normalizeList(results[0].value?.data) : [];
      const usersFallback = results[1].status === 'fulfilled' ? normalizeList(results[1].value?.data) : [];
      const rawUsers = usersPrimary.length ? usersPrimary : usersFallback;
      const users = (Array.isArray(rawUsers) ? rawUsers : []).map((u) => ({
        id: String(u?.id ?? u?._id ?? ''),
        label: String(u?.name || `${u?.firstName ?? ''} ${u?.lastName ?? ''}` || u?.email || 'Kullanıcı').trim(),
        raw: u,
      }));

      const rawLeads = results[2].status === 'fulfilled' ? normalizeList(results[2].value) : [];
      const rawContacts = results[3].status === 'fulfilled' ? normalizeList(results[3].value) : [];
      const rawAccounts = results[4].status === 'fulfilled' ? normalizeList(results[4].value) : [];

      const leads = (Array.isArray(rawLeads) ? rawLeads : []).map((l) => ({
        id: String(l?.id ?? l?._id ?? ''),
        label: String(l?.name || `${l?.firstName ?? ''} ${l?.lastName ?? ''}` || 'Lead').trim(),
        raw: l,
      }));

      const contacts = (Array.isArray(rawContacts) ? rawContacts : []).map((c) => ({
        id: String(c?.id ?? c?._id ?? ''),
        label: String(c?.name || `${c?.firstName ?? ''} ${c?.lastName ?? ''}` || 'Kişi').trim(),
        raw: c,
      }));

      const accounts = (Array.isArray(rawAccounts) ? rawAccounts : []).map((a) => ({
        id: String(a?.id ?? a?._id ?? ''),
        label: String(a?.name ?? a?.companyName ?? 'Firma').trim(),
        raw: a,
      }));

      setLists({ users, leads, contacts, accounts });
    } catch {
      setLists({ users: [], leads: [], contacts: [], accounts: [] });
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const openPicker = useCallback((title, itemsForPicker, onSelect) => {
    setPickerTitle(String(title || 'Seçim'));
    setPickerItems(Array.isArray(itemsForPicker) ? itemsForPicker : []);
    setPickerOnSelect(() => onSelect);
    setPickerQuery('');
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerItems([]);
    setPickerTitle('');
    setPickerQuery('');
    setPickerOnSelect(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const statusUi = useCallback(
    (status) => {
      const s = normalizeStatus(status);
      if (s === 'open') return { label: 'Açık', color: colors.primary, icon: 'alert-circle-outline' };
      if (s === 'in_progress') return { label: 'İşlemde', color: colors.info ?? colors.primary, icon: 'construct-outline' };
      if (s === 'waiting') return { label: 'Beklemede', color: colors.warning, icon: 'time-outline' };
      if (s === 'resolved') return { label: 'Çözüldü', color: colors.success, icon: 'checkmark-circle-outline' };
      if (s === 'closed') return { label: 'Kapalı', color: colors.textSecondary, icon: 'checkmark-done-outline' };
      return { label: String(status || 'Bilinmiyor'), color: colors.textSecondary, icon: 'help-circle-outline' };
    },
    [colors.info, colors.primary, colors.success, colors.textSecondary, colors.warning],
  );

  const visible = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return items
      .filter((t) => {
        const s = normalizeStatus(t?.status ?? t?.state);
        if (filterStatus === 'all') return true;
        return s === filterStatus;
      })
      .filter((t) => {
        const p = normalizePriorityKey(t?.priority ?? t?.severity);
        if (filterPriority !== 'all' && p !== filterPriority) return false;
        if (filterAssignedToMe) {
          const myId = String(me?.id ?? me?.user?.id ?? me?._id ?? '').trim();
          const assignedId = String(t?.assignedTo?.id ?? t?.assignedToId ?? t?.assigned_to_id ?? t?.assigneeId ?? '').trim();
          if (!myId || !assignedId || assignedId !== myId) return false;
        }
        if (!q) return true;
        const hay = `${t?.subject ?? t?.title ?? ''} ${t?.description ?? ''} ${t?.id ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a?.updatedAt ?? a?.updated_at ?? a?.createdAt ?? a?.created_at ?? 0).getTime();
        const tb = new Date(b?.updatedAt ?? b?.updated_at ?? b?.createdAt ?? b?.created_at ?? 0).getTime();
        return tb - ta;
      });
  }, [filterAssignedToMe, filterPriority, filterStatus, items, me, search]);

  const openNew = useCallback(() => {
    setDraft({ subject: '', description: '', priority: 'medium', assignedToId: '', leadId: '', contactId: '', accountId: '' });
    setCreateOpen(true);
  }, []);

  const createTicket = useCallback(async () => {
    const subject = String(draft.subject || '').trim();
    if (!subject) {
      Alert.alert('Eksik bilgi', 'Konu zorunlu.');
      return;
    }
    setCreating(true);
    try {
      await ticketsService.create({
        subject,
        description: String(draft.description || '').trim() || undefined,
        message: String(draft.description || '').trim() || undefined,
        priority: normalizePriorityKey(draft.priority),
        assignedToId: String(draft.assignedToId || '').trim() || undefined,
        leadId: String(draft.leadId || '').trim() || undefined,
        contactId: String(draft.contactId || '').trim() || undefined,
        accountId: String(draft.accountId || '').trim() || undefined,
      });
      setCreateOpen(false);
      await onRefresh();
    } catch {
      Alert.alert('Hata', 'Talep oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }, [draft.accountId, draft.assignedToId, draft.contactId, draft.description, draft.leadId, draft.priority, draft.subject, onRefresh]);

  const openDetail = useCallback(
    async (ticket) => {
      setSelected(ticket);
      setDetailOpen(true);
      setThread(null);
      setDetailTab('customer');
      setActivities([]);
      setActivityNote('');
      setTemplates([]);
      setSelectedTemplateId('');
      setEmailBody('');
      setEmailSubject('');
      setInternalAssignee('');
      setInternalNote('');
      const id = String(ticket?.id ?? ticket?.ticketId ?? ticket?._id ?? '').trim();
      if (!id) return;
      setThreadLoading(true);
      try {
        const results = await Promise.allSettled([
          ticketsService.get(id),
          activityService.list({ ticketId: id }),
          emailService.listTemplates(),
        ]);
        const res = results[0].status === 'fulfilled' ? results[0].value : null;
        const acts = results[1].status === 'fulfilled' ? normalizeList(results[1].value) : [];
        const tpls = results[2].status === 'fulfilled' ? normalizeList(results[2].value) : [];

        setThread(res);
        setActivities(acts);
        setTemplates(tpls);

        const subj = String(res?.subject ?? ticket?.subject ?? ticket?.title ?? '').trim();
        const shortId = String(res?.id ?? ticket?.id ?? ticket?.ticketId ?? id).trim().slice(0, 8);
        setEmailSubject(subj ? `YNT: ${subj} (#${shortId})` : `YNT: Ticket (#${shortId})`);
        setInternalAssignee(String(res?.assignedToId ?? ticket?.assignedToId ?? ticket?.assigned_to_id ?? '').trim());
      } catch {
        setThread(null);
      } finally {
        setThreadLoading(false);
      }
    },
    [],
  );

  const closeTicket = useCallback(async () => {
    const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
    if (!id) return;
    Alert.alert('Talep Kapatılsın mı?', `${String(selected?.subject ?? selected?.title ?? id)}`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kapat',
        style: 'destructive',
        onPress: async () => {
          try {
            await ticketsService.close(id);
            setDetailOpen(false);
            await onRefresh();
          } catch {
            Alert.alert('Hata', 'Talep kapatılamadı.');
          }
        },
      },
    ]);
  }, [onRefresh, selected]);

  const handleStatusChange = useCallback(
    async (newStatus) => {
      const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
      if (!id) return;
      try {
        await ticketsService.update(id, { status: newStatus });
        const res = await ticketsService.get(id);
        setThread(res);
        await onRefresh();
        try {
          const acts = await activityService.list({ ticketId: id });
          setActivities(normalizeList(acts));
        } catch {}
      } catch {
        Alert.alert('Hata', 'Durum güncellenemedi.');
      }
    },
    [onRefresh, selected],
  );

  const loadDefaultEmailTemplate = useCallback(() => {
    const t = thread ?? selected;
    const subj = String(t?.subject ?? t?.title ?? '').trim();
    const id = String(t?.id ?? t?.ticketId ?? t?._id ?? '').trim();
    const customerName = pickText(t?.contact?.firstName, t?.contact?.name, t?.lead?.name, t?.lead?.firstName, t?.customerName) || 'Müşteri';
    const shortId = id ? id.slice(0, 8) : '';
    const text = `Sayın {{customerName}},\n\n{{ticketSubject}} konulu (#{{ticketId}}) talebiniz ile ilgili olarak;\n\n[Yanıtınızı buraya yazınız]\n\nSaygılarımızla,\nDestek Ekibi`
      .replace('{{customerName}}', customerName)
      .replace('{{ticketSubject}}', subj || 'Destek Talebi')
      .replace('{{ticketId}}', shortId || id || '');
    setEmailBody(text);
  }, [selected, thread]);

  const handleTemplateSelect = useCallback(
    (tplId) => {
      const tpl = templates.find((t) => String(t?.id ?? t?._id) === String(tplId));
      if (!tpl) return;
      const t = thread ?? selected;
      const subj = String(t?.subject ?? t?.title ?? '').trim();
      const id = String(t?.id ?? t?.ticketId ?? t?._id ?? '').trim();
      const customerName = pickText(t?.contact?.firstName, t?.contact?.name, t?.lead?.name, t?.lead?.firstName, t?.customerName) || 'Müşteri';
      const shortId = id ? id.slice(0, 8) : '';

      let nextSubject = String(tpl?.subject ?? '').trim();
      let nextBody = String(tpl?.html ?? tpl?.body ?? '').trim();

      nextSubject = nextSubject.replace('{{ticketSubject}}', subj).replace('{{ticketId}}', shortId);
      nextBody = nextBody
        .replace('{{customerName}}', customerName)
        .replace('{{ticketSubject}}', subj)
        .replace('{{ticketId}}', shortId);

      setEmailSubject(nextSubject || emailSubject);
      setEmailBody(stripHtmlToText(nextBody));
      setSelectedTemplateId(String(tplId));
    },
    [emailSubject, selected, templates, thread],
  );

  const handleSendEmail = useCallback(async () => {
    const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
    if (!id) return;
    const t = thread ?? selected;
    const to = pickText(t?.contact?.email, t?.lead?.email, t?.email, t?.customerEmail);
    if (!to) {
      Alert.alert('Hata', 'Müşteri e-posta adresi bulunamadı.');
      return;
    }
    if (!String(emailBody || '').trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen mesaj içeriği girin.');
      return;
    }

    setSendingEmail(true);
    try {
      await ticketsService.sendEmail(id, { to, subject: emailSubject, body: emailBody });
      setEmailBody('');
      try {
        const acts = await activityService.list({ ticketId: id });
        setActivities(normalizeList(acts));
      } catch {}
      await onRefresh();
    } catch {
      Alert.alert('Hata', 'E-posta gönderilemedi.');
    } finally {
      setSendingEmail(false);
    }
  }, [emailBody, emailSubject, onRefresh, selected, thread]);

  const handleCreateTemplate = useCallback(async () => {
    const name = String(newTemplateName || '').trim();
    if (!name) return;
    try {
      await emailService.createTemplate({
        name,
        subject: String(emailSubject || '').trim(),
        html: String(emailBody || '').replace(/\n/g, '<br/>'),
      });
      setSaveTemplateOpen(false);
      setNewTemplateName('');
      const tpls = await emailService.listTemplates();
      setTemplates(normalizeList(tpls));
      Alert.alert('Başarılı', 'Şablon oluşturuldu.');
    } catch {
      Alert.alert('Hata', 'Şablon oluşturulamadı.');
    }
  }, [emailBody, emailSubject, newTemplateName]);

  const handleInternalAssign = useCallback(async () => {
    const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
    if (!id) return;
    setAssigning(true);
    try {
      const nextAssignee = String(internalAssignee || '').trim();
      await ticketsService.update(id, {
        assignedToId: nextAssignee || null,
        notificationMessage: String(internalNote || '').trim() || undefined,
      });
      const res = await ticketsService.get(id);
      setThread(res);
      setInternalNote('');
      try {
        const acts = await activityService.list({ ticketId: id });
        setActivities(normalizeList(acts));
      } catch {}
      await onRefresh();
      Alert.alert('Başarılı', 'Atama güncellendi.');
    } catch {
      Alert.alert('Hata', 'Atama güncellenemedi.');
    } finally {
      setAssigning(false);
    }
  }, [internalAssignee, internalNote, onRefresh, selected]);

  const handleLogActivity = useCallback(async () => {
    const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
    if (!id) return;
    const note = String(activityNote || '').trim();
    if (!note) return;
    setLoggingActivity(true);
    try {
      await activityService.create({ type: 'NOTE', description: note, metadata: { ticketId: id } });
      setActivityNote('');
      const acts = await activityService.list({ ticketId: id });
      setActivities(normalizeList(acts));
    } catch {
      Alert.alert('Hata', 'Not eklenemedi.');
    } finally {
      setLoggingActivity(false);
    }
  }, [activityNote, selected]);

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Destek Talepleri</Text>
              <Text style={styles.meta}>Müşteri taleplerini ve şirket içi görevleri yönetin.</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('refresh', 'refresh')} size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowFilters((v) => !v)} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('filter-outline', 'options-outline')} size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonSmall} onPress={openNew} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('add', 'add')} size={16} color="#fff" />
                <Text style={styles.primaryButtonSmallText}>Yeni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.filterCard}>
          <View style={styles.searchWrap}>
            <Ionicons name={safeIoniconName('search-outline', 'search-outline')} size={18} color={colors.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Ara (id, konu, açıklama)" placeholderTextColor={colors.textSecondary} style={styles.searchInput} />
            {search ? (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </AppCard>

        {showFilters ? (
          <AppCard style={styles.filtersPanel}>
            <Text style={styles.sectionTitle}>Filtreler</Text>

            <Text style={styles.label}>Durum</Text>
            <View style={styles.pillsRow}>
              {[
                { key: 'all', label: 'Tümü' },
                { key: 'open', label: 'Açık' },
                { key: 'in_progress', label: 'İşlemde' },
                { key: 'waiting', label: 'Beklemede' },
                { key: 'resolved', label: 'Çözüldü' },
                { key: 'closed', label: 'Kapalı' },
              ].map((s) => {
                const active = filterStatus === s.key;
                return (
                  <TouchableOpacity key={s.key} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setFilterStatus(s.key)} activeOpacity={0.85}>
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Öncelik</Text>
            <View style={styles.pillsRow}>
              {[
                { key: 'all', label: 'Tümü' },
                { key: 'low', label: 'Düşük' },
                { key: 'medium', label: 'Orta' },
                { key: 'high', label: 'Yüksek' },
                { key: 'urgent', label: 'Acil' },
              ].map((p) => {
                const active = filterPriority === p.key;
                return (
                  <TouchableOpacity key={p.key} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setFilterPriority(p.key)} activeOpacity={0.85}>
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sadece bana atananlar</Text>
              <Switch value={filterAssignedToMe} onValueChange={setFilterAssignedToMe} />
            </View>

            <View style={styles.filtersFooter}>
              <TouchableOpacity
                style={styles.modalOutlineBtn}
                onPress={() => {
                  setFilterStatus('all');
                  setFilterPriority('all');
                  setFilterAssignedToMe(false);
                  setSearch('');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalOutlineText}>Temizle</Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        ) : null}
      </View>
    );
  }, [
    filterAssignedToMe,
    filterPriority,
    filterStatus,
    colors.textPrimary,
    colors.textSecondary,
    onRefresh,
    openNew,
    search,
    showFilters,
    styles.clearBtn,
    styles.filterCard,
    styles.filtersFooter,
    styles.filtersPanel,
    styles.headerCard,
    styles.headerRight,
    styles.headerTop,
    styles.iconBtn,
    styles.meta,
    styles.primaryButtonSmall,
    styles.primaryButtonSmallText,
    styles.searchInput,
    styles.searchWrap,
    styles.toggleLabel,
    styles.toggleRow,
    styles.title,
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
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        {header}

        {visible.length === 0 ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Talep yok</Text>
            <Text style={styles.meta}>Bu filtrede talep bulunamadı.</Text>
          </AppCard>
        ) : null}

        <FlatList
          data={visible}
          keyExtractor={(item, idx) => String(item?.id ?? item?.ticketId ?? item?._id ?? idx)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const id = String(item?.id ?? item?.ticketId ?? item?._id ?? '');
            const subject = String(item?.subject ?? item?.title ?? 'Destek Talebi');
            const status = statusUi(item?.status ?? item?.state);
            const createdAt = item?.createdAt ?? item?.created_at;
            const updatedAt = item?.updatedAt ?? item?.updated_at ?? createdAt;
            const priorityKey = normalizePriorityKey(item?.priority ?? item?.severity);
            const priority = priorityUi(item?.priority ?? item?.severity, colors);
            const assignee =
              item?.assignee?.name ??
              item?.assignedTo?.name ??
              item?.assigned_to?.name ??
              item?.assignedToName ??
              item?.assigneeName ??
              '';
            const preview = pickText(item?.preview, item?.lastMessage, item?.last_message, item?.message, item?.description, item?.body);
            const attachmentsCount = Array.isArray(item?.attachments)
              ? item.attachments.length
              : Array.isArray(item?.files)
                ? item.files.length
                : Number(item?.attachmentsCount ?? item?.attachments_count ?? 0);
            const messagesCount = Number(item?.messagesCount ?? item?.messages_count ?? item?.repliesCount ?? item?.replies_count ?? item?.commentsCount ?? item?.comments_count ?? 0);
            return (
              <AppCard style={styles.ticketCard} onPress={() => openDetail(item)} accessibilityLabel={`${subject} talebi`}>
                <View style={styles.ticketTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>
                      {subject}
                    </Text>
                    <Text style={styles.smallMuted} numberOfLines={1}>
                      #{id} • {priorityLabelTr(priorityKey)} • {formatDate(updatedAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.color + '12', borderColor: status.color + '3A' }]}>
                    <Ionicons name={safeIoniconName(status.icon, 'help-circle-outline')} size={14} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.ticketDivider} />

                <View style={styles.ticketDetails}>
                  {preview ? (
                    <Text style={styles.ticketPreview} numberOfLines={2}>
                      {preview}
                    </Text>
                  ) : null}

                  <View style={styles.ticketPills}>
                    <View style={[styles.detailPill, { borderColor: priority.color + '33', backgroundColor: priority.color + '12' }]}>
                      <Ionicons name={safeIoniconName(priority.icon, 'alert-circle-outline')} size={14} color={priority.color} />
                      <Text style={[styles.detailPillText, { color: priority.color }]} numberOfLines={1}>
                        {priority.label}
                      </Text>
                    </View>

                    {assignee ? (
                      <View style={styles.detailPill}>
                        <Ionicons name={safeIoniconName('person-outline', 'person-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.detailPillText} numberOfLines={1}>
                          {String(assignee)}
                        </Text>
                      </View>
                    ) : null}

                    {Number(messagesCount) > 0 ? (
                      <View style={styles.detailPill}>
                        <Ionicons name={safeIoniconName('chatbox-ellipses-outline', 'chatbox-ellipses-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.detailPillText} numberOfLines={1}>
                          {String(messagesCount)}
                        </Text>
                      </View>
                    ) : null}

                    {Number(attachmentsCount) > 0 ? (
                      <View style={styles.detailPill}>
                        <Ionicons name={safeIoniconName('attach-outline', 'attach-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.detailPillText} numberOfLines={1}>
                          {String(attachmentsCount)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.ticketMetaRow}>
                    <View style={styles.ticketMetaItem}>
                      <Ionicons name={safeIoniconName('time-outline', 'time-outline')} size={14} color={colors.textSecondary} />
                      <Text style={styles.ticketMetaText} numberOfLines={1}>
                        Oluşturuldu: {formatDate(createdAt)}
                      </Text>
                    </View>
                    <View style={styles.ticketMetaItem}>
                      <Ionicons name={safeIoniconName('refresh-outline', 'refresh-outline')} size={14} color={colors.textSecondary} />
                      <Text style={styles.ticketMetaText} numberOfLines={1}>
                        Güncellendi: {formatDate(updatedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              </AppCard>
            );
          }}
        />
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => (creating ? null : setCreateOpen(false))}>
        <Pressable style={styles.modalBackdrop} onPress={() => (creating ? null : setCreateOpen(false))} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Destek Talebi</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => (creating ? null : setCreateOpen(false))} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Konu</Text>
              <TextInput value={draft.subject} onChangeText={(v) => setDraft((p) => ({ ...p, subject: v }))} placeholder="Örn: Senkronizasyon sorunu" placeholderTextColor={colors.textSecondary} style={styles.input} />

              <Text style={styles.label}>Öncelik</Text>
              <View style={styles.pillsRow}>
                {[
                  { key: 'low', label: 'Düşük' },
                  { key: 'medium', label: 'Orta' },
                  { key: 'high', label: 'Yüksek' },
                  { key: 'urgent', label: 'Acil' },
                ].map((p) => {
                  const active = String(draft.priority) === p.key;
                  return (
                    <TouchableOpacity key={p.key} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setDraft((prev) => ({ ...prev, priority: p.key }))} activeOpacity={0.85}>
                      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Açıklama</Text>
              <TextInput value={draft.description} onChangeText={(v) => setDraft((p) => ({ ...p, description: v }))} placeholder="Detayları yazın…" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultiline]} multiline />

              <Text style={styles.label}>Atanan Kişi</Text>
              <TouchableOpacity
                style={styles.selectRow}
                activeOpacity={0.85}
                onPress={() =>
                  openPicker(
                    'Atanan Kişi',
                    [{ id: '', label: 'Atanmamış' }, ...lists.users],
                    (val) => setDraft((p) => ({ ...p, assignedToId: String(val || '') })),
                  )
                }
              >
                <Text style={styles.selectValue} numberOfLines={1}>
                  {lists.users.find((u) => String(u.id) === String(draft.assignedToId))?.label || 'Atanmamış'}
                </Text>
                <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.label}>Lead</Text>
              <TouchableOpacity
                style={styles.selectRow}
                activeOpacity={0.85}
                onPress={() =>
                  openPicker('Lead', [{ id: '', label: 'Seçilmedi' }, ...lists.leads], (val) => setDraft((p) => ({ ...p, leadId: String(val || '') })))
                }
              >
                <Text style={styles.selectValue} numberOfLines={1}>
                  {lists.leads.find((l) => String(l.id) === String(draft.leadId))?.label || 'Seçilmedi'}
                </Text>
                <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.label}>Kişi</Text>
              <TouchableOpacity
                style={styles.selectRow}
                activeOpacity={0.85}
                onPress={() =>
                  openPicker('Kişi', [{ id: '', label: 'Seçilmedi' }, ...lists.contacts], (val) => setDraft((p) => ({ ...p, contactId: String(val || '') })))
                }
              >
                <Text style={styles.selectValue} numberOfLines={1}>
                  {lists.contacts.find((c) => String(c.id) === String(draft.contactId))?.label || 'Seçilmedi'}
                </Text>
                <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.label}>Firma</Text>
              <TouchableOpacity
                style={styles.selectRow}
                activeOpacity={0.85}
                onPress={() =>
                  openPicker('Firma', [{ id: '', label: 'Seçilmedi' }, ...lists.accounts], (val) => setDraft((p) => ({ ...p, accountId: String(val || '') })))
                }
              >
                <Text style={styles.selectValue} numberOfLines={1}>
                  {lists.accounts.find((a) => String(a.id) === String(draft.accountId))?.label || 'Seçilmedi'}
                </Text>
                <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => (creating ? null : setCreateOpen(false))} activeOpacity={0.85} disabled={creating}>
                <Text style={styles.modalOutlineText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, (creating || listsLoading) ? styles.disabled : null]} onPress={createTicket} activeOpacity={0.85} disabled={creating || listsLoading}>
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide" onRequestClose={() => setDetailOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDetailOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {String(selected?.subject ?? selected?.title ?? 'Talep')}
                </Text>
                <Text style={styles.smallMuted} numberOfLines={1}>
                  #{String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '')}
                </Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={closeTicket} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('checkmark-done-outline', 'checkmark-done-outline')} size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setDetailOpen(false)} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {threadLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                (() => {
                  const t = thread ?? selected;
                  const status = normalizeStatus(t?.status ?? t?.state);
                  const currentIdx = ['open', 'in_progress', 'waiting', 'resolved', 'closed'].indexOf(status);
                  const assigneeName =
                    t?.assignedTo?.name ??
                    (t?.assignedTo?.firstName ? `${t?.assignedTo?.firstName} ${t?.assignedTo?.lastName ?? ''}`.trim() : '') ??
                    t?.assignee?.name ??
                    '';
                  const statusSteps = [
                    { id: 'open', label: 'Açık' },
                    { id: 'in_progress', label: 'İşlemde' },
                    { id: 'waiting', label: 'Beklemede' },
                    { id: 'resolved', label: 'Çözüldü' },
                    { id: 'closed', label: 'Kapalı' },
                  ];

                  return (
                    <View style={{ gap: 12 }}>
                      <AppCard style={styles.detailCard}>
                        <Text style={styles.sectionTitle}>Durum</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsRow}>
                          {statusSteps.map((s, idx) => {
                            const completed = currentIdx >= 0 && idx <= currentIdx;
                            const current = currentIdx === idx;
                            return (
                              <TouchableOpacity key={s.id} style={styles.stepItem} activeOpacity={0.85} onPress={() => handleStatusChange(s.id)}>
                                <View style={[styles.stepDot, completed ? styles.stepDotDone : null, current ? styles.stepDotCurrent : null]}>
                                  {completed ? <Ionicons name={safeIoniconName('checkmark', 'checkmark')} size={14} color="#fff" /> : <View style={styles.stepDotInner} />}
                                </View>
                                <Text style={[styles.stepLabel, completed ? styles.stepLabelDone : null]}>{s.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </AppCard>

                      <AppCard style={styles.detailCard}>
                        <Text style={styles.sectionTitle}>Genel Bakış</Text>
                        <Text style={styles.detailText}>
                          {pickText(t?.description, t?.message, t?.body, t?.preview) || 'Açıklama girilmemiş.'}
                        </Text>
                      </AppCard>

                      <View style={styles.detailTabsRow}>
                        {[
                          { key: 'customer', label: 'Müşteri Mesajı', icon: 'mail-outline' },
                          { key: 'internal', label: 'Atama / İç Mesaj', icon: 'person-outline' },
                          { key: 'activity', label: 'Aktivite', icon: 'list-outline' },
                        ].map((tab) => {
                          const active = detailTab === tab.key;
                          return (
                            <TouchableOpacity key={tab.key} style={[styles.detailTabPill, active ? styles.detailTabPillActive : null]} onPress={() => setDetailTab(tab.key)} activeOpacity={0.85}>
                              <Ionicons name={safeIoniconName(tab.icon, 'ellipse-outline')} size={14} color={active ? '#fff' : colors.textSecondary} />
                              <Text style={[styles.detailTabText, active ? styles.detailTabTextActive : null]} numberOfLines={1}>
                                {tab.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {detailTab === 'customer' ? (
                        <AppCard style={styles.detailCard}>
                          <Text style={styles.sectionTitle}>Müşteriye Yanıt Ver</Text>

                          <Text style={styles.label}>Kime</Text>
                          <View style={styles.readonlyRow}>
                            <Text style={styles.readonlyValue} numberOfLines={1}>
                              {pickText(t?.contact?.email, t?.lead?.email, t?.email, t?.customerEmail) || 'E-posta bulunamadı'}
                            </Text>
                          </View>

                          <Text style={styles.label}>Konu</Text>
                          <TextInput value={emailSubject} onChangeText={setEmailSubject} placeholder="Konu" placeholderTextColor={colors.textSecondary} style={styles.input} />

                          <View style={styles.rowBetween}>
                            <Text style={styles.label}>Mesaj</Text>
                            <TouchableOpacity style={styles.linkBtn} onPress={loadDefaultEmailTemplate} activeOpacity={0.85}>
                              <Text style={styles.linkBtnText}>(Varsayılanı Yükle)</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.rowBetween}>
                            <TouchableOpacity
                              style={[styles.selectRow, { flex: 1 }]}
                              activeOpacity={0.85}
                              onPress={() =>
                                openPicker(
                                  'Şablon Seç',
                                  templates.map((tpl) => ({ id: String(tpl?.id ?? tpl?._id ?? ''), label: String(tpl?.name ?? tpl?.title ?? 'Şablon').trim(), raw: tpl })),
                                  (val) => handleTemplateSelect(val),
                                )
                              }
                            >
                              <Text style={styles.selectValue} numberOfLines={1}>
                                {templates.find((tpl) => String(tpl?.id ?? tpl?._id) === String(selectedTemplateId))?.name || 'Şablon Seç'}
                              </Text>
                              <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSaveTemplateOpen(true)} activeOpacity={0.85}>
                              <Ionicons name={safeIoniconName('save-outline', 'save-outline')} size={16} color={colors.textPrimary} />
                              <Text style={styles.secondaryBtnText}>Kaydet</Text>
                            </TouchableOpacity>
                          </View>

                          <TextInput value={emailBody} onChangeText={setEmailBody} placeholder="Mesajınızı buraya yazınız..." placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultiline]} multiline />

                          <View style={styles.actionsRow}>
                            <TouchableOpacity
                              style={[styles.modalPrimaryBtn, (!String(emailBody || '').trim() || sendingEmail) ? styles.disabled : null]}
                              onPress={handleSendEmail}
                              activeOpacity={0.85}
                              disabled={!String(emailBody || '').trim() || sendingEmail}
                            >
                              {sendingEmail ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Gönder</Text>}
                            </TouchableOpacity>
                          </View>
                        </AppCard>
                      ) : null}

                      {detailTab === 'internal' ? (
                        <AppCard style={styles.detailCard}>
                          <Text style={styles.sectionTitle}>Atama ve İç İletişim</Text>

                          <Text style={styles.label}>Atanan Kişi</Text>
                          <TouchableOpacity
                            style={styles.selectRow}
                            activeOpacity={0.85}
                            onPress={() =>
                              openPicker(
                                'Atanan Kişi',
                                [{ id: '', label: 'Atanmamış' }, ...lists.users],
                                (val) => setInternalAssignee(String(val || '')),
                              )
                            }
                          >
                            <Text style={styles.selectValue} numberOfLines={1}>
                              {lists.users.find((u) => String(u.id) === String(internalAssignee))?.label || 'Atanmamış'}
                            </Text>
                            <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} />
                          </TouchableOpacity>

                          <Text style={styles.label}>Not (Opsiyonel)</Text>
                          <TextInput value={internalNote} onChangeText={setInternalNote} placeholder="Atanan kişiye notunuz..." placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultilineSmall]} multiline />

                          <View style={styles.actionsRow}>
                            <TouchableOpacity style={[styles.modalPrimaryBtn, assigning ? styles.disabled : null]} onPress={handleInternalAssign} activeOpacity={0.85} disabled={assigning}>
                              {assigning ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Atama ve Bildirim Gönder</Text>}
                            </TouchableOpacity>
                          </View>
                        </AppCard>
                      ) : null}

                      {detailTab === 'activity' ? (
                        <AppCard style={styles.detailCard}>
                          <Text style={styles.sectionTitle}>Aktivite Geçmişi</Text>

                          <View style={styles.activityInputRow}>
                            <TextInput value={activityNote} onChangeText={setActivityNote} placeholder="Manuel aktivite notu ekle..." placeholderTextColor={colors.textSecondary} style={[styles.input, { flex: 1, marginTop: 0 }]} />
                            <TouchableOpacity
                              style={[styles.modalPrimaryBtn, (!String(activityNote || '').trim() || loggingActivity) ? styles.disabled : null]}
                              onPress={handleLogActivity}
                              activeOpacity={0.85}
                              disabled={!String(activityNote || '').trim() || loggingActivity}
                            >
                              {loggingActivity ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalPrimaryText}>Ekle</Text>}
                            </TouchableOpacity>
                          </View>

                          {activities.length === 0 ? (
                            <Text style={styles.meta}>Henüz aktivite yok.</Text>
                          ) : (
                            <View style={styles.activityList}>
                              {activities.map((a, idx) => {
                                const who =
                                  a?.user?.name ??
                                  (a?.user?.firstName ? `${a?.user?.firstName} ${a?.user?.lastName ?? ''}`.trim() : '') ??
                                  a?.createdBy?.name ??
                                  'Kullanıcı';
                                const when = a?.createdAt ?? a?.created_at ?? a?.timestamp;
                                const desc = String(a?.description ?? a?.message ?? '').trim();
                                return (
                                  <View key={String(a?.id ?? a?._id ?? idx)} style={styles.activityItem}>
                                    <View style={styles.activityTop}>
                                      <Text style={styles.activityWho} numberOfLines={1}>
                                        {who}
                                      </Text>
                                      <Text style={styles.activityWhen} numberOfLines={1}>
                                        {formatDate(when)}
                                      </Text>
                                    </View>
                                    <Text style={styles.activityDesc}>{desc || '—'}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </AppCard>
                      ) : null}

                      <AppCard style={styles.detailCard}>
                        <Text style={styles.sectionTitle}>Detaylar</Text>
                        <View style={styles.detailRows}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Öncelik</Text>
                            <Text style={styles.detailValue}>{priorityLabelTr(t?.priority ?? t?.severity)}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Durum</Text>
                            <Text style={styles.detailValue}>{statusLabelTr(t?.status ?? t?.state)}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailKey}>Atanan</Text>
                            <Text style={styles.detailValue}>{assigneeName || 'Atanmamış'}</Text>
                          </View>
                        </View>
                      </AppCard>

                      {t?.contact ? (
                        <AppCard style={styles.detailCard}>
                          <Text style={styles.sectionTitle}>İlgili Kişi</Text>
                          <Text style={styles.detailText}>
                            {pickText(t?.contact?.name, `${t?.contact?.firstName ?? ''} ${t?.contact?.lastName ?? ''}`.trim()) || '—'}
                          </Text>
                          {pickText(t?.contact?.email) ? <Text style={styles.meta}>{String(t.contact.email)}</Text> : null}
                          {pickText(t?.contact?.phone) ? <Text style={styles.meta}>{String(t.contact.phone)}</Text> : null}
                        </AppCard>
                      ) : null}

                      {t?.account ? (
                        <AppCard style={styles.detailCard}>
                          <Text style={styles.sectionTitle}>İlgili Firma</Text>
                          <Text style={styles.detailText}>{String(t?.account?.name ?? '—')}</Text>
                        </AppCard>
                      ) : null}
                    </View>
                  );
                })()
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={closePicker}>
        <Pressable style={styles.modalBackdrop} onPress={closePicker} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={closePicker} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.searchWrap}>
                <Ionicons name={safeIoniconName('search-outline', 'search-outline')} size={18} color={colors.textSecondary} />
                <TextInput value={pickerQuery} onChangeText={setPickerQuery} placeholder="Ara..." placeholderTextColor={colors.textSecondary} style={styles.searchInput} />
                {pickerQuery ? (
                  <TouchableOpacity style={styles.clearBtn} onPress={() => setPickerQuery('')} activeOpacity={0.85}>
                    <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 4 }}>
                {pickerItems
                  .filter((it) => {
                    const q = String(pickerQuery || '').trim().toLowerCase();
                    if (!q) return true;
                    return String(it?.label || '').toLowerCase().includes(q);
                  })
                  .slice(0, 200)
                  .map((it, idx) => (
                    <TouchableOpacity
                      key={String(it?.id ?? idx)}
                      style={styles.pickerItem}
                      activeOpacity={0.85}
                      onPress={() => {
                        try {
                          if (typeof pickerOnSelect === 'function') pickerOnSelect(it?.id);
                        } finally {
                          closePicker();
                        }
                      }}
                    >
                      <Text style={styles.pickerItemText} numberOfLines={1}>
                        {String(it?.label ?? '—')}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={saveTemplateOpen} transparent animationType="fade" onRequestClose={() => setSaveTemplateOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSaveTemplateOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Şablon Kaydet</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSaveTemplateOpen(false)} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Şablon Adı</Text>
              <TextInput value={newTemplateName} onChangeText={setNewTemplateName} placeholder="Örn: Standart Yanıt" placeholderTextColor={colors.textSecondary} style={styles.input} />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => setSaveTemplateOpen(false)} activeOpacity={0.85}>
                <Text style={styles.modalOutlineText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, !String(newTemplateName || '').trim() ? styles.disabled : null]} onPress={handleCreateTemplate} activeOpacity={0.85} disabled={!String(newTemplateName || '').trim()}>
                <Text style={styles.modalPrimaryText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: 28, gap: 12 },
    center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 10, color: colors.textSecondary, fontWeight: '700' },

    headerCard: { padding: 14 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13, fontWeight: '700', lineHeight: 18 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    primaryButtonSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    primaryButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 12 },

    filterCard: { padding: 12 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, fontWeight: '800', paddingVertical: 10 },
    clearBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    filtersPanel: { padding: 14 },
    filtersFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
    toggleRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleLabel: { color: colors.textPrimary, fontWeight: '800' },

    ticketCard: { padding: 14 },
    ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    ticketTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    smallMuted: { marginTop: 4, color: colors.textSecondary, fontWeight: '700' },
    ticketDivider: { height: 1, backgroundColor: colors.border, opacity: 0.7, marginTop: 12 },
    ticketDetails: { marginTop: 12, gap: 10 },
    ticketPreview: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, lineHeight: 18, opacity: 0.95 },
    ticketPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: '100%',
    },
    detailPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12, maxWidth: 190 },
    ticketMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    ticketMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ticketMetaText: { color: colors.textSecondary, fontWeight: '800', fontSize: 11 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    statusText: { fontWeight: '900', fontSize: 12 },

    modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalWrap: { flex: 1, justifyContent: 'center', padding: 16 },
    modalCard: { backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    modalBody: { padding: 14, paddingBottom: 18 },
    modalFooter: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', padding: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
    modalOutlineBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    modalOutlineText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    modalPrimaryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
    modalPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 12 },

    label: { marginTop: 12, marginBottom: 8, color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontWeight: '800' },
    inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
    inputMultilineSmall: { minHeight: 90, textAlignVertical: 'top' },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    pillTextActive: { color: '#fff' },
    selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
    selectValue: { color: colors.textPrimary, fontWeight: '800', flex: 1, minWidth: 0 },

    sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheetCard: { marginTop: 'auto', maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    sheetTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    sheetBody: { padding: 14, paddingBottom: 18, gap: 10 },

    detailCard: { padding: 14 },
    detailText: { marginTop: 10, color: colors.textPrimary, fontWeight: '700', lineHeight: 18 },
    detailTabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailTabPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    detailTabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    detailTabText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12, maxWidth: 160 },
    detailTabTextActive: { color: '#fff' },
    stepsRow: { gap: 14, paddingVertical: 8, paddingRight: 8 },
    stepItem: { alignItems: 'center', gap: 8 },
    stepDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    stepDotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
    stepDotCurrent: { shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    stepLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 11 },
    stepLabelDone: { color: colors.primary },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    linkBtn: { paddingVertical: 8, paddingHorizontal: 8 },
    linkBtnText: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    secondaryBtnText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    actionsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
    readonlyRow: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
    readonlyValue: { color: colors.textSecondary, fontWeight: '800' },
    activityInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
    activityList: { marginTop: 12, gap: 10 },
    activityItem: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 },
    activityTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    activityWho: { color: colors.textPrimary, fontWeight: '900', flex: 1, minWidth: 0 },
    activityWhen: { color: colors.textSecondary, fontWeight: '800', fontSize: 11 },
    activityDesc: { marginTop: 8, color: colors.textPrimary, fontWeight: '700', lineHeight: 18 },
    detailRows: { marginTop: 12, gap: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    detailKey: { color: colors.textSecondary, fontWeight: '900' },
    detailValue: { color: colors.textPrimary, fontWeight: '900' },
    pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerItemText: { color: colors.textPrimary, fontWeight: '800' },
    disabled: { opacity: 0.6 },
  });
}
