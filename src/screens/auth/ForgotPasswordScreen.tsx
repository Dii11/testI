import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import EmailIcon from '../../../assets/icons/email.svg';
import { Input } from '../../components/common';
import { COLORS, SHADOWS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPasscode = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      // Handle success/error
    }, 2000);
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <MaskedView
              style={styles.maskedView}
              maskElement={<Text style={styles.title}>Forgot Password?</Text>}
            >
              <LinearGradient
                colors={['#FFFFFF', '#BDBDBD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={[styles.title, { opacity: 0 }]}>Forgot Password?</Text>
              </LinearGradient>
            </MaskedView>
          </View>

          {/* Illustration Container */}
          <View style={styles.illustrationContainer}>
            <View style={styles.shieldContainer}>
              <Ionicons name="shield-checkmark" size={80} color={COLORS.PRIMARY} />
            </View>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.description}>
              Enter the email address associated with your account and we will send you a link to
              reset your password.
            </Text>

            {/* Email Input */}
            <Input
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
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
              containerStyle={styles.inputContainer}
              testID="forgot-password-email-input"
              accessibilityLabel="Email address"
              accessibilityHint="Enter your email to reset your password"
              trimWhitespace
            />

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.sendButton, (!email || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSendPasscode}
              disabled={!email || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.TEXT_DARK} size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send me a passcode</Text>
              )}
            </TouchableOpacity>

            {/* Return to Login */}
            <View style={styles.returnContainer}>
              <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
                <Text style={styles.returnText}>Return to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardContainer: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XL,
  },
  shieldContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formContainer: { width: '100%' },
  description: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.XL,
  },
  inputContainer: { marginBottom: 20 },
  sendButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.LG,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 30,
    ...SHADOWS.SMALL_GREEN,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(45, 226, 179, 0.5)',
  },
  sendButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.WHITE,
  },
  returnContainer: {
    alignItems: 'center',
    marginTop: SPACING.LG,
  },
  returnText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
  },
});

export default ForgotPasswordScreen;
