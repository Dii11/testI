import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaskedView from '@react-native-masked-view/masked-view';
import type { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { Button, KeyboardAwareScrollView, Input } from '../../components/common';
import { COLORS, SPACING, TYPOGRAPHY, VALIDATION, BORDER_RADIUS, SHADOWS } from '../../constants';
import { authService } from '../../services/authService';
import type { RootState } from '../../store';
import {
  startRegistrationFlow,
  updateRegistrationFlow,
  clearRegistrationFlow,
} from '../../store/slices/authSlice';
import type { AuthStackParamList } from '../../types';
import AuthFlowPersistence from '../../utils/AuthFlowPersistence';

interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  countryCode?: string;
  accountType: 'customer' | 'health_specialist';
}

type Props = StackScreenProps<AuthStackParamList, 'Register'>;

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { label: 'Patient', value: 'customer' },
  { label: 'Health Specialist', value: 'health_specialist' },
];

const COUNTRIES = [
  { label: 'Afghanistan', value: 'AF', code: '+93' },
  { label: 'Albania', value: 'AL', code: '+355' },
  { label: 'Algeria', value: 'DZ', code: '+213' },
  { label: 'Andorra', value: 'AD', code: '+376' },
  { label: 'Angola', value: 'AO', code: '+244' },
  { label: 'Argentina', value: 'AR', code: '+54' },
  { label: 'Armenia', value: 'AM', code: '+374' },
  { label: 'Australia', value: 'AU', code: '+61' },
  { label: 'Austria', value: 'AT', code: '+43' },
  { label: 'Azerbaijan', value: 'AZ', code: '+994' },
  { label: 'Bahamas', value: 'BS', code: '+1242' },
  { label: 'Bahrain', value: 'BH', code: '+973' },
  { label: 'Bangladesh', value: 'BD', code: '+880' },
  { label: 'Barbados', value: 'BB', code: '+1246' },
  { label: 'Belarus', value: 'BY', code: '+375' },
  { label: 'Belgium', value: 'BE', code: '+32' },
  { label: 'Belize', value: 'BZ', code: '+501' },
  { label: 'Benin', value: 'BJ', code: '+229' },
  { label: 'Bhutan', value: 'BT', code: '+975' },
  { label: 'Bolivia', value: 'BO', code: '+591' },
  { label: 'Bosnia and Herzegovina', value: 'BA', code: '+387' },
  { label: 'Botswana', value: 'BW', code: '+267' },
  { label: 'Brazil', value: 'BR', code: '+55' },
  { label: 'Brunei', value: 'BN', code: '+673' },
  { label: 'Bulgaria', value: 'BG', code: '+359' },
  { label: 'Burkina Faso', value: 'BF', code: '+226' },
  { label: 'Burundi', value: 'BI', code: '+257' },
  { label: 'Cambodia', value: 'KH', code: '+855' },
  { label: 'Cameroon', value: 'CM', code: '+237' },
  { label: 'Canada', value: 'CA', code: '+1' },
  { label: 'Cape Verde', value: 'CV', code: '+238' },
  { label: 'Central African Republic', value: 'CF', code: '+236' },
  { label: 'Chad', value: 'TD', code: '+235' },
  { label: 'Chile', value: 'CL', code: '+56' },
  { label: 'China', value: 'CN', code: '+86' },
  { label: 'Colombia', value: 'CO', code: '+57' },
  { label: 'Comoros', value: 'KM', code: '+269' },
  { label: 'Congo', value: 'CG', code: '+242' },
  { label: 'Costa Rica', value: 'CR', code: '+506' },
  { label: "Côte d'Ivoire", value: 'CI', code: '+225' },
  { label: 'Croatia', value: 'HR', code: '+385' },
  { label: 'Cuba', value: 'CU', code: '+53' },
  { label: 'Cyprus', value: 'CY', code: '+357' },
  { label: 'Czech Republic', value: 'CZ', code: '+420' },
  { label: 'Denmark', value: 'DK', code: '+45' },
  { label: 'Djibouti', value: 'DJ', code: '+253' },
  { label: 'Dominica', value: 'DM', code: '+1767' },
  { label: 'Dominican Republic', value: 'DO', code: '+1849' },
  { label: 'Ecuador', value: 'EC', code: '+593' },
  { label: 'Egypt', value: 'EG', code: '+20' },
  { label: 'El Salvador', value: 'SV', code: '+503' },
  { label: 'Equatorial Guinea', value: 'GQ', code: '+240' },
  { label: 'Eritrea', value: 'ER', code: '+291' },
  { label: 'Estonia', value: 'EE', code: '+372' },
  { label: 'Ethiopia', value: 'ET', code: '+251' },
  { label: 'Fiji', value: 'FJ', code: '+679' },
  { label: 'Finland', value: 'FI', code: '+358' },
  { label: 'France', value: 'FR', code: '+33' },
  { label: 'Gabon', value: 'GA', code: '+241' },
  { label: 'Gambia', value: 'GM', code: '+220' },
  { label: 'Georgia', value: 'GE', code: '+995' },
  { label: 'Germany', value: 'DE', code: '+49' },
  { label: 'Ghana', value: 'GH', code: '+233' },
  { label: 'Greece', value: 'GR', code: '+30' },
  { label: 'Grenada', value: 'GD', code: '+1473' },
  { label: 'Guatemala', value: 'GT', code: '+502' },
  { label: 'Guinea', value: 'GN', code: '+224' },
  { label: 'Guinea-Bissau', value: 'GW', code: '+245' },
  { label: 'Guyana', value: 'GY', code: '+592' },
  { label: 'Haiti', value: 'HT', code: '+509' },
  { label: 'Honduras', value: 'HN', code: '+504' },
  { label: 'Hungary', value: 'HU', code: '+36' },
  { label: 'Iceland', value: 'IS', code: '+354' },
  { label: 'India', value: 'IN', code: '+91' },
  { label: 'Indonesia', value: 'ID', code: '+62' },
  { label: 'Iran', value: 'IR', code: '+98' },
  { label: 'Iraq', value: 'IQ', code: '+964' },
  { label: 'Ireland', value: 'IE', code: '+353' },
  { label: 'Israel', value: 'IL', code: '+972' },
  { label: 'Italy', value: 'IT', code: '+39' },
  { label: 'Jamaica', value: 'JM', code: '+1876' },
  { label: 'Japan', value: 'JP', code: '+81' },
  { label: 'Jordan', value: 'JO', code: '+962' },
  { label: 'Kazakhstan', value: 'KZ', code: '+77' },
  { label: 'Kenya', value: 'KE', code: '+254' },
  { label: 'Kiribati', value: 'KI', code: '+686' },
  { label: 'North Korea', value: 'KP', code: '+850' },
  { label: 'South Korea', value: 'KR', code: '+82' },
  { label: 'Kuwait', value: 'KW', code: '+965' },
  { label: 'Kyrgyzstan', value: 'KG', code: '+996' },
  { label: 'Laos', value: 'LA', code: '+856' },
  { label: 'Latvia', value: 'LV', code: '+371' },
  { label: 'Lebanon', value: 'LB', code: '+961' },
  { label: 'Lesotho', value: 'LS', code: '+266' },
  { label: 'Liberia', value: 'LR', code: '+231' },
  { label: 'Libya', value: 'LY', code: '+218' },
  { label: 'Liechtenstein', value: 'LI', code: '+423' },
  { label: 'Lithuania', value: 'LT', code: '+370' },
  { label: 'Luxembourg', value: 'LU', code: '+352' },
  { label: 'Madagascar', value: 'MG', code: '+261' },
  { label: 'Malawi', value: 'MW', code: '+265' },
  { label: 'Malaysia', value: 'MY', code: '+60' },
  { label: 'Maldives', value: 'MV', code: '+960' },
  { label: 'Mali', value: 'ML', code: '+223' },
  { label: 'Malta', value: 'MT', code: '+356' },
  { label: 'Marshall Islands', value: 'MH', code: '+692' },
  { label: 'Mauritania', value: 'MR', code: '+222' },
  { label: 'Mauritius', value: 'MU', code: '+230' },
  { label: 'Mexico', value: 'MX', code: '+52' },
  { label: 'Micronesia', value: 'FM', code: '+691' },
  { label: 'Moldova', value: 'MD', code: '+373' },
  { label: 'Monaco', value: 'MC', code: '+377' },
  { label: 'Mongolia', value: 'MN', code: '+976' },
  { label: 'Montenegro', value: 'ME', code: '+382' },
  { label: 'Morocco', value: 'MA', code: '+212' },
  { label: 'Mozambique', value: 'MZ', code: '+258' },
  { label: 'Myanmar', value: 'MM', code: '+95' },
  { label: 'Namibia', value: 'NA', code: '+264' },
  { label: 'Nauru', value: 'NR', code: '+674' },
  { label: 'Nepal', value: 'NP', code: '+977' },
  { label: 'Netherlands', value: 'NL', code: '+31' },
  { label: 'New Zealand', value: 'NZ', code: '+64' },
  { label: 'Nicaragua', value: 'NI', code: '+505' },
  { label: 'Niger', value: 'NE', code: '+227' },
  { label: 'Nigeria', value: 'NG', code: '+234' },
  { label: 'North Macedonia', value: 'MK', code: '+389' },
  { label: 'Norway', value: 'NO', code: '+47' },
  { label: 'Oman', value: 'OM', code: '+968' },
  { label: 'Pakistan', value: 'PK', code: '+92' },
  { label: 'Palau', value: 'PW', code: '+680' },
  { label: 'Panama', value: 'PA', code: '+507' },
  { label: 'Papua New Guinea', value: 'PG', code: '+675' },
  { label: 'Paraguay', value: 'PY', code: '+595' },
  { label: 'Peru', value: 'PE', code: '+51' },
  { label: 'Philippines', value: 'PH', code: '+63' },
  { label: 'Poland', value: 'PL', code: '+48' },
  { label: 'Portugal', value: 'PT', code: '+351' },
  { label: 'Qatar', value: 'QA', code: '+974' },
  { label: 'Romania', value: 'RO', code: '+40' },
  { label: 'Russia', value: 'RU', code: '+7' },
  { label: 'Rwanda', value: 'RW', code: '+250' },
  { label: 'Saint Kitts and Nevis', value: 'KN', code: '+1869' },
  { label: 'Saint Lucia', value: 'LC', code: '+1758' },
  { label: 'Saint Vincent and the Grenadines', value: 'VC', code: '+1784' },
  { label: 'Samoa', value: 'WS', code: '+685' },
  { label: 'San Marino', value: 'SM', code: '+378' },
  { label: 'Sao Tome and Principe', value: 'ST', code: '+239' },
  { label: 'Saudi Arabia', value: 'SA', code: '+966' },
  { label: 'Senegal', value: 'SN', code: '+221' },
  { label: 'Serbia', value: 'RS', code: '+381' },
  { label: 'Seychelles', value: 'SC', code: '+248' },
  { label: 'Sierra Leone', value: 'SL', code: '+232' },
  { label: 'Singapore', value: 'SG', code: '+65' },
  { label: 'Slovakia', value: 'SK', code: '+421' },
  { label: 'Slovenia', value: 'SI', code: '+386' },
  { label: 'Solomon Islands', value: 'SB', code: '+677' },
  { label: 'Somalia', value: 'SO', code: '+252' },
  { label: 'South Africa', value: 'ZA', code: '+27' },
  { label: 'South Sudan', value: 'SS', code: '+211' },
  { label: 'Spain', value: 'ES', code: '+34' },
  { label: 'Sri Lanka', value: 'LK', code: '+94' },
  { label: 'Sudan', value: 'SD', code: '+249' },
  { label: 'Suriname', value: 'SR', code: '+597' },
  { label: 'Sweden', value: 'SE', code: '+46' },
  { label: 'Switzerland', value: 'CH', code: '+41' },
  { label: 'Syria', value: 'SY', code: '+963' },
  { label: 'Taiwan', value: 'TW', code: '+886' },
  { label: 'Tajikistan', value: 'TJ', code: '+992' },
  { label: 'Tanzania', value: 'TZ', code: '+255' },
  { label: 'Thailand', value: 'TH', code: '+66' },
  { label: 'Timor-Leste', value: 'TL', code: '+670' },
  { label: 'Togo', value: 'TG', code: '+228' },
  { label: 'Tonga', value: 'TO', code: '+676' },
  { label: 'Trinidad and Tobago', value: 'TT', code: '+1868' },
  { label: 'Tunisia', value: 'TN', code: '+216' },
  { label: 'Turkey', value: 'TR', code: '+90' },
  { label: 'Turkmenistan', value: 'TM', code: '+993' },
  { label: 'Tuvalu', value: 'TV', code: '+688' },
  { label: 'Uganda', value: 'UG', code: '+256' },
  { label: 'Ukraine', value: 'UA', code: '+380' },
  { label: 'United Arab Emirates', value: 'AE', code: '+971' },
  { label: 'United Kingdom', value: 'GB', code: '+44' },
  { label: 'United States', value: 'US', code: '+1' },
  { label: 'Uruguay', value: 'UY', code: '+598' },
  { label: 'Uzbekistan', value: 'UZ', code: '+998' },
  { label: 'Vanuatu', value: 'VU', code: '+678' },
  { label: 'Vatican City', value: 'VA', code: '+39' },
  { label: 'Venezuela', value: 'VE', code: '+58' },
  { label: 'Vietnam', value: 'VN', code: '+84' },
  { label: 'Yemen', value: 'YE', code: '+967' },
  { label: 'Zambia', value: 'ZM', code: '+260' },
  { label: 'Zimbabwe', value: 'ZW', code: '+263' },
];

