import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { emailService } from '../api/services/emailService';
import { segmentsService } from '../api/services/segmentsService';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  return fallback;
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function safeJsonParse(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ok: true, value: {} };
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function formatDate(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('tr-TR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function stripHtmlToText(html) {
  const raw = String(html || '');
  if (!raw) return '';
  const withoutScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPreviewBlocks(html) {
  const raw = String(html || '');
  const blocks = [];
  if (!raw) return blocks;

  const imgMatches = raw.matchAll(/<img[^>]*>/gi);
  for (let i = 0; i < 2; i += 1) {
    const next = imgMatches.next();
    if (next.done) break;
    blocks.push({ type: 'image' });
  }

  const headingMatches = raw.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const m of headingMatches) {
    const txt = stripHtmlToText(m?.[1] || '').slice(0, 60);
    if (txt) blocks.push({ type: 'heading', text: txt });
    if (blocks.length >= 4) break;
  }

  const linkMatches = raw.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const txt = stripHtmlToText(m?.[1] || '').slice(0, 32);
    if (txt) blocks.push({ type: 'button', text: txt });
    if (blocks.length >= 5) break;
  }

  const text = stripHtmlToText(raw);
  if (text) {
    const chunks = text.split('. ').filter(Boolean);
    for (let i = 0; i < chunks.length && blocks.length < 8; i += 1) {
      const t = String(chunks[i]).trim().slice(0, 70);
      if (t) blocks.push({ type: 'text', text: t });
    }
  }

  if (blocks.length === 0) return [{ type: 'text', text: 'İçerik bulunamadı' }];
  return blocks.slice(0, 8);
}

const TAB_ITEMS = [
  { key: 'templates', label: 'Şablonlar', icon: 'copy-outline' },
  { key: 'send', label: 'Gönder', icon: 'send-outline' },
  { key: 'logs', label: 'Raporlar', icon: 'stats-chart-outline' },
];

