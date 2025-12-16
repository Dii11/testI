import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';

import { COLORS } from '../../constants';
import { VIDEO_CALL_PROVIDERS, getAvailableProviders } from '../../services/videoCallProviders';
import { VideoCallProvider } from '../../types/videoCallProvider';

interface VideoCallProviderSelectorProps {
  visible: boolean;
  onClose: () => void;
  onProviderSelected: (provider: VideoCallProvider) => void;
  currentProvider?: VideoCallProvider;
  title?: string;
  subtitle?: string;
}

const VideoCallProviderSelector: React.FC<VideoCallProviderSelectorProps> = ({
  visible,
  onClose,
  onProviderSelected,
  currentProvider,
  title = 'Choose Video Call Provider',
  subtitle = 'Select your preferred video calling technology',
}) => {
  const [selectedProvider, setSelectedProvider] = useState<VideoCallProvider>(
    currentProvider != null || VideoCallProvider.DAILY
  );

  const availableProviders = getAvailableProviders();

  const handleProviderSelect = useCallback((provider: VideoCallProvider) => {
    setSelectedProvider(provider);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedProvider !== currentProvider) {
      Alert.alert(
        'Switch Provider?',
        `Switch to ${VIDEO_CALL_PROVIDERS[selectedProvider].displayName || selectedProvider}? This will apply to your next call.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            onPress: () => {
              onProviderSelected(selectedProvider);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  }, [selectedProvider, currentProvider, onProviderSelected, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          {/* Provider Options */}
          <ScrollView style={styles.providersContainer}>
            {availableProviders.map(config => {
              const isSelected = selectedProvider === config.provider;
              const isCurrent = currentProvider === config.provider;

              return (
                <TouchableOpacity
                  key={config.provider}
                  style={[styles.providerOption, isSelected && styles.selectedProvider]}
                  onPress={() => handleProviderSelect(config.provider)}
                >
                  <View style={styles.providerHeader}>
                    <View style={styles.providerTitleRow}>
                      <View style={[styles.providerIcon, { backgroundColor: config.color }]}>
                        <Ionicons name={config.icon as any} size={24} color="#fff" />
                      </View>
                      <View style={styles.providerTitleContainer}>
                        <View style={styles.providerNameRow}>
                          <Text style={styles.providerName}>{config.displayName}</Text>
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>CURRENT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.providerDescription}>{config.description}</Text>
                      </View>
                    </View>
                    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                      {isSelected && <View style={styles.radioButtonInner} />}
                    </View>
                  </View>

                  {/* Features */}
                  <View style={styles.featuresContainer}>
                    {config.features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        <Ionicons name="checkmark-circle" size={16} color={config.color} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>
                {selectedProvider === currentProvider ? 'Done' : 'Switch Provider'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  providersContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  providerOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  selectedProvider: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: 'rgba(55, 120, 92, 0.05)',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerTitleContainer: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  currentBadge: {
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  providerDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: COLORS.PRIMARY,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.PRIMARY,
  },
  featuresContainer: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  confirmButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VideoCallProviderSelector;
