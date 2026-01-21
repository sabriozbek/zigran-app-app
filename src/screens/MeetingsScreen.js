import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { leadsService } from '../api/services/leadsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

const DAYS = [
  { key: 'mon', label: 'Pazartesi' },
  { key: 'tue', label: 'Salı' },
  { key: 'wed', label: 'Çarşamba' },
  { key: 'thu', label: 'Perşembe' },
  { key: 'fri', label: 'Cuma' },
  { key: 'sat', label: 'Cumartesi' },
  { key: 'sun', label: 'Pazar' },
];

const SOURCE_OPTIONS = [
  { value: 'calendar', label: 'Takvim / Randevu' },
  { value: 'phone', label: 'Telefon Görüşmesi' },
  { value: 'online', label: 'Online Toplantı' },
  { value: 'manual', label: 'Diğer' },
];

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function toDateInputValue(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHm(value) {
  const s = String(value || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function buildSlots(dateStr, settings, disabledSlots = []) {
  if (!dateStr || !settings) return [];
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  const dayIndex = d.getDay();
  const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex];
  const ranges = Array.isArray(settings?.availability?.[dayKey]) ? settings.availability[dayKey] : [];
  const duration = Number(settings?.meetingDuration || 0);
  const buffer = Number(settings?.bufferMinutes || 0);
  const step = duration + buffer;
  if (!ranges.length || duration <= 0 || step <= 0) return [];

  const slots = [];
  for (const r of ranges) {
    const start = parseHm(r?.start);
    const end = parseHm(r?.end);
    if (start === null || end === null) continue;
    let current = start;
    while (current + duration <= end) {
      const hh = String(Math.floor(current / 60)).padStart(2, '0');
      const mm = String(current % 60).padStart(2, '0');
      const label = `${hh}:${mm}`;
      if (!disabledSlots.includes(label)) slots.push(label);
      current += step;
    }
  }
  return slots;
}

function getMonthGrid(cursor) {
  const base = cursor instanceof Date ? cursor : new Date();
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const startDow = monthStart.getDay();
  const mondayIndex = (startDow + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - mondayIndex);
  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { days, monthStart, monthEnd };
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function statusLabel(status) {
  const s = String(status || '');
  if (s === 'scheduled') return 'Planlandı';
  if (s === 'completed') return 'Tamamlandı';
  if (s === 'cancelled') return 'İptal';
  return s || '-';
}

function statusColors(status, colors) {
  const s = String(status || '');
  if (s === 'scheduled') return { bg: colors.success + '14', border: colors.success + '33', fg: colors.success };
  if (s === 'completed') return { bg: colors.primary + '14', border: colors.primary + '33', fg: colors.primary };
  if (s === 'cancelled') return { bg: colors.warning + '14', border: colors.warning + '33', fg: colors.warning };
  return { bg: colors.background, border: colors.border, fg: colors.textSecondary };
}

const MeetingsScreen = ({ route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const title = String(route?.params?.title || 'Toplantılar');
  const mode = String(route?.name || '') === 'Booking' || String(route?.params?.mode || '') === 'booking' ? 'booking' : 'meetings';

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settings, setSettings] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);

  const [openSettings, setOpenSettings] = useState(false);
  const [openBook, setOpenBook] = useState(false);
  const [openLeadPicker, setOpenLeadPicker] = useState(false);

  const [booking, setBooking] = useState({ leadId: '', source: 'calendar' });
  const [date, setDate] = useState('');
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);

  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [createDraftTitle, setCreateDraftTitle] = useState('');
  const [createDraftDuration, setCreateDraftDuration] = useState('30');
  const [createDraftLocation, setCreateDraftLocation] = useState('online');
  const [createDraftNote, setCreateDraftNote] = useState('');
  const [createdLink, setCreatedLink] = useState(null);
  const [createdTab, setCreatedTab] = useState('link');
  const [appointmentLinks, setAppointmentLinks] = useState([]);

  const baseUrl = useMemo(() => {
    const raw = settings?.publicBaseUrl || settings?.baseUrl || 'https://app.zigran.com';
    const s = String(raw || '').trim();
    return s.endsWith('/') ? s.slice(0, -1) : s;
  }, [settings?.baseUrl, settings?.publicBaseUrl]);

  const linkUrlFor = useCallback((slug) => `${baseUrl}/r/${String(slug || '').trim()}`, [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mode === 'booking') {
          if (!cancelled) {
            setSettings((prev) =>
              prev || {
                timezone: 'Europe/Istanbul',
                meetingDuration: 30,
                bufferMinutes: 10,
                availability: {},
              },
            );
          }
          return;
        }
        setLoading(true);
        const results = await Promise.allSettled([
          apiClient.get('/meetings/settings'),
          apiClient.get('/meetings'),
          leadsService.getAll({ limit: 100 }),
        ]);
        const s = results[0].status === 'fulfilled' ? results[0].value?.data : null;
        const m = results[1].status === 'fulfilled' ? results[1].value?.data : null;
        const l = results[2].status === 'fulfilled' ? results[2].value : null;
        if (!cancelled) {
          setSettings(
            s || {
              timezone: 'Europe/Istanbul',
              meetingDuration: 30,
              bufferMinutes: 10,
              availability: {},
            },
          );
          setMeetings(normalizeList(m));
          setLeads(normalizeList(l));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshKey]);

  useEffect(() => {
    if (mode === 'booking') return;
    if (!settings) return;
    if (!date) {
      const today = new Date();
      setDate(toDateInputValue(today));
      setMonthCursor(today);
      setSelectedSlot(null);
    }
  }, [date, mode, settings]);

  const nowTs = Date.now();
  const upcomingMeetings = useMemo(
    () =>
      (meetings || []).filter((m) => {
        const at = m?.scheduledAt || m?.scheduled_at || m?.date;
        const t = at ? new Date(at).getTime() : 0;
        return String(m?.status || '') === 'scheduled' && t >= nowTs;
      }),
    [meetings, nowTs],
  );

  const pastMeetings = useMemo(
    () =>
      (meetings || []).filter((m) => {
        const at = m?.scheduledAt || m?.scheduled_at || m?.date;
        const t = at ? new Date(at).getTime() : 0;
        return t > 0 && t < nowTs;
      }),
    [meetings, nowTs],
  );

  const counts = useMemo(() => {
    const completed = (meetings || []).filter((m) => String(m?.status || '') === 'completed').length;
    const cancelled = (meetings || []).filter((m) => String(m?.status || '') === 'cancelled').length;
    return { upcoming: upcomingMeetings.length, completed, cancelled, total: (meetings || []).length };
  }, [meetings, upcomingMeetings.length]);

  const busySlotsForDate = useMemo(() => {
    if (!settings || !date) return [];
    const day = new Date(`${date}T00:00:00`);
    if (Number.isNaN(day.getTime())) return [];
    return (meetings || [])
      .filter((m) => String(m?.status || '') === 'scheduled')
      .map((m) => {
        const at = m?.scheduledAt || m?.scheduled_at || m?.date;
        const d = at ? new Date(at) : null;
        if (!d || Number.isNaN(d.getTime())) return '';
        if (d.getFullYear() !== day.getFullYear() || d.getMonth() !== day.getMonth() || d.getDate() !== day.getDate()) return '';
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      })
      .filter(Boolean);
  }, [date, meetings, settings]);

  const slots = useMemo(() => buildSlots(date, settings, busySlotsForDate), [busySlotsForDate, date, settings]);

  const grid = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const selectedDateObj = useMemo(() => (date ? new Date(`${date}T00:00:00`) : null), [date]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const saveSettings = useCallback(async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await apiClient.patch('/meetings/settings', settings);
      setOpenSettings(false);
      refresh();
    } catch {
      Alert.alert('Hata', 'Ayarlar kaydedilemedi.');
    } finally {
      setSavingSettings(false);
    }
  }, [refresh, settings]);

  const bookMeeting = useCallback(async () => {
    if (!settings || !date || !selectedSlot || !booking?.leadId) return;
    setBookingSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${selectedSlot}:00`).toISOString();
      await apiClient.post('/meetings', {
        leadId: booking.leadId,
        scheduledAt,
        durationMinutes: Number(settings?.meetingDuration || 30),
        bufferMinutes: Number(settings?.bufferMinutes || 10),
        source: booking.source || 'calendar',
      });
      setOpenBook(false);
      setSelectedSlot(null);
      setBooking({ leadId: '', source: booking.source || 'calendar' });
      refresh();
    } catch {
      Alert.alert('Hata', 'Toplantı oluşturulamadı.');
    } finally {
      setBookingSaving(false);
    }
  }, [booking?.leadId, booking.source, date, refresh, selectedSlot, settings]);

  const openLink = useCallback(async (url) => {
    const u = String(url || '').trim();
    if (!u) return;
    try {
      await Linking.openURL(u);
    } catch {}
  }, []);

  const shareText = useCallback(async (text) => {
    const t = String(text || '').trim();
    if (!t) return;
    try {
      await Share.share({ message: t });
    } catch {}
  }, []);

  const resetCreateLink = useCallback(() => {
    setCreateDraftTitle('');
    setCreateDraftDuration('30');
    setCreateDraftLocation('online');
    setCreateDraftNote('');
    setCreatedLink(null);
    setCreatedTab('link');
  }, []);

  const createAppointmentLink = useCallback(() => {
    const name = String(createDraftTitle || '').trim();
    const duration = Number(createDraftDuration);
    if (!name) return;
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 30;
    const slug = Math.random().toString(36).slice(2, 8);
    const item = {
      id: String(Date.now()),
      title: name,
      durationMinutes: safeDuration,
      location: String(createDraftLocation || 'online'),
      note: String(createDraftNote || ''),
      slug,
      createdAt: new Date().toISOString(),
      active: true,
    };
    setAppointmentLinks((prev) => [item, ...(prev || [])]);
    setCreatedLink(item);
    setCreatedTab('link');
  }, [createDraftDuration, createDraftLocation, createDraftNote, createDraftTitle]);

  const leadById = useCallback((id) => (leads || []).find((l) => String(l?.id ?? l?._id ?? '') === String(id)), [leads]);
  const selectedLead = useMemo(() => (booking?.leadId ? leadById(booking.leadId) : null), [booking?.leadId, leadById]);
  const selectedLeadLabel = selectedLead?.name || selectedLead?.fullName || selectedLead?.email || '';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  if (mode === 'booking') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.h1}>{title}</Text>
              <Text style={styles.h2} numberOfLines={2}>
                Randevu linklerinizi oluşturun, paylaşın ve web sitenize embed ederek otomatik randevu alın.
              </Text>
            </View>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  resetCreateLink();
                  setCreateLinkOpen(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Yeni Link</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <AppCard style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
              <Text style={[styles.statLabel, { color: colors.primary }]}>Aktif</Text>
              <Text style={styles.statValue}>{String((appointmentLinks || []).filter((x) => x?.active).length)}</Text>
              <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
                Paylaşılabilir randevu linki
              </Text>
            </AppCard>
            <AppCard style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
              <Text style={[styles.statLabel, { color: colors.success }]}>Toplam</Text>
              <Text style={styles.statValue}>{String((appointmentLinks || []).length)}</Text>
              <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
                Oluşturulan link sayısı
              </Text>
            </AppCard>
            <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Embed</Text>
              <Text style={styles.statValue}>{String((appointmentLinks || []).length)}</Text>
              <Text style={styles.statHint} numberOfLines={1}>
                iFrame ile entegrasyon
              </Text>
            </AppCard>
            <AppCard style={[styles.statCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '22' }]}>
              <Text style={[styles.statLabel, { color: colors.warning }]}>Takvim</Text>
              <Text style={styles.statValue}>—</Text>
              <Text style={[styles.statHint, { color: colors.warning }]} numberOfLines={1}>
                Entegrasyon yakında
              </Text>
            </AppCard>
          </View>

          <View style={styles.gridRow}>
            <AppCard style={styles.listCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle}>Randevu Linkleri</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    Her link için paylaşım ve embed kodunu tek dokunuşla alın.
                  </Text>
                </View>
              </View>

              {(appointmentLinks || []).length === 0 ? (
                <Text style={styles.emptyText}>Henüz link yok. “Yeni Link” ile ilk randevu sayfanızı oluşturun.</Text>
              ) : (
                <View style={{ gap: 10, marginTop: 12 }}>
                  {(appointmentLinks || []).map((l) => {
                    const url = linkUrlFor(l?.slug);
                    const locLabel =
                      l?.location === 'in_person'
                        ? 'Yüz yüze'
                        : l?.location === 'phone'
                          ? 'Telefon'
                          : l?.location === 'online'
                            ? 'Online'
                            : 'Diğer';
                    return (
                      <View key={String(l?.id)} style={styles.appointmentRow}>
                        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                          <View style={styles.appointmentTitleRow}>
                            <View style={styles.appointmentIcon}>
                              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.appointmentTitle} numberOfLines={1}>
                                {String(l?.title || 'Randevu')}
                              </Text>
                              <Text style={styles.appointmentMeta} numberOfLines={1}>
                                {locLabel} • {String(l?.durationMinutes ?? 30)} dk
                              </Text>
                            </View>
                            <View style={[styles.statusPill, { backgroundColor: l?.active ? colors.success + '14' : colors.warning + '14', borderColor: l?.active ? colors.success + '33' : colors.warning + '33' }]}>
                              <Text style={[styles.statusText, { color: l?.active ? colors.success : colors.warning }]} numberOfLines={1}>
                                {l?.active ? 'Aktif' : 'Pasif'}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity style={styles.urlPill} onPress={() => openLink(url)} activeOpacity={0.85}>
                            <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.urlText} numberOfLines={1}>
                              {url}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.appointmentActions}>
                          <TouchableOpacity style={styles.iconPillBtn} onPress={() => shareText(url)} activeOpacity={0.85}>
                            <Ionicons name="share-social-outline" size={18} color={colors.textPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconPillBtn, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}
                            onPress={() => {
                              setCreatedLink(l);
                              setCreatedTab('embed');
                              setCreateLinkOpen(true);
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </AppCard>
          </View>
        </ScrollView>

        <Modal visible={createLinkOpen} transparent animationType="fade" onRequestClose={() => setCreateLinkOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateLinkOpen(false)} />
          <View style={styles.modalWrap}>
            <KeyboardAvoidingView
              style={styles.modalCard}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{createdLink ? 'Link Paylaş / Embed' : 'Yeni Randevu Linki'}</Text>
                <TouchableOpacity onPress={() => setCreateLinkOpen(false)} activeOpacity={0.8}>
                  <Ionicons name="close" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                {!createdLink ? (
                  <View style={styles.modalGrid}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Başlık</Text>
                      <View style={styles.inputIconRow}>
                        <Ionicons name="text-outline" size={16} color={colors.textSecondary} />
                        <TextInput
                          style={styles.modalInput}
                          value={createDraftTitle}
                          onChangeText={setCreateDraftTitle}
                          placeholder="Örn: 30dk Ön Görüşme"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                    </View>

                    <View style={styles.modalGridTwo}>
                      <View style={[styles.modalField, { flex: 1 }]}>
                        <Text style={styles.modalLabel}>Süre (dk)</Text>
                        <TextInput
                          style={styles.modalInputSolo}
                          value={createDraftDuration}
                          onChangeText={setCreateDraftDuration}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.modalField, { flex: 1 }]}>
                        <Text style={styles.modalLabel}>Görüşme Türü</Text>
                        <View style={styles.segmentRow}>
                          {[
                            { key: 'online', label: 'Online' },
                            { key: 'phone', label: 'Telefon' },
                            { key: 'in_person', label: 'Yüz yüze' },
                            { key: 'manual', label: 'Diğer' },
                          ].map((opt) => {
                            const active = String(createDraftLocation || 'online') === opt.key;
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                style={[styles.segmentBtnSmall, active ? styles.segmentBtnSmallActive : null]}
                                onPress={() => setCreateDraftLocation(opt.key)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.segmentTextSmall, active ? styles.segmentTextSmallActive : null]} numberOfLines={1}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Not (opsiyonel)</Text>
                      <TextInput
                        style={styles.modalInputSolo}
                        value={createDraftNote}
                        onChangeText={setCreateDraftNote}
                        placeholder="Müşteriye gösterilecek kısa açıklama"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryBtnWide, { marginTop: 6 }]}
                      onPress={createAppointmentLink}
                      activeOpacity={0.85}
                      disabled={!String(createDraftTitle || '').trim()}
                    >
                      <Text style={styles.primaryBtnWideText}>Link Oluştur</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={styles.segmentRowOneLine}>
                      {[
                        { key: 'link', label: 'Paylaşılabilir Link', icon: 'link-outline' },
                        { key: 'embed', label: 'Embed', icon: 'code-slash-outline' },
                      ].map((t) => {
                        const active = createdTab === t.key;
                        return (
                          <TouchableOpacity
                            key={t.key}
                            style={[styles.segmentPill, active ? styles.segmentPillActive : null]}
                            onPress={() => setCreatedTab(t.key)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name={t.icon} size={16} color={active ? '#fff' : colors.textPrimary} />
                            <Text style={[styles.segmentPillText, active ? styles.segmentPillTextActive : null]} numberOfLines={1}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {createdTab === 'embed' ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.modalLabel}>Embed Kodu</Text>
                        <TextInput
                          style={styles.codeInput}
                          editable={false}
                          value={`<iframe src="${linkUrlFor(createdLink?.slug)}" style="width:100%;height:720px;border:0;border-radius:16px;" loading="lazy"></iframe>`}
                          multiline
                          selectTextOnFocus
                        />
                        <View style={styles.modalFooter}>
                          <TouchableOpacity style={styles.outlineBtnWide} onPress={() => shareText(`Embed:\n${linkUrlFor(createdLink?.slug)}`)} activeOpacity={0.85}>
                            <Text style={styles.outlineBtnWideText}>Paylaş</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.primaryBtnWide} onPress={() => setCreateLinkOpen(false)} activeOpacity={0.85}>
                            <Text style={styles.primaryBtnWideText}>Tamam</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.modalLabel}>Randevu Linki</Text>
                        <TextInput style={styles.linkInput} editable={false} value={linkUrlFor(createdLink?.slug)} selectTextOnFocus />
                        <View style={styles.modalFooter}>
                          <TouchableOpacity style={styles.outlineBtnWide} onPress={() => openLink(linkUrlFor(createdLink?.slug))} activeOpacity={0.85}>
                            <Text style={styles.outlineBtnWideText}>Aç</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.primaryBtnWide} onPress={() => shareText(linkUrlFor(createdLink?.slug))} activeOpacity={0.85}>
                            <Text style={styles.primaryBtnWideText}>Paylaş</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={styles.ghostLink}
                          onPress={() => {
                            resetCreateLink();
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                          <Text style={styles.ghostLinkText}>Yeni link oluştur</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>{title}</Text>
            <Text style={styles.h2} numberOfLines={2}>
              Müşteri görüşmelerinizi planlayın, müsaitliğinizi yönetin ve bağlantıları tek ekrandan takip edin.
            </Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setOpenSettings(true)} activeOpacity={0.85}>
              <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineBtnText}>Müsaitlik</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setOpenBook(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Yeni</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <AppCard style={[styles.statCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.success }]}>Planlanan</Text>
            <Text style={styles.statValue}>{String(counts.upcoming)}</Text>
            <Text style={[styles.statHint, { color: colors.success }]} numberOfLines={1}>
              Yaklaşan toplantı sayısı
            </Text>
          </AppCard>
          <AppCard style={[styles.statCard, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Tamamlanan</Text>
            <Text style={styles.statValue}>{String(counts.completed)}</Text>
            <Text style={[styles.statHint, { color: colors.primary }]} numberOfLines={1}>
              Sonlanan toplantı sayısı
            </Text>
          </AppCard>
          <AppCard style={[styles.statCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '22' }]}>
            <Text style={[styles.statLabel, { color: colors.warning }]}>İptal</Text>
            <Text style={styles.statValue}>{String(counts.cancelled)}</Text>
            <Text style={[styles.statHint, { color: colors.warning }]} numberOfLines={1}>
              İptal edilen toplam
            </Text>
          </AppCard>
          <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam</Text>
            <Text style={styles.statValue}>{String(counts.total)}</Text>
            <Text style={styles.statHint} numberOfLines={1}>
              Tüm toplantılar
            </Text>
          </AppCard>
        </View>

        <View style={styles.gridRow}>
          <AppCard style={styles.listCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle}>Yaklaşan Toplantılar</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  Bağlantılar, tarih ve müşteri bilgileri
                </Text>
              </View>
              <View style={styles.countPill}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text style={styles.countPillText}>{String(upcomingMeetings.length)} kayıt</Text>
              </View>
            </View>
            {upcomingMeetings.length === 0 ? (
              <Text style={styles.emptyText}>Henüz toplantı bulunmuyor. Sağ üstten yeni toplantı oluşturabilirsiniz.</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                {upcomingMeetings.map((m, idx) => {
                  const lead = leadById(m?.leadId);
                  const leadLabel = lead?.name || lead?.fullName || lead?.email || 'Müşteri';
                  const leadMeta = lead?.name && lead?.email ? lead.email : lead?.phone || '';
                  const at = m?.scheduledAt || m?.scheduled_at || m?.date;
                  const d = at ? new Date(at) : null;
                  const dateText = d && !Number.isNaN(d.getTime()) ? d.toLocaleString('tr-TR') : '-';
                  const pill = statusColors(m?.status, colors);
                  return (
                    <View key={String(m?.id ?? idx)} style={styles.meetingRow}>
                      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                        <View style={styles.meetingLine}>
                          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                          <Text style={styles.meetingDate} numberOfLines={1}>
                            {dateText}
                          </Text>
                        </View>
                        <View style={styles.meetingLine}>
                          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                          <Text style={styles.meetingLead} numberOfLines={1}>
                            {String(leadLabel)}
                          </Text>
                          {leadMeta ? (
                            <Text style={styles.meetingLeadMeta} numberOfLines={1}>
                              ({String(leadMeta)})
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.meetingMetaRow}>
                          <View style={styles.inlineMeta}>
                            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.inlineMetaText}>{String(m?.durationMinutes ?? settings?.meetingDuration ?? 30)} dk</Text>
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                            <Text style={[styles.statusText, { color: pill.fg }]} numberOfLines={1}>
                              {statusLabel(m?.status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {m?.meetingLink ? (
                        <TouchableOpacity style={styles.linkBtn} onPress={() => openLink(m.meetingLink)} activeOpacity={0.85}>
                          <Ionicons name="link-outline" size={18} color={colors.primary} />
                          <Text style={styles.linkText}>Bağlantı</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </AppCard>

          <AppCard style={styles.listCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle}>Sonlanan Toplantılar</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  Tarihi geçen veya tamamlanan toplantılar
                </Text>
              </View>
            </View>
            {pastMeetings.length === 0 ? (
              <Text style={styles.emptyText}>Henüz sonlanan toplantı bulunmuyor.</Text>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                {pastMeetings
                  .slice()
                  .sort((a, b) => new Date(b?.scheduledAt || b?.scheduled_at || b?.date || 0).getTime() - new Date(a?.scheduledAt || a?.scheduled_at || a?.date || 0).getTime())
                  .slice(0, 10)
                  .map((m, idx) => {
                    const lead = leadById(m?.leadId);
                    const leadLabel = lead?.name || lead?.fullName || lead?.email || 'Müşteri';
                    const leadMeta = lead?.name && lead?.email ? lead.email : lead?.phone || '';
                    const at = m?.scheduledAt || m?.scheduled_at || m?.date;
                    const d = at ? new Date(at) : null;
                    const dateText = d && !Number.isNaN(d.getTime()) ? d.toLocaleString('tr-TR') : '-';
                    const pill = statusColors(m?.status, colors);
                    return (
                      <View key={String(m?.id ?? idx)} style={[styles.meetingRow, { backgroundColor: colors.background }]}>
                        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                          <View style={styles.meetingLine}>
                            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.meetingDate} numberOfLines={1}>
                              {dateText}
                            </Text>
                          </View>
                          <View style={styles.meetingLine}>
                            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.meetingLead} numberOfLines={1}>
                              {String(leadLabel)}
                            </Text>
                            {leadMeta ? (
                              <Text style={styles.meetingLeadMeta} numberOfLines={1}>
                                ({String(leadMeta)})
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.statusText, { color: pill.fg }]} numberOfLines={1}>
                            {statusLabel(m?.status)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}
          </AppCard>
        </View>
      </ScrollView>

      <Modal visible={openSettings} transparent animationType="fade" onRequestClose={() => setOpenSettings(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenSettings(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Müsaitlik ve Takvim Ayarları</Text>
              <TouchableOpacity onPress={() => setOpenSettings(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalGrid}>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Zaman Dilimi</Text>
                  <View style={styles.inputIconRow}>
                    <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={styles.modalInput}
                      value={String(settings?.timezone || '')}
                      onChangeText={(v) => setSettings((prev) => ({ ...(prev || {}), timezone: v }))}
                      placeholder="Europe/Istanbul"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Toplantı Süresi (dk)</Text>
                  <TextInput
                    style={styles.modalInputSolo}
                    value={String(settings?.meetingDuration ?? 30)}
                    onChangeText={(v) =>
                      setSettings((prev) => ({ ...(prev || {}), meetingDuration: Number(v) ? Number(v) : 30 }))
                    }
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Toplantılar Arası Boşluk (dk)</Text>
                  <TextInput
                    style={styles.modalInputSolo}
                    value={String(settings?.bufferMinutes ?? 10)}
                    onChangeText={(v) =>
                      setSettings((prev) => ({ ...(prev || {}), bufferMinutes: Number(v) ? Number(v) : 10 }))
                    }
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={styles.modalSectionTitle}>Haftalık Müsaitlik</Text>
                <Text style={styles.modalHint}>
                  Her gün için en fazla iki zaman aralığı belirleyin. Boş bıraktığınız günler için randevu alınamaz.
                </Text>

                <View style={{ gap: 10 }}>
                  {DAYS.map((d) => {
                    const ranges = Array.isArray(settings?.availability?.[d.key]) ? settings.availability[d.key] : [];
                    const first = ranges[0] || { start: '', end: '' };
                    const second = ranges[1] || { start: '', end: '' };

                    const updateDay = (key, nextRanges) => {
                      const normalized = (Array.isArray(nextRanges) ? nextRanges : []).filter((r) => r?.start && r?.end);
                      setSettings((prev) => ({
                        ...(prev || {}),
                        availability: {
                          ...((prev || {}).availability || {}),
                          [key]: normalized,
                        },
                      }));
                    };

                    const clearDay = () => updateDay(d.key, []);

                    return (
                      <View key={d.key} style={styles.dayCard}>
                        <View style={styles.dayHeaderRow}>
                          <Text style={styles.dayTitle}>{d.label}</Text>
                          <TouchableOpacity onPress={clearDay} activeOpacity={0.85} style={styles.ghostBtn}>
                            <Text style={styles.ghostBtnText}>Temizle</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.dayGrid}>
                          <View style={styles.dayField}>
                            <Text style={styles.dayLabel}>Başlangıç</Text>
                            <TextInput
                              style={styles.modalInputSolo}
                              value={String(first.start || '')}
                              onChangeText={(v) => updateDay(d.key, [{ start: v, end: first.end }, ...(second.start || second.end ? [{ start: second.start, end: second.end }] : [])])}
                              placeholder="09:00"
                              placeholderTextColor={colors.textSecondary}
                              autoCapitalize="none"
                            />
                          </View>
                          <View style={styles.dayField}>
                            <Text style={styles.dayLabel}>Bitiş</Text>
                            <TextInput
                              style={styles.modalInputSolo}
                              value={String(first.end || '')}
                              onChangeText={(v) => updateDay(d.key, [{ start: first.start, end: v }, ...(second.start || second.end ? [{ start: second.start, end: second.end }] : [])])}
                              placeholder="12:00"
                              placeholderTextColor={colors.textSecondary}
                              autoCapitalize="none"
                            />
                          </View>
                          <View style={styles.dayField}>
                            <Text style={styles.dayLabel}>Başlangıç 2</Text>
                            <TextInput
                              style={styles.modalInputSolo}
                              value={String(second.start || '')}
                              onChangeText={(v) => updateDay(d.key, [...(first.start || first.end ? [{ start: first.start, end: first.end }] : []), { start: v, end: second.end }])}
                              placeholder="13:00"
                              placeholderTextColor={colors.textSecondary}
                              autoCapitalize="none"
                            />
                          </View>
                          <View style={styles.dayField}>
                            <Text style={styles.dayLabel}>Bitiş 2</Text>
                            <TextInput
                              style={styles.modalInputSolo}
                              value={String(second.end || '')}
                              onChangeText={(v) => updateDay(d.key, [...(first.start || first.end ? [{ start: first.start, end: first.end }] : []), { start: second.start, end: v }])}
                              placeholder="18:00"
                              placeholderTextColor={colors.textSecondary}
                              autoCapitalize="none"
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.outlineBtnWide} onPress={() => setOpenSettings(false)} activeOpacity={0.85}>
                <Text style={styles.outlineBtnWideText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtnWide}
                onPress={saveSettings}
                activeOpacity={0.85}
                disabled={savingSettings}
              >
                {savingSettings ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnWideText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={openBook} transparent animationType="fade" onRequestClose={() => setOpenBook(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenBook(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Toplantı Planla</Text>
              <TouchableOpacity onPress={() => setOpenBook(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalGrid}>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Lead</Text>
                  <TouchableOpacity style={styles.selectBtn} onPress={() => setOpenLeadPicker(true)} activeOpacity={0.85}>
                    <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.selectBtnText} numberOfLines={1}>
                      {selectedLeadLabel ? String(selectedLeadLabel) : 'Lead seçin'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Kaynak</Text>
                  <View style={styles.segmentRow}>
                    {SOURCE_OPTIONS.map((opt) => {
                      const active = String(booking?.source || 'calendar') === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.segmentBtn, active ? styles.segmentBtnActive : null]}
                          onPress={() => setBooking((prev) => ({ ...(prev || {}), source: opt.value }))}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]} numberOfLines={1}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.modalSectionTitle}>Tarih</Text>
                  <View style={styles.calendarNav}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.calendarMonthText}>
                      {grid.monthStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.calendarGrid}>
                  {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((w) => (
                    <Text key={w} style={styles.weekDay}>
                      {w}
                    </Text>
                  ))}
                  {grid.days.map((d) => {
                    const ds = toDateInputValue(d);
                    const inMonth = d.getMonth() === grid.monthStart.getMonth();
                    const isToday = sameDay(d, new Date());
                    const isSelected = selectedDateObj && sameDay(d, selectedDateObj);
                    const hasSlots = buildSlots(ds, settings).length > 0;
                    const disabled = !hasSlots;
                    return (
                      <TouchableOpacity
                        key={ds}
                        style={[
                          styles.dayCell,
                          inMonth ? styles.dayCellInMonth : styles.dayCellOutMonth,
                          isSelected ? styles.dayCellSelected : null,
                          disabled ? styles.dayCellDisabled : null,
                          isToday && !isSelected ? styles.dayCellToday : null,
                        ]}
                        onPress={() => {
                          if (disabled) return;
                          setDate(ds);
                          setSelectedSlot(null);
                        }}
                        activeOpacity={0.85}
                        disabled={disabled}
                      >
                        <Text style={[styles.dayCellText, isSelected ? styles.dayCellTextSelected : null]}>{String(d.getDate())}</Text>
                        {hasSlots ? <View style={[styles.slotDot, { backgroundColor: colors.success }]} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={styles.modalSectionTitle}>Müsait Saatler</Text>
                  {slots.length === 0 ? (
                    <Text style={styles.modalHint}>Seçili gün için uygun saat bulunmuyor.</Text>
                  ) : (
                    <View style={styles.slotsGrid}>
                      {slots.map((s) => {
                        const active = selectedSlot === s;
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.slotBtn, active ? styles.slotBtnActive : null]}
                            onPress={() => setSelectedSlot(s)}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="time-outline" size={14} color={active ? '#fff' : colors.textPrimary} />
                            <Text style={[styles.slotText, active ? styles.slotTextActive : null]}>{s}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  <Text style={styles.tzHint}>Zaman dilimi: {String(settings?.timezone || 'Europe/Istanbul')}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.outlineBtnWide} onPress={() => setOpenBook(false)} activeOpacity={0.85}>
                <Text style={styles.outlineBtnWideText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtnWide}
                onPress={bookMeeting}
                activeOpacity={0.85}
                disabled={!booking?.leadId || !date || !selectedSlot || bookingSaving}
              >
                {bookingSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnWideText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={openLeadPicker} transparent animationType="fade" onRequestClose={() => setOpenLeadPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenLeadPicker(false)} />
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lead Seç</Text>
              <TouchableOpacity onPress={() => setOpenLeadPicker(false)} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
              {(leads || []).map((l, idx) => {
                const leadId = String(l?.id ?? l?._id ?? '');
                const label = l?.name || l?.fullName || l?.email || 'Lead';
                const meta = l?.name && l?.email ? l.email : l?.phone || '';
                const active = String(booking?.leadId || '') === leadId;
                return (
                  <TouchableOpacity
                    key={leadId || String(idx)}
                    style={[styles.leadPickRow, active ? styles.leadPickRowActive : null]}
                    onPress={() => {
                      setBooking((prev) => ({ ...(prev || {}), leadId }));
                      setOpenLeadPicker(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.leadPickAvatar}>
                      <Text style={styles.leadPickAvatarText}>{String(label).charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.leadPickTitle} numberOfLines={1}>
                        {String(label)}
                      </Text>
                      {meta ? (
                        <Text style={styles.leadPickMeta} numberOfLines={1}>
                          {String(meta)}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    outlineBtnText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { flexGrow: 1, flexBasis: '47%', gap: 6, borderWidth: 1 },
    statLabel: { fontSize: 11, fontWeight: '900' },
    statValue: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
    statHint: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, opacity: 0.9 },
    gridRow: { gap: 12 },
    listCard: { gap: 10 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    cardSubtitle: { marginTop: 4, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    countPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.success + '14',
      borderWidth: 1,
      borderColor: colors.success + '22',
    },
    countPillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    emptyText: { marginTop: 12, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    meetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    meetingLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    meetingDate: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    meetingLead: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
    meetingLeadMeta: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    meetingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    inlineMetaText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: '900' },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '22' },
    linkText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    appointmentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    appointmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    appointmentIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    appointmentTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    appointmentMeta: { marginTop: 2, color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    urlPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    urlText: { flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    appointmentActions: { alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingTop: 2 },
    iconPillBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: '#00000088' },
    modalWrap: { flex: 1, justifyContent: 'center', padding: 14 },
    modalCard: { maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', flex: 1, minWidth: 0 },
    modalGrid: { gap: 12 },
    modalGridTwo: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    modalField: { gap: 8 },
    modalLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    modalInput: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '800', paddingVertical: 10 },
    modalInputSolo: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    inputIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
    },
    modalSectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '900' },
    modalHint: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    dayCard: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10, gap: 10 },
    dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    dayTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    ghostBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    ghostBtnText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    dayField: { flexBasis: '47%', flexGrow: 1, gap: 6 },
    dayLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    modalFooter: { flexDirection: 'row', gap: 10 },
    outlineBtnWide: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    outlineBtnWideText: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    primaryBtnWide: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    primaryBtnWideText: { color: '#fff', fontSize: 13, fontWeight: '900' },
    selectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    selectBtnText: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
    segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    segmentBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, flexGrow: 1, flexBasis: '48%' },
    segmentBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentText: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },
    segmentTextActive: { color: '#fff' },
    segmentBtnSmall: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      flexGrow: 1,
      flexBasis: '48%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentBtnSmallActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentTextSmall: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },
    segmentTextSmallActive: { color: '#fff' },
    segmentRowOneLine: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    segmentPill: {
      flexGrow: 1,
      flexBasis: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    segmentPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentPillText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    segmentPillTextActive: { color: '#fff' },
    linkInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 13,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      minHeight: 140,
      textAlignVertical: 'top',
    },
    ghostLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ghostLinkText: { color: colors.textSecondary, fontSize: 12, fontWeight: '900' },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    calendarNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    calendarMonthText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    weekDay: { width: '13.2%', textAlign: 'center', color: colors.textSecondary, fontSize: 10, fontWeight: '900' },
    dayCell: { width: '13.2%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
    dayCellInMonth: { backgroundColor: colors.background, borderColor: colors.border },
    dayCellOutMonth: { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.8 },
    dayCellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayCellDisabled: { opacity: 0.5 },
    dayCellToday: { borderColor: colors.primary + '66' },
    dayCellText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    dayCellTextSelected: { color: '#fff' },
    slotDot: { width: 6, height: 6, borderRadius: 999 },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, minWidth: 92 },
    slotBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    slotText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    slotTextActive: { color: '#fff' },
    tzHint: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    leadPickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 10 },
    leadPickRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '14' },
    leadPickAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.secondary + '14', borderWidth: 1, borderColor: colors.secondary + '22', alignItems: 'center', justifyContent: 'center' },
    leadPickAvatarText: { color: colors.secondary, fontSize: 14, fontWeight: '900' },
    leadPickTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    leadPickMeta: { marginTop: 3, color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  });
}

export default MeetingsScreen;