export const RegisterFormScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const { registrationFlow } = useSelector((state: RootState) => state.auth);

  // Calculate default date of birth (16 years ago from today)
  const getDefaultDateOfBirth = () => {
    const today = new Date();
    const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
    return sixteenYearsAgo.toISOString().split('T')[0];
  };

  // ✅ ENHANCED: Initialize form data from AuthFlowPersistence or defaults
  const getInitialFormData = (): RegisterFormData => {
    // Note: Actual restoration happens in useEffect below
    return {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: getDefaultDateOfBirth(),
      accountType: 'customer',
    };
  };

  const [formData, setFormData] = useState<RegisterFormData>(getInitialFormData());
  const [hasRestoredData, setHasRestoredData] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [validationStates, setValidationStates] = useState({
    firstName: false,
    lastName: false,
    email: false,
    phoneNumber: false,
    address: false,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(getDefaultDateOfBirth()));
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find(country => country.value === 'CI') || COUNTRIES[0]
  );

  // ✅ ENHANCED: Restore form data from AuthFlowPersistence on mount
  useEffect(() => {
    const restoreFormData = async () => {
      try {
        const authFlowPersistence = AuthFlowPersistence.getInstance();
        const savedFlow = await authFlowPersistence.restoreAuthFlow();

        if (savedFlow && savedFlow.step === 'register' && savedFlow.formData) {
          console.log('✅ Restoring registration form data from temporary storage');
          setFormData(savedFlow.formData);
          setHasRestoredData(true);
        }
      } catch (error) {
        console.error('❌ Failed to restore registration form data:', error);
      }
    };

    restoreFormData();

    // ✅ CRITICAL FIX: Save form data on backgrounding, clear on unmount
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Save form data when app goes to background
        console.log('💾 Saving registration form data (app backgrounding)');
        const authFlowPersistence = AuthFlowPersistence.getInstance();
        await authFlowPersistence.saveAuthFlow({
          step: 'register',
          formData,
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Clean up when user leaves the screen WITHOUT completing registration
      const cleanup = async () => {
        console.log('🧹 RegisterFormScreen unmounted - clearing temporary auth flow');
        const authFlowPersistence = AuthFlowPersistence.getInstance();
        await authFlowPersistence.clearAuthFlow();
      };

      cleanup();
      subscription.remove();
    };
  }, [formData]);

  // Validation change handlers
  const handleValidationChange =
    (field: keyof typeof validationStates) => (isValid: boolean, error: string | null) => {
      setValidationStates(prev => ({ ...prev, [field]: isValid }));
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    };

  const isFormValid = useMemo(() => {
    // Check if required fields have values and are valid
    const hasFirstName = formData.firstName.trim().length >= 2;
    const hasLastName = formData.lastName.trim().length >= 2;
    const hasEmail =
      formData.email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const hasPhoneNumber = formData.phoneNumber.trim().length > 0;

    const requiredFieldsValid = hasFirstName && hasLastName && hasEmail && hasPhoneNumber;

    // Check for validation errors
    const hasNoErrors = Object.keys(errors).length === 0;

    return requiredFieldsValid && hasNoErrors;
  }, [formData.firstName, formData.lastName, formData.email, formData.phoneNumber, errors]);

  const validateForm = (): boolean => {
    return isFormValid;
  };

  const handleNext = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly.');
      return;
    }

    setLoading(true);
    try {
      const registrationData = {
        ...formData,
        phoneNumber: `${selectedCountry.code}${formData.phoneNumber}`,
        countryCode: selectedCountry.value,
      };

      const response = await authService.registerStepOne(registrationData);

      if (response.success) {
        // ✅ ENHANCED: Save auth flow for next step
        const authFlowPersistence = AuthFlowPersistence.getInstance();
        await authFlowPersistence.saveAuthFlow({
          step: 'referral',
          formData: registrationData,
          phoneNumber: registrationData.phoneNumber,
        });

        // Also update Redux for immediate state management
        dispatch(
          updateRegistrationFlow({
            step: 'referral',
            phoneNumber: registrationData.phoneNumber,
          })
        );

        navigation.navigate('ReferralCode', {
          phoneNumber: registrationData.phoneNumber,
          registrationData,
        });
      } else {
        Alert.alert('Error', response.message || 'Registration failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setSelectedDate(selectedDate);
      if (Platform.OS === 'android') {
        setFormData(prev => ({
          ...prev,
          dateOfBirth: selectedDate.toISOString().split('T')[0],
        }));
      }
    }
  };

  const handleDateConfirm = () => {
    setFormData(prev => ({
      ...prev,
      dateOfBirth: selectedDate.toISOString().split('T')[0],
    }));
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setSelectedDate(new Date(formData.dateOfBirth || getDefaultDateOfBirth()));
    setShowDatePicker(false);
  };

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Format based on country (simplified for US/CA format)
    if (selectedCountry.code === '+1') {
      const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
      if (match) {
        return !match[2] ? match[1] : `${match[1]}-${match[2]}${match[3] ? `-${match[3]}` : ''}`;
      }
    }
    return cleaned;
  };

  const renderGenderModal = () => (
    <Modal visible={showGenderModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            <TouchableOpacity onPress={() => setShowGenderModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={GENDER_OPTIONS}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  formData.gender === item.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setFormData(prev => ({ ...prev, gender: item.value as any }));
                  setShowGenderModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    formData.gender === item.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {formData.gender === item.value && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.PRIMARY} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const renderCountryModal = () => (
    <Modal visible={showCountryModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={COUNTRIES}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  selectedCountry.value === item.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedCountry.value === item.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {item.label} ({item.code})
                </Text>
                {selectedCountry.value === item.value && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.PRIMARY} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient colors={COLORS.BRAND_GRADIENT}
      locations={COLORS.BRAND_GRADIENT_LOCATIONS}
      start={COLORS.BRAND_GRADIENT_START} style={styles.container}>
      <View style={styles.headerContainer}>
        <MaskedView
          style={styles.maskedView}
          maskElement={<Text style={styles.title}>Register</Text>}
        >
          <LinearGradient
            colors={['#FFFFFF', '#BDBDBD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={[styles.title, { opacity: 0 }]}>Register</Text>
          </LinearGradient>
        </MaskedView>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        extraScrollHeight={100}
        enableOnAndroid
        scrollEnabled
        bounces={false}
        style={styles.scrollView}
      >
        <View style={styles.formContainer}>
          <Input
            placeholder="Enter your first name *"
            value={formData.firstName}
            onChangeText={text => setFormData(prev => ({ ...prev, firstName: text }))}
            leftIcon="person-outline"
            inputType="name"
            variant="glass"
            validation={{
              required: true,
              minLength: 2,
              maxLength: 50,
              customValidator: (value: string) => {
                if (!/^[a-zA-Z\u00C0-\u00FF\s'-]{2,50}$/.test(value)) {
                  return 'Name must contain only letters, spaces, hyphens, and apostrophes';
                }
                return null;
              },
            }}
            onValidationChange={handleValidationChange('firstName')}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="first-name-input"
            accessibilityLabel="First name input"
            accessibilityHint="Enter your first name"
            trimWhitespace
          />

          <Input
            placeholder="Enter your last name *"
            value={formData.lastName}
            onChangeText={text => setFormData(prev => ({ ...prev, lastName: text }))}
            leftIcon="person-outline"
            inputType="name"
            variant="glass"
            validation={{
              required: true,
              minLength: 2,
              maxLength: 50,
              customValidator: (value: string) => {
                if (!/^[a-zA-Z\u00C0-\u00FF\s'-]{2,50}$/.test(value)) {
                  return 'Name must contain only letters, spaces, hyphens, and apostrophes';
                }
                return null;
              },
            }}
            onValidationChange={handleValidationChange('lastName')}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="last-name-input"
            accessibilityLabel="Last name input"
            accessibilityHint="Enter your last name"
            trimWhitespace
          />

          <Input
            placeholder="Enter your email address *"
            value={formData.email}
            onChangeText={text => setFormData(prev => ({ ...prev, email: text }))}
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
            onValidationChange={handleValidationChange('email')}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="email-input"
            accessibilityLabel="Email address input"
            accessibilityHint="Enter your email address"
            trimWhitespace
          />

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowGenderModal(true)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Select gender"
              accessibilityHint="Tap to choose your gender"
              testID="gender-picker"
            >
              <View style={styles.iconContainer}>
                <Ionicons name="people-outline" size={22} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <View style={styles.pickerButton}>
                <Text style={[styles.pickerButtonText, !formData.gender && styles.placeholderText]}>
                  {formData.gender
                    ? GENDER_OPTIONS.find(g => g.value === formData.gender)?.label
                    : 'Gender'}
                </Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="rgba(255, 255, 255, 0.7)"
                style={styles.dropdownIcon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Select date of birth"
              accessibilityHint="Tap to choose your date of birth"
              testID="date-picker"
            >
              <View style={styles.iconContainer}>
                <Ionicons name="calendar-outline" size={22} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <View style={styles.pickerButton}>
                <Text
                  style={[styles.pickerButtonText, !formData.dateOfBirth && styles.placeholderText]}
                >
                  {formData.dateOfBirth || 'Date of Birth'}
                </Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="rgba(255, 255, 255, 0.7)"
                style={styles.dropdownIcon}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowCountryModal(true)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Select country"
              accessibilityHint="Tap to choose your country"
              testID="country-picker"
            >
              <View style={styles.iconContainer}>
                <Ionicons name="location-outline" size={22} color="rgba(255, 255, 255, 0.7)" />
              </View>
              <View style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>
                  {selectedCountry.label || 'Select Country'}
                </Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="rgba(255, 255, 255, 0.7)"
                style={styles.dropdownIcon}
              />
            </TouchableOpacity>
          </View>

          <Input
            placeholder="Enter your home address"
            value={formData.address || ''}
            onChangeText={text => setFormData(prev => ({ ...prev, address: text }))}
            leftIcon="home-outline"
            inputType="address"
            variant="glass"
            validation={{
              required: false,
              minLength: 5,
              maxLength: 100,
              customValidator: (value: string) => {
                if (value && !/^[a-zA-Z0-9\s,'#.-]{5,100}$/.test(value)) {
                  return 'Please enter a valid address';
                }
                return null;
              },
            }}
            onValidationChange={handleValidationChange('address')}
            disabled={loading}
            containerStyle={styles.inputContainer}
            testID="address-input"
            accessibilityLabel="Home address input"
            accessibilityHint="Enter your home address"
            trimWhitespace
          />

          <View style={styles.inputContainer}>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.countryCodePrefix}>{selectedCountry.code}</Text>
              <Input
                placeholder="Enter your phone number *"
                value={formData.phoneNumber}
                onChangeText={text =>
                  setFormData(prev => ({
                    ...prev,
                    phoneNumber: formatPhoneNumber(text),
                  }))
                }
                inputType="phone"
                variant="glass"
                validation={{
                  required: true,
                  customValidator: (value: string) => {
                    if (!/^\+?[1-9]\d{1,14}$/.test(value)) {
                      return 'Please enter a valid phone number';
                    }
                    return null;
                  },
                }}
                onValidationChange={handleValidationChange('phoneNumber')}
                disabled={loading}
                containerStyle={styles.phoneInputWrapper}
                testID="phone-input"
                accessibilityLabel="Phone number input"
                accessibilityHint="Enter your mobile phone number"
                trimWhitespace
                showValidationIcon={false}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.proceedButton,
              (loading || !isFormValid) && styles.proceedButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={loading || !isFormValid}
            accessibilityRole="button"
            accessibilityLabel="Proceed with registration"
            accessibilityHint="Tap to continue to the next step"
            accessibilityState={{ disabled: loading || !isFormValid }}
            testID="proceed-button"
          >
            {loading ? (
              <ActivityIndicator color={COLORS.TEXT_DARK} size="small" />
            ) : (
              <Text style={styles.proceedButtonText}>Proceed</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 0 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleDateCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Date of Birth</Text>
              <TouchableOpacity onPress={handleDateConfirm}>
                <Text style={styles.confirmButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor={COLORS.TEXT_PRIMARY}
                themeVariant="dark"
                style={styles.datePicker}
              />
            </View>
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {renderGenderModal()}
      {renderCountryModal()}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 0,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
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
  formContainer: { width: '100%' },
  inputContainer: { marginBottom: 20 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingLeft: 12,
    height: 60,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_PRIMARY,
    height: '100%',
  },
  pickerButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '400',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dropdownIcon: {
    paddingRight: 16,
  },
  errorText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.ERROR,
    marginTop: SPACING.XS,
    marginLeft: SPACING.SM,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingLeft: 12,
    height: 60,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 4,
  },
  phoneInputWrapper: {
    flex: 1,
    marginBottom: 0,
  },
  countryCodePrefix: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginRight: 12,
    paddingHorizontal: 12,
  },
  proceedButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.LG,
    alignItems: 'center',
    marginTop: 30,
    ...SHADOWS.SMALL_GREEN,
  },
  proceedButtonDisabled: {
    backgroundColor: 'rgba(45, 226, 179, 0.5)',
  },
  proceedButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.WHITE,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(74,78,138,0.95)',
    borderTopLeftRadius: BORDER_RADIUS.XL,
    borderTopRightRadius: BORDER_RADIUS.XL,
    maxHeight: '70%',
    borderWidth: 1.5,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    ...SHADOWS.LARGE,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle glass layer
    borderTopLeftRadius: BORDER_RADIUS.XL,
    borderTopRightRadius: BORDER_RADIUS.XL,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.LG,
    paddingVertical: SPACING.MD,
    marginHorizontal: SPACING.SM,
    marginVertical: SPACING.XS,
    borderRadius: BORDER_RADIUS.LG,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalOptionText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(45, 226, 179, 0.25)', // More prominent selected state
    borderColor: COLORS.PRIMARY,
    borderWidth: 1.5,
    ...SHADOWS.SMALL_GREEN, // Use green shadow for selection
  },
  modalOptionTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
  },
  datePickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle glass background
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.LG,
    marginTop: SPACING.XS,
  },
  datePicker: {
    backgroundColor: 'transparent',
    height: 200,
    borderRadius: BORDER_RADIUS.LG,
    marginVertical: SPACING.SM,
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: 'rgba(255, 255, 255, 0.7)', // Better visibility on glass
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
  },
  confirmButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.PRIMARY,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
  },
});
