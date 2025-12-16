import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import type { ViewStyle, TextStyle, TouchableOpacityProps } from 'react-native';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { hapticFeedback } from '../../utils/platform';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  haptic?: boolean;
}

export const Button: React.FC<ButtonProps> = memo(
  ({
    title,
    variant = 'primary',
    size = 'medium',
    loading = false,
    disabled = false,
    icon,
    iconPosition = 'left',
    style,
    textStyle,
    fullWidth = false,
    haptic = true,
    onPress,
    testID,
    accessibilityLabel,
    ...props
  }) => {
    const handlePress = (event: any) => {
      if (loading || disabled) return;

      if (haptic) {
        hapticFeedback.light();
      }

      onPress?.(event);
    };

    const isDisabled = disabled || loading;

    const buttonStyles = [
      styles.base,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      isDisabled && styles.disabled,
      isDisabled && styles[`${variant}Disabled`],
      style,
    ];

    const textStyles = [
      styles.text,
      styles[`${variant}Text`],
      styles[`${size}Text`],
      isDisabled && styles.disabledText,
      textStyle,
    ];

    const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
    const iconColor = isDisabled ? styles.disabledText.color : styles[`${variant}Text`].color;

    return (
      <TouchableOpacity
        style={buttonStyles}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.7}
        testID={testID || `button-${variant}-${size}`}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityState={{
          disabled: isDisabled,
          busy: loading,
        }}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size={iconSize} color={iconColor} testID="button-loading-indicator" />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} style={styles.iconLeft} />
            )}
            <Text style={textStyles} numberOfLines={1}>
              {title}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={iconSize} color={iconColor} style={styles.iconRight} />
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },

  // Variants
  primary: {
    backgroundColor: '#007AFF',
  },
  primaryDisabled: {
    backgroundColor: '#B0BEC5',
  },
  secondary: {
    backgroundColor: '#F5F5F5',
  },
  secondaryDisabled: {
    backgroundColor: '#E0E0E0',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: '#007AFF',
  },
  outlineDisabled: {
    borderColor: '#B0BEC5',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostDisabled: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#FF3B30',
  },
  dangerDisabled: {
    backgroundColor: '#FFABAB',
  },

  // Sizes
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
  },

  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#333333',
  },
  outlineText: {
    color: '#007AFF',
  },
  ghostText: {
    color: '#007AFF',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#9E9E9E',
  },

  // Text sizes
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },

  // Icons
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