export default function EmailScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);
  const [activeTab, setActiveTab] = useState('templates');

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

  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [segments, setSegments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [templatesView, setTemplatesView] = useState('gallery');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTpl, setPreviewTpl] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [draft, setDraft] = useState({
    id: null,
    name: '',
    subject: '',
    category: '',
    previewText: '',
    description: '',
    html: '',
  });

  const [sendMode, setSendMode] = useState('single');
  const [sendTemplateId, setSendTemplateId] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendSegmentId, setSendSegmentId] = useState('');
  const [sendVariables, setSendVariables] = useState('');
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    const results = await Promise.allSettled([emailService.listTemplates(), emailService.listLogs(), segmentsService.summary()]);
    const nextTemplates = results[0].status === 'fulfilled' ? normalizeList(results[0].value) : [];
    const nextLogs = results[1].status === 'fulfilled' ? normalizeList(results[1].value) : [];
    const segSummary = results[2].status === 'fulfilled' ? results[2].value : null;
    const segItems = normalizeList(segSummary?.segments ?? segSummary?.items ?? segSummary);
    setTemplates(nextTemplates);
    setLogs(nextLogs);
    setSegments(segItems);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAll();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const categories = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => {
      const c = String(t?.category || '').trim();
      if (c) set.add(c);
    });
    return ['all', ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'tr'))];
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== 'all') {
        if (String(t?.category || '') !== String(category)) return false;
      }
      if (!q) return true;
      const hay = `${String(t?.name || '')} ${String(t?.subject || '')} ${String(t?.description || '')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [category, search, templates]);

  const openedRate = useMemo(() => {
    const total = logs.length;
    if (!total) return 0;
    const opened = logs.filter((l) => !!l?.opened).length;
    return Math.round((opened / total) * 100);
  }, [logs]);

  const clickedRate = useMemo(() => {
    const total = logs.length;
    if (!total) return 0;
    const clicked = logs.filter((l) => !!l?.clicked).length;
    return Math.round((clicked / total) * 100);
  }, [logs]);

  const openNewTemplate = useCallback(() => {
    setDraft({ id: null, name: '', subject: '', category: '', previewText: '', description: '', html: '' });
    setEditorOpen(true);
  }, []);

  const openEditTemplate = useCallback((tpl) => {
    setDraft({
      id: tpl?.id ?? null,
      name: String(tpl?.name || ''),
      subject: String(tpl?.subject || ''),
      category: String(tpl?.category || ''),
      previewText: String(tpl?.previewText || ''),
      description: String(tpl?.description || ''),
      html: String(tpl?.html || ''),
    });
    setEditorOpen(true);
  }, []);

  const openPreview = useCallback((tpl) => {
    setPreviewTpl(tpl || null);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewTpl(null);
  }, []);

  const saveTemplate = useCallback(async () => {
    const name = String(draft?.name || '').trim();
    const subject = String(draft?.subject || '').trim();
    const html = String(draft?.html || '').trim();
    if (!name || !subject || !html) {
      Alert.alert('Eksik bilgi', 'Şablon adı, konu ve HTML zorunlu.');
      return;
    }

    setEditorSaving(true);
    try {
      if (draft?.id) {
        const res = await emailService.updateTemplate(draft.id, {
          name,
          subject,
          html,
          category: String(draft?.category || '').trim() || undefined,
          previewText: String(draft?.previewText || '').trim() || undefined,
          description: String(draft?.description || '').trim() || undefined,
        });
        if (res?.ok === false) throw new Error('update_failed');
      } else {
        await emailService.createTemplate({
          name,
          subject,
          html,
          category: String(draft?.category || '').trim() || undefined,
          previewText: String(draft?.previewText || '').trim() || undefined,
          description: String(draft?.description || '').trim() || undefined,
        });
      }
      setEditorOpen(false);
      await loadAll();
    } catch {
      Alert.alert('Hata', 'Şablon kaydedilemedi.');
    } finally {
      setEditorSaving(false);
    }
  }, [draft, loadAll]);

  const confirmDeleteTemplate = useCallback(
    (tpl) => {
      Alert.alert('Şablon Silinsin mi?', `${String(tpl?.name || 'Şablon')}`, [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await emailService.deleteTemplate(tpl?.id);
              await loadAll();
            } catch {
              Alert.alert('Hata', 'Silme işlemi başarısız.');
            }
          },
        },
      ]);
    },
    [loadAll],
  );

  const seedDefaults = useCallback(async () => {
    setSeedLoading(true);
    try {
      const res = await emailService.seedTemplates();
      if (res?.ok) {
        await loadAll();
      } else {
        await loadAll();
      }
    } catch {
      Alert.alert('Hata', 'Varsayılan şablonlar eklenemedi.');
    } finally {
      setSeedLoading(false);
    }
  }, [loadAll]);

  const sendNow = useCallback(async () => {
    const templateId = String(sendTemplateId || '').trim();
    if (!templateId) {
      Alert.alert('Eksik bilgi', 'Şablon seçin.');
      return;
    }
    const parsed = safeJsonParse(sendVariables);
    if (!parsed.ok) {
      Alert.alert('Hata', 'Değişken JSON formatı geçersiz.');
      return;
    }

    setSending(true);
    try {
      if (sendMode === 'segment') {
        const segmentId = String(sendSegmentId || '').trim();
        if (!segmentId) {
          Alert.alert('Eksik bilgi', 'Segment seçin.');
          return;
        }
        const res = await emailService.sendSegment({ segmentId, templateId, variables: parsed.value });
        if (res?.ok === false) {
          Alert.alert('Hata', 'Gönderim başarısız.');
          return;
        }
        pushToast('success', `Gönderim tetiklendi. (${String(res?.sent ?? '')})`);
      } else {
        const to = String(sendTo || '').trim();
        if (!to) {
          Alert.alert('Eksik bilgi', 'Alıcı e-posta girin.');
          return;
        }
        const res = await emailService.sendTemplate({ to, templateId, variables: parsed.value });
        if (res?.ok === false) {
          Alert.alert('Hata', 'Gönderim başarısız.');
          return;
        }
        pushToast('success', 'E-posta gönderildi.');
      }
      setSendTo('');
      await loadAll();
    } catch {
      Alert.alert('Hata', 'Gönderim başarısız.');
    } finally {
      setSending(false);
    }
  }, [loadAll, pushToast, sendMode, sendSegmentId, sendTemplateId, sendTo, sendVariables]);

  const TemplateCard = useCallback(
    ({ item }) => {
      const tpl = item || {};
      const name = String(tpl?.name || 'Şablon');
      const subject = String(tpl?.subject || '—');
      const cat = String(tpl?.category || '').trim();
      const blocks = extractPreviewBlocks(tpl?.html);
      return (
        <AppCard style={styles.tplCard} onPress={() => openPreview(tpl)} accessibilityLabel={`${name} şablonunu önizle`}>
          <View style={styles.tplPreviewFrame}>
            <View style={styles.tplPreviewTopBar}>
              <View style={styles.tplPreviewDot} />
              <View style={styles.tplPreviewDot} />
              <View style={styles.tplPreviewDot} />
              <View style={{ flex: 1 }} />
              <View style={styles.tplPreviewPill}>
                <Text style={styles.tplPreviewPillText} numberOfLines={1}>
                  {String(tpl?.previewText || '').trim() ? String(tpl.previewText).trim() : 'Önizleme'}
                </Text>
              </View>
            </View>
            <View style={styles.tplPreviewBody}>
              {blocks.map((b, idx) => {
                if (b.type === 'image') return <View key={String(idx)} style={styles.tplPreviewImage} />;
                if (b.type === 'heading')
                  return (
                    <View key={String(idx)} style={styles.tplPreviewLineWrap}>
                      <View style={[styles.tplPreviewLine, styles.tplPreviewLineStrong]} />
                      <View style={[styles.tplPreviewLine, styles.tplPreviewLineStrong]} />
                    </View>
                  );
                if (b.type === 'button')
                  return (
                    <View key={String(idx)} style={styles.tplPreviewButton}>
                      <View style={styles.tplPreviewButtonInner} />
                    </View>
                  );
                return (
                  <View key={String(idx)} style={styles.tplPreviewLineWrap}>
                    <View style={styles.tplPreviewLine} />
                    <View style={styles.tplPreviewLine} />
                    <View style={[styles.tplPreviewLine, styles.tplPreviewLineShort]} />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.tplTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tplName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.tplMeta} numberOfLines={2}>
                {subject}
              </Text>
            </View>
            {cat ? (
              <View style={styles.pill}>
                <Text style={styles.pillText} numberOfLines={1}>
                  {cat}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.tplBottom}>
            <Text style={styles.smallMuted} numberOfLines={1}>
              Güncellendi: {formatDate(tpl?.updatedAt ?? tpl?.updated_at ?? tpl?.createdAt)}
            </Text>
            <View style={styles.tplActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.8}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  openEditTemplate(tpl);
                }}
              >
                <Ionicons name={safeIoniconName('create-outline', 'create-outline')} size={16} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.8}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  openPreview(tpl);
                }}
              >
                <Ionicons name={safeIoniconName('eye-outline', 'eye-outline')} size={16} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.8}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  confirmDeleteTemplate(tpl);
                }}
              >
                <Ionicons name={safeIoniconName('trash-outline', 'trash-outline')} size={16} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnPrimary]}
                activeOpacity={0.85}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  setActiveTab('send');
                  setSendTemplateId(String(tpl?.id || ''));
                }}
              >
                <Ionicons name={safeIoniconName('send-outline', 'send-outline')} size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>
      );
    },
    [
      colors.danger,
      colors.textPrimary,
      confirmDeleteTemplate,
      openEditTemplate,
      openPreview,
      styles.iconBtn,
      styles.iconBtnPrimary,
      styles.pill,
      styles.pillText,
      styles.smallMuted,
      styles.tplActions,
      styles.tplBottom,
      styles.tplCard,
      styles.tplMeta,
      styles.tplName,
      styles.tplPreviewBody,
      styles.tplPreviewButton,
      styles.tplPreviewButtonInner,
      styles.tplPreviewDot,
      styles.tplPreviewFrame,
      styles.tplPreviewImage,
      styles.tplPreviewLine,
      styles.tplPreviewLineShort,
      styles.tplPreviewLineStrong,
      styles.tplPreviewLineWrap,
      styles.tplPreviewPill,
      styles.tplPreviewPillText,
      styles.tplPreviewTopBar,
      styles.tplTop,
    ],
  );

  const renderHeader = useMemo(() => {
    const total = logs.length;
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>E-Posta</Text>
              <Text style={styles.meta}>Şablonları yönetin, tekil gönderin veya segmentlere kampanya başlatın.</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.primaryButtonSmall} activeOpacity={0.85} onPress={openNewTemplate}>
                <Ionicons name={safeIoniconName('add', 'add')} size={16} color="#fff" />
                <Text style={styles.primaryButtonSmallText}>Yeni Şablon</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButtonSmall, seedLoading ? styles.disabled : null]}
                activeOpacity={0.85}
                disabled={seedLoading}
                onPress={seedDefaults}
              >
                {seedLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.secondaryButtonSmallText}>Şablonları Yükle</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsInner}>
              {TAB_ITEMS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.85}
                    onPress={() => setActiveTab(t.key)}
                    style={[styles.tabPill, active ? styles.tabPillActive : null]}
                  >
                    <Ionicons
                      name={safeIoniconName(t.icon, 'ellipse-outline')}
                      size={14}
                      color={active ? '#fff' : colors.textSecondary}
                    />
                    <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </AppCard>

        <View style={styles.metricsRow}>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Şablon</Text>
            <Text style={styles.metricValue}>{String(templates.length)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Gönderim</Text>
            <Text style={styles.metricValue}>{String(total)}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Açılma</Text>
            <Text style={styles.metricValue}>{total ? `${openedRate}%` : '—'}</Text>
          </AppCard>
          <AppCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tıklama</Text>
            <Text style={styles.metricValue}>{total ? `${clickedRate}%` : '—'}</Text>
          </AppCard>
        </View>

      </View>
    );
  }, [
    activeTab,
    clickedRate,
    colors.primary,
    colors.textSecondary,
    logs.length,
    openNewTemplate,
    openedRate,
    seedDefaults,
    seedLoading,
    styles.disabled,
    styles.headerCard,
    styles.headerRight,
    styles.headerTop,
    styles.metricCard,
    styles.metricLabel,
    styles.metricValue,
    styles.metricsRow,
    styles.meta,
    styles.primaryButtonSmall,
    styles.primaryButtonSmallText,
    styles.secondaryButtonSmall,
    styles.secondaryButtonSmallText,
    styles.tabPill,
    styles.tabPillActive,
    styles.tabPillText,
    styles.tabPillTextActive,
    styles.tabsInner,
    styles.tabsRow,
    styles.title,
    templates.length,
  ]);

  const content = useMemo(() => {
    if (activeTab === 'templates') {
      const isGrid = templatesView === 'gallery';
      const columns = screenWidth >= 820 ? 3 : screenWidth >= 520 ? 2 : 1;
      return (
        <View style={{ gap: 10 }}>
          <AppCard style={styles.filterCard}>
            <View style={styles.searchRow}>
              <View style={styles.searchWrap}>
                <Ionicons name={safeIoniconName('search', 'search')} size={16} color={colors.textSecondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Şablon ara (ad, konu, açıklama)"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.viewToggleRow}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, templatesView === 'gallery' ? styles.viewToggleBtnActive : null]}
                  onPress={() => setTemplatesView('gallery')}
                  activeOpacity={0.85}
                >
                  <Ionicons name={safeIoniconName('grid-outline', 'grid-outline')} size={16} color={templatesView === 'gallery' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, templatesView === 'list' ? styles.viewToggleBtnActive : null]}
                  onPress={() => setTemplatesView('list')}
                  activeOpacity={0.85}
                >
                  <Ionicons name={safeIoniconName('list-outline', 'list-outline')} size={16} color={templatesView === 'list' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map((c) => {
                const active = String(c) === String(category);
                return (
                  <TouchableOpacity
                    key={String(c)}
                    activeOpacity={0.85}
                    onPress={() => setCategory(String(c))}
                    style={[styles.categoryPill, active ? styles.categoryPillActive : null]}
                  >
                    <Text style={[styles.categoryText, active ? styles.categoryTextActive : null]}>{String(c) === 'all' ? 'Tümü' : String(c)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </AppCard>

          {templates.length === 0 ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Şablon yok</Text>
              <Text style={styles.meta}>Yeni şablon ekleyin veya hazır şablonları yükleyin.</Text>
            </AppCard>
          ) : null}

          <FlatList
            data={visibleTemplates}
            keyExtractor={(item, idx) => String(item?.id ?? idx)}
            renderItem={TemplateCard}
            key={isGrid ? `grid-${columns}` : 'list'}
            numColumns={isGrid ? columns : 1}
            columnWrapperStyle={isGrid && columns > 1 ? styles.tplColumn : null}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </View>
      );
    }

    if (activeTab === 'send') {
      const selectedTemplate = templates.find((t) => String(t?.id) === String(sendTemplateId));
      return (
        <View style={{ gap: 10 }}>
          <AppCard style={styles.sendCard}>
            <Text style={styles.sectionTitle}>Kampanya Gönder</Text>
            <Text style={styles.meta}>Tekil alıcı veya segment bazlı gönderim.</Text>

            <View style={styles.modeRow}>
              {[
                { key: 'single', label: 'Tekil' },
                { key: 'segment', label: 'Segment' },
              ].map((m) => {
                const active = m.key === sendMode;
                return (
                  <TouchableOpacity
                    key={m.key}
                    activeOpacity={0.85}
                    onPress={() => setSendMode(m.key)}
                    style={[styles.modePill, active ? styles.modePillActive : null]}
                  >
                    <Text style={[styles.modeText, active ? styles.modeTextActive : null]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Şablon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatePickRow}>
              {templates.slice(0, 50).map((t) => {
                const active = String(t?.id) === String(sendTemplateId);
                return (
                  <TouchableOpacity
                    key={String(t?.id)}
                    activeOpacity={0.85}
                    onPress={() => setSendTemplateId(String(t?.id))}
                    style={[styles.templatePick, active ? styles.templatePickActive : null]}
                  >
                    <Text style={[styles.templatePickText, active ? styles.templatePickTextActive : null]} numberOfLines={1}>
                      {String(t?.name || 'Şablon')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedTemplate ? (
              <View style={styles.selectedTplBox}>
                <Text style={styles.smallMuted} numberOfLines={2}>
                  Konu: {String(selectedTemplate?.subject || '—')}
                </Text>
                {selectedTemplate?.previewText ? (
                  <Text style={styles.smallMuted} numberOfLines={2}>
                    Önizleme: {String(selectedTemplate?.previewText || '')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {sendMode === 'segment' ? (
              <>
                <Text style={styles.label}>Segment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatePickRow}>
                  {segments.slice(0, 60).map((s) => {
                    const active = String(s?.id) === String(sendSegmentId);
                    const label = String(s?.name || s?.title || 'Segment');
                    const count = s?.count ?? s?.leadsCount ?? s?.size;
                    return (
                      <TouchableOpacity
                        key={String(s?.id)}
                        activeOpacity={0.85}
                        onPress={() => setSendSegmentId(String(s?.id))}
                        style={[styles.templatePick, active ? styles.templatePickActive : null]}
                      >
                        <Text style={[styles.templatePickText, active ? styles.templatePickTextActive : null]} numberOfLines={1}>
                          {label}
                          {count !== undefined ? ` (${String(count)})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.label}>Alıcı E-Posta</Text>
                <TextInput
                  value={sendTo}
                  onChangeText={setSendTo}
                  placeholder="ornek@domain.com"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </>
            )}

            <Text style={styles.label}>Değişkenler (JSON)</Text>
            <TextInput
              value={sendVariables}
              onChangeText={setSendVariables}
              placeholder='{"lead":{"name":"Ada"},"company":{"name":"Zigran"}}'
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              style={[styles.input, styles.inputMultiline]}
              multiline
            />

            <TouchableOpacity
              style={[styles.primaryButton, (!sendTemplateId || sending) ? styles.disabled : null]}
              activeOpacity={0.85}
              onPress={sendNow}
              disabled={!sendTemplateId || sending}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Gönder</Text>}
            </TouchableOpacity>
          </AppCard>
        </View>
      );
    }

    const total = logs.length;
    const opened = logs.filter((l) => !!l?.opened).length;
    const clicked = logs.filter((l) => !!l?.clicked).length;
    const openRate = total ? Math.round((opened / total) * 100) : 0;
    const clickRate = total ? Math.round((clicked / total) * 100) : 0;
    return (
      <View style={{ gap: 10 }}>
        <AppCard style={styles.reportCard}>
          <Text style={styles.sectionTitle}>Son 100 Gönderim</Text>
          <Text style={styles.meta}>Açılma ve tıklama durumlarını izleyin.</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Açılma</Text>
              <Text style={styles.kpiValue}>{total ? `${openRate}%` : '—'}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Tıklama</Text>
              <Text style={styles.kpiValue}>{total ? `${clickRate}%` : '—'}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Toplam</Text>
              <Text style={styles.kpiValue}>{String(total)}</Text>
            </View>
          </View>
        </AppCard>

        <FlatList
          data={logs}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const l = item || {};
            const to = String(l?.to || '—');
            const subject = String(l?.subject || '—');
            const openedOk = !!l?.opened;
            const clickedOk = !!l?.clicked;
            return (
              <AppCard style={styles.logCard}>
                <View style={styles.logTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.logTo} numberOfLines={1}>
                      {to}
                    </Text>
                    <Text style={styles.logSubject} numberOfLines={2}>
                      {subject}
                    </Text>
                  </View>
                  <View style={styles.logBadges}>
                    <View style={[styles.badge, openedOk ? styles.badgeOk : styles.badgeMuted]}>
                      <Ionicons name={safeIoniconName(openedOk ? 'mail-open-outline' : 'mail-outline', 'mail-outline')} size={14} color={openedOk ? colors.success : colors.textSecondary} />
                      <Text style={[styles.badgeText, openedOk ? styles.badgeTextOk : null]}>{openedOk ? 'Açıldı' : 'Kapalı'}</Text>
                    </View>
                    <View style={[styles.badge, clickedOk ? styles.badgeOk : styles.badgeMuted]}>
                      <Ionicons name={safeIoniconName(clickedOk ? 'link-outline' : 'remove-outline', 'link-outline')} size={14} color={clickedOk ? colors.success : colors.textSecondary} />
                      <Text style={[styles.badgeText, clickedOk ? styles.badgeTextOk : null]}>{clickedOk ? 'Tıklandı' : '—'}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.smallMuted}>Tarih: {formatDate(l?.createdAt ?? l?.created_at)}</Text>
              </AppCard>
            );
          }}
        />
      </View>
    );
  }, [
    TemplateCard,
    activeTab,
    categories,
    category,
    colors.success,
    colors.textSecondary,
    logs,
    search,
    segments,
    screenWidth,
    sendMode,
    sendNow,
    sendSegmentId,
    sendTemplateId,
    sendTo,
    sendVariables,
    sending,
    visibleTemplates,
    styles.badge,
    styles.badgeMuted,
    styles.badgeOk,
    styles.badgeText,
    styles.badgeTextOk,
    styles.categoryPill,
    styles.categoryPillActive,
    styles.categoryRow,
    styles.categoryText,
    styles.categoryTextActive,
    styles.disabled,
    styles.filterCard,
    styles.input,
    styles.inputMultiline,
    styles.kpi,
    styles.kpiLabel,
    styles.kpiRow,
    styles.kpiValue,
    styles.label,
    styles.logBadges,
    styles.logCard,
    styles.logSubject,
    styles.logTo,
    styles.logTop,
    styles.meta,
    styles.modePill,
    styles.modePillActive,
    styles.modeRow,
    styles.modeText,
    styles.modeTextActive,
    styles.primaryButton,
    styles.primaryButtonText,
    styles.reportCard,
    styles.searchInput,
    styles.sectionTitle,
    styles.selectedTplBox,
    styles.sendCard,
    styles.smallMuted,
    styles.templatePick,
    styles.templatePickActive,
    styles.templatePickRow,
    styles.templatePickText,
    styles.templatePickTextActive,
    styles.tplColumn,
    styles.searchRow,
    styles.searchWrap,
    styles.viewToggleBtn,
    styles.viewToggleBtnActive,
    styles.viewToggleRow,
    templates,
    templatesView,
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {renderHeader}
        {content}
      </ScrollView>

      <Modal visible={previewOpen} animationType="slide" transparent onRequestClose={closePreview}>
        <Pressable style={styles.modalOverlay} onPress={closePreview} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {String(previewTpl?.name || 'Şablon Önizleme')}
              </Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {String(previewTpl?.subject || '—')}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={closePreview}>
              <Ionicons name={safeIoniconName('close', 'close')} size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.previewBody} keyboardShouldPersistTaps="handled">
            <View style={styles.previewEmailFrame}>
              <View style={styles.previewEmailHeader}>
                <View style={styles.previewAvatar} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.previewFrom} numberOfLines={1}>
                    {String(previewTpl?.fromName || 'Zigran')}
                  </Text>
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {String(previewTpl?.previewText || 'Gelen kutusu önizlemesi')}
                  </Text>
                </View>
                <View style={styles.previewTimePill}>
                  <Text style={styles.previewTimeText}>Şimdi</Text>
                </View>
              </View>
              <View style={styles.previewEmailBody}>
                {extractPreviewBlocks(previewTpl?.html).map((b, idx) => {
                  if (b.type === 'image') return <View key={String(idx)} style={styles.previewBlockImage} />;
                  if (b.type === 'button')
                    return (
                      <View key={String(idx)} style={styles.previewBlockButton}>
                        <Text style={styles.previewBlockButtonText} numberOfLines={1}>
                          {String(b.text || 'Buton')}
                        </Text>
                      </View>
                    );
                  if (b.type === 'heading')
                    return (
                      <Text key={String(idx)} style={styles.previewHeading} numberOfLines={2}>
                        {String(b.text || '')}
                      </Text>
                    );
                  return (
                    <Text key={String(idx)} style={styles.previewParagraph} numberOfLines={3}>
                      {String(b.text || '')}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.secondaryButtonSmall}
                activeOpacity={0.85}
                onPress={() => {
                  if (!previewTpl) return;
                  closePreview();
                  setTimeout(() => openEditTemplate(previewTpl), 0);
                }}
              >
                <Text style={styles.secondaryButtonSmallText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButtonSmall, !previewTpl?.id ? styles.disabled : null]}
                activeOpacity={0.85}
                disabled={!previewTpl?.id}
                onPress={() => {
                  if (!previewTpl?.id) return;
                  setActiveTab('send');
                  setSendTemplateId(String(previewTpl.id));
                  closePreview();
                }}
              >
                <Ionicons name={safeIoniconName('send-outline', 'send-outline')} size={16} color="#fff" />
                <Text style={styles.primaryButtonSmallText}>Kullan</Text>
              </TouchableOpacity>
            </View>

            <AppCard style={styles.previewMetaCard}>
              <Text style={styles.sectionTitle}>İçerik Özeti</Text>
              <Text style={styles.meta} numberOfLines={6}>
                {stripHtmlToText(previewTpl?.html) || '—'}
              </Text>
            </AppCard>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{draft?.id ? 'Şablonu Düzenle' : 'Yeni Şablon'}</Text>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => setEditorOpen(false)}>
              <Ionicons name={safeIoniconName('close', 'close')} size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Ad *</Text>
            <TextInput value={draft.name} onChangeText={(v) => setDraft((p) => ({ ...p, name: v }))} placeholder="Şablon adı" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Konu *</Text>
            <TextInput value={draft.subject} onChangeText={(v) => setDraft((p) => ({ ...p, subject: v }))} placeholder="E-posta konusu" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Kategori</Text>
            <TextInput value={draft.category} onChangeText={(v) => setDraft((p) => ({ ...p, category: v }))} placeholder="Örn: Hoşgeldin" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Önizleme Metni</Text>
            <TextInput value={draft.previewText} onChangeText={(v) => setDraft((p) => ({ ...p, previewText: v }))} placeholder="Gelen kutusu önizlemesi" placeholderTextColor={colors.textSecondary} style={styles.input} />

            <Text style={styles.label}>Açıklama</Text>
            <TextInput value={draft.description} onChangeText={(v) => setDraft((p) => ({ ...p, description: v }))} placeholder="Kısa açıklama" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.inputMultiline]} multiline />

            <Text style={styles.label}>HTML *</Text>
            <TextInput
              value={draft.html}
              onChangeText={(v) => setDraft((p) => ({ ...p, html: v }))}
              placeholder="<html>...</html>"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.htmlInput]}
              multiline
              autoCapitalize="none"
            />

            <TouchableOpacity style={[styles.primaryButton, editorSaving ? styles.disabled : null]} activeOpacity={0.85} onPress={saveTemplate} disabled={editorSaving}>
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

    headerCard: { padding: 14 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { color: colors.textPrimary, fontWeight: '900', fontSize: 18 },

    tabsRow: { marginTop: 2 },
    tabsInner: { gap: 10, paddingRight: 12 },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    tabPillTextActive: { color: '#fff' },

    metricsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    metricCard: { flex: 1, minWidth: 150, paddingVertical: 12 },
    metricLabel: { color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    metricValue: { color: colors.textPrimary, fontWeight: '900', fontSize: 18, marginTop: 6 },

    toolbarCard: { padding: 14 },
    toolbarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 15 },
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
    secondaryButtonSmall: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 130,
    },
    secondaryButtonSmallText: { color: colors.primary, fontWeight: '900', fontSize: 12 },

    filterCard: { padding: 14, gap: 10 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      padding: 0,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    viewToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    viewToggleBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewToggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryRow: { gap: 8, paddingTop: 10, paddingBottom: 2 },
    categoryPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    categoryPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    categoryTextActive: { color: '#fff' },

    tplCard: { padding: 12 },
    tplColumn: { gap: 10, justifyContent: 'space-between' },
    tplPreviewFrame: {
      height: 108,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    tplPreviewTopBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
    tplPreviewDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.textSecondary + '55' },
    tplPreviewPill: { maxWidth: 130, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 5 },
    tplPreviewPillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 10 },
    tplPreviewBody: { flex: 1, padding: 10, gap: 8 },
    tplPreviewImage: { height: 22, borderRadius: 10, backgroundColor: colors.primary + '1A', borderWidth: 1, borderColor: colors.primary + '33' },
    tplPreviewLineWrap: { gap: 5 },
    tplPreviewLine: { height: 7, borderRadius: 99, backgroundColor: colors.textSecondary + '2A' },
    tplPreviewLineStrong: { backgroundColor: colors.textSecondary + '45', height: 8 },
    tplPreviewLineShort: { width: '70%' },
    tplPreviewButton: { height: 18, borderRadius: 999, backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '2A', alignSelf: 'flex-start', paddingHorizontal: 14, justifyContent: 'center' },
    tplPreviewButtonInner: { height: 6, borderRadius: 99, backgroundColor: colors.primary + '66', width: 44 },
    tplTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
    tplName: { color: colors.textPrimary, fontWeight: '900', fontSize: 14 },
    tplMeta: { marginTop: 4, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },
    tplBottom: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    tplActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    smallMuted: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    pill: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 120 },
    pillText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },

    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },

    sendCard: { padding: 14 },
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
    inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
    htmlInput: { minHeight: 220, textAlignVertical: 'top', fontFamily: isDark ? undefined : undefined },

    modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    modePill: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 10,
      alignItems: 'center',
    },
    modePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeText: { color: colors.textSecondary, fontWeight: '900' },
    modeTextActive: { color: '#fff' },

    templatePickRow: { gap: 8, paddingBottom: 2 },
    templatePick: {
      maxWidth: 180,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    templatePickActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    templatePickText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    templatePickTextActive: { color: '#fff' },

    selectedTplBox: {
      marginTop: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 10,
      gap: 4,
    },

    primaryButton: { marginTop: 14, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    disabled: { opacity: 0.6 },

    reportCard: { padding: 14 },
    kpiRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    kpi: { flex: 1, minWidth: 110, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    kpiLabel: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    kpiValue: { marginTop: 6, color: colors.textPrimary, fontWeight: '900', fontSize: 16 },

    logCard: { padding: 12 },
    logTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' },
    logTo: { color: colors.textPrimary, fontWeight: '900' },
    logSubject: { marginTop: 4, color: colors.textSecondary, fontWeight: '700', lineHeight: 18 },
    logBadges: { gap: 8, alignItems: 'flex-end' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    badgeOk: { borderColor: colors.success + '40', backgroundColor: colors.success + '12' },
    badgeMuted: { borderColor: colors.border, backgroundColor: colors.background },
    badgeText: { color: colors.textSecondary, fontWeight: '900', fontSize: 12 },
    badgeTextOk: { color: colors.success },

    modalOverlay: { flex: 1, backgroundColor: '#000', opacity: 0.3 },
    modalSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '10%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { color: colors.textPrimary, fontWeight: '900', fontSize: 16 },
    modalSubtitle: { marginTop: 3, color: colors.textSecondary, fontWeight: '800', fontSize: 12 },
    modalBody: { padding: 16, paddingBottom: 28 },
    previewBody: { padding: 16, paddingBottom: 28, gap: 12 },
    previewEmailFrame: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
    previewEmailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    previewAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '33' },
    previewFrom: { color: colors.textPrimary, fontWeight: '900' },
    previewSub: { marginTop: 2, color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
    previewTimePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    previewTimeText: { color: colors.textSecondary, fontWeight: '900', fontSize: 11 },
    previewEmailBody: { padding: 14, gap: 10, backgroundColor: colors.surface },
    previewBlockImage: { height: 120, borderRadius: 16, backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '2A' },
    previewHeading: { color: colors.textPrimary, fontWeight: '900', fontSize: 18, lineHeight: 24 },
    previewParagraph: { color: colors.textSecondary, fontWeight: '700', lineHeight: 20 },
    previewBlockButton: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary },
    previewBlockButtonText: { color: '#fff', fontWeight: '900' },
    previewActions: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between' },
    previewMetaCard: { padding: 14 },
  });
}
