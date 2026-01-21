import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { authService } from '../api/authService';
import AppCard from '../components/AppCard';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const PACKAGE_LEVELS = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export default function ModulesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authService.me();
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const company = me?.company ?? me?.tenant ?? me?.organization ?? null;
  const user = me?.user ?? me?.profile ?? me?.data ?? me ?? null;
  const trialEndsAtRaw = company?.trialEndsAt ?? company?.trial_ends_at ?? company?.trialEndAt ?? null;
  const planRaw = company?.plan ?? company?.package ?? company?.subscription ?? 'free';
  const planId = String(planRaw?.id ?? planRaw?.name ?? planRaw ?? 'free')
    .trim()
    .toLowerCase();
  const trialActive = trialEndsAtRaw ? new Date(trialEndsAtRaw) > new Date() : false;
  const userPlan =
    trialActive && planId === 'free' ? 'pro' : ['free', 'starter', 'pro', 'enterprise'].includes(planId) ? planId : 'free';
  const userLevel = PACKAGE_LEVELS[userPlan] ?? 0;
  const companyName = company?.name || company?.companyName || '';

  const modules = useMemo(
    () => [
      {
        id: 'crm',
        title: 'CRM (Lead & Kişiler)',
        description: 'Müşteri ilişkilerinizi yönetin. Lead takibi ve satış süreci.',
        icon: 'people-outline',
        status: 'active',
        route: 'Leads',
        requiredPackage: 'free',
      },
      {
        id: 'forms',
        title: 'Form Oluşturucu',
        description: 'Sürükle-bırak editör ile lead toplama formları oluşturun.',
        icon: 'document-text-outline',
        status: 'active',
        route: 'Forms',
        requiredPackage: 'starter',
      },
      {
        id: 'email',
        title: 'E-Posta Pazarlama',
        description: 'E-posta kampanyaları oluşturun ve performansı analiz edin.',
        icon: 'mail-outline',
        status: 'active',
        route: 'Email',
        requiredPackage: 'starter',
      },
      {
        id: 'sms',
        title: 'SMS Gönderimi',
        description: 'Toplu SMS gönderin ve teslimat raporlarını inceleyin.',
        icon: 'chatbox-ellipses-outline',
        status: 'active',
        route: 'Sms',
        requiredPackage: 'starter',
      },
      {
        id: 'ads',
        title: 'Reklam Yönetimi',
        description: 'Google, Meta ve LinkedIn reklamlarınızı tek yerden yönetin.',
        icon: 'megaphone-outline',
        status: 'active',
        route: 'AdsAccounts',
        requiredPackage: 'pro',
      },
      {
        id: 'segments',
        title: 'Segmentasyon',
        description: 'Müşterileri davranışlarına göre akıllı segmentlere ayırın.',
        icon: 'layers-outline',
        status: 'active',
        route: 'Segments',
        requiredPackage: 'pro',
      },
      {
        id: 'automation',
        title: 'Otomasyon',
        description: 'Tetikleyiciler ve aksiyonlar ile iş akışlarını hızlandırın.',
        icon: 'shuffle-outline',
        status: 'active',
        route: 'Automations',
        requiredPackage: 'pro',
      },
      {
        id: 'analytics',
        title: 'Gelişmiş Analitik',
        description: 'Özelleştirilebilir raporlar ve gerçek zamanlı metrikler.',
        icon: 'bar-chart-outline',
        status: 'active',
        route: 'Analytics',
        requiredPackage: 'pro',
      },
      {
        id: 'appointments',
        title: 'Randevular',
        description: 'Randevuları planlayın ve takvim entegrasyonu yapın.',
        icon: 'calendar-outline',
        status: 'active',
        route: 'Booking',
        requiredPackage: 'enterprise',
      },
      {
        id: 'calls',
        title: 'Aramalar',
        description: 'Aramaları yönetin ve çağrı raporlarını inceleyin.',
        icon: 'call-outline',
        status: 'active',
        route: 'Calls',
        requiredPackage: 'enterprise',
      },
    ],
    [],
  );

  const openModule = useCallback(
    (m) => {
      const reqLevel = PACKAGE_LEVELS[m.requiredPackage] ?? 0;
      const allowedByPlan = userLevel >= reqLevel;
      const allowedByStatus = m.status === 'active';
      if (allowedByPlan && allowedByStatus) {
        navigation.navigate(m.route);
        return;
      }
      setSelected(m);
    },
    [navigation, userLevel],
  );

  const badgeFor = useCallback(
    (m) => {
      if (m.status === 'coming_soon') return { label: 'Yakında', color: colors.textSecondary };
      const reqLevel = PACKAGE_LEVELS[m.requiredPackage] ?? 0;
      if (userLevel < reqLevel) return { label: 'Kilitli', color: colors.warning };
      return { label: 'Aktif', color: colors.success };
    },
    [colors.success, colors.textSecondary, colors.warning, userLevel],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.h1}>Modüller</Text>
        <Text style={styles.h2} numberOfLines={2}>
          {companyName ? `${companyName} • ${String(user?.email || '')}` : String(user?.email || 'Modül kataloğu')}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {modules.map((m) => {
            const badge = badgeFor(m);
            return (
              <AppCard key={m.id} onPress={() => openModule(m)} style={styles.card} accessibilityLabel={m.title}>
                <View style={styles.cardTopRow}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={safeIoniconName(m.icon, 'cube-outline')} size={18} color={colors.primary} />
                  </View>
                  <View style={[styles.badge, { borderColor: badge.color + '33', backgroundColor: badge.color + '12' }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {m.description}
                </Text>
                <View style={styles.cardFooterRow}>
                  <View style={styles.planPill}>
                    <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.planText}>{String(m.requiredPackage).toUpperCase()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </AppCard>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{selected?.title || 'Modül'}</Text>
          <Text style={styles.modalDesc}>{selected?.description || ''}</Text>
          <View style={styles.modalInfoRow}>
            <View style={styles.modalPill}>
              <Text style={styles.modalPillText}>Paket: {String(selected?.requiredPackage || '').toUpperCase()}</Text>
            </View>
            <View style={styles.modalPill}>
              <Text style={styles.modalPillText}>Plan: {String(userPlan).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setSelected(null)} activeOpacity={0.85}>
              <Text style={styles.modalGhostText}>Kapat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setSelected(null);
                navigation.navigate('Packages');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalPrimaryText}>Paketleri Gör</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    top: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
    },
    h1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
    },
    h2: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    grid: {
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 12,
    },
    card: {
      padding: 14,
      gap: 10,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '900',
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    planPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    planText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      marginTop: 'auto',
      margin: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    modalDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    modalInfoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    modalPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalPillText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: '900',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 6,
    },
    modalGhostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalGhostText: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    modalPrimaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    modalPrimaryText: {
      color: '#fff',
      fontWeight: '900',
    },
  });
}
