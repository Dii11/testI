import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import type { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';

import NumberIcon from '../../../assets/icons/number.svg';
import ReferralImage from '../../../assets/referral-image.svg';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../constants';
import { authService } from '../../services/authService';
import type { AuthStackParamList } from '../../types';

type Props = StackScreenProps<AuthStackParamList, 'ReferralCode'>;

export const ReferralCodeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const handleApplyReferral = async (autoNavigate: boolean = false) => {
    if (!referralCode.trim()) {
      Alert.alert('Error', 'Please enter a referral code');
      return false;
    }

    setLoading(true);
    try {
      const response = await authService.registerStepTwo({
        phoneNumber,
        referralCode: referralCode.trim(),
      });

      if (response.success && (response.data?.referralValid || (response as any).referralValid)) {
        setIsApplied(true);
        setValidationMessage('Referral code applied successfully');

        // ✅ HIGH PRIORITY FIX: Auto-navigate to verification if requested
        if (autoNavigate) {
          // Small delay to show success message
          setTimeout(() => {
            navigation.navigate('Verification', { phoneNumber });
          }, 800);
        }

        return true;
      } else {
        Alert.alert(
          'Invalid Code',
          response.data?.message || (response as any).message || 'Invalid referral code'
        );
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error in handleApplyReferral:', error);
      Alert.alert('Error', error.message || 'Failed to apply referral code');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = async () => {
    setLoading(true);
    try {
      // ✅ HIGH PRIORITY FIX: Simplified proceed logic with auto-navigation
      if (!isApplied && referralCode.trim()) {
        // User entered a code but hasn't applied it yet - validate and auto-navigate
        const success = await handleApplyReferral(true);
        if (!success) {
          setLoading(false);
        }
        // handleApplyReferral will navigate on success, so we return here
        return;
      }

      // No referral code entered, skip it
      if (!isApplied && !referralCode.trim()) {
        await authService.registerStepTwo({
          phoneNumber,
        });
      }

      // Navigate to verification screen
      navigation.navigate('Verification', { phoneNumber });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await authService.registerStepTwo({
        phoneNumber,
      });

      navigation.navigate('Verification', { phoneNumber });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.headerContainer}>
              <MaskedView
                style={styles.maskedView}
                maskElement={<Text style={styles.title}>Referral Code</Text>}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#BDBDBD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <Text style={[styles.title, { opacity: 0 }]}>Referral Code</Text>
                </LinearGradient>
              </MaskedView>
            </View>

            <Text style={styles.subtitle}>
              Do you have a referral code? If yes, input the code and get 20% off your first
              subscription.
            </Text>

            <View style={styles.imageContainer}>
              <ReferralImage width={200} height={150} style={styles.image} />
            </View>

            <View style={styles.inputSection}>
              {isApplied ? (
                <View style={styles.appliedContainer}>
                  <View style={styles.appliedCodeContainer}>
                    <NumberIcon width={20} height={20} fill={COLORS.PRIMARY} />
                    <Text style={styles.appliedCodeText}>{referralCode}</Text>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
                  </View>
                  <Text style={styles.successMessage}>{validationMessage}</Text>
                </View>
              ) : (
                <>
                  <Input
                    placeholder="Input referral Code"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    leftIcon="ticket-outline"
                    variant="glass"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    disabled={loading}
                    containerStyle={styles.inputContainer}
                    testID="referral-code-input"
                    accessibilityLabel="Referral code"
                    accessibilityHint="Enter your referral code if you have one"
                    trimWhitespace
                  />

                  {referralCode.trim() && !isApplied && (
                    <TouchableOpacity
                      style={styles.validateButton}
                      onPress={() => handleApplyReferral(false)}
                      disabled={loading}
                    >
                      <Text style={styles.validateButtonText}>
                        {loading ? 'Validating...' : 'Validate Code'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={styles.buttonSection}>
              <Button
                title="Proceed"
                onPress={handleProceed}
                loading={loading}
                style={styles.proceedButton}
                size="large"
                fullWidth
              />

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
                <Text style={styles.skipButtonText}>I do not have a referral code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXL,
    justifyContent: 'space-between',
    minHeight: '100%',
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
  },
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.XL,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: SPACING.XL,
  },
  image: {
    width: 200,
    height: 150,
  },
  inputSection: {
    marginBottom: SPACING.XL,
  },
  inputContainer: {
    marginBottom: 20,
  },
  validateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  validateButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  appliedContainer: {
    alignItems: 'center',
  },
  appliedCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: SPACING.SM,
  },
  appliedCodeText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_SEMIBOLD,
    color: COLORS.WHITE,
    marginHorizontal: SPACING.SM,
  },
  successMessage: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.SUCCESS,
    textAlign: 'center',
  },
  buttonSection: {
    paddingBottom: SPACING.XL,
  },
  proceedButton: {
    backgroundColor: COLORS.PRIMARY,
    marginBottom: SPACING.LG,
    ...SHADOWS.SMALL_GREEN,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: SPACING.MD,
  },
  skipButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
});
