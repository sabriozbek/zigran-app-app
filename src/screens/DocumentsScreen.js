import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { documentsService } from '../api/services/documentsService';
import { useTheme } from '../theme/ThemeContext';
import AppCard from '../components/AppCard';

function safeString(v) {
  return String(v ?? '').trim();
}

function getDocId(item, index) {
  return String(item?.id ?? item?._id ?? item?.documentId ?? item?.document_id ?? index);
}

function isFolderItem(item) {
  const flag = item?.isFolder ?? item?.folder ?? item?.is_folder;
  if (typeof flag === 'boolean') return flag;
  const type = String(item?.type ?? item?.kind ?? item?.resourceType ?? '').toLowerCase();
  if (type === 'folder' || type === 'directory' || type === 'dir') return true;
  return false;
}

export default function DocumentsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderStack, setFolderStack] = useState([]);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
  const currentParentId = currentFolder?.id ? String(currentFolder.id) : undefined;
  const pathLabel = folderStack.length === 0 ? '/' : `/${folderStack.map((f) => safeString(f?.name) || 'Klasör').join('/')}`;

  const pushToast = useCallback(
    (type, message) => {
      const toast = { type: type || 'success', message: String(message || '') };
      if (!toast.message) return;
      const parent = navigation?.getParent?.();
      if (parent?.setParams) parent.setParams({ toast });
      else navigation?.setParams?.({ toast });
    },
    [navigation],
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await documentsService.list({ parentId: currentParentId });
      const list = Array.isArray(res) ? res : [];
      const sorted = list.slice().sort((a, b) => {
        const fa = isFolderItem(a);
        const fb = isFolderItem(b);
        if (fa !== fb) return fa ? -1 : 1;
        const an = safeString(a?.name ?? a?.fileName ?? a?.filename).toLocaleLowerCase('tr-TR');
        const bn = safeString(b?.name ?? b?.fileName ?? b?.filename).toLocaleLowerCase('tr-TR');
        return an.localeCompare(bn, 'tr-TR');
      });
      setData(sorted);
    } catch {
      setData([]);
    }
  }, [currentParentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await fetchData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const handleUpload = useCallback(async () => {
    setUploading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !Array.isArray(res.assets) || res.assets.length === 0) return;
      const asset = res.assets[0];
      const fileName = safeString(asset?.name) || 'document';
      const mimeType = safeString(asset?.mimeType) || 'application/octet-stream';

      const file =
        asset?.file ??
        ({
          uri: asset?.uri,
          name: fileName,
          type: mimeType,
        });

      if (!file) {
        pushToast('error', 'Dosya seçilemedi.');
        return;
      }

      await documentsService.upload({ name: fileName, file, parentId: currentParentId });
      await fetchData();
      pushToast('success', 'Belge başarıyla yüklendi.');
    } catch {
      pushToast('error', 'Belge yüklenemedi.');
    } finally {
      setUploading(false);
    }
  }, [currentParentId, fetchData, pushToast]);

  const handleOpenCreateFolder = useCallback(() => {
    setFolderName('');
    setFolderModalOpen(true);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = safeString(folderName);
    if (!name) {
      pushToast('warning', 'Klasör adı gerekli.');
      return;
    }
    setCreatingFolder(true);
    try {
      await documentsService.createFolder({ name, parentId: currentParentId });
      setFolderModalOpen(false);
      setFolderName('');
      await fetchData();
      pushToast('success', 'Klasör başarıyla oluşturuldu.');
    } catch {
      pushToast('error', 'Klasör oluşturulamadı.');
    } finally {
      setCreatingFolder(false);
    }
  }, [currentParentId, fetchData, folderName, pushToast]);

  const handleEnterFolder = useCallback((item, index) => {
    const id = item?.id ?? item?._id ?? item?.documentId ?? item?.document_id ?? getDocId(item, index);
    if (!id) return;
    const name = safeString(item?.name ?? item?.fileName ?? item?.filename) || 'Klasör';
    setFolderStack((prev) => [...prev, { id: String(id), name }]);
  }, []);

  const handleGoUp = useCallback(() => {
    setFolderStack((prev) => prev.slice(0, -1));
  }, []);

  const handleDelete = useCallback(
    (item, index) => {
      const id = item?.id ?? item?._id ?? item?.documentId ?? item?.document_id ?? getDocId(item, index);
      if (!id) return;
      Alert.alert('Sil', 'Bu belgeyi silmek istiyor musunuz?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentsService.delete(id);
              setData((prev) => prev.filter((d, idx) => getDocId(d, idx) !== String(id)));
            } catch {
              pushToast('error', 'Belge silinemedi.');
            }
          },
        },
      ]);
    },
    [pushToast],
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      const isFolder = isFolderItem(item);
      const name = safeString(item?.name ?? item?.fileName ?? item?.filename) || 'Belge';
      const meta = safeString(item?.createdAt ?? item?.created_at ?? item?.uploadedAt ?? item?.uploaded_at);

      return (
        <AppCard style={styles.card}>
          <View style={styles.row}>
            {isFolder ? (
              <TouchableOpacity style={styles.mainTap} onPress={() => handleEnterFolder(item, index)} activeOpacity={0.85}>
                <View style={styles.iconBox}>
                  <Ionicons name="folder-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {meta ? String(meta) : 'Klasör'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.mainTap}>
                <View style={styles.iconBox}>
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {meta ? String(meta) : '—'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.actions}>
              {isFolder ? (
                <TouchableOpacity style={styles.openBtn} onPress={() => handleEnterFolder(item, index)} activeOpacity={0.85}>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.trashBtn} onPress={() => handleDelete(item, index)} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={18} color={colors.danger || '#ef4444'} />
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>
      );
    },
    [
      colors.danger,
      colors.primary,
      colors.textSecondary,
      handleDelete,
      handleEnterFolder,
      styles.actions,
      styles.card,
      styles.iconBox,
      styles.info,
      styles.mainTap,
      styles.openBtn,
      styles.row,
      styles.sub,
      styles.title,
      styles.trashBtn,
    ],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {folderStack.length > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleGoUp} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Belgeler</Text>
          <Text style={styles.h2} numberOfLines={1}>
            {folderStack.length === 0 ? 'Dosyaları yükle ve yönet' : `Konum: ${pathLabel}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.folderBtn} onPress={handleOpenCreateFolder} activeOpacity={0.85} disabled={creatingFolder}>
            <Ionicons name="folder-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.folderText}>Klasör</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} activeOpacity={0.85} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.uploadText}>Yükle</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => getDocId(item, index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="folder-open-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>{folderStack.length === 0 ? 'Henüz belge yok.' : 'Bu klasör boş.'}</Text>
            </View>
          }
        />
      )}

      <Modal visible={folderModalOpen} transparent animationType="fade" onRequestClose={() => setFolderModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFolderModalOpen(false)} />
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView
            style={styles.modalCard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: 18 })}
          >
            <Text style={styles.modalTitle}>Yeni Klasör</Text>
            <TextInput
              style={styles.modalInput}
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Klasör adı"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="sentences"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setFolderModalOpen(false)} activeOpacity={0.85} disabled={creatingFolder}>
                <Text style={styles.modalGhostText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleCreateFolder} activeOpacity={0.85} disabled={creatingFolder}>
                {creatingFolder ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    h1: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    h2: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    folderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minWidth: 98,
    },
    folderText: { color: colors.textPrimary, fontWeight: '900' },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      height: 42,
      borderRadius: 14,
      minWidth: 110,
    },
    uploadText: { color: '#fff', fontWeight: '900' },
    list: { padding: 16, paddingTop: 0, gap: 12 },
    card: { padding: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
    mainTap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, minWidth: 0, gap: 4 },
    title: { color: colors.textPrimary, fontSize: 14, fontWeight: '900' },
    sub: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    openBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    trashBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { color: colors.textSecondary, fontWeight: '700' },
    modalBackdrop: { position: 'absolute', inset: 0, backgroundColor: '#00000088' },
    modalWrap: { flex: 1, justifyContent: 'center', padding: 14 },
    modalCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
    modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalGhostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    modalGhostText: { color: colors.textPrimary, fontWeight: '900' },
    modalPrimaryBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary, minWidth: 96, alignItems: 'center' },
    modalPrimaryText: { color: '#fff', fontWeight: '900' },
  });
}
