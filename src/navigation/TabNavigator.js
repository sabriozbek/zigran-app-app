import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import DashboardScreen from '../screens/DashboardScreen';
import CustomersScreen from '../screens/CustomersScreen';
import TasksScreen from '../screens/TasksScreen';
import LeadsScreen from '../screens/LeadsScreen';
import FormsScreen from '../screens/FormsScreen';
import ConversionsScreen from '../screens/ConversionsScreen';
import AdsAccountsScreen from '../screens/AdsAccountsScreen';
import PackagesScreen from '../screens/PackagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CompanyScreen from '../screens/CompanyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import ModulesScreen from '../screens/ModulesScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';
import LeadUpsertScreen from '../screens/LeadUpsertScreen';
import SegmentsScreen from '../screens/SegmentsScreen';
import AccountsScreen from '../screens/AccountsScreen';
import PipelinesScreen from '../screens/PipelinesScreen';
import CallsScreen from '../screens/CallsScreen';
import ForecastsScreen from '../screens/ForecastsScreen';
import CallDetailScreen from '../screens/CallDetailScreen';
import AddCallScreen from '../screens/AddCallScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import MeetingsScreen from '../screens/MeetingsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ProductsScreen from '../screens/ProductsScreen';
import PriceListsScreen from '../screens/PriceListsScreen';
import OffersScreen from '../screens/OffersScreen';
import EmailScreen from '../screens/EmailScreen';
import SmsScreen from '../screens/SmsScreen';
import SurveysScreen from '../screens/SurveysScreen';
import AutomationsScreen from '../screens/AutomationsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import IntegrationsScreen from '../screens/IntegrationsScreen';
import TicketsScreen from '../screens/TicketsScreen';
import { authService } from '../api/authService';
import apiClient from '../api/client';
import { activityService } from '../api/services/activityService';
import { useTheme } from '../theme/ThemeContext';

const Stack = createNativeStackNavigator();

const LOGO_SOURCE = require('../../assets/adaptive-icon.png');

function safeIoniconName(name, fallback) {
  const n = String(name || '');
  if (n && Ionicons?.glyphMap && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, n)) return n;
  if (n === 'arrow-up-right') return 'open-outline';
  return fallback;
}

function getActiveRouteNameFromState(state) {
  if (!state || !Array.isArray(state.routes) || state.routes.length === 0) return null;
  const idx = typeof state.index === 'number' ? state.index : 0;
  const route = state.routes[idx] || state.routes[0];
  if (route?.state) return getActiveRouteNameFromState(route.state);
  return route?.name ? String(route.name) : null;
}

