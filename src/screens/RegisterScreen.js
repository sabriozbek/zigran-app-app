import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { authService } from '../api/authService';
import { useTheme } from '../theme/ThemeContext';

const LOGO_SOURCE = require('../../assets/icon.png');

const RegisterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalSteps = 3;
  const steps = useMemo(() => ['Şirket', 'Admin', 'Giriş'], []);
  const companySizes = useMemo(
    () => [
      { value: '1-10', label: '1-10 Çalışan' },
      { value: '11-50', label: '11-50 Çalışan' },
      { value: '51-200', label: '51-200 Çalışan' },
      { value: '201+', label: '201+ Çalışan' },
    ],
    [],
  );

  const [companyName, setCompanyName] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [step, setStep] = useState(1);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const validate = useCallback(
    (targetStep) => {
      const nextErrors = {};
      const companyNameValue = String(companyName || '').trim();
      const firstNameValue = String(firstName || '').trim();
      const lastNameValue = String(lastName || '').trim();
      const positionValue = String(position || '').trim();
      const phoneValue = String(phone || '').trim();
      const emailValue = String(email || '').trim().toLowerCase();
      const passwordValue = String(password || '');

      if (targetStep === 1 || targetStep === 'all') {
        if (companyNameValue.length < 2) nextErrors.companyName = 'Şirket adı en az 2 karakter';
        if (!companySize) nextErrors.companySize = 'Lütfen seçim yapın';
      }

      if (targetStep === 2 || targetStep === 'all') {
        if (firstNameValue.length < 2) nextErrors.firstName = 'Ad en az 2 karakter';
        if (lastNameValue.length < 2) nextErrors.lastName = 'Soyad en az 2 karakter';
        if (phoneValue.replace(/\D/g, '').length < 10) nextErrors.phone = 'Telefon en az 10 karakter';
        if (positionValue.length < 3) nextErrors.position = 'Pozisyon en az 3 karakter';
      }

      if (targetStep === 3 || targetStep === 'all') {
        if (!emailValue || !/^\S+@\S+\.\S+$/.test(emailValue)) nextErrors.email = 'Geçerli bir e‑posta girin';
        if (passwordValue.length < 6) nextErrors.password = 'Şifre en az 6 karakter olmalı';
      }
      setFieldErrors(nextErrors);
      return {
        nextErrors,
        values: { companyNameValue, firstNameValue, lastNameValue, positionValue, phoneValue, emailValue, passwordValue },
      };
    },
    [companyName, companySize, email, firstName, lastName, password, phone, position],
  );

  const handleNext = useCallback(() => {
    setError('');
    const { nextErrors } = validate(step);
    if (Object.keys(nextErrors).length > 0) return;
    setStep((s) => Math.min(totalSteps, s + 1));
  }, [step, totalSteps, validate]);

  const handleBack = useCallback(() => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleRegister = async () => {
    setError('');
    const { nextErrors, values } = validate('all');
    if (Object.keys(nextErrors).length > 0) {
      const firstErrorKey = Object.keys(nextErrors)[0];
      if (firstErrorKey) {
        const targetStep =
          firstErrorKey === 'companyName' || firstErrorKey === 'companySize'
            ? 1
            : firstErrorKey === 'firstName' || firstErrorKey === 'lastName' || firstErrorKey === 'phone' || firstErrorKey === 'position'
              ? 2
              : 3;
        setStep(targetStep);
      }
      return;
    }

    setError('');
    setLoading(true);
    try {
      await authService.signup({
        companyName: values.companyNameValue,
        companySize,
        firstName: values.firstNameValue,
        lastName: values.lastNameValue,
        position: values.positionValue,
        phone: values.phoneValue,
        email: values.emailValue,
        password: values.passwordValue,
      });
      navigation.replace('Main', { toast: { type: 'success', message: 'Hesabın oluşturuldu. Hoş geldin!' } });
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409) setError('Bu e‑posta zaten kayıtlı');
      else if (status === 400) setError('Form doğrulaması hatalı');
      else {
        setError('Sunucu hatası, lütfen tekrar deneyin');
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Kayıt başarısız. Lütfen bilgileri kontrol edin.';
        Alert.alert('Hata', Array.isArray(message) ? message.join('\n') : String(message));
      }
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
            <Text style={styles.title}>Hesap Oluştur</Text>
            <Text style={styles.subtitle}>Hemen başlayın, işinizi büyütün</Text>
            <Text style={styles.trialHint}>Kayıt olduğunuzda ücretsiz 30 günlük denemeniz başlatılır.</Text>
          </View>

          <View style={styles.stack}>
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.85}
              onPress={() => Alert.alert('Yakında', 'Google ile kayıt bu sürümde aktif değil.')}
            >
              <View style={styles.googleMark}>
                <Text style={styles.googleMarkText}>G</Text>
              </View>
              <Text style={styles.googleText}>Google ile Kayıt Ol</Text>
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

              <View style={styles.stepper}>
                {steps.map((label, i) => {
                  const n = i + 1;
                  const active = n === step;
                  const done = n < step;
                  const canPress = n < step && !loading;
                  return (
                    <TouchableOpacity
                      key={String(label || n)}
                      style={[styles.stepPill, active ? styles.stepPillActive : null, done ? styles.stepPillDone : null]}
                      activeOpacity={0.85}
                      disabled={!canPress}
                      onPress={() => {
                        if (!canPress) return;
                        setError('');
                        setStep(n);
                      }}
                    >
                      <View style={[styles.stepPillNum, active ? styles.stepPillNumActive : null, done ? styles.stepPillNumDone : null]}>
                        {done ? (
                          <Ionicons name="checkmark" size={14} color={colors.primary} />
                        ) : (
                          <Text style={[styles.stepPillNumText, active ? styles.stepPillNumTextActive : null]}>{n}</Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepPillText,
                          active ? styles.stepPillTextActive : null,
                          done ? styles.stepPillTextDone : null,
                        ]}
                        numberOfLines={1}
                      >
                        {label || `Adım ${n}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {step === 1 ? (
                <>
                  <Text style={styles.stepTitle}>Şirket Bilgileri</Text>
                  <Text style={styles.stepSubtitle}>Şirketini tanımla, hesabı oluşturalım.</Text>

                  <Text style={styles.label}>Şirket Adı</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.companyName ? styles.inputError : null]}
                    placeholder="Şirket Adı"
                    placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                    value={companyName}
                    onChangeText={(t) => {
                      setCompanyName(t);
                      if (fieldErrors.companyName) setFieldErrors((prev) => ({ ...prev, companyName: undefined }));
                    }}
                    autoCorrect={false}
                  />
                  {fieldErrors.companyName ? <Text style={styles.fieldError}>{String(fieldErrors.companyName)}</Text> : null}

                  <Text style={styles.label}>Çalışan Sayısı</Text>
                  <View style={styles.segmentRow}>
                    {companySizes.map((item) => {
                      const active = item.value && item.value === companySize;
                      return (
                        <TouchableOpacity
                          key={item.value || 'placeholder'}
                          style={[styles.segment, active ? styles.segmentActive : null]}
                          onPress={() => setCompanySize(item.value)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              active ? styles.segmentTextActive : null,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {fieldErrors.companySize ? <Text style={styles.fieldError}>{String(fieldErrors.companySize)}</Text> : null}
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <Text style={styles.stepTitle}>Admin Bilgileri</Text>
                  <Text style={styles.stepSubtitle}>Hesabı yönetecek kişiyi tanımla.</Text>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Ad</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.firstName ? styles.inputError : null]}
                        placeholder="Adınız"
                        placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                        value={firstName}
                        onChangeText={(t) => {
                          setFirstName(t);
                          if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                        }}
                        autoCorrect={false}
                      />
                      {fieldErrors.firstName ? <Text style={styles.fieldError}>{String(fieldErrors.firstName)}</Text> : null}
                    </View>

                    <View style={styles.col}>
                      <Text style={styles.label}>Soyad</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.lastName ? styles.inputError : null]}
                        placeholder="Soyadınız"
                        placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                        value={lastName}
                        onChangeText={(t) => {
                          setLastName(t);
                          if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                        }}
                        autoCorrect={false}
                      />
                      {fieldErrors.lastName ? <Text style={styles.fieldError}>{String(fieldErrors.lastName)}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Telefon</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.phone ? styles.inputError : null]}
                        placeholder="5XX XXX XX XX"
                        placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                        value={phone}
                        onChangeText={(t) => {
                          setPhone(t);
                          if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        keyboardType="phone-pad"
                      />
                      {fieldErrors.phone ? <Text style={styles.fieldError}>{String(fieldErrors.phone)}</Text> : null}
                    </View>

                    <View style={styles.col}>
                      <Text style={styles.label}>Pozisyon</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.position ? styles.inputError : null]}
                        placeholder="Ünvanınız"
                        placeholderTextColor={colors.placeholder ?? colors.textSecondary}
                        value={position}
                        onChangeText={(t) => {
                          setPosition(t);
                          if (fieldErrors.position) setFieldErrors((prev) => ({ ...prev, position: undefined }));
                        }}
                        autoCorrect={false}
                      />
                      {fieldErrors.position ? <Text style={styles.fieldError}>{String(fieldErrors.position)}</Text> : null}
                    </View>
                  </View>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <Text style={styles.stepTitle}>Giriş Bilgileri</Text>
                  <Text style={styles.stepSubtitle}>E-posta ve şifre ile güvenli giriş yap.</Text>

                  <Text style={styles.label}>E-Posta</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.email ? styles.inputError : null]}
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
                  />
                  {fieldErrors.email ? <Text style={styles.fieldError}>{String(fieldErrors.email)}</Text> : null}

                  <Text style={styles.label}>Şifre</Text>
                  <View style={[styles.inputIconRow, fieldErrors.password ? styles.inputIconRowError : null]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                    <TextInput
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
                    />
                    <TouchableOpacity style={styles.trailingIconBtn} onPress={() => setPasswordVisible((v) => !v)} activeOpacity={0.85}>
                      <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? <Text style={styles.fieldError}>{String(fieldErrors.password)}</Text> : null}
                </>
              ) : null}

              <View style={styles.navRow}>
                {step > 1 ? (
                  <TouchableOpacity
                    style={styles.backIconBtn}
                    onPress={handleBack}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                ) : null}

                {step < totalSteps ? (
                  <TouchableOpacity style={[styles.button, styles.buttonFull]} onPress={handleNext} disabled={loading} activeOpacity={0.85}>
                    <Text style={styles.buttonText}>Devam</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.button, styles.buttonFull]} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Hesap Oluştur</Text>}
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.footerTextRow}>
                <Text style={styles.footerTextMuted}>Zaten hesabın var mı? </Text>
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.replace('Login')}>
                  <Text style={styles.footerLink}>Giriş yap</Text>
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
      paddingTop: 16,
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 12,
      resizeMode: 'contain',
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '700',
      textAlign: 'center',
    },
    trialHint: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '700',
      textAlign: 'center',
    },
    stack: {
      gap: 12,
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
      height: 44,
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
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 16,
      padding: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2 ?? colors.background,
    },
    stepPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      maxWidth: '100%',
    },
    stepPillActive: {
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      backgroundColor: colors.surface,
    },
    stepPillDone: {
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '10',
    },
    stepPillNum: {
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    stepPillNumActive: {
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '12',
    },
    stepPillNumDone: {
      borderColor: colors.primary + '2A',
      backgroundColor: colors.primary + '12',
    },
    stepPillNumText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
    },
    stepPillNumTextActive: {
      color: colors.primary,
    },
    stepPillText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
      maxWidth: 96,
    },
    stepPillTextActive: {
      color: colors.primary,
    },
    stepPillTextDone: {
      color: colors.textPrimary,
    },
    stepItem: {
      flex: 1,
    },
    stepTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepCircle: {
      width: 30,
      height: 30,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircleActive: {
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
    },
    stepCircleDone: {
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
    },
    stepCircleText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '900',
    },
    stepCircleTextActive: {
      color: colors.primary,
    },
    stepCircleTextDone: {
      color: colors.primary,
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: colors.border,
      marginHorizontal: 8,
      borderRadius: 2,
      marginTop: -1,
    },
    stepLineDone: {
      backgroundColor: colors.primary + '55',
    },
    stepLineSpacer: {
      flex: 1,
      height: 2,
      marginHorizontal: 8,
      marginTop: -1,
    },
    stepLabel: {
      marginTop: 8,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    stepLabelActive: {
      color: colors.textPrimary,
      fontWeight: '900',
    },
    stepLabelDone: {
      color: colors.primary,
      fontWeight: '900',
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
    twoColRow: {
      flexDirection: 'row',
      gap: 12,
    },
    col: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    stepSubtitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    input: {
      backgroundColor: colors.surface2 ?? colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16,
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
      marginBottom: 16,
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
      marginTop: -8,
      marginBottom: 12,
      color: colors.error,
      fontSize: 12,
      fontWeight: '800',
    },
    segmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
      columnGap: 10,
      marginBottom: 16,
    },
    segment: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface2 ?? colors.background,
      flexBasis: '48%',
      maxWidth: '48%',
    },
    segmentActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '12',
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: colors.primary,
      fontWeight: '900',
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    buttonFull: {
      flex: 1,
    },
    backIconBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2 ?? colors.background,
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

export default RegisterScreen;
