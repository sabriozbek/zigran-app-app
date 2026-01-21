import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { leadsService } from '../api/services/leadsService';
import { useTheme } from '../theme/ThemeContext';

const LeadUpsertScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initialLead = route?.params?.lead ?? null;
  const leadId = route?.params?.leadId ?? route?.params?.id ?? initialLead?.id ?? initialLead?._id ?? null;
  const isEdit = Boolean(leadId);

  const [name, setName] = useState(String(initialLead?.name ?? initialLead?.fullName ?? ''));
  const [companyName, setCompanyName] = useState(String(initialLead?.companyName ?? initialLead?.company ?? ''));
  const [email, setEmail] = useState(String(initialLead?.email ?? ''));
  const [phone, setPhone] = useState(String(initialLead?.phone ?? ''));
  const [status, setStatus] = useState(String(initialLead?.status ?? initialLead?.stage ?? ''));
  const [score, setScore] = useState(
    initialLead?.score !== undefined && initialLead?.score !== null
      ? String(initialLead.score)
      : initialLead?.leadScore !== undefined && initialLead?.leadScore !== null
        ? String(initialLead.leadScore)
        : '',
  );
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const payload = {
      ...(name ? { name } : {}),
      ...(companyName ? { companyName } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(status ? { status } : {}),
      ...(score ? { score: Number(score) } : {}),
    };

    if (!payload.name && !payload.email && !payload.phone) {
      Alert.alert('Hata', 'En az bir alan doldurun (isim, e-posta veya telefon).');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await leadsService.update(leadId, payload);
      } else {
        await leadsService.create(payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Hata', isEdit ? 'Lead güncellenemedi.' : 'Lead oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }, [companyName, email, isEdit, leadId, name, navigation, phone, score, status]);

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
          <View style={styles.card}>
            <Text style={styles.title}>{isEdit ? 'Lead Düzenle' : 'Yeni Lead'}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>İsim</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ad Soyad"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Şirket</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Firma"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@sirket.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Telefon</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+90..."
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Durum</Text>
                <TextInput
                  style={styles.input}
                  value={status}
                  onChangeText={setStatus}
                  placeholder="Yeni / İletişimde / ..."
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Skor</Text>
                <TextInput
                  style={styles.input}
                  value={score}
                  onChangeText={setScore}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>
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
      padding: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    field: {
      gap: 8,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    saveButton: {
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 15,
    },
  });
}

export default LeadUpsertScreen;
