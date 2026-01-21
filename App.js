import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('"arrow-up-right"')) {
      return;
    }
    originalWarn(...args);
  };
}

function Root() {
  const { isDark, colors } = useTheme();
  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        secondary: colors.secondary,
        background: colors.background,
        surface: colors.surface,
        surfaceVariant: colors.background,
        outline: colors.border,
        error: colors.error,
        onPrimary: '#fff',
        onSecondary: '#fff',
        onBackground: colors.textPrimary,
        onSurface: colors.textPrimary,
        onSurfaceVariant: colors.textSecondary,
      },
    };
  }, [colors, isDark]);
  return (
    <>
      <AppErrorBoundary>
        <PaperProvider theme={paperTheme}>
          <AppNavigator />
        </PaperProvider>
      </AppErrorBoundary>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

function ErrorFallback({ error, onRetry }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uygulama Hatası</Text>
      <Text style={styles.subtitle}>Bir hata oluştu ve ekran yüklenemedi.</Text>
      {error ? (
        <ScrollView style={styles.box} contentContainerStyle={styles.boxContent}>
          <Text style={styles.mono}>{String(error?.message || error)}</Text>
        </ScrollView>
      ) : null}
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Tekrar Dene</Text>
      </Pressable>
    </View>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      gap: 10,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center' },
    subtitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    box: {
      alignSelf: 'stretch',
      maxHeight: 180,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    boxContent: { padding: 12 },
    mono: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    button: {
      marginTop: 6,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView style={styles.appFlex} behavior="padding">
            <Root />
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.appFlex}>
            <Root />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appFlex: { flex: 1 },
});
