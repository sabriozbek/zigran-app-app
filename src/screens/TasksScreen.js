import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { tasksService } from '../api/services/tasksService';
import { useTheme } from '../theme/ThemeContext';

const TasksScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const tasks = await tasksService.getAll();
      setData(tasks);
    } catch (_error) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.statusIndicator, { backgroundColor: item.completed ? colors.success : colors.secondary }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('tr-TR') : 'Tarih yok'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id ?? item?._id ?? item?.uuid ?? index)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Yapılacak görev yok.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      padding: 16,
    },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 16,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    date: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '700',
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 20,
      color: colors.textSecondary,
      fontWeight: '700',
    },
  });
}

export default TasksScreen;
