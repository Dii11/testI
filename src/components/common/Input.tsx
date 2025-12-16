import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, memo, useMemo } from 'react';
import type { TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';

import {
  getInputProps,
  getPlatformInputProps,
  createStableInputConfig,
  createValidationConfig,
} from '../../utils/formUtils';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
}

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  isPassword?: boolean;
  required?: boolean;
  disabled?: boolean;
  inputType?: 'email' | 'password' | 'name' | 'phone' | 'address' | 'generic';
  validation?: ValidationRule;
  showValidationIcon?: boolean;
  allowClear?: boolean;
  trimWhitespace?: boolean;
  onValidationChange?: (isValid: boolean, error: string | null) => void;
  variant?: 'default' | 'glass';
}

export const Input: React.FC<InputProps> = memo(
  ({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    inputStyle,
    labelStyle,
    isPassword = false,
    required = false,
    disabled = false,
    inputType = 'generic',
    validation,
    showValidationIcon = true,
    allowClear = true,
    trimWhitespace = false,
    onValidationChange,
    variant = 'default',
    testID,
    accessibilityLabel,
    accessibilityHint,
    ...props
  }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Create validation function
    const validateInput = useMemo(() => {
      if (!validation) return null;
      return createValidationConfig(validation);
    }, [validation]);

    // Enhanced onChangeText with stable configuration and validation
    const stableInputConfig = useMemo(() => {
      const config = createStableInputConfig(
        isPassword ? 'password' : inputType,
        (text: string) => {
          // Run validation if provided
          if (validateInput) {
            const validationResult = validateInput(text);
            setValidationError(validationResult);
            onValidationChange?.(validationResult === null, validationResult);
          }

          // Call original onChangeText
          props.onChangeText?.(text);
        },
        undefined, // Don't pass onBlur here to avoid conflicts
        props.value || '',
        {
          allowClear,
          trimWhitespace,
          preventEmpty: validation?.required ?? false,
        }
      );

      return config;
    }, [
      isPassword,
      inputType,
      props.onChangeText,
      props.value,
      allowClear,
      trimWhitespace,
      validation?.required,
      validateInput,
      onValidationChange,
    ]);

    const handleFocus = useCallback(
      (event: any) => {
        setIsFocused(true);
        props.onFocus?.(event);
      },
      [props.onFocus]
    );

    const handleBlur = useCallback(
      (event: any) => {
        setIsFocused(false);
        props.onBlur?.(event);
      },
      [props.onBlur]
    );

    const togglePasswordVisibility = useCallback(() => {
      setShowPassword(prev => !prev);
    }, []);

    const hasError = Boolean(error || validationError);
    const displayError = error || validationError;
    const isValid = !hasError && props.value && props.value.length > 0;
    const showRightIcon = rightIcon || isPassword || (showValidationIcon && isValid);

    const inputContainerStyles = [
      variant === 'glass' ? styles.inputContainerGlass : styles.inputContainer,
      isFocused &&
        (variant === 'glass' ? styles.inputContainerGlassFocused : styles.inputContainerFocused),
      hasError &&
        (variant === 'glass' ? styles.inputContainerGlassError : styles.inputContainerError),
      disabled && styles.inputContainerDisabled,
    ];

    const inputStyles = [
      variant === 'glass' ? styles.inputGlass : styles.input,
      leftIcon && styles.inputWithLeftIcon,
      showRightIcon && styles.inputWithRightIcon,
      disabled && styles.inputDisabled,
      inputStyle,
    ];

    const rightIconName = isPassword
      ? showPassword
        ? 'eye-off-outline'
        : 'eye-outline'
      : rightIcon || (showValidationIcon && isValid ? 'checkmark-circle' : undefined);

    const rightIconPress = isPassword ? togglePasswordVisibility : onRightIconPress;
    const rightIconColor =
      variant === 'glass'
        ? hasError
          ? '#FF6B6B'
          : isValid
            ? '#4ECDC4'
            : isFocused
              ? '#A8E6CF'
              : 'rgba(255, 255, 255, 0.7)'
        : hasError
          ? '#FF3B30'
          : isValid
            ? '#34C759'
            : isFocused
              ? '#007AFF'
              : '#8E8E93';

    const leftIconColor =
      variant === 'glass'
        ? hasError
          ? '#FF6B6B'
          : isFocused
            ? '#A8E6CF'
            : 'rgba(255, 255, 255, 0.7)'
        : hasError
          ? '#FF3B30'
          : isFocused
            ? '#007AFF'
            : '#8E8E93';

    const placeholderTextColor = variant === 'glass' ? 'rgba(255, 255, 255, 0.6)' : '#8E8E93';

    return (
      <View style={[styles.container, containerStyle]} testID={testID}>
        {label && (
          <Text
            style={[styles.label, labelStyle]}
            accessibilityRole="text"
            testID={`${testID}-label`}
          >
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}

        <View style={inputContainerStyles}>
          {leftIcon && (
            <Ionicons name={leftIcon} size={20} color={leftIconColor} style={styles.leftIcon} />
          )}

          <TextInput
            style={inputStyles}
            editable={!disabled}
            placeholderTextColor={placeholderTextColor}
            accessibilityLabel={accessibilityLabel || label}
            accessibilityHint={accessibilityHint || hint}
            accessibilityState={{
              disabled,
            }}
            testID={`${testID}-input`}
            onFocus={handleFocus}
            {...stableInputConfig}
            {...props}
            secureTextEntry={isPassword && !showPassword}
            onBlur={handleBlur}
          />

          {showRightIcon && (
            <TouchableOpacity
              onPress={rightIconPress}
              disabled={!rightIconPress}
              style={styles.rightIconContainer}
              testID={`${testID}-right-icon`}
              accessibilityRole="button"
              accessibilityLabel={isPassword ? 'Toggle password visibility' : 'Right icon'}
            >
              <Ionicons name={rightIconName!} size={20} color={rightIconColor} />
            </TouchableOpacity>
          )}
        </View>

        {(displayError || hint) && (
          <Text
            style={[styles.helperText, hasError && styles.errorText]}
            testID={`${testID}-helper-text`}
            accessibilityRole="text"
            accessibilityLiveRegion={hasError ? 'assertive' : 'polite'}
          >
            {displayError || hint}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  inputContainerFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  inputContainerDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  inputDisabled: {
    color: '#8E8E93',
  },
  leftIcon: {
    marginLeft: 12,
  },
  rightIconContainer: {
    padding: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    color: '#FF3B30',
  },
  // Glass variant styles
  inputContainerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 60,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 4,
  },
  inputContainerGlassFocused: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: 'rgba(168, 230, 207, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  inputContainerGlassError: {
    borderColor: 'rgba(255, 107, 107, 0.5)',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    shadowColor: 'rgba(255, 107, 107, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGlass: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: '400',
  },
});
