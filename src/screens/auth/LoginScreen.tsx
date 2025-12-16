import { Ionicons } from '@expo/vector-icons';
import { yupResolver } from '@hookform/resolvers/yup';
import MaskedView from '@react-native-masked-view/masked-view';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as yup from 'yup';

import { KeyboardAwareScrollView, Input } from '../../components/common';
import { getConfig } from '../../config/env.config';
import { COLORS, SHADOWS, TYPOGRAPHY, SPACING, BORDER_RADIUS, API } from '../../constants';
import type { RootState, AppDispatch } from '../../store';
import { loginUser, clearError } from '../../store/slices/authSlice';
import type { LoginRequest } from '../../types';

const schema = yup.object().shape({
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);
  const config = getConfig();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginRequest>({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: {
      email: 'alice.johnson@example.com',
      password: 'Customer@123',
    },
  });

  const onSubmit = async (data: LoginRequest) => {
    try {
      dispatch(clearError());
      const result = await dispatch(loginUser(data));
      if (loginUser.fulfilled.match(result)) {
        // Navigation handled by AppNavigator
      } else {
        Alert.alert('Login Failed', error || 'Invalid credentials');
      }
    } catch (err) {
      Alert.alert('Login Failed', 'An unexpected error occurred');
    }
  };

  const navigateToRegister = () => {
    navigation.navigate('Register');
  };

  const navigateToForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <LinearGradient
      // ✅ PERFECT: Use the correct 3-color gradient from old app
      colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START}
      style={styles.container}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        extraScrollHeight={80}
        enableOnAndroid
        scrollEnabled
        bounces={false}
      >
        <View style={styles.headerContainer}>
          <MaskedView
            style={styles.maskedView}
            maskElement={<Text style={styles.title}>Sign in</Text>}
          >
            <LinearGradient
              colors={['#FFFFFF', '#BDBDBD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={[styles.title, { opacity: 0 }]}>Sign in</Text>
            </LinearGradient>
          </MaskedView>

          {/* <View style={styles.debugContainer}>
            <Text style={styles.debugLabel}>API URL:</Text>
            <Text style={styles.debugText}>{API.BASE_URL}</Text>
            <Text style={styles.debugText}>Login: {API.BASE_URL}/auth/login</Text>

            <Text style={styles.debugLabel}>Sentry:</Text>
            <Text style={styles.debugText}>
              Enabled: {config.HOPMED_BUILD_SENTRY_ENABLED ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.debugText}>
              DSN:{' '}
              {config.HOPMED_SENTRY_DSN
                ? config.HOPMED_SENTRY_DSN.substring(0, 30) + '...'
                : 'Not set'}
            </Text>
            <Text style={styles.debugText}>Environment: {config.HOPMED_BUILD_ENVIRONMENT}</Text>
          </View> */}
        </View>

        <View style={styles.formContainer}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Sign in via email *"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                leftIcon="mail-outline"
                inputType="email"
                variant="glass"
                validation={{
                  required: true,
                  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  customValidator: (value: string) => {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                      return 'Please enter a valid email address';
                    }
                    return null;
                  },
                }}
                disabled={isLoading}
                error={errors.email?.message}
                containerStyle={styles.inputContainer}
                testID="email-input"
                accessibilityLabel="Email address input"
                accessibilityHint="Enter your email address to sign in"
                trimWhitespace
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Enter your password *"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                isPassword
                inputType="password"
                variant="glass"
                disabled={isLoading}
                error={errors.password?.message}
                containerStyle={styles.inputContainer}
                testID="password-input"
                accessibilityLabel="Password input"
                accessibilityHint="Enter your password to sign in"
              />
            )}
          />
          {/*<TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={navigateToForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity> */}

          <TouchableOpacity
            style={[styles.loginButton, (!isValid || isLoading) && styles.loginButtonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Login"
            accessibilityHint="Tap to sign in to your account"
            accessibilityState={{ disabled: !isValid || isLoading }}
            testID="login-button"
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.TEXT_DARK} size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/*<View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialButton} disabled={isLoading}>
              <Ionicons
                name="logo-google"
                size={22}
                color={COLORS.WHITE}
                style={styles.socialIcon}
              />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity> */}
          {/* <TouchableOpacity style={styles.socialButton} disabled={isLoading}>
              <Ionicons
                name="logo-apple"
                size={22}
                color={COLORS.WHITE}
                style={styles.socialIcon}
              />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity> */}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={navigateToRegister}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Register now"
              accessibilityHint="Tap to create a new account"
              accessibilityState={{ disabled: isLoading }}
              testID="register-link"
            >
              <Text style={styles.registerLink}>Register now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40, // Add vertical padding for better spacing
    minHeight: '100%', // Ensure full height coverage
  },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  maskedView: {
    height: TYPOGRAPHY.FONT_SIZE_4XL * 1.2,
  },
  title: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_4XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: 'black',
  },
  formContainer: { width: '100%' },
  inputContainer: { marginBottom: 20 },
  forgotPasswordContainer: { alignItems: 'flex-end', marginBottom: 30 },
  forgotPasswordText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
  },
  loginButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.LG,
    alignItems: 'center',
    ...SHADOWS.SMALL_GREEN,
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(45, 226, 179, 0.5)',
  },
  loginButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.WHITE,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.GLASS_BORDER },
  dividerText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_MUTED,
    marginHorizontal: SPACING.MD,
  },
  socialButton: {
    backgroundColor: COLORS.GLASS_BG,
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.LG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  socialIcon: { marginRight: SPACING.MD },
  socialButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.LG,
  },
  registerText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    marginRight: SPACING.XS,
  },
  registerLink: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
  },
  debugContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  debugLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    marginBottom: 4,
  },
  debugText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XS,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

export default LoginScreen;
