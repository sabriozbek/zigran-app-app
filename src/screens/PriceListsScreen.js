import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
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
import { useTheme } from '../theme/ThemeContext';

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
    primaryBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    modalBackdrop: {
      position: 'absolute',
      inset: 0,
      backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.55)',
    },
    modalWrap: { flex: 1, justifyContent: 'center', padding: 14 },
    modalCard: {
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', flex: 1, minWidth: 0 },
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
    switchPill: {
      width: 52,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 4,
      justifyContent: 'center',
    },
    switchPillOn: { borderColor: colors.primary + '55', backgroundColor: colors.primary + '22' },
    switchDot: { width: 24, height: 24, borderRadius: 999, backgroundColor: colors.textSecondary + '66', transform: [{ translateX: 0 }] },
    switchDotOn: { backgroundColor: colors.primary, transform: [{ translateX: 20 }] },
    modalFooter: { flexDirection: 'row', gap: 10, marginTop: 10 },
    modalGhostBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalGhostText: { color: colors.textPrimary, fontWeight: '900' },
    modalPrimaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    modalPrimaryText: { color: '#fff', fontWeight: '900' },
  });
}

const PriceListsScreen = ({ navigation }) => {
  const { colors } = useTheme();
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
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Para Birimi</Text>
            <Text style={styles.statValue}>{String(stats.currencies)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Kullanılan birimler
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.textSecondary + '12', borderColor: colors.textSecondary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Kural</Text>
            <Text style={styles.statValue}>{String(stats.rules)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              İndirim/markup
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Varsayılan</Text>
            <Text style={styles.statValue}>{stats.def ? '1' : '0'}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              {stats.def ? String(stats.def.name || '') : 'Seçilmedi'}
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
                Para birimi ve varsayılan liste
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
                  ? { bg: colors.success + '14', border: colors.success + '33', fg: colors.success, label: 'Varsayılan' }
                  : { bg: colors.textSecondary + '12', border: colors.textSecondary + '22', fg: colors.textSecondary, label: 'Özel' };
                return (
                  <TouchableOpacity key={String(l.id)} style={styles.row} onPress={() => openEdit(l)} activeOpacity={0.85}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="pricetags-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {String(l.name || 'Liste')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        Para Birimi: {String(l.currency || 'TRY')} • Kurallar: {String(l.rules ?? 0)}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.pillText, { color: pill.fg }]} numberOfLines={1}>
                            {pill.label}
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
                  placeholder="Örn: Bayi Listesi"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />

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

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.toggleTitle}>Varsayılan</Text>
                    <Text style={styles.toggleHint} numberOfLines={2}>
                      Seçilirse diğer listeler varsayılan olmaktan çıkar.
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
};

export default PriceListsScreen;

