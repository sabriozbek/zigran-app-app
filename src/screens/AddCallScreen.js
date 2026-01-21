import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { callsService } from '../api/services/callsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

const STATUS_OPTIONS = [
  { key: 'planned', label: 'Planlı', icon: 'calendar-outline' },
  { key: 'completed', label: 'Tamamlandı', icon: 'checkmark-circle-outline' },
  { key: 'missed', label: 'Cevapsız', icon: 'close-circle-outline' },
];

function safeString(v) {
  return String(v ?? '').trim();
}

export default function AddCallScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = route?.params?.call ?? null;
  const id = route?.params?.id ?? initial?.id ?? initial?._id ?? null;
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(Boolean(id) && !initial);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState(safeString(initial?.subject) || 'Arama');
  const [contactName, setContactName] = useState(safeString(initial?.contactName ?? initial?.contact_name));
  const [companyName, setCompanyName] = useState(safeString(initial?.companyName ?? initial?.company_name));
  const [phone, setPhone] = useState(safeString(initial?.phone));
  const [description, setDescription] = useState(safeString(initial?.description));
  const [status, setStatus] = useState(safeString(initial?.status ?? initial?.state) || 'planned');
  const [duration, setDuration] = useState(
    initial?.duration === undefined || initial?.duration === null ? '' : String(initial.duration),
  );

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Aramayı Düzenle' : 'Yeni Arama' });
  }, [isEdit, navigation]);

  useEffect(() => {
    let cancelled = false;
    if (!id || initial) return undefined;
    (async () => {
      try {
        const res = await callsService.get(id);
        if (!cancelled) {
          setSubject(safeString(res?.subject) || 'Arama');
          setContactName(safeString(res?.contactName ?? res?.contact_name));
          setCompanyName(safeString(res?.companyName ?? res?.company_name));
          setPhone(safeString(res?.phone));
          setDescription(safeString(res?.description));
          setStatus(safeString(res?.status ?? res?.state) || 'planned');
          setDuration(res?.duration === undefined || res?.duration === null ? '' : String(res.duration));
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initial]);

  const canSave = useMemo(() => {
    const s = safeString(subject);
    return s.length > 0;
  }, [subject]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        subject: safeString(subject),
        contactName: safeString(contactName),
        companyName: safeString(companyName),
        phone: safeString(phone),
        description: safeString(description),
        status: safeString(status) || 'planned',
        duration: duration === '' ? undefined : Number(duration),
      };

      const res = isEdit ? await callsService.update(id, payload) : await callsService.create(payload);
      const nextId = res?.id ?? res?._id ?? id;
      if (nextId) {
        navigation.replace('CallDetail', { id: nextId, call: res });
        return;
      }
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Arama kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }, [canSave, companyName, contactName, description, duration, id, isEdit, navigation, phone, status, subject]);

  const handleCancel = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
          <AppCard style={styles.card}>
            <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

            <Text style={styles.label}>Konu</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Örn. Teklif görüşmesi"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoCapitalize="sentences"
            />

            <View style={styles.grid2}>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Kişi</Text>
                <TextInput
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="Örn. Ahmet Yılmaz"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Firma</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Örn. Zigran"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.grid2}>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Telefon</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+90..."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Süre (sn)</Text>
                <TextInput
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="Örn. 120"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Durum</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = String(status) === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.chip,
                      { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '14' : colors.surface },
                    ]}
                    onPress={() => setStatus(opt.key)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={opt.icon} size={14} color={active ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.chipText, { color: active ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Not</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Kısa not..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
            />
          </AppCard>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel} activeOpacity={0.85} disabled={saving}>
              <Text style={styles.secondaryText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, (!canSave || saving) && { opacity: 0.6 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={!canSave || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 24, gap: 12 },
    card: { padding: 16 },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: 6 },
    label: { color: colors.textSecondary, fontSize: 11, fontWeight: '900', marginTop: 10, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    textarea: {
      minHeight: 110,
      paddingTop: 12,
    },
    grid2: { flexDirection: 'row', gap: 10 },
    gridCol: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: { fontSize: 12, fontWeight: '900' },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    secondaryBtn: {
      width: 120,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { color: colors.textPrimary, fontWeight: '900', fontSize: 14 },
  });
}
