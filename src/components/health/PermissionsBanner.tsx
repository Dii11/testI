import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import {
  selectHealthPermissionSummary,
  selectMissingGrantedHealthTypes,
  selectHealthPermissionsGranted,
} from '../../store/selectors/healthSelectors';
import { requestHealthPermissions } from '../../store/slices/healthSlice';
import type { HealthDataType } from '../../types/health';

interface PermissionsBannerProps {
  compact?: boolean;
  onAfterRequest?: () => void;
}

export const PermissionsBanner: React.FC<PermissionsBannerProps> = ({
  compact,
  onAfterRequest,
}) => {
  const dispatch = useDispatch();
  const summary = useSelector(selectHealthPermissionSummary);
  const missing = useSelector(selectMissingGrantedHealthTypes);
  const hasGrantedAny = useSelector(selectHealthPermissionsGranted);
  const [isRequesting, setIsRequesting] = React.useState(false);

  if (summary.allGranted) return null;

  const handleRequest = async () => {
    if (isRequesting || missing.length === 0) return;
    setIsRequesting(true);
    try {
      await dispatch<any>(requestHealthPermissions(missing as HealthDataType[]));
      onAfterRequest?.();
    } finally {
      setIsRequesting(false);
    }
  };

  const title = !hasGrantedAny ? 'Enable health access' : 'Unlock more metrics';
  const subtitle = !hasGrantedAny
    ? 'Grant permissions to view steps, heart rate, sleep and more.'
    : `Still missing: ${missing.join(', ')}`;

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {missing.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={handleRequest}
          disabled={isRequesting}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isRequesting && styles.buttonDisabled,
          ]}
        >
          {isRequesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{hasGrantedAny ? 'Grant remaining' : 'Grant all'}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#222831',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  compactContainer: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#b0b8c4',
    fontSize: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#4da3ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default PermissionsBanner;
