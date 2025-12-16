import { StyleSheet } from 'react-native';

import { COLORS, SHADOWS } from '../constants';

/**
 * Shared style utilities matching the design system
 */
export const SharedStyles = StyleSheet.create({
  // Glass morphism effects - From designs
  glassContainer: {
    backgroundColor: COLORS.GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    ...SHADOWS.CARD_GLASS,
  },

  glassCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER_LIGHT,
    ...SHADOWS.SMALL_GREEN,
  },

  glassDark: {
    backgroundColor: COLORS.GLASS_BG_DARKER,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.GLASS_BORDER,
    ...SHADOWS.CARD_ELEVATED,
  },

  // Button styles - Matching designs
  buttonPrimary: {
    backgroundColor: COLORS.BUTTON_PRIMARY,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.SMALL_GREEN,
  },

  buttonSuccess: {
    backgroundColor: COLORS.BUTTON_SUCCESS,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.SMALL_GREEN,
  },

  buttonBlue: {
    backgroundColor: COLORS.BUTTON_BLUE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text styles - Matching designs
  textPrimary: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
  },

  textSecondary: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },

  textMuted: {
    color: COLORS.TEXT_MUTED,
    fontSize: 13,
  },

  textHeading: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.01,
  },

  // Input styles - From designs
  inputContainer: {
    backgroundColor: COLORS.GLASS_BG,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.GLASS_BORDER,
    paddingHorizontal: 22,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    letterSpacing: 0.01,
  },

  // Common layout styles
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  safeContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },

  // Health metric card style
  healthCard: {
    backgroundColor: COLORS.CARD_DARKER,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.HEALTH_CARD,
    borderLeftWidth: 4,
  },
});

/**
 * Helper functions for dynamic styles
 */
export const StyleHelpers = {
  // Create glass background with opacity
  glassBackground: (opacity: number = 0.1) => ({
    backgroundColor: `rgba(217,217,217,${opacity})`,
  }),

  // Create health card with specific accent color
  healthCard: (accentColor: string) => ({
    ...SharedStyles.healthCard,
    borderLeftColor: accentColor,
  }),

  // Create button with specific color
  buttonWithColor: (backgroundColor: string) => ({
    ...SharedStyles.buttonPrimary,
    backgroundColor,
  }),

  // Text shadow for better readability on gradients
  textWithShadow: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
};
