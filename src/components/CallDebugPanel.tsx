/**
 * CallDebugPanel
 * 
 * Production-ready debug panel for call diagnostics
 * Shows call status, push notification status, and errors
 * Allows copying error details for troubleshooting
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Clipboard,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CallDebugInfo {
  timestamp: string;
  caller: string;
  recipient: string;
  callType: 'audio' | 'video';
  initiationSuccess: boolean;
  pushStatus?: string;
  pushError?: string;
  roomUrl?: string;
  error?: string;
  requestPayload?: {
    recipientId: string;
    callType: string;
    metadata?: Record<string, any>;
  };
  additionalInfo?: Record<string, any>;
}

interface CallDebugPanelProps {
  visible: boolean;
  onClose: () => void;
  debugInfo: CallDebugInfo | null;
}

export const CallDebugPanel: React.FC<CallDebugPanelProps> = ({
  visible,
  onClose,
  debugInfo,
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    Clipboard.setString(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAllInfo = () => {
    if (!debugInfo) return;

    const fullInfo = `
HopMed Call Debug Report
========================
Timestamp: ${debugInfo.timestamp}
Caller: ${debugInfo.caller}
Recipient: ${debugInfo.recipient}
Call Type: ${debugInfo.callType}
Initiation: ${debugInfo.initiationSuccess ? 'SUCCESS' : 'FAILED'}
${debugInfo.roomUrl ? `Room URL: ${debugInfo.roomUrl}` : ''}

Push Notification Status
-------------------------
Status: ${debugInfo.pushStatus || 'unknown'}
${debugInfo.pushError ? `Error: ${debugInfo.pushError}` : 'No errors'}

${debugInfo.requestPayload ? `API Request Payload\n-------------------\nRecipient ID: ${debugInfo.requestPayload.recipientId}\nCall Type: ${debugInfo.requestPayload.callType}\n${debugInfo.requestPayload.metadata ? `Metadata:\n${JSON.stringify(debugInfo.requestPayload.metadata, null, 2)}\n` : ''}` : ''}

${debugInfo.error ? `Call Error\n----------\n${debugInfo.error}\n` : ''}

${debugInfo.additionalInfo ? `Additional Info\n--------------\n${JSON.stringify(debugInfo.additionalInfo, null, 2)}` : ''}

Generated: ${new Date().toISOString()}
    `.trim();

    Clipboard.setString(fullInfo);
    Alert.alert('Copied!', 'Debug information copied to clipboard');
  };

  if (!debugInfo) return null;

  const getStatusIcon = (status: boolean | undefined) => {
    return status ? '✅' : '❌';
  };

  const getStatusColor = (status: boolean | undefined) => {
    return status ? '#4CAF50' : '#F44336';
  };

  const getPushStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'sent':
        return '#4CAF50';
      case 'failed':
        return '#FF9800';
      case 'error':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>📊 Call Debug Info</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Call Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Call Status</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Initiation:</Text>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: getStatusColor(debugInfo.initiationSuccess) }]}>
                    {getStatusIcon(debugInfo.initiationSuccess)} {debugInfo.initiationSuccess ? 'SUCCESS' : 'FAILED'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{debugInfo.callType}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Time:</Text>
                <Text style={styles.value}>{new Date(debugInfo.timestamp).toLocaleString()}</Text>
              </View>
            </View>

            {/* Push Notification Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Push Notification</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Status:</Text>
                <View style={[styles.pushStatusBadge, { backgroundColor: getPushStatusColor(debugInfo.pushStatus) }]}>
                  <Text style={styles.pushStatusText}>{debugInfo.pushStatus?.toUpperCase() || 'UNKNOWN'}</Text>
                </View>
              </View>

              {debugInfo.pushError && (
                <View style={styles.errorBox}>
                  <View style={styles.errorHeader}>
                    <Ionicons name="warning" size={16} color="#F44336" />
                    <Text style={styles.errorTitle}>Push Error Details</Text>
                  </View>
                  <Text style={styles.errorText}>{debugInfo.pushError}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(debugInfo.pushError!, 'pushError')}
                  >
                    <Ionicons name={copiedSection === 'pushError' ? 'checkmark' : 'copy-outline'} size={16} color="#2196F3" />
                    <Text style={styles.copyButtonText}>
                      {copiedSection === 'pushError' ? 'Copied!' : 'Copy Error'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!debugInfo.pushError && debugInfo.pushStatus === 'sent' && (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.successText}>Notification sent successfully</Text>
                </View>
              )}
            </View>

            {/* Participants */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Participants</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Caller:</Text>
                <Text style={styles.value}>{debugInfo.caller}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Recipient:</Text>
                <Text style={styles.value}>{debugInfo.recipient}</Text>
              </View>
            </View>

            {/* Room URL */}
            {debugInfo.roomUrl && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Room URL</Text>
                <View style={styles.urlBox}>
                  <Text style={styles.urlText} numberOfLines={2}>{debugInfo.roomUrl}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(debugInfo.roomUrl!, 'roomUrl')}
                  >
                    <Ionicons name={copiedSection === 'roomUrl' ? 'checkmark' : 'copy-outline'} size={16} color="#2196F3" />
                    <Text style={styles.copyButtonText}>
                      {copiedSection === 'roomUrl' ? 'Copied!' : 'Copy URL'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Request Payload */}
            {debugInfo.requestPayload && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>API Request Payload</Text>
                <View style={styles.codeBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Recipient ID:</Text>
                    <Text style={[styles.value, styles.monoText]}>{debugInfo.requestPayload.recipientId}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Call Type:</Text>
                    <Text style={styles.value}>{debugInfo.requestPayload.callType}</Text>
                  </View>
                  {debugInfo.requestPayload.metadata && (
                    <View style={styles.metadataBox}>
                      <Text style={styles.label}>Metadata:</Text>
                      <Text style={styles.codeText}>
                        {JSON.stringify(debugInfo.requestPayload.metadata, null, 2)}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(JSON.stringify(debugInfo.requestPayload, null, 2), 'payload')}
                >
                  <Ionicons name={copiedSection === 'payload' ? 'checkmark' : 'copy-outline'} size={16} color="#2196F3" />
                  <Text style={styles.copyButtonText}>
                    {copiedSection === 'payload' ? 'Copied!' : 'Copy Payload'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Call Error */}
            {debugInfo.error && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Call Error</Text>
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{debugInfo.error}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(debugInfo.error!, 'callError')}
                  >
                    <Ionicons name={copiedSection === 'callError' ? 'checkmark' : 'copy-outline'} size={16} color="#2196F3" />
                    <Text style={styles.copyButtonText}>
                      {copiedSection === 'callError' ? 'Copied!' : 'Copy Error'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Additional Info */}
            {debugInfo.additionalInfo && Object.keys(debugInfo.additionalInfo).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Info</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(debugInfo.additionalInfo, null, 2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Troubleshooting Tips */}
            {!debugInfo.initiationSuccess && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 Troubleshooting</Text>
                <View style={styles.tipBox}>
                  {debugInfo.pushStatus === 'failed' && (
                    <Text style={styles.tipText}>
                      • Push notification failed, but call should still work if recipient is in the app
                    </Text>
                  )}
                  {debugInfo.error?.includes('userId') && (
                    <Text style={styles.tipText}>
                      • Check if recipient user ID is correct
                    </Text>
                  )}
                  {debugInfo.error?.includes('network') && (
                    <Text style={styles.tipText}>
                      • Check your internet connection
                    </Text>
                  )}
                  <Text style={styles.tipText}>
                    • Try restarting the app
                  </Text>
                  <Text style={styles.tipText}>
                    • Contact support with this debug info if issue persists
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.copyAllButton} onPress={copyAllInfo}>
              <Ionicons name="copy-outline" size={20} color="#fff" />
              <Text style={styles.copyAllButtonText}>Copy All Debug Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pushStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pushStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#D32F2F',
    lineHeight: 20,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  successText: {
    fontSize: 13,
    color: '#388E3C',
    marginLeft: 8,
  },
  urlBox: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  urlText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  codeBox: {
    backgroundColor: '#263238',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    fontSize: 12,
    color: '#A5D6A7',
    fontFamily: 'monospace',
  },
  tipBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#1976D2',
    marginBottom: 8,
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  copyButtonText: {
    fontSize: 13,
    color: '#2196F3',
    marginLeft: 6,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
  },
  copyAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  metadataBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
});

export default CallDebugPanel;
