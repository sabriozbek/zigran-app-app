import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { accountsService } from '../api/services/accountsService';
import { contactsService } from '../api/services/contactsService';
import { useTheme } from '../theme/ThemeContext';

const AddCustomerScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = route?.params?.customer ?? route?.params?.contact ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;
  const isEdit = Boolean(id);

  const [name, setName] = useState(String(initial?.name ?? [initial?.firstName, initial?.lastName].filter(Boolean).join(' ') ?? '').trim());
  const [company, setCompany] = useState(String(initial?.company ?? initial?.companyName ?? initial?.account?.name ?? initial?.accountName ?? '').trim());
  const [email, setEmail] = useState(String(initial?.email ?? '').trim());
  const [phone, setPhone] = useState(String(initial?.phone ?? '').trim());
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const pushToast = useCallback((type, message) => {
    const next = { type: type || 'success', message: String(message || '') };
    if (!next.message) return;
    setToast(next);
  }, []);

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

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Kişiyi Düzenle' : 'Yeni Kişi' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let cancelled = false;
    if (!id || initial) return undefined;
    setLoading(true);
    (async () => {
      try {
        const res = await contactsService.getOne(id);
        if (cancelled) return;
        const n = String(res?.name ?? [res?.firstName, res?.lastName].filter(Boolean).join(' ') ?? '').trim();
        const c = String(res?.company ?? res?.companyName ?? res?.account?.name ?? res?.accountName ?? '').trim();
        setName(n);
        setCompany(c);
        setEmail(String(res?.email ?? '').trim());
        setPhone(String(res?.phone ?? '').trim());
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initial]);

  const extractApiErrorMessage = useCallback((err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    let msg = '';
    if (typeof data === 'string') msg = data;
    else if (data && typeof data === 'object') {
      if (typeof data.message === 'string') msg = data.message;
      else if (typeof data.error === 'string') msg = data.error;
      else if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.errors) && data.errors.length) msg = String(data.errors[0]?.message || data.errors[0] || '');
    }
    if (!msg && typeof err?.message === 'string') msg = err.message;
    msg = String(msg || '').trim();
    if (status && msg) return `${status}: ${msg}`;
    if (status) return String(status);
    return msg;
  }, []);

  const handleSubmit = useCallback(async () => {
    const nextName = name.trim();
    const nextCompany = company.trim();
    if (!nextName) {
      pushToast('error', 'İsim alanı zorunludur.');
      return;
    }

    setLoading(true);
    try {
      let accountId;
      if (nextCompany) {
        try {
          const existing = await accountsService.findByName(nextCompany);
          if (existing) {
            accountId = existing?.id ?? existing?._id ?? null;
          } else {
            const acc = await accountsService.create({ name: nextCompany });
            accountId = acc?.id ?? acc?._id ?? null;
          }
        } catch {
          accountId = null;
        }
      }
      const payload = {
        name: nextName,
        company: nextCompany || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        accountId: accountId || undefined,
      };

      if (isEdit) {
        await contactsService.update(id, payload);
      } else {
        await contactsService.create(payload);
      }
      navigation.navigate('Main', {
        screen: 'Customers',
        toast: { type: 'success', message: isEdit ? 'Kişi güncellendi.' : 'Kişi eklendi.' },
      });
    } catch (_error) {
      const details = extractApiErrorMessage(_error);
      const base = isEdit ? 'Kişi güncellenemedi.' : 'Kişi eklenemedi.';
      pushToast('error', details ? `${base} (${details})` : base);
    } finally {
      setLoading(false);
    }
  }, [company, email, extractApiErrorMessage, id, isEdit, name, navigation, phone, pushToast]);

  return (
    <SafeAreaView style={styles.container}>
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type === 'success'
              ? styles.toastSuccess
              : toast.type === 'error'
                ? styles.toastError
                : toast.type === 'warning'
                  ? styles.toastWarning
                  : styles.toastInfo,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
            },
          ]}
        >
          <View style={styles.toastIconWrap}>
            <Ionicons
              name={
                toast.type === 'success'
                  ? 'checkmark-circle'
                  : toast.type === 'error'
                    ? 'close-circle'
                    : toast.type === 'warning'
                      ? 'alert-circle'
                      : 'information-circle'
              }
              size={18}
              color={
                toast.type === 'success'
                  ? colors.success
                  : toast.type === 'error'
                    ? colors.error
                    : toast.type === 'warning'
                      ? colors.warning
                      : colors.primary
              }
            />
          </View>
          <Text style={styles.toastText} numberOfLines={3}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInsetAdjustmentBehavior="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{isEdit ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}</Text>
          
          <View style={styles.form}>
            <Text style={styles.label}>Ad Soyad *</Text>
            <TextInput
              style={styles.input}
              placeholder="Müşteri Adı"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Şirket</Text>
            <TextInput
              style={styles.input}
              placeholder="Şirket Adı"
              placeholderTextColor={colors.textSecondary}
              value={company}
              onChangeText={setCompany}
            />

            <Text style={styles.label}>E-Posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@sirket.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              placeholder="0555 555 55 55"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: { flex: 1 },
    toast: {
      position: 'absolute',
      top: 10,
      left: 12,
      right: 12,
      zIndex: 10,
      elevation: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
    },
    toastSuccess: { backgroundColor: colors.surface, borderColor: colors.success },
    toastError: { backgroundColor: colors.surface, borderColor: colors.error },
    toastWarning: { backgroundColor: colors.surface, borderColor: colors.warning },
    toastInfo: { backgroundColor: colors.surface, borderColor: colors.primary },
    toastIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
    content: {
      padding: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 24,
    },
    form: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 20,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },
  });
}

export default AddCustomerScreen;
