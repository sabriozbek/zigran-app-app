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

const ResetPasswordScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initialToken = route?.params?.token ? String(route.params.token) : '';
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState('info');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleReset = async () => {
    const tokenValue = String(token || '').trim();
    const passwordValue = String(newPassword || '');
    const confirmValue = String(confirmPassword || '');

    if (!tokenValue) {
      Alert.alert('Hata', 'Lütfen token girin.');
      return;
    }
    if (passwordValue.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı');
      return;
    }
    if (passwordValue !== confirmValue) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    setMsg('');
    try {
      await authService.resetPassword({ token: tokenValue, newPassword: passwordValue });
      setMsgKind('success');
      setMsg('Şifre sıfırlandı, giriş sayfasına yönlendiriliyorsunuz...');
      Alert.alert('Başarılı', 'Şifreniz güncellendi.', [{ text: 'Giriş Yap', onPress: () => navigation.replace('Login') }]);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Şifre değiştirilemedi. Lütfen tekrar deneyin.';
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
            <Text style={styles.title}>Şifre Sıfırla</Text>
            <Text style={styles.subtitle}>Yeni şifre belirleyin</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Token</Text>
            <View style={styles.inputIconRow}>
              <Ionicons name="key-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.inputText}
                placeholder="Token"
                placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Yeni Şifre</Text>
            <View style={styles.inputIconRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.inputText}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!passwordVisible}
                textContentType="newPassword"
              />
              <TouchableOpacity style={styles.trailingIconBtn} onPress={() => setPasswordVisible((v) => !v)} activeOpacity={0.85}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
            <View style={styles.inputIconRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={styles.inputText}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!passwordVisible}
                textContentType="newPassword"
              />
              <TouchableOpacity style={styles.trailingIconBtn} onPress={() => setPasswordVisible((v) => !v)} activeOpacity={0.85}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {msg ? (
              <View style={[styles.msgBox, msgKind === 'error' ? styles.msgBoxError : styles.msgBoxSuccess]}>
                <Text style={[styles.msgText, msgKind === 'error' ? styles.msgTextError : styles.msgTextSuccess]}>
                  {String(msg)}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kaydet</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => navigation.replace('Login')} activeOpacity={0.85}>
              <Text style={styles.linkText}>Giriş Yap</Text>
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
    trailingIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
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
    linkButton: { marginTop: 14, alignItems: 'center' },
    linkText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  });
}

export default ResetPasswordScreen;
