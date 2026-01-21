import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StartupScreen from '../screens/StartupScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import TwoFactorScreen from '../screens/TwoFactorScreen';
import AddCustomerScreen from '../screens/AddCustomerScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import AccountDetailScreen from '../screens/AccountDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import TabNavigator from './TabNavigator';
import { useTheme } from '../theme/ThemeContext';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { colors, navTheme } = useTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator 
        initialRouteName="Startup"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '900', fontSize: 16 },
          headerTitleAlign: 'left',
          headerBackTitleVisible: false,
          headerShadowVisible: false,
          headerBackVisible: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Startup"
          component={StartupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ title: 'Şifre Sıfırlama' }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: 'Şifre Sıfırla' }}
        />
        <Stack.Screen
          name="TwoFactor"
          component={TwoFactorScreen}
          options={{ title: 'Doğrulama' }}
        />
        <Stack.Screen 
          name="Main" 
          component={TabNavigator} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="AddCustomer" 
          component={AddCustomerScreen} 
          options={{ title: 'Yeni Müşteri' }} 
        />
        <Stack.Screen
          name="AddAccount"
          component={AddAccountScreen}
          options={{ title: 'Yeni Firma' }}
        />
        <Stack.Screen
          name="AccountDetail"
          component={AccountDetailScreen}
          options={{ title: 'Firma' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Bildirimler' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
