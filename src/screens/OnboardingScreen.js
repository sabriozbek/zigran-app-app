import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../theme/ThemeContext';

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

const ONBOARDING_KEY = 'zigran_onboarding_done';

const SLIDES = [
  {
    key: 'welcome',
    icon: 'sparkles-outline',
    title: 'Zigran CRM',
    subtitle: 'Satış ve pazarlama süreçlerini tek yerden yönet.',
    bullets: ['Lead yakala ve niteliklendir', 'Pipeline ile aşama aşama ilerlet', 'Ekibinle görev ve aktiviteyi takip et'],
  },
  {
    key: 'leads',
    icon: 'funnel-outline',
    title: 'Lead & Pipeline',
    subtitle: 'Lead skorunu, aşamasını ve tahmini değerini anında güncelle.',
    bullets: ['Aşama değiştir, geçmişi gör', 'Arama ve aktivite kayıtlarını incele', 'Etiketlerle segment oluştur'],
  },
  {
    key: 'tracking',
    icon: 'link-outline',
    title: 'Kaynak & UTM Takibi',
    subtitle: 'Lead’in nereden geldiğini net gör: form, kampanya, landing sayfa.',
    bullets: ['UTM / GCLID / FBCLID alanları', 'Landing ve referrer linkleri', 'Form verilerini tek ekranda'],
  },
  {
    key: 'activity',
    icon: 'pulse-outline',
    title: 'Aktivite & Bildirim',
    subtitle: 'Ekip hareketlerini ve önemli bildirimleri kaçırma.',
    bullets: ['Okunmamış bildirim sayacı', 'Son aktiviteler listesi', 'Hızlı aksiyonlarla ilerle'],
  },
  {
    key: 'grow',
    icon: 'trending-up-outline',
    title: 'Daha Hızlı Büyü',
    subtitle: 'Zaman kazandıran akışlarla daha fazla satışa odaklan.',
    bullets: ['Kampanya entegrasyonları', 'Dönüşüm takibi', 'Rapor ve içgörü ile karar ver'],
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OnboardingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const lastIndex = SLIDES.length - 1;
  const isLast = index === lastIndex;

  const goTo = useCallback((nextIndex) => {
    const target = Math.max(0, Math.min(lastIndex, nextIndex));
    scrollerRef.current?.scrollTo({ x: target * SCREEN_WIDTH, y: 0, animated: true });
    setIndex(target);
  }, [lastIndex]);

  const finish = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    } catch {}
    navigation.replace('Startup');
  }, [navigation]);

  const onPrimaryPress = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    goTo(index + 1);
  }, [finish, goTo, index, isLast]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandPill}>
          <Text style={styles.brandText}>Zigran</Text>
        </View>
        <TouchableOpacity onPress={finish} activeOpacity={0.8} style={styles.skipBtn}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setIndex(Math.max(0, Math.min(lastIndex, next)));
        }}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s) => (
          <View key={s.key} style={styles.slide}>
            <View style={styles.iconWrap}>
              <Ionicons name={safeIoniconName(s.icon, 'sparkles-outline')} size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.subtitle}>{s.subtitle}</Text>
            {Array.isArray(s.bullets) && s.bullets.length > 0 ? (
              <View style={styles.bullets}>
                {s.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onPrimaryPress} activeOpacity={0.85}>
          <Text style={styles.primaryText}>{isLast ? 'Başla' : 'Devam'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topRow: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brandPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    brandText: {
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 13,
      letterSpacing: 0.2,
    },
    skipBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipText: {
      color: colors.textSecondary,
      fontWeight: '900',
      fontSize: 12,
    },
    slide: {
      width: SCREEN_WIDTH,
      paddingHorizontal: 22,
      paddingTop: 30,
      paddingBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 28,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginTop: 10,
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      maxWidth: 320,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 20,
    },
    bullets: {
      width: Math.min(340, SCREEN_WIDTH - 44),
      gap: 10,
      marginTop: 6,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    bulletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    bulletText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    bottom: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 14,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 15,
    },
  });
}

export default OnboardingScreen;
