import MaskedView from '@react-native-masked-view/masked-view';
import type { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useDispatch } from 'react-redux';

import AccountReadySvg from '../../../assets/account-ready.svg';
import { Button } from '../../components/common';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../constants';
import type { AppDispatch } from '../../store';
import { clearRegistrationFlow } from '../../store/slices/authSlice';
import type { AuthStackParamList } from '../../types';
import AuthFlowPersistence from '../../utils/AuthFlowPersistence';

type Props = StackScreenProps<AuthStackParamList, 'AccountReady'>;

const { width } = Dimensions.get('window');

export const AccountReadyScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();

  // ✅ ENHANCED: Clear auth flow data when registration completes
  useEffect(() => {
    const clearAuthFlow = async () => {
      console.log('✅ Registration complete - clearing temporary auth flow data');
      const authFlowPersistence = AuthFlowPersistence.getInstance();
      await authFlowPersistence.clearAuthFlow();

      // Also clear Redux state
      dispatch(clearRegistrationFlow());
    };

    clearAuthFlow();
  }, [dispatch]);

  const handleGetStarted = () => {
    // ✅ CRITICAL FIX: Clear registration flow state before navigating
    // This prevents stale registration data from persisting in Redux
    dispatch(clearRegistrationFlow());

    // Reset the navigation stack to Login to avoid broken state
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.upperSection}>
          <View style={styles.headerContainer}>
            <MaskedView
              style={styles.maskedView}
              maskElement={<Text style={styles.title}>Your account is ready</Text>}
            >
              <LinearGradient
                colors={['#FFFFFF', '#BDBDBD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={[styles.title, { opacity: 0 }]}>Your account is ready</Text>
              </LinearGradient>
            </MaskedView>
          </View>

          <View style={styles.imageContainer}>
            <AccountReadySvg width={width * 0.7 * 0.8} height={width * 0.7 * 0.8} />
          </View>

          <View style={styles.successBadge}>
            <Text style={styles.badgeText}>Account creation successfully completed.</Text>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            style={styles.getStartedButton}
            size="large"
            fullWidth
          />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XXL,
    justifyContent: 'space-between',
  },
  upperSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XXL,
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
  frame: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  image: {
    width: '80%',
    height: '80%',
  },
  successBadge: {
    backgroundColor: 'rgba(74, 232, 144, 0.2)',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.WHITE,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  buttonSection: {
    paddingBottom: SPACING.XL,
  },
  getStartedButton: {
    backgroundColor: COLORS.PRIMARY,
    ...SHADOWS.SMALL_GREEN,
  },
});
