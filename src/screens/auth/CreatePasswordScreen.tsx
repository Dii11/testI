import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import type { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import PasswordIcon from '../../../assets/icons/pad.svg';
import { Button, KeyboardAwareScrollView, Input } from '../../components/common';
import { COLORS, SPACING, TYPOGRAPHY, VALIDATION, BORDER_RADIUS, SHADOWS } from '../../constants';
import { authService } from '../../services/authService';
import type { AuthStackParamList } from '../../types';

type Props = StackScreenProps<AuthStackParamList, 'CreatePassword'>;

export const CreatePasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isConfirmPasswordValid, setIsConfirmPasswordValid] = useState(false);

  // Validation handlers
  const handlePasswordValidationChange = (isValid: boolean, error: string | null) => {
    setIsPasswordValid(isValid);
    if (error) {
      setErrors(prev => ({ ...prev, password: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  };

  const handleConfirmPasswordValidationChange = (isValid: boolean, error: string | null) => {
    setIsConfirmPasswordValid(isValid);
    if (error) {
      setErrors(prev => ({ ...prev, confirmPassword: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.confirmPassword;
        return newErrors;
      });
    }
  };

  // Password validation with professional patterns
  const passwordValidation = {
    required: true,
    minLength: VALIDATION.PASSWORD_MIN_LENGTH,
    customValidator: (value: string) => {
      if (!/(?=.*[a-z])/.test(value)) {
        return 'Password must contain at least one lowercase letter';
      }
      if (!/(?=.*[A-Z])/.test(value)) {
        return 'Password must contain at least one uppercase letter';
      }
      if (!/(?=.*\d)/.test(value)) {
        return 'Password must contain at least one number';
      }
      return null;
    },
  };

  const confirmPasswordValidation = {
    required: true,
    customValidator: (value: string) => {
      if (value !== password) {
        return 'Passwords do not match';
      }
      return null;
    },
  };

  const isFormValid = useMemo(() => {
    // Check password requirements
    const hasValidPassword =
      password.length >= 8 &&
      /(?=.*[a-z])/.test(password) &&
      /(?=.*[A-Z])/.test(password) &&
      /(?=.*\d)/.test(password);

    // Check if passwords match
    const passwordsMatch =
      password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

    // Check for errors
    const hasNoErrors = Object.keys(errors).length === 0;

    return hasValidPassword && passwordsMatch && hasNoErrors;
  }, [password, confirmPassword, errors]);

  const getPasswordStrength = (): 'weak' | 'medium' | 'strong' => {
    if (password.length === 0) return 'weak';

    let score = 0;
    if (password.length >= 8) score++;
    if (/(?=.*[a-z])/.test(password)) score++;
    if (/(?=.*[A-Z])/.test(password)) score++;
    if (/(?=.*\d)/.test(password)) score++;
    if (/(?=.*[!@#$%^&*])/.test(password)) score++;

    if (score >= 4) return 'strong';
    if (score >= 2) return 'medium';
    return 'weak';
  };

  const getPasswordStrengthColor = () => {
    const strength = getPasswordStrength();
    switch (strength) {
      case 'strong':
        return COLORS.SUCCESS;
      case 'medium':
        return COLORS.WARNING;
      default:
        return COLORS.ERROR;
    }
  };

  const handleProceed = async () => {
    if (!isFormValid) {
      Alert.alert(
        'Validation Error',
        'Please ensure your password meets all requirements and both passwords match.'
      );
      return;
    }

    setLoading(true);
    try {
      const response = await authService.completeRegistration({
        phoneNumber,
        password,
      });

      if (response.success) {
        navigation.navigate('AccountReady');
      } else {
        Alert.alert('Registration Failed', response.message || 'Failed to complete registration');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const isPasswordMatching = password && confirmPassword && password === confirmPassword;

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
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
            maskElement={<Text style={styles.title}>Create Password</Text>}
          >
            <LinearGradient
              colors={['#FFFFFF', '#BDBDBD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={[styles.title, { opacity: 0 }]}>Create Password</Text>
            </LinearGradient>
          </MaskedView>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/create-password-image.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subtitle}>
          Your password should be something{'\n'}you can easily remember. Keep it safe{'\n'}at all
          times!
        </Text>

        <View style={styles.formContainer}>
          <Input
            placeholder="Enter your new password *"
            value={password}
            onChangeText={setPassword}
            isPassword
            inputType="password"
            variant="glass"
            validation={passwordValidation}
            onValidationChange={handlePasswordValidationChange}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="password-input"
            accessibilityLabel="New password input"
            accessibilityHint="Enter a strong password with uppercase, lowercase, and numbers"
          />

          {password && (
            <View style={styles.strengthContainer}>
              <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
                Password strength: {getPasswordStrength()}
              </Text>
              <View style={styles.strengthIndicator}>
                <View
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: getPasswordStrengthColor(),
                      flex:
                        getPasswordStrength() === 'weak'
                          ? 1
                          : getPasswordStrength() === 'medium'
                            ? 2
                            : 3,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      flex:
                        getPasswordStrength() === 'weak'
                          ? 2
                          : getPasswordStrength() === 'medium'
                            ? 1
                            : 0,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <Input
            placeholder="Confirm your new password *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            inputType="password"
            variant="glass"
            validation={confirmPasswordValidation}
            onValidationChange={handleConfirmPasswordValidationChange}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="confirm-password-input"
            accessibilityLabel="Confirm password input"
            accessibilityHint="Re-enter your password to confirm it matches"
          />

          {isPasswordMatching && (
            <View style={styles.matchingContainer}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.SUCCESS} />
              <Text style={styles.matchingText}>Passwords match!</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.proceedButton,
              (!isFormValid || loading) && styles.proceedButtonDisabled,
            ]}
            onPress={handleProceed}
            disabled={!isFormValid || loading}
            testID="proceed-button"
            accessibilityRole="button"
            accessibilityLabel="Proceed with password creation"
            accessibilityState={{
              disabled: !isFormValid || loading,
            }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.TEXT_DARK} size="small" />
            ) : (
              <Text style={styles.proceedButtonText}>Proceed</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXL,
    paddingBottom: SPACING.XL,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  maskedView: {
    height: TYPOGRAPHY.FONT_SIZE_4XL * 1.2,
  },
  title: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_4XL,
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
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.XL,
    fontFamily: TYPOGRAPHY.FONT_FAMILY_PRIMARY,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: SPACING.LG,
  },
  strengthContainer: {
    marginBottom: SPACING.MD,
  },
  strengthText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    fontFamily: TYPOGRAPHY.FONT_FAMILY_PRIMARY,
    marginBottom: SPACING.XS,
  },
  strengthIndicator: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    marginRight: 2,
  },
  matchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.XS,
  },
  matchingText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.SUCCESS,
    fontFamily: TYPOGRAPHY.FONT_FAMILY_PRIMARY,
    marginLeft: SPACING.XS,
  },
  proceedButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: BORDER_RADIUS.LG,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.LG,
    ...SHADOWS.SMALL_GREEN,
  },
  proceedButtonDisabled: {
    backgroundColor: 'rgba(45, 226, 179, 0.5)',
  },
  proceedButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontFamily: TYPOGRAPHY.FONT_FAMILY_PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
  },
});
