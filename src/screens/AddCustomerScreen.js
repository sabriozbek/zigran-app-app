import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { contactsService } from '../api/services/contactsService';
import { useTheme } from '../theme/ThemeContext';

const AddCustomerScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = route?.params?.customer ?? route?.params?.contact ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;
  const isEdit = Boolean(id);

  const [name, setName] = useState(String(initial?.name ?? [initial?.firstName, initial?.lastName].filter(Boolean).join(' ') ?? '').trim());
  const [company, setCompany] = useState(String(initial?.company ?? initial?.companyName ?? '').trim());
  const [email, setEmail] = useState(String(initial?.email ?? '').trim());
  const [phone, setPhone] = useState(String(initial?.phone ?? '').trim());
  const [loading, setLoading] = useState(false);

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
        const c = String(res?.company ?? res?.companyName ?? '').trim();
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

  const handleSubmit = useCallback(async () => {
    if (!name || !company) {
      Alert.alert('Hata', 'İsim ve Şirket alanları zorunludur.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      if (isEdit) {
        await contactsService.update(id, payload);
      } else {
        await contactsService.create(payload);
      }

      Alert.alert('Başarılı', isEdit ? 'Kişi başarıyla güncellendi.' : 'Kişi başarıyla eklendi.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (_error) {
      Alert.alert('Hata', isEdit ? 'Kişi güncellenirken bir sorun oluştu.' : 'Kişi eklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  }, [company, email, id, isEdit, name, navigation, phone]);

  return (
    <SafeAreaView style={styles.container}>
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

            <Text style={styles.label}>Şirket *</Text>
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
