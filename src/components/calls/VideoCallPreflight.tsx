import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

import { COLORS } from '../../constants';
import DailyService from '../../services/dailyService';
import NetworkMonitorService, { NetworkQuality } from '../../services/networkMonitorService';
import PermissionManager from '../../services/PermissionManagerMigrated';
import { SentryErrorTracker } from '../../utils/sentryErrorTracker';

interface Assessment {
  sdkReady: boolean | null;
  videoPermGranted: boolean | null;
  micPermGranted: boolean | null;
  networkQuality: NetworkQuality | null;
  videoReady: boolean;
  audioReady: boolean;
  reason?: string;
}

interface Props {
  callType: 'audio' | 'video';
  slim?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onAssessmentChange?: (assessment: Assessment) => void;
}

const StatusRow = ({
  ok,
  label,
  onFix,
}: {
  ok: boolean;
  label: string;
  onFix?: (() => void) | (() => Promise<void>) | undefined;
}) => (
  <View style={styles.statusRow}>
    <View style={[styles.dot, { backgroundColor: ok ? '#4CAF50' : '#FF9800' }]} />
    <Text style={[styles.statusText, !ok && styles.statusTextWarn]}>{label}</Text>
    {!ok && onFix && (
      <TouchableOpacity style={styles.fixBtn} onPress={onFix}>
        <Ionicons name="build-outline" size={14} color="#fff" />
        <Text style={styles.fixText}>Fix</Text>
      </TouchableOpacity>
    )}
  </View>
);

