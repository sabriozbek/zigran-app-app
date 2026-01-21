import React, { useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

const LOGO_SOURCE = require('../../assets/icon.png');

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState('info');

  const handleSubmit = async () => {
    const emailValue = String(email || '').trim().toLowerCase();
    if (!emailValue || !/^\S+@\S+\.\S+$/.test(emailValue)) {
      Alert.alert('Hata', 'Geçerli bir e‑posta girin');
      return;
    }

    setLoading(true);
    setMsg('');
    try {
      await authService.forgotPassword(emailValue);
      setMsgKind('success');
      setMsg('Şifre sıfırlama bağlantısı e‑postanıza gönderildi');
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'İşlem başarısız. Lütfen tekrar deneyin.';
      setMsgKind('error');
      setMsg(Array.isArray(message) ? message.join('\n') : String(message));
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>Şifremi Unuttum</Text>
            <Text style={styles.subtitle}>E‑posta adresinizi girin, sıfırlama bağlantısı gönderelim.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>E‑posta</Text>
            <View style={styles.inputIconRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.inputText}
                placeholder="ornek@sirket.com"
                placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {msg ? (
              <View style={[styles.msgBox, msgKind === 'error' ? styles.msgBoxError : styles.msgBoxSuccess]}>
                <Text style={[styles.msgText, msgKind === 'error' ? styles.msgTextError : styles.msgTextSuccess]}>
                  {String(msg)}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Bağlantı Gönder</Text>}
            </TouchableOpacity>

            <View style={styles.linksRow}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Login')}>
                <Text style={styles.linkText}>Giriş Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Register')}>
                <Text style={styles.linkText}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ResetPassword')} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>Token ile şifre değiştir</Text>
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
    title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
    form: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 12,
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
      fontSize: 15,
      fontWeight: '800',
      paddingVertical: 12,
    },
    msgBox: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 14,
    },
    msgBoxSuccess: {
      backgroundColor: colors.success + '14',
      borderColor: colors.success + '33',
    },
    msgBoxError: {
      backgroundColor: colors.error + '14',
      borderColor: colors.error + '33',
    },
    msgText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
    msgTextSuccess: { color: colors.success },
    msgTextError: { color: colors.error },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
    linksRow: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    linkText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
    secondaryButton: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    secondaryText: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
  });
}

export default ForgotPasswordScreen;
