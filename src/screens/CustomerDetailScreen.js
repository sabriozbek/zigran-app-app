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
import { contactsService } from '../api/services/contactsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function safeString(v) {
  return String(v ?? '').trim();
}

export default function CustomerDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = route?.params?.customer ?? route?.params?.contact ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;

  const [loading, setLoading] = useState(Boolean(id) && !initial);
  const [customer, setCustomer] = useState(initial);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      const res = await contactsService.getOne(id);
      setCustomer(res);
    } catch {
      setCustomer(null);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id || initial) return undefined;
    (async () => {
      try {
        await fetchCustomer();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCustomer, id, initial]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchCustomer);
    return unsub;
  }, [fetchCustomer, navigation]);

  const displayName = useMemo(() => {
    const full = safeString(customer?.name) || [customer?.firstName, customer?.lastName].filter(Boolean).map(String).join(' ').trim();
    return full || safeString(customer?.email) || 'Kişi';
  }, [customer?.email, customer?.firstName, customer?.lastName, customer?.name]);

  useEffect(() => {
    navigation.setOptions({ title: displayName || 'Kişi' });
  }, [displayName, navigation]);

  const company = safeString(customer?.company ?? customer?.companyName);
  const title = safeString(customer?.title ?? customer?.jobTitle);
  const email = safeString(customer?.email);
  const phone = safeString(customer?.phone);

  const initials = useMemo(() => {
    const n = safeString(displayName);
    if (!n) return 'K';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [displayName]);

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

  const handleEmail = useCallback(async () => {
    if (!email) return;
    const url = `mailto:${email}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return;
      await Linking.openURL(url);
    } catch {
    }
  }, [email]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    navigation.navigate('AddCustomer', { id, customer });
  }, [customer, id, navigation]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Sil', 'Bu kişiyi silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await contactsService.delete(id);
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

  if (!customer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="person-outline" size={44} color={colors.border} />
          <Text style={styles.emptyTitle}>Kişi bulunamadı</Text>
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {displayName}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {title || company ? [title, company].filter(Boolean).join(' • ') : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleEdit} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.secondaryText}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.danger || '#ef4444' }]}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
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
            <TouchableOpacity
              style={[styles.primaryBtnAlt, !email && { opacity: 0.5 }]}
              onPress={handleEmail}
              activeOpacity={0.85}
              disabled={!email}
            >
              <Ionicons name="mail" size={18} color={colors.primary} />
              <Text style={styles.primaryAltText}>Mail</Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>İletişim</Text>
          {email ? (
            <View style={styles.kvRow}>
              <Text style={styles.k}>E-posta</Text>
              <Text style={styles.v} numberOfLines={1}>
                {email}
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
          {!email && !phone ? <Text style={styles.muted}>İletişim bilgisi yok.</Text> : null}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Bilgiler</Text>
          <View style={styles.kvRow}>
            <Text style={styles.k}>Firma</Text>
            <Text style={styles.v} numberOfLines={2}>
              {company || '—'}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.k}>Ünvan</Text>
            <Text style={styles.v} numberOfLines={2}>
              {title || '—'}
            </Text>
          </View>
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
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
    heroTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    heroSubtitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4 },
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
      minWidth: 98,
    },
    primaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
    primaryBtnAlt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minWidth: 98,
    },
    primaryAltText: { color: colors.primary, fontWeight: '900', fontSize: 13 },
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
    muted: { color: colors.textSecondary, fontWeight: '700' },
    emptyTitle: { color: colors.textSecondary, fontWeight: '800' },
  });
}

