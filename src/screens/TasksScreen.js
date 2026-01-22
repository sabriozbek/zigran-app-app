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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppCard from '../components/AppCard';
import { tasksService } from '../api/services/tasksService';
import { leadsService } from '../api/services/leadsService';
import { useTheme } from '../theme/ThemeContext';

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function safeString(v) {
  return String(v ?? '').trim();
}

function normalizeTaskStatus(task) {
  const raw = safeString(task?.status ?? task?.state);
  const s = raw.toLowerCase();
  if (typeof task?.completed === 'boolean') return task.completed ? 'completed' : 'open';
  if (s === 'completed' || s === 'done' || s === 'closed' || s === 'success') return 'completed';
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  if (s === 'in_progress' || s === 'inprogress' || s === 'ongoing') return 'in_progress';
  if (!s || s === 'open' || s === 'new' || s === 'pending' || s === 'planned') return 'open';
  return s;
}

function statusUi(status, colors) {
  if (status === 'completed') return { label: 'Tamamlandı', color: colors.success, icon: 'checkmark-done-outline' };
  if (status === 'cancelled' || status === 'canceled') return { label: 'İptal', color: colors.textSecondary, icon: 'close-circle-outline' };
  if (status === 'in_progress') return { label: 'Devam Ediyor', color: colors.primary, icon: 'time-outline' };
  return { label: 'Açık', color: colors.warning, icon: 'radio-button-on-outline' };
}

function formatDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('tr-TR');
  } catch {
    return '';
  }
}

