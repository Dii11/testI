import type {
  DailyEventObjectAvailableDevicesUpdated,
  MediaDeviceInfo,
} from '@daily-co/react-native-daily-js';
import { DailyEvent } from '@daily-co/react-native-daily-js';
import { useCallback, useEffect, useState } from 'react';

import { useCallObject } from './useCallObject';
import { useMeetingState } from './useMeetingState';

/**
 * Hook to manage Daily.co devices (cameras and microphones)
 * Based on official Daily.co React Native example patterns
 */
export const useDeviceManagement = () => {
  const callObject = useCallObject();
  const meetingState = useMeetingState();

  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraDevice, setSelectedCameraDevice] = useState<string | null>(null);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | null>(null);
  const [usingFrontCamera, setUsingFrontCamera] = useState(true);

  const refreshSelectedDevices = useCallback(async () => {
    if (!callObject) return;

    try {
      const devicesInUse = await callObject.getInputDevices();
      if (devicesInUse.camera && (devicesInUse.camera as MediaDeviceInfo).deviceId) {
        setSelectedCameraDevice((devicesInUse.camera as MediaDeviceInfo).deviceId);
      }
      if (devicesInUse.speaker && (devicesInUse.speaker as MediaDeviceInfo).deviceId) {
        setSelectedAudioDevice((devicesInUse.speaker as MediaDeviceInfo).deviceId);
      }
    } catch (error) {
      console.error('Failed to get input devices:', error);
    }
  }, [callObject]);

  const updateAvailableDevices = useCallback(
    (devices: MediaDeviceInfo[] | undefined) => {
      if (!devices) return;

      const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audio');

      setCameraDevices(videoInputDevices);
      setAudioDevices(audioDevices);
      refreshSelectedDevices();
    },
    [refreshSelectedDevices]
  );

  /**
   * Load devices when meeting is joined
   */
  useEffect(() => {
    if (!callObject || meetingState !== 'joined-meeting') {
      return;
    }

    const loadDevicesInfo = async () => {
      try {
        const devicesAvailable = await callObject.enumerateDevices();
        updateAvailableDevices(devicesAvailable.devices);
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    };

    loadDevicesInfo();
  }, [callObject, meetingState, updateAvailableDevices]);

  /**
   * Listen for available devices updates
   */
  useEffect(() => {
    if (!callObject) {
      return;
    }

    const handleDevicesUpdated = (event?: DailyEventObjectAvailableDevicesUpdated) => {
      updateAvailableDevices(event?.availableDevices);
    };

    callObject.on('available-devices-updated', handleDevicesUpdated);

    return function cleanup() {
      callObject.off('available-devices-updated', handleDevicesUpdated);
    };
  }, [callObject, updateAvailableDevices]);

  /**
   * Toggle between front and rear cameras
   */
  const flipCamera = useCallback(async () => {
    if (!callObject) return;

    try {
      const { device } = await callObject.cycleCamera();
      if (device) {
        setUsingFrontCamera(device.facingMode === 'user');
      }
    } catch (error) {
      console.error('Failed to flip camera:', error);
    }
  }, [callObject]);

  /**
   * Set specific camera device
   */
  const setCameraDevice = useCallback(
    async (deviceId: string) => {
      if (!callObject) return;

      try {
        await callObject.setCamera(deviceId);
        setSelectedCameraDevice(deviceId);
      } catch (error) {
        console.error('Failed to set camera device:', error);
      }
    },
    [callObject]
  );

  /**
   * Set specific audio device
   */
  const setAudioDevice = useCallback(
    async (deviceId: string) => {
      if (!callObject) return;

      try {
        const result = await callObject.setAudioDevice(deviceId);
        setSelectedAudioDevice(result.deviceId);
        console.log('Selected audio device:', result.deviceId);
      } catch (error) {
        console.error('Failed to set audio device:', error);
      }
    },
    [callObject]
  );

  return {
    cameraDevices,
    audioDevices,
    selectedCameraDevice,
    selectedAudioDevice,
    usingFrontCamera,
    flipCamera,
    setCameraDevice,
    setAudioDevice,
  };
};
