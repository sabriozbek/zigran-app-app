import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
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
import { useTheme } from '../theme/ThemeContext';

function formatDateTR(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return String(value);
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

const OffersScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createInventoryStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTotal, setDraftTotal] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('TRY');
  const [draftStatus, setDraftStatus] = useState('draft');
  const [items, setItems] = useState(() => [
    { id: 'o1', customer: 'Acme Ltd.', title: 'Web Site + CRM Kurulumu', total: 24900, currency: 'TRY', status: 'sent', createdAt: new Date().toISOString() },
    { id: 'o2', customer: 'Nova Yazılım', title: 'Danışmanlık Paketi', total: 12000, currency: 'TRY', status: 'draft', createdAt: new Date().toISOString() },
    { id: 'o3', customer: 'Globex', title: 'Zigran Pro (Yıllık)', total: 1990, currency: 'USD', status: 'won', createdAt: new Date().toISOString() },
  ]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (items || []).filter((o) => {
      if (tab !== 'all' && String(o.status) !== tab) return false;
      if (!q) return true;
      const hay = `${o.customer || ''} ${o.title || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, tab]);

  const stats = useMemo(() => {
    const total = (items || []).length;
    const draft = (items || []).filter((x) => x.status === 'draft').length;
    const sent = (items || []).filter((x) => x.status === 'sent').length;
    const won = (items || []).filter((x) => x.status === 'won').length;
    return { total, draft, sent, won };
  }, [items]);

  const resetDraft = useCallback(() => {
    setDraftCustomer('');
    setDraftTitle('');
    setDraftTotal('');
    setDraftCurrency('TRY');
    setDraftStatus('draft');
  }, []);

  const create = useCallback(() => {
    const customer = String(draftCustomer || '').trim();
    const title = String(draftTitle || '').trim();
    if (!customer || !title) return;
    const total = Number(draftTotal);
    const safeTotal = Number.isFinite(total) ? total : 0;
    const currency = String(draftCurrency || 'TRY').trim().toUpperCase();
    const status = String(draftStatus || 'draft');
    const id = `o_${Math.random().toString(36).slice(2, 10)}`;
    setItems((prev) => [{ id, customer, title, total: safeTotal, currency, status, createdAt: new Date().toISOString() }, ...(prev || [])]);
    setUpsertOpen(false);
    resetDraft();
  }, [draftCurrency, draftCustomer, draftStatus, draftTitle, draftTotal, resetDraft]);

  const shareOffer = useCallback(async (offer) => {
    const msg = `${String(offer?.customer || '')}\n${String(offer?.title || '')}\nTutar: ${String(offer?.currency || 'TRY')} ${String(
      offer?.total ?? 0,
    )}\nDurum: ${String(offer?.status || '')}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  }, []);

  const statusPill = useCallback(
    (status) => {
      const s = String(status || '');
      if (s === 'won') return { bg: colors.success + '14', border: colors.success + '33', fg: colors.success, label: 'Kazanıldı' };
      if (s === 'sent') return { bg: colors.primary + '14', border: colors.primary + '33', fg: colors.primary, label: 'Gönderildi' };
      if (s === 'lost') return { bg: colors.error + '14', border: colors.error + '33', fg: colors.error, label: 'Kaybedildi' };
      return { bg: colors.textSecondary + '12', border: colors.textSecondary + '22', fg: colors.textSecondary, label: 'Taslak' };
    },
    [colors.error, colors.primary, colors.success, colors.textSecondary],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>Teklifler</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Teklif oluşturun, durumunu takip edin ve müşteriye gönderin.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Products')} activeOpacity={0.85}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                resetDraft();
                setUpsertOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam</Text>
            <Text style={styles.statValue}>{String(stats.total)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Tüm teklifler
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.textSecondary + '12', borderColor: colors.textSecondary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taslak</Text>
            <Text style={styles.statValue}>{String(stats.draft)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Düzenlenebilir
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Gönderildi</Text>
            <Text style={styles.statValue}>{String(stats.sent)}</Text>
            <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
              Müşteriye iletildi
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Kazanıldı</Text>
            <Text style={styles.statValue}>{String(stats.won)}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              Satışa dönen
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Müşteri veya teklif ara"
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
            { key: 'draft', label: 'Taslak' },
            { key: 'sent', label: 'Gönderildi' },
            { key: 'won', label: 'Kazanıldı' },
            { key: 'lost', label: 'Kaybedildi' },
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
              <Text style={styles.cardTitle}>Son Teklifler</Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                Durum, tarih ve toplam tutar
              </Text>
            </View>
            <TouchableOpacity style={styles.outlineBtnSmall} onPress={() => navigation.navigate('PriceLists')} activeOpacity={0.85}>
              <Ionicons name="pricetags-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineBtnSmallText}>Fiyat</Text>
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Teklif bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((o) => {
                const pill = statusPill(o.status);
                return (
                  <View key={String(o.id)} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {String(o.customer || 'Müşteri')}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {String(o.title || 'Teklif')} • {String(o.currency || 'TRY')} {String(o.total ?? 0)}
                      </Text>
                      <View style={styles.rowBottom}>
                        <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.pillText, { color: pill.fg }]} numberOfLines={1}>
                            {pill.label}
                          </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {formatDateTR(o.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => shareOffer(o)} activeOpacity={0.85} style={styles.iconActionBtn}>
                      <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
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
              <Text style={styles.modalTitle}>Yeni Teklif</Text>
              <TouchableOpacity onPress={() => setUpsertOpen(false)} activeOpacity={0.85} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGrid}>
                <Text style={styles.label}>Müşteri</Text>
                <TextInput
                  value={draftCustomer}
                  onChangeText={setDraftCustomer}
                  placeholder="Örn: Acme Ltd."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
                <Text style={styles.label}>Başlık</Text>
                <TextInput
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="Örn: Zigran Pro Yıllık"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Tutar</Text>
                    <TextInput
                      value={draftTotal}
                      onChangeText={setDraftTotal}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.input}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
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
                  </View>
                </View>

                <Text style={styles.label}>Durum</Text>
                <View style={styles.chipRow}>
                  {[
                    { key: 'draft', label: 'Taslak' },
                    { key: 'sent', label: 'Gönderildi' },
                    { key: 'won', label: 'Kazanıldı' },
                    { key: 'lost', label: 'Kaybedildi' },
                  ].map((s) => {
                    const active = String(draftStatus) === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.chip, active ? styles.chipActive : null]}
                        onPress={() => setDraftStatus(s.key)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
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
                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={create}
                  activeOpacity={0.85}
                  disabled={!String(draftCustomer || '').trim() || !String(draftTitle || '').trim()}
                >
                  <Text style={styles.modalPrimaryText}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default OffersScreen;