export default function TasksScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [leads, setLeads] = useState([]);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('open');

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ id: null, title: '', dueDate: '', description: '', leadId: '' });
  const [openLeadPicker, setOpenLeadPicker] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');

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

  const load = useCallback(async () => {
    const results = await Promise.allSettled([tasksService.getAll(), leadsService.getAll({ limit: 500 })]);
    const t = results[0].status === 'fulfilled' ? results[0].value : [];
    const l = results[1].status === 'fulfilled' ? results[1].value : [];
    setItems(normalizeList(t));
    setLeads(normalizeList(l));
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const visible = useMemo(() => {
    const q = safeString(query).toLowerCase();
    return (items || [])
      .map((t) => ({ ...t, _status: normalizeTaskStatus(t) }))
      .filter((t) => {
        if (tab === 'open') return t._status !== 'completed';
        if (tab === 'completed') return t._status === 'completed';
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        const hay = [
          t?.title,
          t?.name,
          t?.description,
          t?.note,
          t?.assignee?.name,
          t?.assignedTo?.name,
          t?.dueDate,
          t?.due_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ad = new Date(a?.dueDate ?? a?.due_date ?? a?.createdAt ?? a?.created_at ?? 0).getTime();
        const bd = new Date(b?.dueDate ?? b?.due_date ?? b?.createdAt ?? b?.created_at ?? 0).getTime();
        return ad - bd;
      });
  }, [items, query, tab]);

  const openNew = useCallback(() => {
    setLeadSearch('');
    setDraft({ id: null, title: '', dueDate: '', description: '', leadId: '' });
    setCreateOpen(true);
  }, []);

  const openEdit = useCallback((task) => {
    const id = safeString(task?.id ?? task?._id ?? task?.uuid);
    const leadId = safeString(task?.leadId ?? task?.lead_id ?? task?.lead?.id ?? task?.lead?.leadId);
    setDraft({
      id: id || null,
      title: safeString(task?.title ?? task?.name),
      dueDate: safeString(task?.dueDate ?? task?.due_date),
      description: safeString(task?.description ?? task?.note),
      leadId,
    });
    setLeadSearch('');
    setCreateOpen(true);
  }, []);

  const upsertTask = useCallback(async () => {
    const title = safeString(draft?.title);
    if (!title) {
      pushToast('warning', 'Görev başlığı girin.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        description: safeString(draft?.description) || undefined,
        dueDate: safeString(draft?.dueDate) || undefined,
        leadId: safeString(draft?.leadId) || undefined,
      };
      if (draft?.id) await tasksService.update(String(draft.id), payload);
      else await tasksService.create({ ...payload, status: 'open' });
      setCreateOpen(false);
      await onRefresh();
      pushToast('success', draft?.id ? 'Görev güncellendi.' : 'Görev oluşturuldu.');
    } catch {
      pushToast('error', draft?.id ? 'Görev güncellenemedi.' : 'Görev oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }, [draft?.description, draft?.dueDate, draft?.id, draft?.leadId, draft?.title, onRefresh, pushToast]);

  const updateTaskStatus = useCallback(
    async (task, nextStatus) => {
      const id = safeString(task?.id ?? task?._id ?? task?.uuid);
      if (!id) return;
      try {
        await tasksService.updateStatus(id, nextStatus);
        await onRefresh();
        pushToast('success', 'Durum güncellendi.');
      } catch {
        pushToast('error', 'Durum güncellenemedi.');
      }
    },
    [onRefresh, pushToast],
  );

  const confirmDelete = useCallback(
    (task) => {
      const id = safeString(task?.id ?? task?._id ?? task?.uuid);
      if (!id) return;
      const label = safeString(task?.title ?? task?.name) || 'Görev';
      Alert.alert('Görev silinsin mi?', label, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await tasksService.delete(id);
              await onRefresh();
              pushToast('success', 'Görev silindi.');
            } catch {
              pushToast('error', 'Görev silinemedi.');
            }
          },
        },
      ]);
    },
    [onRefresh, pushToast],
  );

  const header = useMemo(() => {
    const total = (items || []).length;
    const completed = (items || []).filter((t) => normalizeTaskStatus(t) === 'completed').length;
    const openCount = total - completed;
    return (
      <AppCard style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Görevler</Text>
            <Text style={styles.meta}>Yapılacaklar, son tarihler ve durumlar.</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.85}>
              <Ionicons name={safeIoniconName('refresh', 'refresh')} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButtonSmall} onPress={openNew} activeOpacity={0.85}>
              <Ionicons name={safeIoniconName('add', 'add')} size={16} color="#fff" />
              <Text style={styles.primaryButtonSmallText}>Yeni</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '22' }]}>
            <Text style={[styles.kpiLabel, { color: colors.warning }]}>Açık</Text>
            <Text style={styles.kpiValue}>{String(openCount)}</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.kpiLabel, { color: colors.success }]}>Tamamlanan</Text>
            <Text style={styles.kpiValue}>{String(completed)}</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Toplam</Text>
            <Text style={styles.kpiValue}>{String(total)}</Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.searchWrap}>
            <Ionicons name={safeIoniconName('search', 'search')} size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ara: başlık, açıklama…"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setQuery('')} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
            {[
              { key: 'open', label: 'Açık' },
              { key: 'completed', label: 'Tamamlandı' },
              { key: 'all', label: 'Tümü' },
            ].map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => setTab(t.key)} style={[styles.tabPill, active ? styles.tabPillActive : null]}>
                  <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </AppCard>
    );
  }, [
    colors.border,
    colors.success,
    colors.surface,
    colors.textPrimary,
    colors.textSecondary,
    colors.warning,
    items,
    onRefresh,
    openNew,
    query,
    styles.clearBtn,
    styles.filterCard,
    styles.headerCard,
    styles.headerRight,
    styles.headerTop,
    styles.iconBtn,
    styles.kpi,
    styles.kpiLabel,
    styles.kpiRow,
    styles.kpiValue,
    styles.meta,
    styles.primaryButtonSmall,
    styles.primaryButtonSmallText,
    styles.searchInput,
    styles.searchWrap,
    styles.tabPill,
    styles.tabPillActive,
    styles.tabPillText,
    styles.tabPillTextActive,
    styles.tabsInner,
    styles.title,
    tab,
  ]);

  const leadLabelById = useMemo(() => {
    const map = new Map();
    (leads || []).forEach((l) => {
      const id = safeString(l?.id ?? l?._id ?? l?.uuid);
      if (!id) return;
      const label = safeString(l?.name ?? l?.fullName ?? l?.full_name) || safeString(l?.email) || id;
      map.set(id, label);
    });
    return map;
  }, [leads]);

  const selectedLeadLabel = useMemo(() => (draft?.leadId ? leadLabelById.get(safeString(draft.leadId)) || '' : ''), [draft?.leadId, leadLabelById]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(item, idx) => safeString(item?.id ?? item?._id ?? item?.uuid ?? idx)}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const status = normalizeTaskStatus(item);
          const ui = statusUi(status, colors);
          const title = safeString(item?.title ?? item?.name) || 'Görev';
          const due = formatDate(item?.dueDate ?? item?.due_date);
          const assignee = safeString(item?.assignee?.name ?? item?.assignedTo?.name ?? item?.assigneeName ?? item?.assignedToName);
          const desc = safeString(item?.description ?? item?.note);
          const overdue = status !== 'completed' && (item?.dueDate || item?.due_date) ? new Date(item?.dueDate ?? item?.due_date).getTime() < Date.now() : false;
          const leadId = safeString(item?.leadId ?? item?.lead_id ?? item?.lead?.id);
          const leadLabel = leadId ? leadLabelById.get(leadId) || '' : '';
          return (
            <AppCard style={styles.taskCard}>
              <View style={styles.taskTop}>
                <View style={[styles.taskIcon, { backgroundColor: ui.color + '14', borderColor: ui.color + '22' }]}>
                  <Ionicons name={safeIoniconName(ui.icon, 'checkbox-outline')} size={18} color={ui.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <View style={styles.taskMetaRow}>
                    {due ? (
                      <View style={[styles.pill, overdue ? { borderColor: colors.danger + '3A', backgroundColor: colors.danger + '10' } : null]}>
                        <Ionicons name={safeIoniconName('calendar-outline', 'calendar-outline')} size={14} color={overdue ? colors.danger : colors.textSecondary} />
                        <Text style={[styles.pillText, overdue ? { color: colors.danger } : null]} numberOfLines={1}>
                          {due}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.pill}>
                        <Ionicons name={safeIoniconName('calendar-outline', 'calendar-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.pillText}>Tarih yok</Text>
                      </View>
                    )}
                    {assignee ? (
                      <View style={styles.pill}>
                        <Ionicons name={safeIoniconName('person-outline', 'person-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.pillText} numberOfLines={1}>
                          {assignee}
                        </Text>
                      </View>
                    ) : null}
                    {leadLabel ? (
                      <View style={styles.pill}>
                        <Ionicons name={safeIoniconName('at-outline', 'at-outline')} size={14} color={colors.textSecondary} />
                        <Text style={styles.pillText} numberOfLines={1}>
                          {leadLabel}
                        </Text>
                      </View>
                    ) : null}
                    <View style={[styles.statusPill, { backgroundColor: ui.color + '12', borderColor: ui.color + '22' }]}>
                      <Text style={[styles.statusText, { color: ui.color }]}>{ui.label}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.taskMiniActions}>
                  <TouchableOpacity style={styles.miniIconBtn} onPress={() => openEdit(item)} activeOpacity={0.85}>
                    <Ionicons name={safeIoniconName('create-outline', 'create-outline')} size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.miniIconBtn} onPress={() => confirmDelete(item)} activeOpacity={0.85}>
                    <Ionicons name={safeIoniconName('trash-outline', 'trash-outline')} size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              {desc ? (
                <Text style={styles.taskDesc} numberOfLines={3}>
                  {desc}
                </Text>
              ) : null}

              <View style={styles.taskActions}>
                {status === 'completed' ? (
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => updateTaskStatus(item, 'open')} activeOpacity={0.85}>
                    <Ionicons name={safeIoniconName('refresh-outline', 'refresh-outline')} size={16} color={colors.textPrimary} />
                    <Text style={styles.outlineBtnText}>Tekrar Aç</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => updateTaskStatus(item, 'done')} activeOpacity={0.85}>
                    <Ionicons name={safeIoniconName('checkmark-done-outline', 'checkmark-done-outline')} size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Tamamla</Text>
                  </TouchableOpacity>
                )}
              </View>
            </AppCard>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name={safeIoniconName('checkbox-outline', 'checkbox-outline')} size={48} color={colors.border} />
            <Text style={styles.emptyText}>Görev bulunamadı.</Text>
          </View>
        }
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => (saving ? null : setCreateOpen(false))}>
        <Pressable style={styles.modalBackdrop} onPress={() => (saving ? null : setCreateOpen(false))} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{draft?.id ? 'Görevi Düzenle' : 'Yeni Görev'}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => (saving ? null : setCreateOpen(false))} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Başlık *</Text>
              <TextInput
                value={draft.title}
                onChangeText={(v) => setDraft((p) => ({ ...p, title: v }))}
                placeholder="Örn: Müşteriyi ara"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />

              <Text style={styles.label}>Lead (opsiyonel)</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setOpenLeadPicker(true)} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('person-outline', 'person-outline')} size={16} color={colors.textSecondary} />
                <Text style={[styles.selectText, { color: selectedLeadLabel ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
                  {selectedLeadLabel || 'Boş geç'}
                </Text>
                {draft?.leadId ? (
                  <TouchableOpacity
                    onPress={() => setDraft((p) => ({ ...p, leadId: '' }))}
                    activeOpacity={0.85}
                    style={{ padding: 4, marginLeft: 'auto' }}
                  >
                    <Ionicons name={safeIoniconName('close-circle', 'close-circle')} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name={safeIoniconName('chevron-down', 'chevron-down')} size={18} color={colors.textSecondary} style={{ marginLeft: 'auto', opacity: 0.7 }} />
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Son Tarih (opsiyonel)</Text>
              <TextInput
                value={draft.dueDate}
                onChangeText={(v) => setDraft((p) => ({ ...p, dueDate: v }))}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Açıklama (opsiyonel)</Text>
              <TextInput
                value={draft.description}
                onChangeText={(v) => setDraft((p) => ({ ...p, description: v }))}
                placeholder="Not ekleyin…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.inputMultiline]}
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => (saving ? null : setCreateOpen(false))} activeOpacity={0.85} disabled={saving}>
                <Text style={styles.modalOutlineText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, saving ? styles.disabled : null]} onPress={upsertTask} activeOpacity={0.85} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>{draft?.id ? 'Kaydet' : 'Oluştur'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={openLeadPicker} transparent animationType="fade" onRequestClose={() => setOpenLeadPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenLeadPicker(false)} />
        <View style={styles.pickerWrap}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Lead Seç</Text>
              <TouchableOpacity onPress={() => setOpenLeadPicker(false)} activeOpacity={0.85} style={styles.pickerClose}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearch}>
              <Ionicons name={safeIoniconName('search', 'search')} size={16} color={colors.textSecondary} />
              <TextInput
                value={leadSearch}
                onChangeText={setLeadSearch}
                placeholder="Lead ara…"
                placeholderTextColor={colors.textSecondary}
                style={styles.pickerSearchInput}
                autoCapitalize="none"
              />
              {leadSearch ? (
                <TouchableOpacity onPress={() => setLeadSearch('')} activeOpacity={0.85}>
                  <Ionicons name={safeIoniconName('close-circle', 'close-circle')} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView contentContainerStyle={styles.pickerList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setDraft((p) => ({ ...p, leadId: '' }));
                  setOpenLeadPicker(false);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.pickerIcon}>
                  <Ionicons name={safeIoniconName('remove-circle-outline', 'remove-circle-outline')} size={18} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pickerRowTitle}>Boş geç</Text>
                </View>
              </TouchableOpacity>

              {(leads || [])
                .filter((l) => {
                  const q = safeString(leadSearch).toLowerCase();
                  if (!q) return true;
                  const hay = [l?.name, l?.fullName, l?.full_name, l?.email, l?.phone].filter(Boolean).join(' ').toLowerCase();
                  return hay.includes(q);
                })
                .slice(0, 200)
                .map((l) => {
                  const id = safeString(l?.id ?? l?._id ?? l?.uuid);
                  const label = safeString(l?.name ?? l?.fullName ?? l?.full_name) || safeString(l?.email) || 'Lead';
                  const meta = safeString(l?.name && l?.email ? l.email : l?.phone || '');
                  const active = id && safeString(draft?.leadId) === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.pickerRow, active ? { borderColor: colors.primary + '33', backgroundColor: colors.primary + '10' } : null]}
                      onPress={() => {
                        setDraft((p) => ({ ...p, leadId: id }));
                        setOpenLeadPicker(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.pickerIcon, active ? { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' } : null]}>
                        <Ionicons name={safeIoniconName('person-outline', 'person-outline')} size={18} color={active ? colors.primary : colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.pickerRowTitle} numberOfLines={1}>
                          {label}
                        </Text>
                        {meta ? (
                          <Text style={styles.pickerRowMeta} numberOfLines={1}>
                            {meta}
                          </Text>
                        ) : null}
                      </View>
                      {active ? <Ionicons name={safeIoniconName('checkmark', 'checkmark')} size={18} color={colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 10, color: colors.textSecondary, fontWeight: '700' },
    list: { padding: 16, paddingBottom: 28, gap: 12 },
    selectInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 14,
    },
    selectText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800' },
    pickerWrap: { flex: 1, justifyContent: 'center', padding: 14 },
    pickerCard: { maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
    pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    pickerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
    pickerClose: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    pickerSearch: {
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
    pickerSearchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
    pickerList: { paddingBottom: 8, gap: 10 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    pickerIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerRowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    pickerRowMeta: { marginTop: 2, color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

    headerCard: { padding: 14, marginBottom: 12 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    meta: { marginTop: 6, color: colors.textSecondary, fontSize: 13, fontWeight: '700', lineHeight: 18 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    primaryButtonSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    primaryButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 12 },

    kpiRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    kpi: { flex: 1, minWidth: 120, padding: 12, borderRadius: 16, borderWidth: 1 },
    kpiLabel: { fontWeight: '900', fontSize: 12 },
    kpiValue: { marginTop: 6, color: colors.textPrimary, fontWeight: '900', fontSize: 18 },

    filterCard: { marginTop: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    searchInput: { flex: 1, padding: 0, color: colors.textPrimary, fontWeight: '800' },
    clearBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 9 },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    taskCard: { padding: 14 },
    taskTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    taskIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    taskTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    taskMetaRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6 },
    pillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
    statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    statusText: { fontWeight: '900', fontSize: 11 },
    taskDesc: { marginTop: 10, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },
    taskActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
    outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12 },
    outlineBtnText: { color: colors.textPrimary, fontWeight: '900', fontSize: 12 },
    taskMiniActions: { gap: 8, alignItems: 'flex-end', paddingTop: 2 },
    miniIconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },

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
    disabled: { opacity: 0.6 },

    label: { marginTop: 12, marginBottom: 8, color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontWeight: '800' },
    inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  });
}