const TabNavigator = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const parentState = useNavigationState((s) => s);
  const [activeRouteName, setActiveRouteName] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [me, setMe] = useState(null);
  const [toast, setToast] = useState(null);
  const menuWidth = useMemo(() => Math.min(320, Math.round(Dimensions.get('window').width * 0.82)), []);
  const translateX = useRef(new Animated.Value(-menuWidth)).current;
  const [openGroups, setOpenGroups] = useState([]);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('');
  const [avatarHeaders, setAvatarHeaders] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authService.me();
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: menuOpen ? 0 : -menuWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuWidth, translateX]);

  useEffect(() => {
    let cancelled = false;
    if (!menuOpen) return undefined;

    (async () => {
      try {
        const res = await authService.me();
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  useEffect(() => {
    const nextToast = route?.params?.toast;
    if (!nextToast || typeof nextToast !== 'object') return;
    if (!nextToast.message) return;

    setToast({ type: nextToast.type || 'success', message: String(nextToast.message) });
    navigation.setParams({ toast: undefined });
  }, [navigation, route?.params?.toast]);

  useEffect(() => {
    if (!toast) return;
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [toast, toastAnim]);

  const refreshNotificationsCount = useCallback(async () => {
    const res = await activityService.list({ limit: 50 });
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
          ? res.items
          : [];
    const hasReadFlags = list.some((a) => typeof a?.isRead === 'boolean' || typeof a?.read === 'boolean');
    return hasReadFlags ? list.filter((a) => a?.isRead === false || a?.read === false).length : list.length;
  }, []);

  useEffect(() => {
    const updateActive = () => {
      const selfRoute =
        (parentState?.routes || []).find((r) => r?.key === route?.key) ||
        (parentState?.routes || []).find((r) => r?.name === 'Main') ||
        null;
      const nested = selfRoute?.state || route?.state || null;
      const name = getActiveRouteNameFromState(nested) || 'Dashboard';
      setActiveRouteName(name);
    };

    updateActive();
    const unsubscribe = navigation.addListener('state', updateActive);
    return unsubscribe;
  }, [navigation, parentState?.routes, route?.key, route?.state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const count = await refreshNotificationsCount();
        if (!cancelled) setNotificationsCount(count);
      } catch {
        if (!cancelled) setNotificationsCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRouteName, refreshNotificationsCount]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshNotificationsCount()
        .then((count) => setNotificationsCount(count))
        .catch(() => setNotificationsCount(0));
    });
    return unsubscribe;
  }, [navigation, refreshNotificationsCount]);

  const sidebarGroups = useMemo(
    () => [
      {
        label: 'Genel',
        items: [
          { key: 'dashboard', label: 'Kontrol Paneli', icon: 'grid-outline', route: 'Dashboard' },
          { key: 'modules', label: 'Modüller', icon: 'cube-outline', route: 'Modules' },
        ],
      },
      {
        label: 'Pazarlama',
        items: [
          { key: 'campaigns', label: 'Kampanyalar', icon: 'megaphone-outline', route: 'Campaigns' },
          { key: 'conversions', label: 'Dönüşümler', icon: 'trending-up-outline', route: 'Conversions' },
          { key: 'email', label: 'E-Posta', icon: 'mail-outline', route: 'Email' },
          { key: 'sms', label: 'SMS', icon: 'chatbox-outline', route: 'Sms' },
          { key: 'surveys', label: 'Anketler', icon: 'clipboard-outline', route: 'Surveys' },
          { key: 'automations', label: 'Otomasyonlar', icon: 'flash-outline', route: 'Automations' },
          { key: 'segments', label: 'Segmentasyon', icon: 'layers-outline', route: 'Segments' },
          { key: 'analytics', label: 'Analitik', icon: 'bar-chart-outline', route: 'Analytics' },
          { key: 'integrations', label: 'Entegrasyonlar', icon: 'link-outline', route: 'Integrations' },
        ],
      },
      {
        label: 'Satışlar',
        items: [
          { key: 'leads', label: 'Leadler', icon: 'funnel-outline', route: 'Leads' },
          { key: 'contacts', label: 'Kişiler', icon: 'people-outline', route: 'Customers' },
          { key: 'accounts', label: 'Firmalar', icon: 'business-outline', route: 'Accounts' },
          { key: 'pipelines', label: 'Satış Fırsatları', icon: 'swap-horizontal-outline', route: 'Pipelines' },
          { key: 'calls', label: 'Aramalar', icon: 'call-outline', route: 'Calls' },
          { key: 'forecasts', label: 'Öngörüler', icon: 'stats-chart-outline', route: 'Forecasts' },
          { key: 'documents', label: 'Belgeler', icon: 'folder-open-outline', route: 'Documents' },
        ],
      },
      {
        label: 'Aktiviteler',
        items: [
          { key: 'tasks', label: 'Görevler', icon: 'checkbox-outline', route: 'Tasks' },
          { key: 'meetings', label: 'Toplantılar', icon: 'calendar-outline', route: 'Meetings' },
          { key: 'booking', label: 'Randevular', icon: 'time-outline', route: 'Booking' },
        ],
      },
      {
        label: 'Envanter',
        items: [
          { key: 'products', label: 'Ürünler', icon: 'pricetag-outline', route: 'Products' },
          { key: 'priceLists', label: 'Fiyat Listeleri', icon: 'pricetags-outline', route: 'PriceLists' },
          { key: 'offers', label: 'Teklifler', icon: 'document-text-outline', route: 'Offers' },
        ],
      },
      {
        label: 'Diğer',
        items: [
          { key: 'forms', label: 'Formlar', icon: 'document-text-outline', route: 'Forms' },
          { key: 'company', label: 'Şirketim', icon: 'business-outline', route: 'Company' },
          { key: 'settings', label: 'Ayarlar', icon: 'settings-outline', route: 'Settings' },
        ],
      },
      {
        label: 'Destek',
        items: [{ key: 'tickets', label: 'Destek Talepleri', icon: 'help-buoy-outline', route: 'Tickets' }],
      },
    ],
    [],
  );

  useEffect(() => {
    const activeGroup = sidebarGroups.find((g) => (g?.items || []).some((i) => i?.route === activeRouteName));
    if (!activeGroup?.label) return;
    setOpenGroups((prev) => (prev.includes(activeGroup.label) ? prev : [...prev, activeGroup.label]));
  }, [activeRouteName, sidebarGroups]);

  const toggleGroup = useCallback((label) => {
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]));
  }, []);

  const handleNavigate = (routeName, params) => {
    setMenuOpen(false);
    if (routeName === 'Notifications') {
      navigation.navigate('Notifications');
      return;
    }
    navigation.navigate('Main', { screen: routeName, params });
    setActiveRouteName(routeName);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await authService.logout();
    } catch {}
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const user = me?.user ?? me?.profile ?? me?.data?.user ?? me?.data?.profile ?? me?.data ?? me ?? null;

  const pickValue = (...values) => {
    for (const v of values) {
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      if (v && typeof v === 'object') {
        const maybe = v.value ?? v.email ?? v.mail;
        if (typeof maybe === 'string' && maybe.trim()) return maybe.trim();
      }
    }
    return '';
  };

  const normalizeEmail = (value) => {
    const s = pickValue(value);
    if (!s) return '';
    const cleaned = s.replace(/\s+/g, '').trim();
    return cleaned.includes('@') ? cleaned : cleaned;
  };

  const isEmailLike = (value) => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (!s) return false;
    if (!s.includes('@')) return false;
    return true;
  };

  const extractUrl = (value) => {
    if (!value) return '';

    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const u = extractUrl(item);
        if (u) return u;
      }
      return '';
    }

    if (typeof value !== 'object') return '';

    const direct =
      value.uri ??
      value.url ??
      value.src ??
      value.href ??
      value.path ??
      value.location ??
      value.downloadUrl ??
      value.download_url ??
      value.publicUrl ??
      value.public_url ??
      value.id ??
      value.uuid ??
      value.documentId ??
      value.document_id;

    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);

    const nestedCandidates = [
      value.data,
      value.attributes,
      value.file,
      value.image,
      value.avatar,
      value.photo,
      value.picture,
      value.profilePhoto,
      value.profile_photo,
    ];

    for (const candidate of nestedCandidates) {
      const u = extractUrl(candidate);
      if (u) return u;
    }

    const keys = Object.keys(value);
    for (const k of keys) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const u = extractUrl(value[k]);
      if (u) return u;
    }

    return '';
  };

  const userEmail = normalizeEmail(
    user?.email ??
      user?.mail ??
      me?.email ??
      me?.mail ??
      user?.emails?.[0]?.value ??
      user?.emails?.[0] ??
      me?.emails?.[0]?.value ??
      me?.emails?.[0],
  );

  const firstName = pickValue(
    user?.firstName,
    user?.first_name,
    user?.givenName,
    user?.given_name,
    user?.profile?.firstName,
    user?.profile?.first_name,
    me?.firstName,
    me?.first_name,
  );
  const lastName = pickValue(
    user?.lastName,
    user?.last_name,
    user?.familyName,
    user?.family_name,
    user?.profile?.lastName,
    user?.profile?.last_name,
    me?.lastName,
    me?.last_name,
  );
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const emailLocalPart = userEmail ? String(userEmail).split('@')[0] : '';
  const rawName = pickValue(
    user?.fullName,
    user?.full_name,
    user?.displayName,
    user?.display_name,
    user?.name,
    user?.username,
    user?.userName,
    user?.profile?.fullName,
    user?.profile?.full_name,
    user?.profile?.name,
    me?.fullName,
    me?.full_name,
    me?.name,
  );

  let userName = fullName || rawName || (emailLocalPart ? emailLocalPart : '') || 'Hesap';
  if (isEmailLike(userName)) userName = emailLocalPart || 'Hesap';

  let displayEmail = userEmail;
  if (displayEmail && userName && String(userName).toLowerCase() === String(displayEmail).toLowerCase()) displayEmail = '';
  const company =
    me?.company ?? me?.tenant ?? me?.organization ?? me?.data?.company ?? me?.data?.tenant ?? me?.data?.organization ?? null;
  const companyName = company?.name || company?.companyName || '';
  const avatarUrlRaw =
    user?.photoUrl ??
    user?.photo_url ??
    user?.avatarUrl ??
    user?.avatar_url ??
    user?.avatarId ??
    user?.avatar_id ??
    user?.avatar ??
    user?.picture ??
    user?.photoURL ??
    user?.photo ??
    user?.imageUrl ??
    user?.image_url ??
    user?.profilePhotoUrl ??
    user?.profile_photo_url ??
    user?.profilePhotoId ??
    user?.profile_photo_id ??
    user?.profilePhotoDocumentId ??
    user?.profile_photo_document_id ??
    user?.profilePhoto ??
    user?.profile_photo ??
    user?.profile?.photoUrl ??
    user?.profile?.photo_url ??
    user?.profile?.avatarUrl ??
    user?.profile?.avatar_url ??
    user?.profile?.avatarId ??
    user?.profile?.avatar_id ??
    user?.profile?.avatar ??
    user?.profile?.picture ??
    me?.photoUrl ??
    me?.photo_url ??
    me?.avatarUrl ??
    me?.avatar_url ??
    me?.avatarId ??
    me?.avatar_id ??
    me?.avatar ??
    me?.picture ??
    me?.photo ??
    '';
  const avatarUrl = extractUrl(avatarUrlRaw);

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl, avatarSrc]);

  useEffect(() => {
    let active = true;

    async function load() {
      const ref = String(avatarUrl || '').trim();
      if (active) setAvatarHeaders(null);
      if (!ref) {
        if (active) setAvatarSrc('');
        return;
      }
      if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) {
        if (active) setAvatarSrc(ref);
        return;
      }
      const isDocumentRef =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref) || /^[0-9]+$/.test(ref);
      const baseUrl = String(apiClient?.defaults?.baseURL || '').replace(/\/$/, '');
      const rootUrl = baseUrl.replace(/\/api$/i, '');
      const normalizedPath = ref.startsWith('/') ? ref : `/${ref}`;
      const shouldUseRoot = /\/uploads\/|\/media\/|\/static\/|\/files\//i.test(normalizedPath) && /\/api$/i.test(baseUrl);
      if (!isDocumentRef && (ref.startsWith('/') || /^[a-z0-9]/i.test(ref))) {
        const absolute = (ref.startsWith('documents/') || ref.startsWith('/documents/') || ref.startsWith('files/') || ref.startsWith('/files/')) && baseUrl
          ? `${baseUrl}${normalizedPath}`
          : baseUrl
            ? `${shouldUseRoot ? rootUrl : baseUrl}${normalizedPath}`
            : ref;
        if (absolute && (absolute.startsWith('http://') || absolute.startsWith('https://'))) {
          if (active) setAvatarSrc(absolute);
          return;
        }
      }
      if (!isDocumentRef) {
        if (active) setAvatarSrc(ref);
        return;
      }
      try {
        const token = await authService.getToken();
        const downloadUrl = `${baseUrl}/documents/${ref}/download`;
        if (Platform.OS !== 'web') {
          if (active) {
            setAvatarSrc(downloadUrl);
            setAvatarHeaders(token ? { Authorization: `Bearer ${token}` } : null);
          }
          return;
        }
        const res = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error('download_failed');
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (active) setAvatarSrc(typeof dataUrl === 'string' ? dataUrl : '');
      } catch {
        if (active) setAvatarSrc('');
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [avatarUrl]);

  return (
    <View style={styles.root}>
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : styles.toastInfo,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
            },
          ]}
        >
          <View style={styles.toastIconWrap}>
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : 'information-circle'}
              size={18}
              color={toast.type === 'success' ? colors.success : colors.primary}
            />
          </View>
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}

      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          contentStyle: styles.sceneContainer,
          headerShown: true,
          headerStyle: styles.header,
          headerTintColor: colors.textPrimary,
          headerTitleStyle: styles.headerTitle,
          headerTitleAlign: 'left',
          headerTitle: ({ children }) => (
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerBrandMark}>
                <Image source={LOGO_SOURCE} style={styles.headerBrandIcon} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.headerTitleText} numberOfLines={1}>
                  {String(children ?? '')}
                </Text>
                <Text style={styles.headerSubtitleText} numberOfLines={1}>
                  Zigran
                </Text>
              </View>
            </View>
          ),
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <Ionicons name="menu" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
              style={styles.headerIconButton}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              {notificationsCount > 0 ? <View style={styles.headerDot} /> : null}
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Kontrol Paneli' }} />
        <Stack.Screen name="Leads" component={LeadsScreen} options={{ title: 'Leadler' }} />
        <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Görevler' }} />
        <Stack.Screen name="Company" component={CompanyScreen} options={{ title: 'Şirketim' }} />
        <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Kişiler' }} />
        <Stack.Screen
          name="CustomerDetail"
          component={CustomerDetailScreen}
          options={({ navigation: stackNav }) => ({
            title: 'Kişi',
            headerLeft: () => (
              <TouchableOpacity onPress={() => stackNav.goBack()} activeOpacity={0.7} style={styles.headerIconButton}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ),
            headerRight: () => null,
          })}
        />
        <Stack.Screen name="Forms" component={FormsScreen} options={{ title: 'Formlar' }} />
        <Stack.Screen name="Conversions" component={ConversionsScreen} options={{ title: 'Dönüşümler' }} />
        <Stack.Screen name="AdsAccounts" component={AdsAccountsScreen} options={{ title: 'Reklam Hesapları' }} />
        <Stack.Screen name="Packages" component={PackagesScreen} options={{ title: 'Paketler' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
        <Stack.Screen
          name="LeadDetail"
          component={LeadDetailScreen}
          options={({ navigation: stackNav }) => ({
            title: 'Lead Detay',
            headerLeft: () => (
              <TouchableOpacity onPress={() => stackNav.goBack()} activeOpacity={0.7} style={styles.headerIconButton}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ),
            headerRight: () => null,
          })}
        />
        <Stack.Screen name="LeadUpsert" component={LeadUpsertScreen} options={{ title: 'Lead' }} />

        <Stack.Screen
          name="Modules"
          component={ModulesScreen}
          options={{ title: 'Modüller' }}
        />
        <Stack.Screen
          name="Campaigns"
          component={CampaignsScreen}
          options={{ title: 'Kampanyalar' }}
        />
        <Stack.Screen
          name="Messages"
          component={PlaceholderScreen}
          initialParams={{ title: 'Mesajlar', subtitle: 'Yakında' }}
          options={{ title: 'Mesajlar' }}
        />
        <Stack.Screen
          name="Email"
          component={EmailScreen}
          options={{ title: 'E-Posta' }}
        />
        <Stack.Screen
          name="Sms"
          component={SmsScreen}
          options={{ title: 'SMS' }}
        />
        <Stack.Screen
          name="Widgets"
          component={PlaceholderScreen}
          initialParams={{ title: 'Widgets', subtitle: 'Yakında' }}
          options={{ title: 'Widgets' }}
        />
        <Stack.Screen
          name="Surveys"
          component={SurveysScreen}
          options={{ title: 'Anketler' }}
        />
        <Stack.Screen
          name="Automations"
          component={AutomationsScreen}
          options={{ title: 'Otomasyonlar' }}
        />
        <Stack.Screen
          name="Segments"
          component={SegmentsScreen}
          options={{ title: 'Segmentasyon' }}
        />
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: 'Analitik' }}
        />
        <Stack.Screen
          name="Integrations"
          component={IntegrationsScreen}
          options={{ title: 'Entegrasyonlar' }}
        />
        <Stack.Screen
          name="Accounts"
          component={AccountsScreen}
          options={{ title: 'Firmalar' }}
        />
        <Stack.Screen
          name="Pipelines"
          component={PipelinesScreen}
          options={{ title: 'Satış Fırsatları' }}
        />
        <Stack.Screen
          name="Calls"
          component={CallsScreen}
          options={{ title: 'Aramalar' }}
        />
        <Stack.Screen
          name="AddCall"
          component={AddCallScreen}
          options={({ navigation: stackNav }) => ({
            title: 'Yeni Arama',
            headerLeft: () => (
              <TouchableOpacity onPress={() => stackNav.goBack()} activeOpacity={0.7} style={styles.headerIconButton}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ),
            headerRight: () => null,
          })}
        />
        <Stack.Screen
          name="CallDetail"
          component={CallDetailScreen}
          options={({ navigation: stackNav }) => ({
            title: 'Arama Detayı',
            headerLeft: () => (
              <TouchableOpacity onPress={() => stackNav.goBack()} activeOpacity={0.7} style={styles.headerIconButton}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ),
            headerRight: () => null,
          })}
        />
        <Stack.Screen
          name="Forecasts"
          component={ForecastsScreen}
          options={{ title: 'Öngörüler' }}
        />
        <Stack.Screen
          name="Documents"
          component={DocumentsScreen}
          options={{ title: 'Belgeler' }}
        />
        <Stack.Screen
          name="Calendar"
          component={PlaceholderScreen}
          initialParams={{ title: 'Takvim', subtitle: 'Yakında' }}
          options={{ title: 'Takvim' }}
        />
        <Stack.Screen
          name="Meetings"
          component={MeetingsScreen}
          initialParams={{ title: 'Toplantılar', subtitle: 'Yakında' }}
          options={{ title: 'Toplantılar' }}
        />
        <Stack.Screen
          name="Booking"
          component={MeetingsScreen}
          initialParams={{ title: 'Randevular', subtitle: 'Yakında' }}
          options={{ title: 'Randevular' }}
        />
        <Stack.Screen
          name="Products"
          component={ProductsScreen}
          options={{ title: 'Ürünler' }}
        />
        <Stack.Screen
          name="PriceLists"
          component={PriceListsScreen}
          options={{ title: 'Fiyat Listeleri' }}
        />
        <Stack.Screen
          name="Offers"
          component={OffersScreen}
          options={{ title: 'Teklifler' }}
        />
        <Stack.Screen
          name="Tickets"
          component={TicketsScreen}
          options={{ title: 'Destek Talepleri' }}
        />
      </Stack.Navigator>

      <Pressable
        style={[styles.backdrop, { opacity: menuOpen ? 1 : 0 }]}
        pointerEvents={menuOpen ? 'auto' : 'none'}
        onPress={() => setMenuOpen(false)}
      />

      <Animated.View style={[styles.sidebar, { width: menuWidth, transform: [{ translateX }] }]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.logoWrap}>
            <Image source={LOGO_SOURCE} style={styles.logoMark} />
          </View>
          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>Zigran</Text>
            {companyName ? <Text style={styles.brandSubtitle}>{String(companyName)}</Text> : null}
          </View>
        </View>

        <View style={styles.userCard}>
          <TouchableOpacity
            style={styles.userInfoBtn}
            onPress={() => handleNavigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.userAvatar}>
              {avatarSrc && !avatarBroken ? (
                <Image
                  source={
                    Platform.OS !== 'web' && avatarHeaders
                      ? { uri: avatarSrc, headers: avatarHeaders }
                      : { uri: avatarSrc }
                  }
                  style={styles.userAvatarImage}
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <Text style={styles.userAvatarText}>{String(userName).slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.userTextBlock}>
              <Text style={styles.userName} numberOfLines={1}>
                {String(userName)}
              </Text>
              {displayEmail ? (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {String(displayEmail)}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <IconButton
            icon={({ size, color }) => <Ionicons name="log-out-outline" size={size} color={color} />}
            size={18}
            onPress={handleLogout}
            style={styles.userLogoutBtn}
            iconColor={colors.error}
          />
        </View>

        <ScrollView style={styles.sidebarBody} contentContainerStyle={styles.sidebarBodyContent} showsVerticalScrollIndicator={false}>
          {sidebarGroups.map((group) => {
            const isOpen = openGroups.includes(group.label);
            return (
              <View key={group.label} style={styles.groupBlock}>
                <TouchableOpacity
                  onPress={() => toggleGroup(group.label)}
                  activeOpacity={0.8}
                  style={styles.groupHeader}
                >
                  <Text style={styles.groupHeaderText}>{group.label}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-down' : 'chevron-forward'}
                    size={14}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {isOpen ? (
                  <View style={styles.groupItems}>
                    {group.items.map((item) => {
                      const active = item.route === activeRouteName;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[styles.menuItem, active && styles.menuItemActive]}
                          onPress={() => handleNavigate(item.route, item.params)}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.menuIconWrap, active && styles.menuIconWrapActive]}>
                            <Ionicons
                              name={safeIoniconName(item.icon, 'help-circle-outline')}
                              size={18}
                              color={active ? colors.primary : colors.textSecondary}
                            />
                          </View>
                          <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

      </Animated.View>
    </View>
  );
};

export default TabNavigator;

function createStyles(colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    toast: {
      position: 'absolute',
      top: Platform.select({ ios: 60, android: 38, default: 24 }),
      left: 12,
      right: 12,
      zIndex: 50,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    toastSuccess: {
      backgroundColor: colors.surface,
      borderColor: colors.success + '33',
    },
    toastInfo: {
      backgroundColor: colors.surface,
      borderColor: colors.primary + '33',
    },
    toastIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toastText: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 13,
      lineHeight: 18,
    },
    sceneContainer: {
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontWeight: '900',
      fontSize: 17,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: Platform.select({ ios: 220, default: 240 }),
    },
    headerBrandMark: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBrandIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    headerTitleText: {
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 15,
    },
    headerSubtitleText: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 11,
      marginTop: 1,
    },
    headerIconButton: {
      marginHorizontal: 6,
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerDot: {
      position: 'absolute',
      top: 8,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    tabBar: {
      position: 'absolute',
      left: 14,
      right: 14,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: colors.border,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 18,
    },
    tabBarItem: {
      flex: 1,
      paddingTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBarIcon: {
      marginTop: 2,
    },
    tabBarLabel: {
      fontSize: 11,
      fontWeight: '800',
      marginTop: 2,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.textPrimary === '#0F172A' ? 'rgba(15, 23, 42, 0.35)' : 'rgba(0,0,0,0.45)',
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 6, height: 0 },
      elevation: 12,
    },
    sidebarHeader: {
      paddingTop: Platform.select({ ios: 54, default: 34 }),
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoMark: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
    },
    logoText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '900',
    },
    brandBlock: {
      flex: 1,
    },
    brandTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    brandSubtitle: {
      color: colors.textSecondary,
      marginTop: 2,
      fontSize: 12,
      fontWeight: '700',
    },
    userCard: {
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    userInfoBtn: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
    },
    userAvatarImage: {
      width: 40,
      height: 40,
      borderRadius: 14,
      resizeMode: 'cover',
    },
    userAvatarText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '900',
    },
    userTextBlock: {
      flex: 1,
      gap: 2,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    userEmail: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    userLogoutBtn: {
      margin: 0,
      width: 40,
      height: 40,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error + '2A',
      backgroundColor: colors.error + '10',
    },
    sidebarBody: {
      flex: 1,
    },
    sidebarBodyContent: {
      paddingTop: 10,
      paddingHorizontal: 10,
      paddingBottom: 12,
      gap: 10,
    },
    groupBlock: {
      gap: 8,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    groupHeaderText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    groupItems: {
      gap: 2,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      gap: 10,
    },
    menuItemActive: {
      backgroundColor: colors.primary + '14',
    },
    menuIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuIconWrapActive: {
      backgroundColor: colors.primary + '12',
      borderColor: colors.primary + '2A',
    },
    menuLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    menuLabelActive: {
      color: colors.primary,
    },
  });
}
