import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants';

interface HealthProviderInfoProps {
  providerName: string;
  lastSyncTime: string | null;
}

const getProviderIcon = (providerName: string): keyof typeof Ionicons.glyphMap => {
  const lowerProviderName = providerName.toLowerCase();
  if (lowerProviderName.includes('apple')) {
    return 'logo-apple';
  }
  if (lowerProviderName.includes('google')) {
    return 'logo-google';
  }
  return 'watch-outline';
};

const getProviderDisplayName = (providerName: string): string => {
  const lowerProviderName = providerName.toLowerCase();
  if (lowerProviderName.includes('apple')) {
    return 'Apple Health';
  }
  if (lowerProviderName.includes('google')) {
    return 'Google Health Connect';
  }
  return providerName;
};

export const HealthProviderInfo: React.FC<HealthProviderInfoProps> = ({
  providerName,
  lastSyncTime,
}) => {
  const lastSyncText = lastSyncTime
    ? `Synced ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`
    : 'Not synced yet';

  return (
    <View style={styles.container}>
      <Ionicons
        name={getProviderIcon(providerName)}
        size={20}
        color={COLORS.TEXT_SECONDARY}
        style={styles.icon}
      />
      <Text style={styles.text}>Data from {getProviderDisplayName(providerName)}</Text>
      <Text style={styles.syncText}>{lastSyncText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.SM,
    backgroundColor: COLORS.LIGHT_GRAY,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.SM,
  },
  icon: {
    marginRight: SPACING.SM,
  },
  text: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_REGULAR,
    fontSize: TYPOGRAPHY.FONT_SIZE_BASE,
    color: COLORS.TEXT_SECONDARY,
    flex: 1,
  },
  syncText: {
    fontFamily: TYPOGRAPHY.FONT_FAMILY_REGULAR,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_MUTED,
  },
});
