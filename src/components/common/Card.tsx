import React, { memo } from 'react';
import type { ViewStyle, TouchableOpacityProps } from 'react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { getPlatformShadow } from '../../utils/platform';

interface CardProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
  borderRadius?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  pressable?: boolean;
  elevation?: number;
}

export const Card: React.FC<CardProps> = memo(
  ({
    children,
    variant = 'default',
    padding = 'medium',
    margin = 'none',
    borderRadius = 12,
    backgroundColor = '#FFFFFF',
    style,
    pressable = false,
    elevation = 2,
    testID,
    accessibilityLabel,
    ...props
  }) => {
    const cardStyles = [
      styles.base,
      styles[variant],
      (styles as any)[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`],
      (styles as any)[`margin${margin.charAt(0).toUpperCase() + margin.slice(1)}`],
      {
        borderRadius,
        backgroundColor,
        ...(variant === 'elevated' ? getPlatformShadow(elevation) : {}),
      },
      style,
    ];

    if (pressable) {
      return (
        <TouchableOpacity
          style={cardStyles}
          activeOpacity={0.7}
          testID={testID || 'card-pressable'}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          {...props}
        >
          {children}
        </TouchableOpacity>
      );
    }

    return (
      <View style={cardStyles} testID={testID || 'card'} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = memo(
  ({ children, style, testID = 'card-header' }) => (
    <View style={[styles.header, style]} testID={testID}>
      {children}
    </View>
  )
);

CardHeader.displayName = 'CardHeader';

interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export const CardContent: React.FC<CardContentProps> = memo(
  ({ children, style, testID = 'card-content' }) => (
    <View style={[styles.content, style]} testID={testID}>
      {children}
    </View>
  )
);

CardContent.displayName = 'CardContent';

interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export const CardFooter: React.FC<CardFooterProps> = memo(
  ({ children, style, testID = 'card-footer' }) => (
    <View style={[styles.footer, style]} testID={testID}>
      {children}
    </View>
  )
);

CardFooter.displayName = 'CardFooter';

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  default: {
    borderWidth: 0,
  },
  outlined: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  elevated: {
    borderWidth: 0,
  },

  // Padding variants
  paddingNone: {
    padding: 0,
  },
  paddingSmall: {
    padding: 8,
  },
  paddingMedium: {
    padding: 16,
  },
  paddingLarge: {
    padding: 24,
  },

  // Margin variants
  marginNone: {
    margin: 0,
  },
  marginSmall: {
    margin: 8,
  },
  marginMedium: {
    margin: 16,
  },
  marginLarge: {
    margin: 24,
  },

  // Card sections
  header: {
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
