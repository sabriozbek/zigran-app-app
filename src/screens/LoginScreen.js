import React, { useMemo, useRef, useState } from 'react';
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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const LOGO_SOURCE = require('../../assets/icon.png');

const GOOGLE_WEB_CLIENT_ID = '226159104512-2mjto4j121blk3ngoua2p9h931s7udcc.apps.googleusercontent.com';

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googlePrompting, setGooglePrompting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordRef = useRef(null);

  const googleNonce = useMemo(() => `${Date.now()}-${Math.random().toString(16).slice(2)}`, []);
  const googleRedirectUri = useMemo(() => AuthSession.makeRedirectUri({ useProxy: true }), []);
  const googleDiscovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const [googleRequest, googleResponse, promptGoogleLogin] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      redirectUri: googleRedirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      extraParams: { nonce: googleNonce, prompt: 'select_account' },
    },
    googleDiscovery,
  );

  React.useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') return;
    const idToken = googleResponse?.params?.id_token || googleResponse?.params?.idToken;
    if (!idToken) {
      setError('Google ile giriş başlatıldı ancak token alınamadı.');
      return;
    }
    setGoogleLoading(true);
    setError('');
    authService
      .loginWithGoogle(idToken)
      .then((result) => {
        if (result?.twoFactorRequired && result?.ticketId) {
          Alert.alert('Doğrulama Gerekli', 'E‑posta adresinize doğrulama kodu gönderildi.');
          navigation.replace('TwoFactor', { ticketId: result.ticketId });
          return;
        }
        navigation.replace('Main', { toast: { type: 'success', message: 'Başarıyla giriş yaptın.' } });
      })
      .catch((e) => {
        const status = e?.response?.status;
        if (status === 401) setError('Google ile giriş reddedildi');
        else setError('Google ile giriş yapılamadı, lütfen tekrar deneyin');
      })
      .finally(() => setGoogleLoading(false));
  }, [googleResponse, navigation]);

  const handleLogin = async () => {
    const emailValue = String(email || '').trim().toLowerCase();
    const passwordValue = String(password || '');
    const nextErrors = {};

    if (!emailValue || !/^\S+@\S+\.\S+$/.test(emailValue)) {
      nextErrors.email = 'Geçerli bir e‑posta girin';
    }
    if (!passwordValue || passwordValue.length < 6) {
      nextErrors.password = 'Şifre en az 6 karakter olmalı';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      const result = await authService.login(emailValue, passwordValue);

      if (result?.twoFactorRequired && result?.ticketId) {
        setLoading(false);
        Alert.alert('Doğrulama Gerekli', 'E‑posta adresinize doğrulama kodu gönderildi.');
        navigation.replace('TwoFactor', { ticketId: result.ticketId });
        return;
      }

      setLoading(false);
      navigation.replace('Main', { toast: { type: 'success', message: 'Başarıyla giriş yaptın.' } });
    } catch (error) {
      setLoading(false);
      const status = error?.response?.status;
      if (status === 401) setError('E‑posta veya şifre hatalı');
      else if (status === 409) setError('Hesap geçersiz durumda');
      else if (status === 400) setError(error?.response?.data?.message || 'Form doğrulaması hatalı');
      else {
        setError('Sunucu hatası, lütfen tekrar deneyin');
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          'Giriş yapılamadı. Bilgilerinizi kontrol edin.';
        Alert.alert('Hata', Array.isArray(errorMessage) ? errorMessage.join('\n') : String(errorMessage));
      }
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
            <Text style={styles.title}>Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>Hesabınıza giriş yaparak devam edin</Text>
          </View>

          <View style={styles.stack}>
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.85}
              onPress={async () => {
                if (!googleRequest) {
                  Alert.alert('Hata', 'Google giriş yapılandırması hazır değil.');
                  return;
                }
                setError('');
                setGooglePrompting(true);
                try {
                  await promptGoogleLogin({ useProxy: true });
                } catch {
                } finally {
                  setGooglePrompting(false);
                }
              }}
              disabled={googlePrompting || googleLoading}
            >
              <View style={styles.googleMark}>
                {googlePrompting || googleLoading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Text style={styles.googleMarkText}>G</Text>
                )}
              </View>
              <Text style={styles.googleText}>{googlePrompting || googleLoading ? 'Google...' : 'Google ile Giriş Yap'}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Veya e-posta ile</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{String(error)}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>E-Posta</Text>
              <View style={[styles.inputIconRow, fieldErrors.email ? styles.inputIconRowError : null]}>
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.inputText}
                  placeholder="ornek@sirket.com"
                  placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus?.()}
                />
              </View>
              {fieldErrors.email ? <Text style={styles.fieldError}>{String(fieldErrors.email)}</Text> : null}

              <View style={styles.passwordRow}>
                <Text style={styles.label}>Şifre</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.passwordLink}>Şifremi unuttum?</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputIconRow, fieldErrors.password ? styles.inputIconRowError : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  ref={passwordRef}
                  style={styles.inputText}
                  placeholder="••••••••"
                  placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.trailingIconBtn}
                  onPress={() => setPasswordVisible((v) => !v)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {fieldErrors.password ? <Text style={styles.fieldError}>{String(fieldErrors.password)}</Text> : null}

              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
              </TouchableOpacity>

              <View style={styles.footerTextRow}>
                <Text style={styles.footerTextMuted}>Hesabınız yok mu? </Text>
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Register')}>
                  <Text style={styles.footerLink}>Hemen kayıt olun</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      gap: 10,
    },
    logo: {
      width: 56,
      height: 56,
      borderRadius: 14,
      resizeMode: 'contain',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    stack: {
      marginTop: 22,
      gap: 14,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      height: 48,
    },
    googleMark: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleMarkText: {
      color: colors.textPrimary,
      fontWeight: '900',
      fontSize: 14,
    },
    googleText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    form: {
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow ?? '#000',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    errorBox: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.error + '14',
      borderWidth: 1,
      borderColor: colors.error + '33',
      marginBottom: 14,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
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
      marginBottom: 8,
    },
    inputIconRowError: {
      borderColor: colors.error + 'AA',
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
    inputError: {
      borderColor: colors.error + 'AA',
    },
    fieldError: {
      marginBottom: 12,
      color: colors.error,
      fontSize: 12,
      fontWeight: '800',
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    passwordLink: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    button: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },
    footerTextRow: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    footerTextMuted: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    footerLink: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
    },
  });
}

export default LoginScreen;
