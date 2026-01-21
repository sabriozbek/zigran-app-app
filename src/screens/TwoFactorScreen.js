import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

const LOGO_SOURCE = require('../../assets/icon.png');

const TwoFactorScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ticketId = route?.params?.ticketId ? String(route.params.ticketId) : '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleVerify = async () => {
    const codeValue = String(code || '').replace(/\D/g, '').slice(0, 6);
    if (!ticketId || codeValue.length < 6) {
      Alert.alert('Hata', 'Lütfen 6 haneli kodu girin.');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyTwoFactor({ ticketId, code: codeValue });
      navigation.replace('Main', { toast: { type: 'success', message: 'Doğrulandı. Hoş geldin!' } });
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Kod doğrulanamadı.';
      Alert.alert('Hata', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!ticketId) return;
    setResendLoading(true);
    try {
      const res = await authService.resendTwoFactor({ ticketId });
      const newTicketId = res?.ticketId;
      Alert.alert('Gönderildi', 'Yeni doğrulama kodu e-posta adresinize gönderildi.');
      if (newTicketId) {
        navigation.setParams({ ticketId: String(newTicketId) });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Kod tekrar gönderilemedi.';
      Alert.alert('Hata', Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setResendLoading(false);
    }
  };

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
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Startup')}>
              <Image source={LOGO_SOURCE} style={styles.logo} />
            </TouchableOpacity>
            <Text style={styles.title}>İki Adımlı Doğrulama</Text>
            <Text style={styles.subtitle}>Lütfen e‑posta adresinize gönderilen 6 haneli kodu girin.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Kod</Text>
            <View style={styles.inputIconRow}>
              <Ionicons name="keypad-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.inputText}
                placeholder="123456"
                placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (code.replace(/\D/g, '').length < 6) return;
                  handleVerify();
                }}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, code.replace(/\D/g, '').length < 6 ? styles.buttonDisabled : null]}
              onPress={handleVerify}
              disabled={loading || code.replace(/\D/g, '').length < 6}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Doğrula ve Giriş Yap</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleResend} disabled={resendLoading} activeOpacity={0.85}>
              {resendLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryText}>Kodu tekrar gönder</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.replace('Login')} activeOpacity={0.85}>
              <Text style={styles.linkText}>Geri Dön</Text>
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
    content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 28 },
    header: { alignItems: 'center', gap: 10, marginBottom: 18 },
    logo: { width: 56, height: 56, borderRadius: 14, resizeMode: 'contain' },
    title: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
    form: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow ?? '#000',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    label: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    inputIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2 ?? colors.background,
      borderRadius: 14,
      paddingHorizontal: 12,
      minHeight: 50,
      marginBottom: 16,
    },
    inputText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      paddingVertical: 12,
      letterSpacing: 10,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    secondaryButton: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
    linkButton: { marginTop: 16, alignItems: 'center' },
    linkText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  });
}

export default TwoFactorScreen;
