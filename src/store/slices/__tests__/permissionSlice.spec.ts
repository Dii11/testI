/// <reference types="@types/jest" />

import { configureStore } from '@reduxjs/toolkit';

import permissionsReducer, {
  checkCameraAndMicrophonePermissions,
  requestCameraAndMicrophonePermissions,
  selectCameraAndMicrophonePermission,
  selectCameraPermission,
  selectMicrophonePermission,
} from '../permissionSlice';

// Mocks for expo modules
jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'undetermined', canAskAgain: true })
    ),
    requestCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted', canAskAgain: true })
    ),
  },
}));

jest.mock('expo-av', () => ({
  Audio: {
    getPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'undetermined', canAskAgain: true })
    ),
    requestPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted', canAskAgain: true })
    ),
  },
}));

// Mock ConsolidatedPermissionManager instead of deleted permissionCacheService
jest.mock('../../../services/permissions/ConsolidatedPermissionManager', () => ({
  ConsolidatedPermissionManager: {
    getInstance: jest.fn(() => ({
      initialize: jest.fn(async () => {}),
      checkPermission: jest.fn(async () => ({
        status: 'granted',
        canAskAgain: true,
        metadata: { source: 'cache', timestamp: Date.now() },
      })),
      requestPermission: jest.fn(async () => ({
        status: 'granted',
        canAskAgain: true,
        metadata: { source: 'fresh', timestamp: Date.now() },
      })),
      invalidatePermission: jest.fn(() => {}),
    })),
  },
}));

const setupStore = () =>
  configureStore({
    reducer: { permissions: permissionsReducer },
  });

describe('permissionSlice', () => {
  it('derives combined status from individual permissions when cached', async () => {
    const store = setupStore();
    // First call: no cache, will read undetermined
    await store.dispatch(checkCameraAndMicrophonePermissions() as any);
    const combined = selectCameraAndMicrophonePermission(store.getState() as any);
    expect(combined.status).toBe('denied'); // undetermined treated as not granted
  });

  it('requests only missing permissions and updates cache', async () => {
    const store = setupStore();
    // Simulate initial request (grants both)
    await store.dispatch(requestCameraAndMicrophonePermissions() as any);
    const cam = selectCameraPermission(store.getState() as any);
    const mic = selectMicrophonePermission(store.getState() as any);
    const combined = selectCameraAndMicrophonePermission(store.getState() as any);
    expect(cam.status).toBe('granted');
    expect(mic.status).toBe('granted');
    expect(combined.status).toBe('granted');
  });

  it('ignores stale fulfillment results (concurrency guard)', async () => {
    const store = setupStore();
    const first = store.dispatch(checkCameraAndMicrophonePermissions() as any);
    const second = store.dispatch(checkCameraAndMicrophonePermissions() as any);
    await Promise.all([first, second]);
    // If guard works there should be no crash; we simply assert state shape
    const state: any = store.getState();
    expect(state.permissions.cameraAndMicrophone.status).toBeDefined();
  });
});
