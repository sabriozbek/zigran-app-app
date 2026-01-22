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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../api/authService';
import apiClient from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const CompanyScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [activeTab, setActiveTab] = useState(String(route?.params?.tab || 'general'));
  const [account, setAccount] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [activePlanDetails, setActivePlanDetails] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [savingAccount, setSavingAccount] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [memberPicker, setMemberPicker] = useState({ open: false, teamId: null });
  const [checkout, setCheckout] = useState({ open: false, plan: null, amount: 0, currency: 'TRY', cycle: 'monthly' });
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paying, setPaying] = useState(false);

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

  const closeCheckout = useCallback(() => {
    setCheckout({ open: false, plan: null, amount: 0, currency: 'TRY', cycle: 'monthly' });
    setCardName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvc('');
  }, []);

  const sanitizeCardNumber = useCallback((value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }, []);

  const sanitizeExpiry = useCallback((value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }, []);

  const sanitizeCvc = useCallback((value) => {
    return String(value || '').replace(/\D/g, '').slice(0, 4);
  }, []);

  const normalizeList = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }, []);

  const load = useCallback(
    async (opts = { silent: false }) => {
      let nextMe = null;
      try {
        const res = await authService.me();
        nextMe = res;
        setMe(res);
      } catch {}

      const calls = [
        apiClient.get('/settings/company/account').catch(() => null),
        apiClient.get('/settings/company/users').catch(() => null),
        apiClient.get('/teams').catch(() => null),
        apiClient.get('/invoices').catch(() => null),
        apiClient.get('/plans').catch(() => null),
      ];

      const results = await Promise.all(calls);
      const nextAccount = results[0]?.data ?? null;
      const nextUsers = normalizeList(results[1]?.data);
      const nextTeams = normalizeList(results[2]?.data);
      const nextInvoices = normalizeList(results[3]?.data);
      const nextPlans = normalizeList(results[4]?.data);

      if (nextAccount) setAccount(nextAccount);
      setUsers(nextUsers);
      setTeams(nextTeams);
      setInvoices(nextInvoices);
      setPlans(nextPlans);

      const company = nextMe?.company ?? nextMe?.tenant ?? nextMe?.organization ?? null;
      const rawPlan = String(nextAccount?.plan || company?.plan?.id || company?.plan?.name || company?.plan || company?.package || company?.subscription || 'free').toLowerCase();
      const currentPlanId = rawPlan === 'business' ? 'enterprise' : rawPlan;
      if (currentPlanId) {
        const planRes = await apiClient.get(`/plans/${encodeURIComponent(currentPlanId)}`).catch(() => null);
        setActivePlanDetails(planRes?.data ?? null);
      } else {
        setActivePlanDetails(null);
      }

      if (!opts?.silent) setLoading(false);
      return { me: nextMe, account: nextAccount, users: nextUsers, teams: nextTeams, invoices: nextInvoices, plans: nextPlans };
    },
    [normalizeList],
  );

  const submitPlanChange = useCallback(
    async (planId) => {
      const cleanId = String(planId || '').trim();
      if (!cleanId) {
        Alert.alert('Hata', 'Plan bulunamadı.');
        return;
      }
      setPaying(true);
      try {
        await apiClient.patch('/settings/company/account', { requestedPlan: cleanId });
        await load({ silent: true });
        pushToast('success', 'Plan güncellendi.');
      } catch {
        Alert.alert('Hata', 'Plan seçimi kaydedilemedi.');
      } finally {
        setPaying(false);
      }
    },
    [load, pushToast],
  );

  const openCheckout = useCallback(
    (pkg) => {
      const planId = String(pkg?.id || '').trim();
      if (!planId) {
        Alert.alert('Hata', 'Plan bulunamadı.');
        return;
      }
      const basePrice = Number(pkg?.price || 0);
      const yearlyRaw = Number(pkg?.priceYearly);
      const amount =
        basePrice === 0
          ? 0
          : billingCycle === 'yearly'
            ? Number.isFinite(yearlyRaw) && yearlyRaw > 0
              ? yearlyRaw
              : Math.round(basePrice * 12 * 0.7)
            : basePrice;
      const currency = String(pkg?.currency || 'TRY');
      setCheckout({ open: true, plan: pkg, amount, currency, cycle: billingCycle });
      setCardName('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
    },
    [billingCycle],
  );

  const confirmCheckout = useCallback(async () => {
    const planId = String(checkout?.plan?.id || '').trim();
    if (!planId) {
      Alert.alert('Hata', 'Plan bulunamadı.');
      return;
    }
    const name = String(cardName || '').trim();
    const numberDigits = String(cardNumber || '').replace(/\D/g, '');
    const expiry = String(cardExpiry || '').trim();
    const cvc = String(cardCvc || '').replace(/\D/g, '');
    if (String(checkout?.amount || 0) !== '0') {
      if (!name || name.length < 3) {
        Alert.alert('Hata', 'Kart üzerindeki isim gerekli.');
        return;
      }
      if (numberDigits.length < 12) {
        Alert.alert('Hata', 'Kart numarası hatalı.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        Alert.alert('Hata', 'Son kullanma tarihi hatalı.');
        return;
      }
      if (cvc.length < 3) {
        Alert.alert('Hata', 'CVC hatalı.');
        return;
      }
    }
    setPaying(true);
    try {
      await apiClient.patch('/settings/company/account', { requestedPlan: planId });
      closeCheckout();
      await load({ silent: true });
      setActiveTab('billing');
      pushToast('success', 'Plan aktif edildi ve fatura oluşturuldu.');
    } catch {
      Alert.alert('Hata', 'Ödeme alınamadı.');
    } finally {
      setPaying(false);
    }
  }, [cardCvc, cardExpiry, cardName, cardNumber, checkout?.amount, checkout?.plan?.id, closeCheckout, load, pushToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load({ silent: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const unsubscribe = navigation?.addListener?.('focus', () => load({ silent: false }).catch(() => {}));
    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [load, navigation]);

  useEffect(() => {
    const requested = String(route?.params?.tab || '').trim();
    if (requested) setActiveTab(requested);
  }, [route?.params?.tab]);

  const company = me?.company ?? me?.tenant ?? me?.organization ?? null;
  const title = company?.name || company?.companyName || 'Şirket';
  const plan = company?.plan || company?.package || company?.subscription;
  const myEmail = me?.email || me?.user?.email;
  const myName = me?.name || me?.fullName || me?.user?.name || me?.user?.fullName;
  const myRole = me?.role || me?.user?.role;

  const companySizes = useMemo(
    () => [
      { value: '1-10', label: '1-10' },
      { value: '11-50', label: '11-50' },
      { value: '51-200', label: '51-200' },
      { value: '201-500', label: '201-500' },
      { value: '500+', label: '500+' },
    ],
    [],
  );

  const predefinedTeams = useMemo(
    () => ['Satış Ekibi', 'Pazarlama Ekibi', 'Destek Ekibi', 'Yazılım Ekibi', 'İnsan Kaynakları', 'Operasyon', 'Finans', 'Yönetim'],
    [],
  );

  const tabs = useMemo(() => {
    return [
      { key: 'general', label: 'Genel Bilgiler' },
      { key: 'plans', label: 'Planlar' },
      { key: 'billing', label: 'Faturalar' },
      { key: 'users', label: 'Kullanıcılar' },
      { key: 'teams', label: 'Ekiplerim' },
    ];
  }, []);

  const displayName = useMemo(() => {
    const n = [me?.firstName, me?.lastName].filter(Boolean).join(' ').trim();
    if (n) return n;
    if (myName) return String(myName);
    return String(myEmail || 'Kullanıcı');
  }, [me?.firstName, me?.lastName, myEmail, myName]);

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return String(value);
    }
  }, []);

  const formatMoney = useCallback((amount, currency = 'TRY') => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount ?? '');
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const r = await apiClient.get('/settings/company/users');
      setUsers(normalizeList(r?.data));
    } catch {}
  }, [normalizeList]);

  const refreshTeams = useCallback(async () => {
    try {
      const r = await apiClient.get('/teams');
      setTeams(normalizeList(r?.data));
    } catch {}
  }, [normalizeList]);

  const refreshInvoices = useCallback(async () => {
    try {
      const r = await apiClient.get('/invoices');
      setInvoices(normalizeList(r?.data));
    } catch {}
  }, [normalizeList]);

  const renderGeneral = useCallback(() => {
    const nameValue = String(account?.name || title || '').trim();
    const planValue = String(account?.plan || plan || '').trim();
    const seatsValue = account?.seats;
    const companySizeValue = String(account?.companySize || '').trim();
    const usersCount = account?.usersCount ?? users?.length;

    return (
      <View style={{ gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Şirket Bilgileri</Text>

          <Text style={styles.label}>Şirket Adı</Text>
          <TextInput
            style={styles.input}
            placeholder="Şirket Adı"
            placeholderTextColor={colors.textSecondary}
            value={nameValue}
            onChangeText={(t) => setAccount((p) => ({ ...(p || {}), name: t }))}
          />

          <Text style={styles.label}>Şirket Büyüklüğü</Text>
          <View style={styles.segmentRow}>
            {companySizes.map((s) => {
              const active = s.value === companySizeValue;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.segment, active ? styles.segmentActive : null]}
                  onPress={() => setAccount((p) => ({ ...(p || {}), companySize: s.value }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, savingAccount ? styles.buttonDisabled : null]}
            activeOpacity={0.85}
            disabled={savingAccount}
            onPress={async () => {
              setSavingAccount(true);
              try {
                await apiClient.patch('/settings/company/account', {
                  name: (account?.name || '').trim(),
                  companySize: (account?.companySize || '').trim(),
                  plan: (account?.plan || '').trim() || undefined,
                  seats: typeof account?.seats === 'number' ? account.seats : undefined,
                  requestedPlan: (account?.requestedPlan || '').trim() || undefined,
                });
                try {
                  const r = await apiClient.get('/settings/company/account');
                  setAccount(r?.data ?? null);
                } catch {}
                pushToast('success', 'Şirket bilgileri güncellendi.');
              } catch {
                Alert.alert('Hata', 'Şirket bilgileri kaydedilemedi.');
              } finally {
                setSavingAccount(false);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>{savingAccount ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hesap Özeti</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Plan</Text>
            <Text style={styles.kvValue}>{planValue ? planValue.toUpperCase() : 'FREE'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Kullanıcı Limiti</Text>
            <Text style={styles.kvValue}>{seatsValue ? String(seatsValue) : '-'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Aktif Kullanıcı</Text>
            <Text style={styles.kvValue}>{usersCount !== undefined ? String(usersCount) : '-'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Kayıt Tarihi</Text>
            <Text style={styles.kvValue}>{formatDate(account?.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  }, [
    account?.companySize,
    account?.createdAt,
    account?.name,
    account?.plan,
    account?.requestedPlan,
    account?.usersCount,
    account?.seats,
    colors.textSecondary,
    companySizes,
    formatDate,
    plan,
    savingAccount,
    styles,
    title,
    users?.length,
    pushToast,
  ]);

  const renderPlans = useCallback(() => {
    const currentPlanRaw = String(account?.plan || plan?.name || plan?.title || plan || 'free').toLowerCase();
    const pendingPlanRaw = String(account?.requestedPlan || account?.pendingPlan || '').toLowerCase();
    const currentPlan = currentPlanRaw === 'business' ? 'enterprise' : currentPlanRaw;
    const pendingPlan = pendingPlanRaw === 'business' ? 'enterprise' : pendingPlanRaw;

    return (
      <View style={{ gap: 12 }}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Planlar</Text>
              <Text style={styles.meta}>Mevcut plan: {String(currentPlan || 'free').toUpperCase()}</Text>
              {pendingPlan ? <Text style={[styles.meta, { color: colors.primary }]}>Bekleyen talep: {pendingPlan.toUpperCase()}</Text> : null}
            </View>

            <View style={styles.cyclePillRow}>
              {[
                { key: 'monthly', label: 'Aylık' },
                { key: 'yearly', label: 'Yıllık' },
              ].map((c) => {
                const active = c.key === billingCycle;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cyclePill, active ? styles.cyclePillActive : null]}
                    onPress={() => setBillingCycle(c.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.cyclePillText, active ? styles.cyclePillTextActive : null]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          {plans.map((pkg, idx) => {
            const id = String(pkg?.id || pkg?.name || idx);
            const isCurrent = String(pkg?.id || '').toLowerCase() === currentPlan;
            const isPending = pendingPlan && String(pkg?.id || '').toLowerCase() === pendingPlan;
            const basePrice = Number(pkg?.price || 0);
            const isFree = basePrice === 0;
            const displayPrice = isFree ? 0 : billingCycle === 'yearly' ? Number(pkg?.priceYearly || Math.round(basePrice * 12 * 0.7)) : basePrice;
            const disabled = isCurrent || isPending;
            const planId = String(pkg?.id || '').trim();
            const features = Array.isArray(pkg?.features)
              ? pkg.features
              : isCurrent && Array.isArray(activePlanDetails?.features)
                ? activePlanDetails.features
                : [];

            return (
              <View key={id} style={[styles.planCard, isCurrent ? styles.planCardActive : null]}>
                <Text style={styles.planTitle} numberOfLines={1}>
                  {String(pkg?.title || pkg?.name || 'Paket')}
                </Text>
                <Text style={styles.planPrice}>
                  {displayPrice === 0 ? '₺0' : `₺${Number(displayPrice).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
                  <Text style={styles.planPriceUnit}>/{billingCycle === 'yearly' ? 'yıl' : 'ay'}</Text>
                </Text>
                {pkg?.description ? (
                  <Text style={styles.planDesc} numberOfLines={2}>
                    {String(pkg.description)}
                  </Text>
                ) : null}

                {features.length > 0 ? (
                  <View style={styles.planFeatures}>
                    {features.slice(0, 5).map((feat, fIdx) => (
                      <View key={String(fIdx)} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
                        <Text style={styles.featureText} numberOfLines={1}>
                          {String(feat)}
                        </Text>
                      </View>
                    ))}
                    {features.length > 5 ? <Text style={styles.featureMore}>+{features.length - 5} özellik</Text> : null}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.secondaryButton, disabled || paying ? styles.buttonDisabled : null]}
                  activeOpacity={0.85}
                  disabled={disabled || paying}
                  onPress={async () => {
                    if (!planId) {
                      Alert.alert('Hata', 'Plan bulunamadı.');
                      return;
                    }
                    if (displayPrice === 0) {
                      await submitPlanChange(planId);
                      return;
                    }
                    openCheckout(pkg);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isCurrent ? 'Mevcut Plan' : isPending ? 'Beklemede' : paying ? 'İşleniyor...' : displayPrice === 0 ? 'Seç' : 'Satın Al'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    );
  }, [
    account?.pendingPlan,
    account?.plan,
    account?.requestedPlan,
    activePlanDetails?.features,
    billingCycle,
    colors.primary,
    openCheckout,
    paying,
    plan,
    plans,
    styles,
    submitPlanChange,
  ]);

  const renderBilling = useCallback(() => {
    const currentPlanRaw = String(account?.plan || plan?.name || plan?.title || plan || 'free').toLowerCase();
    const currentPlan = currentPlanRaw === 'business' ? 'enterprise' : currentPlanRaw;

    return (
      <View style={{ gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ödeme Yöntemi</Text>
          <View style={styles.paymentRow}>
            <View style={styles.paymentBrand}>
              <Text style={styles.paymentBrandText}>VISA</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.paymentTitle} numberOfLines={1}>
                •••• •••• •••• 4242
              </Text>
              <Text style={styles.paymentMeta}>Son Kullanma: 12/28</Text>
            </View>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => pushToast('info', 'Kart güncelleme özelliği yakında.')}
              activeOpacity={0.85}
            >
              <Text style={styles.ghostButtonText}>Düzenle</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.billingSummary}>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Mevcut Plan</Text>
              <Text style={styles.kvValue}>{String(currentPlan || 'free').toUpperCase()}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Sonraki Ödeme</Text>
              <Text style={styles.kvValue}>{formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Ödeme Geçmişi</Text>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => refreshInvoices()}
              activeOpacity={0.85}
            >
              <Text style={styles.ghostButtonText}>Yenile</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.table}>
            {invoices.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Henüz fatura bulunmuyor.</Text>
              </View>
            ) : (
              invoices.map((inv, idx) => {
                const statusRaw = String(inv?.status || '').toLowerCase();
                const statusText = statusRaw === 'paid' ? 'Ödendi' : statusRaw === 'pending' ? 'Bekliyor' : statusRaw ? String(inv.status) : '-';
                const planTitle = inv?.planTitle || inv?.plan || inv?.package || '';
                return (
                  <View key={String(inv?.id ?? inv?._id ?? idx)} style={[styles.invoiceRow, idx === 0 ? styles.invoiceRowFirst : null]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.invoiceTitle} numberOfLines={1}>
                        {planTitle ? `${String(planTitle)} Plan - ${statusText}` : statusText}
                      </Text>
                      <Text style={styles.invoiceMeta} numberOfLines={1}>
                        {formatDate(inv?.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.invoiceAmount} numberOfLines={1}>
                      {formatMoney(inv?.amount, inv?.currency || 'TRY')}
                    </Text>
                    <TouchableOpacity
                      style={styles.ghostButton}
                      onPress={() => pushToast('info', 'Fatura indirme yakında.')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.ghostButtonText}>İndir</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
    );
  }, [account?.plan, formatDate, formatMoney, invoices, plan, refreshInvoices, styles, pushToast]);

  const renderUsers = useCallback(() => {
    const normalized = users.length
      ? users
      : [
          {
            id: me?.id ?? me?.user?.id ?? 'me',
            email: myEmail,
            firstName: me?.firstName,
            lastName: me?.lastName,
            role: myRole || 'viewer',
          },
        ];

    return (
      <View style={{ gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kullanıcı Yönetimi</Text>
          <Text style={styles.meta}>Planı değiştir, kullanıcı ekle ve yetkilendir</Text>

          <View style={styles.inviteBox}>
            <Text style={styles.label}>E‑posta</Text>
            <TextInput
              style={styles.input}
              placeholder="user@example.com"
              placeholderTextColor={colors.textSecondary}
              value={inviteEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setInviteEmail}
            />

            <Text style={styles.label}>Rol</Text>
            <View style={styles.chipsRow}>
              {[
                { key: 'viewer', label: 'Viewer' },
                { key: 'marketer', label: 'Marketer' },
                { key: 'admin', label: 'Admin' },
              ].map((r) => {
                const active = r.key === inviteRole;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.chip, active ? styles.chipActive : null]}
                    activeOpacity={0.85}
                    onPress={() => setInviteRole(r.key)}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, inviting || !inviteEmail.trim() ? styles.buttonDisabled : null]}
              activeOpacity={0.85}
              disabled={inviting || !inviteEmail.trim()}
              onPress={async () => {
                setInviting(true);
                try {
                  const r = await apiClient.post('/settings/company/users', {
                    email: inviteEmail.trim(),
                    role: inviteRole,
                  });
                  if (r?.data?.ok === false && r?.data?.error === 'seat_limit') {
                    Alert.alert('Koltuk limiti dolu', 'Planı veya koltuk sayısını artırın.');
                    return;
                  }
                  setInviteEmail('');
                  await refreshUsers();
                  pushToast('success', `Davet gönderildi: ${inviteEmail.trim()}`);
                } catch {
                  Alert.alert('Hata', 'Davet gönderilemedi.');
                } finally {
                  setInviting(false);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>{inviting ? 'Ekleniyor...' : 'Kullanıcı Ekle'}</Text>
            </TouchableOpacity>

            {account?.id ? <Text style={styles.inviteFoot}>Bu hesap ID’si paylaşılabilir: {String(account.id)}</Text> : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kullanıcılar</Text>
          <View style={styles.table}>
            {normalized.map((u, idx) => {
              const fullName = String([u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || u?.email || 'Kullanıcı');
              const userTeam = teams.find((t) => Array.isArray(t?.members) && t.members.some((m) => String(m?.userId ?? m?.id) === String(u?.id)));
              const role = String(u?.role || 'viewer');
              return (
                <View key={String(u?.id ?? u?._id ?? u?.email ?? idx)} style={[styles.userRow, idx === 0 ? styles.userRowFirst : null]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tableLabel} numberOfLines={1}>
                      {u?.email ? String(u.email) : fullName}
                    </Text>
                    <Text style={styles.tableMeta} numberOfLines={1}>
                      {fullName}
                      {userTeam?.name ? ` • ${String(userTeam.name)}` : ''}
                    </Text>
                  </View>

                  <View style={styles.roleSelectRow}>
                    {['admin', 'marketer', 'viewer'].map((r) => {
                      const active = r === role;
                      return (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleMini, active ? styles.roleMiniActive : null]}
                          activeOpacity={0.85}
                          onPress={async () => {
                            try {
                              await apiClient.patch(`/settings/company/users/${String(u?.id)}/role`, { role: r });
                              await refreshUsers();
                            } catch {
                              Alert.alert('Hata', 'Rol güncellenemedi.');
                            }
                          }}
                        >
                          <Text style={[styles.roleMiniText, active ? styles.roleMiniTextActive : null]}>{r}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }, [account?.id, colors.textSecondary, inviteEmail, inviteRole, inviting, me, myEmail, myRole, refreshUsers, styles, teams, users, pushToast]);

  const renderTeams = useCallback(() => {
    return (
      <View style={{ gap: 12 }}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Ekipler</Text>
              <Text style={styles.meta}>Departmanlar ve çalışma grupları oluşturun</Text>
            </View>
            <TouchableOpacity style={styles.primaryButtonSmall} activeOpacity={0.85} onPress={() => setTeamModalOpen(true)}>
              <Text style={styles.primaryButtonSmallText}>Yeni Ekip</Text>
            </TouchableOpacity>
          </View>
        </View>

        {teams.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Henüz bir ekip oluşturulmamış.</Text>
            <TouchableOpacity style={styles.linkButton} activeOpacity={0.85} onPress={() => setTeamModalOpen(true)}>
              <Text style={styles.linkButtonText}>İlk ekibi oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : (
          teams.map((team) => {
            const membersList = Array.isArray(team?.members) ? team.members : [];
            return (
              <View key={String(team?.id ?? team?._id ?? team?.name)} style={styles.teamCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.teamTitle} numberOfLines={1}>
                      {String(team?.name || 'Ekip')}
                    </Text>
                    <Text style={styles.teamDesc} numberOfLines={1}>
                      {String(team?.description || 'Açıklama yok')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dangerButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      Alert.alert('Ekip Sil', 'Bu ekibi silmek istediğinize emin misiniz?', [
                        { text: 'Vazgeç', style: 'cancel' },
                        {
                          text: 'Sil',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await apiClient.delete(`/teams/${String(team?.id)}`);
                              await refreshTeams();
                              await refreshUsers();
                            } catch {
                              Alert.alert('Hata', 'Ekip silinemedi.');
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <Text style={styles.dangerButtonText}>Sil</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.teamMembersBox}>
                  <Text style={styles.teamMembersTitle}>Üyeler ({String(membersList.length)})</Text>

                  {membersList.length === 0 ? (
                    <Text style={styles.teamMemberEmpty}>Üye yok</Text>
                  ) : (
                    membersList.map((m, idx) => {
                      const label = String(m?.user?.name || m?.user?.email || m?.name || m?.email || 'Kullanıcı');
                      const userId = m?.userId ?? m?.id;
                      return (
                        <View key={String(userId ?? idx)} style={[styles.teamMemberRow, idx === 0 ? styles.teamMemberRowFirst : null]}>
                          <Text style={styles.teamMemberName} numberOfLines={1}>
                            {label}
                          </Text>
                          <TouchableOpacity
                            style={styles.ghostButton}
                            activeOpacity={0.85}
                            onPress={async () => {
                              try {
                                await apiClient.delete(`/teams/${String(team?.id)}/members/${String(userId)}`);
                                await refreshTeams();
                                await refreshUsers();
                              } catch {
                                Alert.alert('Hata', 'Üye çıkarılamadı.');
                              }
                            }}
                          >
                            <Text style={styles.ghostButtonText}>Çıkar</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    activeOpacity={0.85}
                    onPress={() => setMemberPicker({ open: true, teamId: String(team?.id) })}
                  >
                    <Text style={styles.secondaryButtonText}>Üye Ekle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <Modal visible={teamModalOpen} transparent animationType="fade" onRequestClose={() => (creatingTeam ? null : setTeamModalOpen(false))}>
          <Pressable style={styles.modalOverlay} onPress={() => (creatingTeam ? null : setTeamModalOpen(false))}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })} style={{ width: '100%' }}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.modalTitle}>Yeni Ekip Oluştur</Text>

                  <Text style={styles.label}>Ekip Adı</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn. Pazarlama"
                    placeholderTextColor={colors.textSecondary}
                    value={newTeamName}
                    onChangeText={setNewTeamName}
                  />

                  <Text style={styles.label}>Açıklama</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ekip hakkında kısa bilgi"
                    placeholderTextColor={colors.textSecondary}
                    value={newTeamDesc}
                    onChangeText={setNewTeamDesc}
                  />

                  <Text style={styles.label}>Önerilen Ekipler</Text>
                  <View style={styles.wrapRow}>
                    {predefinedTeams.map((t) => (
                      <TouchableOpacity key={t} style={styles.badge} activeOpacity={0.85} onPress={() => setNewTeamName(t)}>
                        <Text style={styles.badgeText}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.modalActionButton, creatingTeam ? styles.buttonDisabled : null]}
                      activeOpacity={0.85}
                      disabled={creatingTeam}
                      onPress={() => setTeamModalOpen(false)}
                    >
                      <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.modalActionButton, creatingTeam || !newTeamName.trim() ? styles.buttonDisabled : null]}
                      activeOpacity={0.85}
                      disabled={creatingTeam || !newTeamName.trim()}
                      onPress={async () => {
                        setCreatingTeam(true);
                        try {
                          await apiClient.post('/teams', { name: newTeamName.trim(), description: newTeamDesc.trim() });
                          setNewTeamName('');
                          setNewTeamDesc('');
                          setTeamModalOpen(false);
                          await refreshTeams();
                          await refreshUsers();
                          pushToast('success', 'Ekip oluşturuldu.');
                        } catch {
                          Alert.alert('Hata', 'Ekip oluşturulamadı.');
                        } finally {
                          setCreatingTeam(false);
                        }
                      }}
                    >
                      <Text style={styles.primaryButtonText}>{creatingTeam ? 'Oluşturuluyor...' : 'Oluştur'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal
          visible={!!memberPicker?.open}
          transparent
          animationType="fade"
          onRequestClose={() => setMemberPicker({ open: false, teamId: null })}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setMemberPicker({ open: false, teamId: null })}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Üye Ekle</Text>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {users
                  .filter((u) => {
                    const t = teams.find((x) => String(x?.id) === String(memberPicker?.teamId));
                    const ms = Array.isArray(t?.members) ? t.members : [];
                    return !ms.some((m) => String(m?.userId ?? m?.id) === String(u?.id));
                  })
                  .map((u) => {
                    const label = String(u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || 'Kullanıcı');
                    return (
                      <TouchableOpacity
                        key={String(u?.id ?? u?.email)}
                        style={styles.pickerRow}
                        activeOpacity={0.85}
                        onPress={async () => {
                          try {
                            await apiClient.post(`/teams/${String(memberPicker?.teamId)}/members`, { userId: String(u?.id) });
                            setMemberPicker({ open: false, teamId: null });
                            await refreshTeams();
                            await refreshUsers();
                          } catch {
                            Alert.alert('Hata', 'Üye eklenemedi.');
                          }
                        }}
                      >
                        <Text style={styles.pickerRowText} numberOfLines={1}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => setMemberPicker({ open: false, teamId: null })}>
                <Text style={styles.secondaryButtonText}>Kapat</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }, [
    colors.textSecondary,
    creatingTeam,
    memberPicker?.open,
    memberPicker?.teamId,
    newTeamDesc,
    newTeamName,
    predefinedTeams,
    refreshTeams,
    refreshUsers,
    styles,
    teamModalOpen,
    teams,
    users,
    pushToast,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {String(title)}
                </Text>
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  {String(displayName)}
                  {myRole ? ` • ${String(myRole)}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.heroAction}
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.85}
              >
                <Text style={styles.heroActionText}>Ayarlar</Text>
              </TouchableOpacity>
            </View>
            {myEmail ? (
              <Text style={styles.heroMeta} numberOfLines={1}>
                {String(myEmail)}
              </Text>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {tabs.map((t) => {
              const active = t.key === activeTab;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabPill, active ? styles.tabPillActive : null]}
                  activeOpacity={0.85}
                  onPress={() => setActiveTab(t.key)}
                >
                  <Text style={[styles.tabPillText, active ? styles.tabPillTextActive : null]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'general' ? renderGeneral() : null}
          {activeTab === 'plans' ? renderPlans() : null}
          {activeTab === 'billing' ? renderBilling() : null}
          {activeTab === 'users' ? renderUsers() : null}
          {activeTab === 'teams' ? renderTeams() : null}
        </ScrollView>
      )}

      <Modal
        visible={!!checkout?.open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!paying) closeCheckout();
        }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => (paying ? null : closeCheckout())}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Ödeme</Text>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Plan</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {String(checkout?.plan?.title || checkout?.plan?.name || checkout?.plan?.id || 'Paket')}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Tutar</Text>
                <Text style={styles.kvValue} numberOfLines={1}>
                  {Number(checkout?.amount || 0) === 0
                    ? '₺0'
                    : `${Number(checkout?.amount || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${String(checkout?.currency || 'TRY')}`}
                  {checkout?.cycle ? ` / ${checkout.cycle === 'yearly' ? 'yıl' : 'ay'}` : ''}
                </Text>
              </View>

              {Number(checkout?.amount || 0) > 0 ? (
                <>
                  <Text style={styles.label}>Kart Üzerindeki İsim</Text>
                  <TextInput
                    style={styles.input}
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="Ad Soyad"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                  />

                  <Text style={styles.label}>Kart Numarası</Text>
                  <TextInput
                    style={styles.input}
                    value={cardNumber}
                    onChangeText={(v) => setCardNumber(sanitizeCardNumber(v))}
                    placeholder="0000 0000 0000 0000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Son Kullanma</Text>
                      <TextInput
                        style={styles.input}
                        value={cardExpiry}
                        onChangeText={(v) => setCardExpiry(sanitizeExpiry(v))}
                        placeholder="AA/YY"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>CVC</Text>
                      <TextInput
                        style={styles.input}
                        value={cardCvc}
                        onChangeText={(v) => setCardCvc(sanitizeCvc(v))}
                        placeholder="000"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                        secureTextEntry
                      />
                    </View>
                  </View>
                </>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.modalActionButton, paying ? styles.buttonDisabled : null]}
                  activeOpacity={0.85}
                  disabled={paying}
                  onPress={closeCheckout}
                >
                  <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.modalActionButton, paying ? styles.buttonDisabled : null]}
                  activeOpacity={0.85}
                  disabled={paying}
                  onPress={confirmCheckout}
                >
                  {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Ödemeyi Tamamla</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
    },
    content: {
      paddingBottom: 20,
      gap: 12,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroTextBlock: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    heroSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    heroMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    heroAction: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    heroActionText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 2,
    },
    tabPill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabPillActive: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary + '33',
    },
    tabPillText: {
      color: colors.textSecondary,
      fontWeight: '900',
      fontSize: 12,
    },
    tabPillTextActive: {
      color: colors.primary,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    meta: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    label: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    segmentRow: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    segment: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    segmentActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    segmentTextActive: {
      color: colors.primary,
    },
    primaryButton: {
      marginTop: 14,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '900',
    },
    primaryButtonSmall: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonSmallText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '900',
    },
    secondaryButton: {
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    kvRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    kvLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    kvValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    cyclePillRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    cyclePill: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    cyclePillActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    cyclePillText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    cyclePillTextActive: {
      color: colors.primary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    planCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 6,
    },
    planCardActive: {
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '08',
    },
    planTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    planPrice: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    planPriceUnit: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    planDesc: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
    },
    planFeatures: {
      marginTop: 8,
      gap: 6,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    featureText: {
      flex: 1,
      minWidth: 0,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    featureMore: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
    },
    table: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      overflow: 'hidden',
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: 10,
    },
    userRowFirst: {
      borderTopWidth: 0,
    },
    tableLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    tableMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    roleSelectRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    roleMini: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    roleMiniActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    roleMiniText: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '900',
    },
    roleMiniTextActive: {
      color: colors.primary,
    },
    inviteBox: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 12,
    },
    inviteFoot: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    chipsRow: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '10',
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    chipTextActive: {
      color: colors.primary,
    },
    paymentRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    paymentBrand: {
      width: 54,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#111827',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentBrandText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
    },
    paymentTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    paymentMeta: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    ghostButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ghostButtonText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    billingSummary: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + '1A',
      backgroundColor: colors.primary + '08',
    },
    emptyBox: {
      padding: 14,
      backgroundColor: colors.background,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    invoiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    invoiceRowFirst: {
      borderTopWidth: 0,
    },
    invoiceTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    invoiceMeta: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    invoiceAmount: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '900',
    },
    teamCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    teamTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    teamDesc: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    dangerButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '55',
      backgroundColor: colors.error + '10',
    },
    dangerButtonText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '900',
    },
    teamMembersBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 12,
      gap: 10,
    },
    teamMembersTitle: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    teamMemberEmpty: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      fontStyle: 'italic',
    },
    teamMemberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    teamMemberRowFirst: {
      borderTopWidth: 0,
    },
    teamMemberName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    linkButton: {
      marginTop: 12,
      alignSelf: 'center',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
      marginBottom: 4,
    },
    modalActions: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    modalActionButton: {
      flex: 1,
      marginTop: 0,
    },
    wrapRow: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    badgeText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: '800',
    },
    pickerRow: {
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    pickerRowText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
  });
}

export default CompanyScreen;
