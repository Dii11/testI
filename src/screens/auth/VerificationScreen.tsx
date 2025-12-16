import MaskedView from '@react-native-masked-view/masked-view';
import type { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image } from 'react-native';

import { Button, KeyboardAwareScrollView } from '../../components/common';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants';
import { authService } from '../../services/authService';
import type { AuthStackParamList } from '../../types';

type Props = StackScreenProps<AuthStackParamList, 'Verification'>;

export const VerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  // ✅ HIGH PRIORITY FIX: Track failed verification attempts
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const inputRefs = useRef<TextInput[]>([]);
  const MAX_ATTEMPTS = 5;

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste case
      const pastedCode = value.slice(0, 4).split('');
      const newCode = [...code];
      pastedCode.forEach((digit, i) => {
        if (i < 4) newCode[i] = digit;
      });
      setCode(newCode);

      // Focus on the last filled input or next empty one
      const nextIndex = Math.min(pastedCode.length, 3);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Single character input
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input
      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');

    if (verificationCode.length !== 4) {
      Alert.alert('Error', 'Please enter the complete 4-digit code');
      return;
    }

    // ✅ HIGH PRIORITY FIX: Check if account is locked due to too many failed attempts
    if (isLocked) {
      Alert.alert(
        'Account Temporarily Locked',
        'Too many failed attempts. Please request a new verification code.',
        [{ text: 'Request New Code', onPress: handleResend }]
      );
      return;
    }

    setLoading(true);
    try {
      const response = await authService.verifyPhone({
        phoneNumber,
        code: verificationCode,
      });

      if (response.success) {
        // ✅ Reset failed attempts on success
        setFailedAttempts(0);
        setIsLocked(false);
        navigation.navigate('CreatePassword', { phoneNumber });
      } else {
        // ✅ HIGH PRIORITY FIX: Increment failed attempts counter
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        // ✅ Lock account after MAX_ATTEMPTS failures
        if (newFailedAttempts >= MAX_ATTEMPTS) {
          setIsLocked(true);
          Alert.alert(
            'Too Many Failed Attempts',
            `You have entered an incorrect code ${MAX_ATTEMPTS} times. Please request a new verification code to continue.`,
            [
              {
                text: 'Request New Code',
                onPress: handleResend,
                style: 'default',
              },
            ]
          );
        } else {
          // Show remaining attempts
          const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;
          Alert.alert(
            'Verification Failed',
            `${response.data?.message || 'Invalid verification code'}\n\nAttempts remaining: ${remainingAttempts}`,
            [{ text: 'Try Again' }]
          );
        }

        // Clear the code inputs
        setCode(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      // ✅ Also increment on error
      const newFailedAttempts = failedAttempts + 1;
      setFailedAttempts(newFailedAttempts);

      if (newFailedAttempts >= MAX_ATTEMPTS) {
        setIsLocked(true);
        Alert.alert(
          'Too Many Failed Attempts',
          'Please request a new verification code to continue.',
          [{ text: 'Request New Code', onPress: handleResend }]
        );
      } else {
        const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;
        Alert.alert(
          'Error',
          `${error.message || 'Verification failed'}\n\nAttempts remaining: ${remainingAttempts}`
        );
      }

      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      const response = await authService.resendVerificationCode(phoneNumber);

      if (response.success) {
        // ✅ HIGH PRIORITY FIX: Reset failed attempts and unlock when new code is sent
        setFailedAttempts(0);
        setIsLocked(false);
        setCode(['', '', '', '']);
        Alert.alert(
          'Code Sent',
          'A new verification code has been sent to your phone. You have 5 new attempts.'
        );
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to resend code');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend verification code');
    } finally {
      setResendLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display (hide middle digits)
    if (phone.length > 6) {
      return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
    }
    return phone;
  };

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        extraScrollHeight={100}
        enableOnAndroid
        scrollEnabled
        bounces={false}
      >
        <View style={styles.headerContainer}>
          <MaskedView
            style={styles.maskedView}
            maskElement={<Text style={styles.title}>Verification</Text>}
          >
            <LinearGradient
              colors={['#FFFFFF', '#BDBDBD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={[styles.title, { opacity: 0 }]}>Verification</Text>
            </LinearGradient>
          </MaskedView>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/verification-image.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subtitle}>
          Enter the 4 digit code sent to {'\n'}
          {formatPhoneNumber(phoneNumber)}
        </Text>

        {/* ✅ HIGH PRIORITY FIX: Show remaining attempts */}
        {failedAttempts > 0 && !isLocked && (
          <View style={styles.attemptsContainer}>
            <Text style={styles.attemptsText}>
              {failedAttempts === 1
                ? '1 incorrect attempt'
                : `${failedAttempts} incorrect attempts`}
              {' · '}
              {MAX_ATTEMPTS - failedAttempts} {MAX_ATTEMPTS - failedAttempts === 1 ? 'attempt' : 'attempts'} remaining
            </Text>
          </View>
        )}

        {isLocked && (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedText}>
              ⚠️ Account locked. Request a new code to continue.
            </Text>
          </View>
        )}

        <View
          style={styles.codeContainer}
          accessibilityRole="adjustable"
          accessibilityLabel="Verification code input"
          accessibilityHint="Enter the 4-digit verification code"
        >
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => {
                inputRefs.current[index] = ref!;
              }}
              style={styles.codeInput}
              value={digit}
              onChangeText={value => handleCodeChange(value, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              autoCorrect={false}
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              accessibilityLabel={`Verification code digit ${index + 1}`}
              accessibilityHint={`Enter the ${index + 1} digit of your verification code`}
              accessibilityRole="text"
              testID={`code-input-${index}`}
              editable={!loading && !isLocked}
              importantForAutofill="no"
            />
          ))}
        </View>

        <View style={styles.buttonSection}>
          <Button
            title="Proceed"
            onPress={handleVerify}
            loading={loading}
            style={styles.proceedButton}
            size="large"
            fullWidth
            disabled={code.join('').length !== 4}
          />

          <View style={styles.resendSection}>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResend}
              disabled={resendLoading}
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
              accessibilityHint="Tap to resend the verification code to your phone"
              accessibilityState={{ disabled: resendLoading }}
              testID="resend-button"
            >
              <Text style={styles.resendButtonText}>
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Tap to go back to the previous screen"
              testID="back-button"
            >
              <Text style={styles.backButtonText}>Back to previous screen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXL,
    justifyContent: 'space-between',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  maskedView: {
    height: TYPOGRAPHY.FONT_SIZE_3XL * 1.2,
  },
  title: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_3XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: 'black',
    textAlign: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XL,
  },
  image: {
    width: 200,
    height: 150,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.XL,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.XL,
    paddingHorizontal: SPACING.LG,
  },
  codeInput: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  buttonSection: {
    paddingBottom: SPACING.XL,
  },
  proceedButton: {
    backgroundColor: COLORS.PRIMARY,
    marginBottom: SPACING.LG,
    ...SHADOWS.SMALL_GREEN,
  },
  resendSection: {
    alignItems: 'center',
    gap: SPACING.MD,
  },
  resendButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resendButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.WHITE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // ✅ HIGH PRIORITY FIX: Styles for failed attempts tracking
  attemptsContainer: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.LG,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    alignItems: 'center',
  },
  attemptsText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: '#FFA726',
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  lockedContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.LG,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
    alignItems: 'center',
  },
  lockedText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: '#EF5350',
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
  },
});
