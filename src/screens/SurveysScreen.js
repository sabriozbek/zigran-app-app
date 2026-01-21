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
import { surveysService } from '../api/services/surveysService';

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

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit' });
}

const AUDIENCE_ITEMS = [
  { key: 'external', label: 'Harici' },
  { key: 'customer', label: 'Müşteri' },
  { key: 'staff', label: 'Ekip' },
];

export default function SurveysScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  const [search, setSearch] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [draft, setDraft] = useState({ id: null, name: '', audience: 'external', schemaJsonText: '' });

  const load = useCallback(async () => {
    const res = await surveysService.list();
    setItems(Array.isArray(res) ? res : []);
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

  const visible = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => String(s?.name || '').toLowerCase().includes(q));
  }, [items, search]);

  const openNew = useCallback(() => {
    setDraft({ id: null, name: '', audience: 'external', schemaJsonText: '' });
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((s) => {
    const schema = s?.schemaJson ?? s?.schema_json ?? null;
    setDraft({
      id: s?.id ?? null,
      name: String(s?.name || ''),
      audience: String(s?.audience || 'external'),
      schemaJsonText: schema ? JSON.stringify(schema, null, 2) : '',
    });
    setEditorOpen(true);
  }, []);

  const save = useCallback(async () => {
    const name = String(draft?.name || '').trim();
    const audience = String(draft?.audience || 'external').trim();
    if (!name) {
      Alert.alert('Eksik bilgi', 'Anket adı zorunlu.');
      return;
    }
    if (!AUDIENCE_ITEMS.some((a) => a.key === audience)) {
      Alert.alert('Hata', 'Hedef kitle geçersiz.');
      return;
    }

    const parsed = safeJsonParse(draft?.schemaJsonText);
    if (!parsed.ok) {
      Alert.alert('Hata', 'Şema JSON formatı geçersiz.');
      return;
    }

    setEditorSaving(true);
    try {
      if (draft?.id) {
        await surveysService.update(draft.id, { name, audience, schemaJson: parsed.value ?? null });
      } else {
        await surveysService.create({ name, audience, schemaJson: parsed.value ?? null });
      }
      setEditorOpen(false);
      await load();
    } catch {
      Alert.alert('Hata', 'Kaydetme başarısız.');
    } finally {
      setEditorSaving(false);
    }
  }, [draft, load]);

  const confirmRemove = useCallback(
    (s) => {
      Alert.alert('Anket Silinsin mi?', `${String(s?.name || 'Anket')}`, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await surveysService.remove(s?.id);
              await load();
            } catch {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]);
    },
    [load],
  );

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
              <Text style={styles.title}>Anketler</Text>
              <Text style={styles.meta}>Anket oluşturun, şema JSON ile düzenleyin ve sonuçları takip edin.</Text>
            </View>
            <TouchableOpacity style={styles.primaryButtonSmall} activeOpacity={0.85} onPress={openNew}>
              <Ionicons name={safeIoniconName('add', 'add')} size={16} color="#fff" />
              <Text style={styles.primaryButtonSmallText}>Yeni</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Anket ara"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
        </AppCard>

        {items.length === 0 ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Anket yok</Text>
            <Text style={styles.meta}>Yeni anket oluşturup paylaşım linkiyle yayınlayabilirsiniz.</Text>
          </AppCard>
        ) : null}

        <FlatList
          data={visible}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const s = item || {};
            const audience = String(s?.audience || 'external');
            const submissions = s?.submissionsCount ?? s?.submissions_count ?? 0;
            const updatedAt = s?.updatedAt ?? s?.updated_at ?? s?.createdAt;
            return (
              <AppCard style={styles.card} onPress={() => openEdit(s)} accessibilityLabel={`${String(s?.name || 'Anket')} düzenle`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {String(s?.name || 'Anket')}
                    </Text>
                    <Text style={styles.smallMuted} numberOfLines={1}>
                      {formatDate(updatedAt)} • {AUDIENCE_ITEMS.find((a) => a.key === audience)?.label || 'Harici'}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(submissions)} Yanıt</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => openEdit(s)}>
                    <Ionicons name={safeIoniconName('create-outline', 'create-outline')} size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => confirmRemove(s)}>
                    <Ionicons name={safeIoniconName('trash-outline', 'trash-outline')} size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </AppCard>
            );
          }}
        />
      </ScrollView>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{draft?.id ? 'Anketi Düzenle' : 'Yeni Anket'}</Text>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85} onPress={() => setEditorOpen(false)}>
              <Ionicons name={safeIoniconName('close', 'close')} size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Ad *</Text>
            <TextInput value={draft.name} onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))} placeholder="Anket adı" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Hedef Kitle</Text>
            <View style={styles.audienceRow}>
              {AUDIENCE_ITEMS.map((a) => {
                const active = a.key === draft.audience;
                return (
                  <TouchableOpacity
                    key={a.key}
                    activeOpacity={0.85}
                    onPress={() => setDraft((p) => ({ ...p, audience: a.key }))}
                    style={[styles.audiencePill, active ? styles.audiencePillActive : null]}
                  >
                    <Text style={[styles.audienceText, active ? styles.audienceTextActive : null]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Şema (JSON)</Text>
            <TextInput
              value={draft.schemaJsonText}
              onChangeText={(v) => setDraft((p) => ({ ...p, schemaJsonText: v }))}
              placeholder='{"title":"Anket","fields":[...]}'
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.inputMultiline]}
              multiline
              autoCapitalize="none"
            />

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

    headerCard: { padding: 14, gap: 12 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    title: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    meta: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },

    primaryButtonSmall: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    primaryButtonSmallText: { color: '#fff', fontWeight: '900', fontSize: 12 },

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

    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
    card: { padding: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cardTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 14 },
    smallMuted: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: isDark ? colors.surface : colors.background, borderWidth: 1, borderColor: colors.border },
    badgeText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    cardActions: { marginTop: 12, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    modalOverlay: { flex: 1, backgroundColor: '#000', opacity: 0.3 },
    modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '12%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    modalBody: { padding: 16, paddingBottom: 28 },

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
    inputMultiline: { minHeight: 180, textAlignVertical: 'top' },

    audienceRow: { flexDirection: 'row', gap: 8 },
    audiencePill: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    audiencePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    audienceText: { color: colors.textSecondary, fontWeight: '900' },
    audienceTextActive: { color: '#fff' },

    primaryButton: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    disabled: { opacity: 0.6 },

    danger: { color: colors.danger },
  });
}

