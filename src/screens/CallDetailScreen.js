import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callsService } from '../api/services/callsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function safeString(v) {
  return String(v ?? '').trim();
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return String(value);
  }
}

export default function CallDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = route?.params?.call ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;

  const [loading, setLoading] = useState(Boolean(id) && !initial);
  const [call, setCall] = useState(initial);

  const fetchCall = useCallback(async () => {
    if (!id) return;
    try {
      const res = await callsService.get(id);
      setCall(res);
    } catch {
      setCall(null);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id || initial) return undefined;
    (async () => {
      try {
        await fetchCall();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCall, id, initial]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchCall);
    return unsub;
  }, [fetchCall, navigation]);

  useEffect(() => {
    const title = safeString(call?.subject) || 'Arama Detayı';
    navigation.setOptions({ title });
  }, [call?.subject, navigation]);

  const subject = safeString(call?.subject) || 'Arama';
  const status = safeString(call?.status ?? call?.state) || 'planned';
  const contact = safeString(call?.contactName ?? call?.contact_name) || 'Bilinmeyen Kişi';
  const company = safeString(call?.companyName ?? call?.company_name);
  const phone = safeString(call?.phone);
  const duration = call?.duration === undefined || call?.duration === null ? '' : `${String(call.duration)} sn`;
  const description = safeString(call?.description);
  const createdAt = formatDate(call?.createdAt ?? call?.created_at ?? call?.date);

  const statusConf = useMemo(() => {
    if (status === 'completed') return { label: 'Tamamlandı', fg: colors.success, bg: colors.success + '14', border: colors.success + '2A', icon: 'checkmark-circle' };
    if (status === 'missed') return { label: 'Cevapsız', fg: colors.danger || '#ef4444', bg: (colors.danger || '#ef4444') + '14', border: (colors.danger || '#ef4444') + '2A', icon: 'close-circle' };
    return { label: 'Planlı', fg: colors.primary, bg: colors.primary + '14', border: colors.primary + '2A', icon: 'calendar' };
  }, [colors.danger, colors.primary, colors.success, status]);

  const handleCall = useCallback(async () => {
    if (!phone) return;
    const url = `tel:${phone}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return;
      await Linking.openURL(url);
    } catch {
    }
  }, [phone]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    navigation.navigate('AddCall', { id, call });
  }, [call, id, navigation]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Sil', 'Bu arama kaydını silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await callsService.delete(id);
            if (navigation.canGoBack()) navigation.goBack();
          } catch {
            Alert.alert('Hata', 'Silme işlemi başarısız.');
          }
        },
      },
    ]);
  }, [id, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!call) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="call-outline" size={44} color={colors.border} />
          <Text style={styles.emptyTitle}>Arama bulunamadı</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: statusConf.bg, borderColor: statusConf.border }]}>
              <Ionicons name={statusConf.icon} size={18} color={statusConf.fg} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {subject}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={1}>
                {contact}
                {company ? ` • ${company}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={[styles.pill, { backgroundColor: statusConf.bg, borderColor: statusConf.border }]}>
              <Text style={[styles.pillText, { color: statusConf.fg }]}>{statusConf.label}</Text>
            </View>
            {duration ? (
              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>{duration}</Text>
              </View>
            ) : null}
            {createdAt ? (
              <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>{createdAt}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleEdit} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.secondaryText}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.danger || '#ef4444' }]} onPress={handleDelete} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color={colors.danger || '#ef4444'} />
              <Text style={[styles.secondaryText, { color: colors.danger || '#ef4444' }]}>Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, !phone && { opacity: 0.5 }]}
              onPress={handleCall}
              activeOpacity={0.85}
              disabled={!phone}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.primaryText}>Ara</Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Detaylar</Text>
          <View style={styles.kvRow}>
            <Text style={styles.k}>Kişi</Text>
            <Text style={styles.v} numberOfLines={2}>
              {contact}
            </Text>
          </View>
          {company ? (
            <View style={styles.kvRow}>
              <Text style={styles.k}>Firma</Text>
              <Text style={styles.v} numberOfLines={2}>
                {company}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.kvRow}>
              <Text style={styles.k}>Telefon</Text>
              <Text style={styles.v} numberOfLines={1}>
                {phone}
              </Text>
            </View>
          ) : null}
          <View style={styles.kvRow}>
            <Text style={styles.k}>Durum</Text>
            <Text style={styles.v} numberOfLines={1}>
              {statusConf.label}
            </Text>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Not</Text>
          <Text style={styles.noteText}>{description || '—'}</Text>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    content: { padding: 16, paddingBottom: 24, gap: 12 },
    hero: { padding: 16, gap: 14 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    heroSubtitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4 },
    heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    pillText: { fontSize: 11, fontWeight: '900' },
    heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minWidth: 110,
    },
    primaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minWidth: 110,
    },
    secondaryText: { color: colors.textPrimary, fontWeight: '900', fontSize: 13 },
    card: { padding: 16 },
    sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', marginBottom: 8 },
    kvRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
    k: { color: colors.textSecondary, fontSize: 12, fontWeight: '900' },
    v: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    noteText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', lineHeight: 19 },
    emptyTitle: { color: colors.textSecondary, fontWeight: '800' },
  });
}

