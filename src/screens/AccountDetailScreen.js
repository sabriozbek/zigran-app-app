import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accountsService } from '../api/services/accountsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function safeString(v) {
  return String(v ?? '').trim();
}

const AccountDetailScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = route?.params?.account ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;

  const [loading, setLoading] = useState(Boolean(id) && !initial);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: safeString(initial?.name ?? initial?.companyName),
    industry: safeString(initial?.industry ?? initial?.sector),
    website: safeString(initial?.website),
    phone: safeString(initial?.phone),
    employeeCount: safeString(initial?.employeeCount),
    annualRevenue: safeString(initial?.annualRevenue),
    taxOffice: safeString(initial?.taxOffice),
    taxNumber: safeString(initial?.taxNumber),
    description: safeString(initial?.description),
    billingAddressLine: safeString(initial?.billingAddress?.address ?? initial?.billingAddress?.line1),
    billingCity: safeString(initial?.billingAddress?.city ?? initial?.city),
    billingCountry: safeString(initial?.billingAddress?.country),
  });

  useEffect(() => {
    let cancelled = false;
    if (!id || initial) return undefined;
    (async () => {
      try {
        const res = await accountsService.get(id);
        if (!cancelled) {
          setAccount(res);
          setDraft({
            name: safeString(res?.name ?? res?.companyName),
            industry: safeString(res?.industry ?? res?.sector),
            website: safeString(res?.website),
            phone: safeString(res?.phone),
            employeeCount: safeString(res?.employeeCount),
            annualRevenue: safeString(res?.annualRevenue),
            taxOffice: safeString(res?.taxOffice),
            taxNumber: safeString(res?.taxNumber),
            description: safeString(res?.description),
            billingAddressLine: safeString(res?.billingAddress?.address ?? res?.billingAddress?.line1),
            billingCity: safeString(res?.billingAddress?.city ?? res?.city),
            billingCountry: safeString(res?.billingAddress?.country),
          });
        }
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initial]);

  useEffect(() => {
    const title = account?.name || account?.companyName || 'Firma';
    navigation.setOptions({ title: String(title) });
  }, [account?.companyName, account?.name, navigation]);

  const name = safeString(account?.name ?? account?.companyName) || 'Firma';
  const industry = safeString(account?.industry ?? account?.sector);
  const website = safeString(account?.website);
  const email = safeString(account?.email);
  const phone = safeString(account?.phone);
  const location = safeString(
    account?.billingAddress?.address ??
      account?.billingAddress?.line1 ??
      account?.location ??
      account?.city ??
      account?.address,
  );

  const openUrl = useCallback(async (url) => {
    const v = String(url || '').trim();
    if (!v) return;
    const normalized = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      await Linking.openURL(normalized);
    } catch {}
  }, []);

  const openEmail = useCallback(async (v) => {
    const emailValue = String(v || '').trim();
    if (!emailValue) return;
    try {
      await Linking.openURL(`mailto:${encodeURIComponent(emailValue)}`);
    } catch {}
  }, []);

  const openPhone = useCallback(async (v) => {
    const phoneValue = String(v || '').trim();
    if (!phoneValue) return;
    try {
      await Linking.openURL(`tel:${phoneValue}`);
    } catch {}
  }, []);

  const confirmDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Silinsin mi?', 'Bu firmayı silmek istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await accountsService.delete(id);
            navigation.goBack();
          } catch {
            Alert.alert('Hata', 'Firma silinemedi.');
          }
        },
      },
    ]);
  }, [id, navigation]);

  const startEdit = useCallback(() => {
    setDraft({
      name: safeString(account?.name ?? account?.companyName),
      industry: safeString(account?.industry ?? account?.sector),
      website: safeString(account?.website),
      phone: safeString(account?.phone),
      employeeCount: safeString(account?.employeeCount),
      annualRevenue: safeString(account?.annualRevenue),
      taxOffice: safeString(account?.taxOffice),
      taxNumber: safeString(account?.taxNumber),
      description: safeString(account?.description),
      billingAddressLine: safeString(account?.billingAddress?.address ?? account?.billingAddress?.line1),
      billingCity: safeString(account?.billingAddress?.city ?? account?.city),
      billingCountry: safeString(account?.billingAddress?.country),
    });
    setEditing(true);
  }, [account]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft({
      name: safeString(account?.name ?? account?.companyName),
      industry: safeString(account?.industry ?? account?.sector),
      website: safeString(account?.website),
      phone: safeString(account?.phone),
      employeeCount: safeString(account?.employeeCount),
      annualRevenue: safeString(account?.annualRevenue),
      taxOffice: safeString(account?.taxOffice),
      taxNumber: safeString(account?.taxNumber),
      description: safeString(account?.description),
      billingAddressLine: safeString(account?.billingAddress?.address ?? account?.billingAddress?.line1),
      billingCity: safeString(account?.billingAddress?.city ?? account?.city),
      billingCountry: safeString(account?.billingAddress?.country),
    });
  }, [account]);

  const saveEdit = useCallback(async () => {
    if (!id) return;
    const nextName = safeString(draft.name);
    if (!nextName) {
      Alert.alert('Hata', 'Firma adı zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const nextBillingAddress = {
        ...(account?.billingAddress && typeof account.billingAddress === 'object' ? account.billingAddress : {}),
        address: safeString(draft.billingAddressLine) || undefined,
        line1: safeString(draft.billingAddressLine) || undefined,
        city: safeString(draft.billingCity) || undefined,
        country: safeString(draft.billingCountry) || undefined,
      };
      const payload = {
        name: nextName,
        website: safeString(draft.website) || undefined,
        phone: safeString(draft.phone) || undefined,
        industry: safeString(draft.industry) || undefined,
        employeeCount: safeString(draft.employeeCount) || undefined,
        annualRevenue: safeString(draft.annualRevenue) || undefined,
        taxOffice: safeString(draft.taxOffice) || undefined,
        taxNumber: safeString(draft.taxNumber) || undefined,
        description: safeString(draft.description) || undefined,
        billingAddress: nextBillingAddress,
      };
      const res = await accountsService.update(id, payload);
      setAccount(res);
      setEditing(false);
      setDraft({
        name: safeString(res?.name ?? res?.companyName),
        industry: safeString(res?.industry ?? res?.sector),
        website: safeString(res?.website),
        phone: safeString(res?.phone),
        employeeCount: safeString(res?.employeeCount),
        annualRevenue: safeString(res?.annualRevenue),
        taxOffice: safeString(res?.taxOffice),
        taxNumber: safeString(res?.taxNumber),
        description: safeString(res?.description),
        billingAddressLine: safeString(res?.billingAddress?.address ?? res?.billingAddress?.line1),
        billingCity: safeString(res?.billingAddress?.city ?? res?.city),
        billingCountry: safeString(res?.billingAddress?.country),
      });
    } catch {
      Alert.alert('Hata', 'Firma güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }, [account, draft, id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInsetAdjustmentBehavior="always"
        >
          <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{String(name).slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {String(name)}
              </Text>
              {industry ? (
                <Text style={styles.heroSubtitle} numberOfLines={1}>
                  {String(industry)}
                </Text>
              ) : null}
            </View>
            {!editing ? (
              <TouchableOpacity style={styles.editIconBtn} onPress={startEdit} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={2}>
                {String(location)}
              </Text>
            </View>
          ) : null}

          {!editing ? (
            <View style={styles.actionsRow}>
              {website ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openUrl(website)} activeOpacity={0.85}>
                  <Ionicons name="globe-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>Web</Text>
                </TouchableOpacity>
              ) : null}
              {email ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEmail(email)} activeOpacity={0.85}>
                  <Ionicons name="mail-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>E-posta</Text>
                </TouchableOpacity>
              ) : null}
              {phone ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openPhone(phone)} activeOpacity={0.85}>
                  <Ionicons name="call-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>Ara</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={cancelEdit} activeOpacity={0.85} disabled={saving}>
                <Ionicons name="close" size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={saveEdit}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          )}
        </AppCard>

        {!editing ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Detaylar</Text>
            <View style={styles.kv}>
              <KeyValue label="Sektör" value={industry} styles={styles} />
              <KeyValue label="Web" value={website} styles={styles} />
              <KeyValue label="E-posta" value={email} styles={styles} />
              <KeyValue label="Telefon" value={phone} styles={styles} />
              <KeyValue label="Konum" value={location} styles={styles} />
              <KeyValue label="Çalışan" value={account?.employeeCount} styles={styles} />
              <KeyValue label="Yıllık Ciro" value={account?.annualRevenue} styles={styles} />
              <KeyValue label="Vergi Dairesi" value={account?.taxOffice} styles={styles} />
              <KeyValue label="Vergi No" value={account?.taxNumber} styles={styles} />
              <KeyValue label="Açıklama" value={account?.description} styles={styles} />
            </View>
          </AppCard>
        ) : (
          <AppCard>
            <Text style={styles.sectionTitle}>Düzenle</Text>
            <View style={styles.formGrid}>
              <FormField label="Firma Adı" value={draft.name} onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))} styles={styles} colors={colors} />
              <FormField label="Sektör" value={draft.industry} onChangeText={(t) => setDraft((p) => ({ ...p, industry: t }))} styles={styles} colors={colors} />
              <FormField label="Web" value={draft.website} onChangeText={(t) => setDraft((p) => ({ ...p, website: t }))} styles={styles} colors={colors} autoCapitalize="none" />
              <FormField label="Telefon" value={draft.phone} onChangeText={(t) => setDraft((p) => ({ ...p, phone: t }))} styles={styles} colors={colors} keyboardType="phone-pad" />
              <FormField label="Çalışan" value={draft.employeeCount} onChangeText={(t) => setDraft((p) => ({ ...p, employeeCount: t }))} styles={styles} colors={colors} keyboardType="number-pad" />
              <FormField label="Yıllık Ciro" value={draft.annualRevenue} onChangeText={(t) => setDraft((p) => ({ ...p, annualRevenue: t }))} styles={styles} colors={colors} keyboardType="number-pad" />
              <FormField label="Vergi Dairesi" value={draft.taxOffice} onChangeText={(t) => setDraft((p) => ({ ...p, taxOffice: t }))} styles={styles} colors={colors} />
              <FormField label="Vergi No" value={draft.taxNumber} onChangeText={(t) => setDraft((p) => ({ ...p, taxNumber: t }))} styles={styles} colors={colors} keyboardType="number-pad" />
              <FormField label="Adres" value={draft.billingAddressLine} onChangeText={(t) => setDraft((p) => ({ ...p, billingAddressLine: t }))} styles={styles} colors={colors} />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fLabel}>Şehir</Text>
                  <TextInput
                    value={draft.billingCity}
                    onChangeText={(t) => setDraft((p) => ({ ...p, billingCity: t }))}
                    placeholder="İstanbul"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fLabel}>Ülke</Text>
                  <TextInput
                    value={draft.billingCountry}
                    onChangeText={(t) => setDraft((p) => ({ ...p, billingCountry: t }))}
                    placeholder="Türkiye"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.fLabel}>Açıklama</Text>
              <TextInput
                value={draft.description}
                onChangeText={(t) => setDraft((p) => ({ ...p, description: t }))}
                placeholder="Kısa not..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.textarea]}
                multiline
                textAlignVertical="top"
              />
            </View>
          </AppCard>
        )}

        {id ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete} activeOpacity={0.85}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.deleteText}>Firmayı Sil</Text>
          </TouchableOpacity>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function KeyValue({ label, value, styles }) {
  const v = String(value || '').trim();
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kLabel}>{String(label)}</Text>
      <Text style={styles.kValue}>{v ? v : '—'}</Text>
    </View>
  );
}

function FormField({ label, value, onChangeText, styles, colors, keyboardType, autoCapitalize }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.fLabel}>{String(label)}</Text>
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder="—"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 12 },
    hero: { gap: 12 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroAvatar: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroAvatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
    heroTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    heroSubtitle: { marginTop: 4, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    editIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    metaText: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actionText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 110,
    },
    saveText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
    kv: { marginTop: 10, gap: 10 },
    kvRow: { gap: 4 },
    kLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
    kValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
    formGrid: { marginTop: 2 },
    fLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '900', marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    textarea: {
      minHeight: 110,
      paddingTop: 12,
      marginTop: 2,
    },
    row2: { flexDirection: 'row', gap: 10, marginTop: 10 },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: (colors.danger || '#ef4444'),
      borderRadius: 16,
      paddingVertical: 14,
      marginTop: 2,
    },
    deleteText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  });
}

export default AccountDetailScreen;
