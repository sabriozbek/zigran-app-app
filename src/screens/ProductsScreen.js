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

function formatMoneyTRY(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return `₺${Math.round(n).toLocaleString('tr-TR')}`;
  } catch {
    return `₺${Math.round(n)}`;
  }
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

const ProductsScreen = ({ navigation }) => {
  const { colors } = useTheme();
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

  const openEdit = useCallback((p) => {
    setEditing(p);
    setDraftName(String(p?.name || ''));
    setDraftSku(String(p?.sku || ''));
    setDraftPrice(String(p?.price ?? ''));
    setDraftStock(String(p?.stock ?? ''));
    setDraftActive(!!p?.active);
    setUpsertOpen(true);
  }, []);

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
                const status = p.active
                  ? { bg: colors.success + '14', border: colors.success + '33', fg: colors.success, label: 'Aktif' }
                  : { bg: colors.warning + '14', border: colors.warning + '33', fg: colors.warning, label: 'Arşiv' };
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
                        <View
                          style={[
                            styles.pill,
                            {
                              backgroundColor: (isLow ? colors.warning : colors.textSecondary) + '12',
                              borderColor: (isLow ? colors.warning : colors.textSecondary) + '22',
                            },
                          ]}
                        >
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
};

export default ProductsScreen;

