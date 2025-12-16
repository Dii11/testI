import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

import { COLORS } from '../../constants';
import { useOfficialCallControls } from '../../hooks/daily/useOfficialCallControls';

interface OfficialCallControlsProps {
  onEndCall: () => void;
  disabled?: boolean;
  showScreenShare?: boolean;
  style?: any;
}

/**
 * ✅ ENHANCED: Official call controls with consistent UX across all contexts
 */
export const OfficialCallControls: React.FC<OfficialCallControlsProps> = ({
  onEndCall,
  disabled = false,
  showScreenShare = false,
  style,
}) => {
  const { isMuted, isVideoEnabled, toggleAudio, toggleVideo, isHandRaised, toggleHand } =
    useOfficialCallControls();

  // Enhanced UX state - consistent with other controls
  const [showSecondaryControls, setShowSecondaryControls] = useState(false);

  const handleMoreOptions = () => {
    setShowSecondaryControls(!showSecondaryControls);
  };

  const primaryControlSize = 64;
  const endCallSize = 72; // Larger for prominence
  const secondaryControlSize = 56;
  const iconSize = 24;
  const endCallIconSize = 28;

  return (
    <View style={[styles.enhancedContainer, style]}>
      {/* Secondary Controls (Expandable) */}
      {showSecondaryControls && (
        <View style={styles.secondaryControlsContainer}>
          {/* Hand Raise */}
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { width: secondaryControlSize, height: secondaryControlSize },
              isHandRaised && styles.activeSecondaryButton,
              disabled && styles.disabledButton,
            ]}
            onPress={toggleHand}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Text style={styles.handIcon}>{isHandRaised ? '✋' : '👋'}</Text>
          </TouchableOpacity>

          {/* Screen Share Placeholder */}
          {showScreenShare && (
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { width: secondaryControlSize, height: secondaryControlSize },
              ]}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Share screen"
            >
              <Ionicons name="desktop" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Primary Controls Row */}
      <View style={styles.primaryControlsRow}>
        {/* More Options */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            { width: primaryControlSize, height: primaryControlSize },
            showSecondaryControls && styles.activeButton,
            disabled && styles.disabledButton,
          ]}
          onPress={handleMoreOptions}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={showSecondaryControls ? 'Hide options' : 'Show options'}
        >
          <Ionicons name="ellipsis-horizontal" size={iconSize} color="#fff" />
        </TouchableOpacity>

        {/* Microphone Control */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            { width: primaryControlSize, height: primaryControlSize },
            isMuted && styles.mutedButton,
            disabled && styles.disabledButton,
          ]}
          onPress={toggleAudio}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={iconSize} color="#fff" />
        </TouchableOpacity>

        {/* Camera Control */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            { width: primaryControlSize, height: primaryControlSize },
            !isVideoEnabled && styles.mutedButton,
            disabled && styles.disabledButton,
          ]}
          onPress={toggleVideo}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          <Ionicons
            name={isVideoEnabled ? 'videocam' : 'videocam-off'}
            size={iconSize}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Prominent End Call Button - Same as other controls */}
      <TouchableOpacity
        style={[
          styles.endCallButtonEnhanced,
          { width: endCallSize + 40, height: endCallSize },
          disabled && styles.disabledButton,
        ]}
        onPress={onEndCall}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="End call"
      >
        <Ionicons name="call" size={endCallIconSize} color="#fff" />
        <Text style={styles.endCallLabel}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Legacy container (kept for backward compatibility)
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },

  // ✅ ENHANCED: Professional UX layout - consistent with other controls
  enhancedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },

  // Secondary controls (expandable)
  secondaryControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  secondaryButton: {
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },

  activeSecondaryButton: {
    backgroundColor: '#FF9800',
  },

  // Primary controls row
  primaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },

  controlButton: {
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },

  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.6)',
  },

  mutedButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.4,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // ✅ PROMINENT: Enhanced End Call button - consistent with other controls
  endCallButtonEnhanced: {
    backgroundColor: '#FF3B30',
    borderRadius: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  endCallLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Legacy styles (kept for backward compatibility)
  handRaisedButton: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  handIcon: {
    fontSize: 20,
  },
  endCallButton: {
    backgroundColor: '#f44336',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 120,
    flexDirection: 'row',
  },
});

export default OfficialCallControls;
