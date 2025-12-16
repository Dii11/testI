import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';
import { openHealthSettings } from '../../utils/healthSettings';

interface PermissionDeniedViewProps {
  permissionName: string;
  featureName: string;
  reason: string;
}

export const PermissionDeniedView: React.FC<PermissionDeniedViewProps> = ({
  permissionName,
  featureName,
  reason,
}) => {
  const handleOpenSettings = () => {
    openHealthSettings();
  };

  return (
    <View style={styles.container}>
      <Ionicons name="shield-checkmark-outline" size={80} color={COLORS.WARNING} />
      <Text style={styles.title}>Permission Required for {featureName}</Text>
      <Text style={styles.reasonText}>{reason}</Text>
      <Text style={styles.instructionText}>
        To enable this feature, please grant the "{permissionName}" permission in your device
        settings.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleOpenSettings}>
        <Text style={styles.buttonText}>Go to Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
    backgroundColor: COLORS.LIGHT_GRAY,
  },
  title: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_HEADING,
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    textAlign: 'center',
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  reasonText: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_REGULAR,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    textAlign: 'center',
    marginBottom: SPACING.LG,
    color: COLORS.TEXT_SECONDARY,
  },
  instructionText: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_REGULAR,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    textAlign: 'center',
    marginBottom: SPACING.LG,
    color: COLORS.TEXT_SECONDARY,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_BOLD,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.WHITE,
  },
});