const VideoCallPreflight: React.FC<Props> = ({
  callType,
  slim,
  onReadyChange,
  onAssessmentChange,
}) => {
  const [sdkReady, setSdkReady] = useState<boolean | null>(null);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [networkReady, setNetworkReady] = useState<boolean | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);
  const [micPermGranted, setMicPermGranted] = useState<boolean | null>(null);
  const warnedRef = useRef(false);

  const permissionType = callType === 'video' ? 'camera+microphone' : 'microphone';

  const recompute = useCallback(() => {
    const videoReady = sdkReady === true && permGranted === true && networkReady === true;
    const audioNetworkReady = NetworkMonitorService.isAudioCallViable();
    const audioReady = sdkReady === true && micPermGranted === true && audioNetworkReady;
    onReadyChange?.(videoReady);
    onAssessmentChange?.({
      sdkReady,
      videoPermGranted: permGranted,
      micPermGranted,
      networkQuality,
      videoReady: !!videoReady,
      audioReady: !!audioReady,
      reason: !videoReady ? 'not-ready' : 'ready',
    });

    // Track a single warning if video not ready
    if (
      !videoReady &&
      !warnedRef.current &&
      sdkReady !== null &&
      permGranted !== null &&
      micPermGranted !== null &&
      networkQuality !== null
    ) {
      warnedRef.current = true;
      try {
        SentryErrorTracker.getInstance().trackWarning('Video preflight not ready', {
          component: 'VideoCallPreflight',
          callType,
          additional: {
            sdkReady,
            videoPermGranted: permGranted,
            micPermGranted,
            networkQuality,
            audioReady,
          },
        });
      } catch {}
    }
    return videoReady;
  }, [
    sdkReady,
    permGranted,
    micPermGranted,
    networkReady,
    networkQuality,
    onReadyChange,
    onAssessmentChange,
    callType,
  ]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    (async () => {
      try {
        // SDK availability
        const available = await DailyService.ensureReady();
        if (mounted) setSdkReady(!!available);
      } catch {
        if (mounted) setSdkReady(false);
      }

      // Permissions (check only; do not prompt yet)
      try {
        const res = await PermissionManager.checkPermission(permissionType);
        if (mounted) setPermGranted(res.status === 'granted');
      } catch {
        if (mounted) setPermGranted(false);
      }

      // Also check microphone permission for potential audio-only fallback
      try {
        const mic = await PermissionManager.checkPermission('microphone');
        if (mounted) setMicPermGranted(mic.status === 'granted');
      } catch {
        if (mounted) setMicPermGranted(false);
      }

      // Network monitoring
      const current = NetworkMonitorService.getCurrentState();
      const isReady =
        callType === 'video'
          ? NetworkMonitorService.isVideoCallViable()
          : NetworkMonitorService.isAudioCallViable();
      if (mounted) {
        setNetworkQuality(current.quality);
        setNetworkReady(isReady);
      }
      unsubscribe = NetworkMonitorService.addListener(state => {
        const readyNow =
          callType === 'video'
            ? NetworkMonitorService.isVideoCallViable()
            : NetworkMonitorService.isAudioCallViable();
        setNetworkQuality(state.quality);
        setNetworkReady(readyNow);
      });
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [callType, permissionType]);

  useEffect(() => {
    recompute();
  }, [sdkReady, permGranted, networkReady, recompute]);

  const qualityLabel = useMemo(() => {
    switch (networkQuality) {
      case NetworkQuality.EXCELLENT:
        return 'Excellent network';
      case NetworkQuality.GOOD:
        return 'Good network';
      case NetworkQuality.POOR:
        return 'Weak network';
      case NetworkQuality.DISCONNECTED:
        return 'No internet';
      default:
        return 'Checking network...';
    }
  }, [networkQuality]);

  const requestFixPermissions = useCallback(async () => {
    try {
      const res = await PermissionManager.requestPermission(permissionType, {
        feature: `preflight-${callType}`,
        priority: 'critical',
        userInitiated: true,
      });
      setPermGranted(res.status === 'granted');
    } catch {
      setPermGranted(false);
    }
  }, [permissionType, callType]);

  const sdkLabel = useMemo(() => {
    if (sdkReady === null) return 'Checking SDK...';
    if (sdkReady) return 'Daily SDK ready';
    return Platform.select({
      ios: 'Build required (not Expo Go)',
      android: 'Dev build required',
      default: 'SDK unavailable',
    })!;
  }, [sdkReady]);

  const permLabel = useMemo(() => {
    if (permGranted === null) return 'Checking permissions...';
    return permGranted ? 'Permissions granted' : 'Permissions needed';
  }, [permGranted]);

  const allReady = sdkReady && permGranted && networkReady;

  return (
    <View style={[styles.container, slim && styles.containerSlim]}>
      <View style={styles.headerRow}>
        <Ionicons name="shield-checkmark" size={16} color="#fff" />
        <Text style={styles.title}>Preflight Check</Text>
        <View style={[styles.readyPill, { backgroundColor: allReady ? '#2e7d32' : '#f57c00' }]}>
          <Text style={styles.readyText}>{allReady ? 'Ready' : 'Needs attention'}</Text>
        </View>
      </View>

      <StatusRow ok={!!sdkReady} label={sdkLabel} />
      <StatusRow
        ok={!!permGranted}
        label={permLabel}
        onFix={!permGranted ? requestFixPermissions : undefined}
      />
      <StatusRow ok={!!networkReady} label={qualityLabel} />

      {sdkReady === false && (
        <View style={styles.infoBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#FFB74D" />
          <Text style={styles.infoText}>
            Video calls require a development build.{' '}
            {Platform.OS === 'ios'
              ? 'Install via Xcode or EAS build.'
              : 'Install a dev build (APK/AAB).'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    marginBottom: 12,
  },
  containerSlim: {
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  readyPill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  readyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    flex: 1,
  },
  statusTextWarn: {
    color: 'rgba(255,220,180,0.95)',
  },
  fixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  fixText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  infoBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 183, 77, 0.12)',
    borderColor: 'rgba(255, 183, 77, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  infoText: {
    color: 'rgba(255, 183, 77, 0.95)',
    fontSize: 11,
    flex: 1,
  },
});

export default VideoCallPreflight;
