import { StyleSheet, Text, View } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants';

type HealthValueProps = {
  label: string;
  value: string;
  color?: string;
};

export const HealthValue = ({ label, value, color = COLORS.TEXT_PRIMARY }: HealthValueProps) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: SPACING.SM,
  },
  label: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    marginBottom: SPACING.XS,
  },
  value: {
    fontSize: TYPOGRAPHY.FONT_SIZE_2XL,
    fontWeight: '600',
  },
});

export default HealthValue;