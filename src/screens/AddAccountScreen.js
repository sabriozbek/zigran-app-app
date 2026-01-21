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
import { accountsService } from '../api/services/accountsService';
import { useTheme } from '../theme/ThemeContext';

const AddAccountScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = useCallback(async () => {
    const nameValue = String(name || '').trim();
    if (!nameValue) {
      Alert.alert('Hata', 'Firma adı zorunludur.');
      return;
    }

    const payload = {
      name: nameValue,
      ...(String(industry || '').trim() ? { industry: String(industry || '').trim() } : {}),
      ...(String(website || '').trim() ? { website: String(website || '').trim() } : {}),
      ...(String(phone || '').trim() ? { phone: String(phone || '').trim() } : {}),
      ...(String(employeeCount || '').trim() ? { employeeCount: String(employeeCount || '').trim() } : {}),
      ...(String(taxOffice || '').trim() ? { taxOffice: String(taxOffice || '').trim() } : {}),
      ...(String(taxNumber || '').trim() ? { taxNumber: String(taxNumber || '').trim() } : {}),
      ...(String(address || '').trim() ? { billingAddress: { address: String(address || '').trim() } } : {}),
      ...(String(description || '').trim() ? { description: String(description || '').trim() } : {}),
    };

    setSaving(true);
    try {
      await accountsService.create(payload);
      Alert.alert('Başarılı', 'Firma oluşturuldu.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Hata', 'Firma oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }, [address, description, employeeCount, industry, name, navigation, phone, taxNumber, taxOffice, website]);

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
            <Text style={styles.title}>Yeni Firma</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Firma Adı *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Firma adı"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Sektör</Text>
              <TextInput
                style={styles.input}
                value={industry}
                onChangeText={setIndustry}
                placeholder="Örn: E-ticaret"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Web Sitesi</Text>
              <TextInput
                style={styles.input}
                value={website}
                onChangeText={setWebsite}
                placeholder="https://"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
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
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Çalışan Sayısı</Text>
                <TextInput
                  style={styles.input}
                  value={employeeCount}
                  onChangeText={setEmployeeCount}
                  placeholder="Örn: 11-50"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vergi Dairesi</Text>
              <TextInput
                style={styles.input}
                value={taxOffice}
                onChangeText={setTaxOffice}
                placeholder="Örn: Kadıköy"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vergi Numarası</Text>
              <TextInput
                style={styles.input}
                value={taxNumber}
                onChangeText={setTaxNumber}
                placeholder="Vergi numarası"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Adres</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={address}
                onChangeText={setAddress}
                placeholder="Fatura adresi"
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Açıklama</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Notlar"
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Oluştur</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: 16 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    row: { flexDirection: 'row', gap: 10 },
    field: { gap: 8 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
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
    multiline: {
      minHeight: 96,
      paddingTop: 12,
    },
    saveButton: {
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  });
}

export default AddAccountScreen;
