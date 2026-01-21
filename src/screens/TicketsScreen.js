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
import { useTheme } from '../theme/ThemeContext';
import { ticketsService } from '../api/services/ticketsService';

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
  if (s === 'pending' || s === 'waiting' || s === 'in_progress' || s === 'in-progress') return 'pending';
  if (s === 'closed' || s === 'resolved' || s === 'done') return 'closed';
  return s;
}

export default function TicketsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('open');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ subject: '', message: '', category: 'Genel', priority: 'Normal' });
  const [creating, setCreating] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    const res = await ticketsService.list({ limit: 50, offset: 0 });
    const list = normalizeList(res?.items ?? res);
    setItems(list);
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

  const statusUi = useCallback(
    (status) => {
      const s = normalizeStatus(status);
      if (s === 'open') return { label: 'Açık', color: colors.primary, icon: 'alert-circle-outline' };
      if (s === 'pending') return { label: 'Beklemede', color: colors.warning, icon: 'time-outline' };
      if (s === 'closed') return { label: 'Kapalı', color: colors.success, icon: 'checkmark-done-outline' };
      return { label: String(status || 'Bilinmiyor'), color: colors.textSecondary, icon: 'help-circle-outline' };
    },
    [colors.primary, colors.success, colors.textSecondary, colors.warning],
  );

  const stats = useMemo(() => {
    const open = items.filter((t) => normalizeStatus(t?.status ?? t?.state) === 'open').length;
    const pending = items.filter((t) => normalizeStatus(t?.status ?? t?.state) === 'pending').length;
    const closed = items.filter((t) => normalizeStatus(t?.status ?? t?.state) === 'closed').length;
    return { open, pending, closed, total: items.length };
  }, [items]);

  const visible = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return items
      .filter((t) => {
        const s = normalizeStatus(t?.status ?? t?.state);
        if (activeTab === 'all') return true;
        return s === activeTab;
      })
      .filter((t) => {
        if (!q) return true;
        const hay = `${t?.subject ?? t?.title ?? ''} ${t?.id ?? ''} ${t?.category ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a?.updatedAt ?? a?.updated_at ?? a?.createdAt ?? a?.created_at ?? 0).getTime();
        const tb = new Date(b?.updatedAt ?? b?.updated_at ?? b?.createdAt ?? b?.created_at ?? 0).getTime();
        return tb - ta;
      });
  }, [activeTab, items, search]);

  const openNew = useCallback(() => {
    setDraft({ subject: '', message: '', category: 'Genel', priority: 'Normal' });
    setCreateOpen(true);
  }, []);

  const createTicket = useCallback(async () => {
    const subject = String(draft.subject || '').trim();
    const message = String(draft.message || '').trim();
    if (!subject || !message) {
      Alert.alert('Eksik bilgi', 'Konu ve mesaj zorunlu.');
      return;
    }
    setCreating(true);
    try {
      await ticketsService.create({
        subject,
        message,
        category: String(draft.category || 'Genel'),
        priority: String(draft.priority || 'Normal'),
      });
      setCreateOpen(false);
      await onRefresh();
    } catch {
      Alert.alert('Hata', 'Talep oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }, [draft.category, draft.message, draft.priority, draft.subject, onRefresh]);

  const openDetail = useCallback(
    async (ticket) => {
      setSelected(ticket);
      setDetailOpen(true);
      setThread(null);
      setReplyText('');
      const id = String(ticket?.id ?? ticket?.ticketId ?? ticket?._id ?? '').trim();
      if (!id) return;
      setThreadLoading(true);
      try {
        const res = await ticketsService.get(id);
        setThread(res);
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

  const sendReply = useCallback(async () => {
    const id = String(selected?.id ?? selected?.ticketId ?? selected?._id ?? '').trim();
    const message = String(replyText || '').trim();
    if (!id || !message) return;
    setReplying(true);
    try {
      await ticketsService.reply(id, { message });
      setReplyText('');
      const res = await ticketsService.get(id);
      setThread(res);
      await onRefresh();
    } catch {
      Alert.alert('Hata', 'Yanıt gönderilemedi.');
    } finally {
      setReplying(false);
    }
  }, [onRefresh, replyText, selected]);

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Destek Talepleri</Text>
              <Text style={styles.meta}>Sorun ve isteklerinizi iletin, durumunu takip edin.</Text>
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

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
              {[
                { key: 'open', label: `Açık (${stats.open})`, icon: 'alert-circle-outline' },
                { key: 'pending', label: `Beklemede (${stats.pending})`, icon: 'time-outline' },
                { key: 'closed', label: `Kapalı (${stats.closed})`, icon: 'checkmark-done-outline' },
                { key: 'all', label: `Tümü (${stats.total})`, icon: 'grid-outline' },
              ].map((t) => {
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
        </AppCard>

        <AppCard style={styles.filterCard}>
          <View style={styles.searchWrap}>
            <Ionicons name={safeIoniconName('search-outline', 'search-outline')} size={18} color={colors.textSecondary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Ara (id, konu, kategori)" placeholderTextColor={colors.textSecondary} style={styles.searchInput} />
            {search ? (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')} activeOpacity={0.85}>
                <Ionicons name={safeIoniconName('close', 'close')} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </AppCard>
      </View>
    );
  }, [
    activeTab,
    colors.textPrimary,
    colors.textSecondary,
    onRefresh,
    openNew,
    search,
    stats.closed,
    stats.open,
    stats.pending,
    stats.total,
    styles.clearBtn,
    styles.filterCard,
    styles.headerCard,
    styles.headerRight,
    styles.headerTop,
    styles.iconBtn,
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
    styles.tabsRow,
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
            const updatedAt = item?.updatedAt ?? item?.updated_at ?? item?.createdAt ?? item?.created_at;
            const category = String(item?.category ?? 'Genel');
            return (
              <AppCard style={styles.ticketCard} onPress={() => openDetail(item)} accessibilityLabel={`${subject} talebi`}>
                <View style={styles.ticketTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>
                      {subject}
                    </Text>
                    <Text style={styles.smallMuted} numberOfLines={1}>
                      #{id} • {category} • {formatDate(updatedAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.color + '12', borderColor: status.color + '3A' }]}>
                    <Ionicons name={safeIoniconName(status.icon, 'help-circle-outline')} size={14} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
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

              <Text style={styles.label}>Kategori</Text>
              <View style={styles.pillsRow}>
                {['Genel', 'CRM', 'Pazarlama', 'Fatura', 'Hata'].map((c) => {
                  const active = String(draft.category) === c;
                  return (
                    <TouchableOpacity key={c} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setDraft((p) => ({ ...p, category: c }))} activeOpacity={0.85}>
                      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Öncelik</Text>
              <View style={styles.pillsRow}>
                {['Düşük', 'Normal', 'Yüksek', 'Kritik'].map((p) => {
                  const active = String(draft.priority) === p;
                  return (
                    <TouchableOpacity key={p} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setDraft((prev) => ({ ...prev, priority: p }))} activeOpacity={0.85}>
                      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Mesaj</Text>
              <TextInput value={draft.message} onChangeText={(v) => setDraft((p) => ({ ...p, message: v }))} placeholder="Detayları yazın…" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultiline]} multiline />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalOutlineBtn} onPress={() => (creating ? null : setCreateOpen(false))} activeOpacity={0.85} disabled={creating}>
                <Text style={styles.modalOutlineText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryBtn, creating ? styles.disabled : null]} onPress={createTicket} activeOpacity={0.85} disabled={creating}>
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
                (normalizeList(thread?.messages ?? thread?.replies ?? thread?.comments ?? thread?.items) || []).map((m, idx) => {
                  const isSupport = String(m?.authorType ?? m?.from ?? m?.role ?? '').toLowerCase().includes('support');
                  const text = String(m?.message ?? m?.body ?? m?.text ?? '');
                  const when = m?.createdAt ?? m?.created_at ?? m?.timestamp;
                  return (
                    <View key={String(m?.id ?? idx)} style={[styles.msgRow, isSupport ? styles.msgRowSupport : styles.msgRowMe]}>
                      <View style={[styles.msgBubble, isSupport ? styles.msgSupport : styles.msgMe]}>
                        <Text style={[styles.msgText, isSupport ? styles.msgTextSupport : styles.msgTextMe]}>{text || '—'}</Text>
                        <Text style={[styles.msgTime, isSupport ? styles.msgTimeSupport : styles.msgTimeMe]} numberOfLines={1}>
                          {formatDate(when)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.replyRow}>
              <TextInput value={replyText} onChangeText={setReplyText} placeholder="Yanıt yaz…" placeholderTextColor={colors.textSecondary} style={styles.replyInput} multiline />
              <TouchableOpacity style={[styles.sendBtn, (!replyText.trim() || replying) ? styles.disabled : null]} onPress={sendReply} activeOpacity={0.85} disabled={!replyText.trim() || replying}>
                {replying ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={safeIoniconName('send', 'send')} size={18} color="#fff" />}
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

    tabsRow: { marginTop: 12 },
    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    filterCard: { padding: 12 },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchInput: { flex: 1, minWidth: 0, color: colors.textPrimary, fontWeight: '800', paddingVertical: 10 },
    clearBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

    ticketCard: { padding: 14 },
    ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    ticketTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    smallMuted: { marginTop: 4, color: colors.textSecondary, fontWeight: '700' },
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
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    pillTextActive: { color: '#fff' },

    sheetBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheetCard: { marginTop: 'auto', maxHeight: '90%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    sheetTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    sheetBody: { padding: 14, paddingBottom: 18, gap: 10 },

    msgRow: { flexDirection: 'row' },
    msgRowMe: { justifyContent: 'flex-end' },
    msgRowSupport: { justifyContent: 'flex-start' },
    msgBubble: { maxWidth: '86%', borderRadius: 16, borderWidth: 1, padding: 10 },
    msgMe: { backgroundColor: colors.primary, borderColor: colors.primary },
    msgSupport: { backgroundColor: colors.surface, borderColor: colors.border },
    msgText: { fontWeight: '800', fontSize: 13, lineHeight: 18 },
    msgTextMe: { color: '#fff' },
    msgTextSupport: { color: colors.textPrimary },
    msgTime: { marginTop: 6, fontWeight: '800', fontSize: 11 },
    msgTimeMe: { color: '#fff' },
    msgTimeSupport: { color: colors.textSecondary },

    replyRow: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' },
    replyInput: { flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontWeight: '800' },
    sendBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    disabled: { opacity: 0.6 },
  });
}

