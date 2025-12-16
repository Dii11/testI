/// <reference types="@types/jest" />

import { configureStore } from '@reduxjs/toolkit';

import * as HealthDataServiceModule from '../../../services/health/HealthDataService';
import type { HealthMetric } from '../../../types/health';
import { HealthDataType } from '../../../types/health';
import reducer, { addHealthMetric } from '../healthSlice';
import { requestHealthPermissions as requestPermissionsThunk } from '../healthSlice';
import {
  initializeHealthService,
  requestHealthPermissions,
  fetchLatestHealthData,
} from '../healthSlice';

describe('healthSlice', () => {
  it('handles initializeHealthService.fulfilled updating permissions', () => {
    const initial = undefined as any;
    const action = {
      type: initializeHealthService.fulfilled.type,
      payload: {
        initialized: true,
        permissions: [
          { type: HealthDataType.STEPS, granted: true },
          { type: HealthDataType.HEART_RATE, granted: false },
        ],
      },
    };
    const state = reducer(initial, action as any);
    expect(state.permissions.requested).toBe(true);
    expect(state.permissions.granted).toBe(true); // at least one granted
    expect(state.permissions.types).toContain(HealthDataType.STEPS);
  });

  it('flags partiallyGranted when some permissions granted', () => {
    const action = {
      type: initializeHealthService.fulfilled.type,
      payload: {
        initialized: true,
        permissions: [
          { type: HealthDataType.STEPS, granted: true, read: true },
          { type: HealthDataType.HEART_RATE, granted: false, read: true },
          { type: HealthDataType.WEIGHT, granted: false, read: true },
        ],
      },
    } as any;
    const state = reducer(undefined as any, action);
    expect(state.permissions.granted).toBe(true);
    const perms: any = state.permissions;
    expect(perms.partiallyGranted).toBe(true);
    expect(perms.details?.length).toBe(3);
  });

  it('requestHealthPermissions.fulfilled sets granular details', () => {
    const base = reducer(undefined as any, { type: '@@INIT' } as any);
    const action = {
      type: requestHealthPermissions.fulfilled.type,
      payload: [
        { type: HealthDataType.STEPS, granted: true, read: true, write: true },
        { type: HealthDataType.HEART_RATE, granted: true, read: true },
        { type: HealthDataType.SLEEP, granted: false, read: true },
      ],
    } as any;
    const state = reducer(base, action);
    const perms: any = state.permissions;
    expect(perms.details?.find((p: any) => p.type === HealthDataType.SLEEP)?.granted).toBe(false);
    expect(perms.partiallyGranted).toBe(true);
    expect(perms.types).toContain(HealthDataType.HEART_RATE);
  });

  it('handles requestHealthPermissions.rejected setting error & granted=false', () => {
    const state1 = reducer(undefined as any, { type: '@@INIT' } as any);
    const action = {
      type: requestHealthPermissions.rejected.type,
      error: { message: 'Denied' },
    };
    const state2 = reducer(state1, action as any);
    expect(state2.permissions.granted).toBe(false);
    expect(state2.error).toBe('Denied');
  });

  it('updates steps & progress on fetchLatestHealthData.fulfilled', () => {
    const start = reducer(undefined as any, { type: '@@INIT' } as any);
    const today = new Date();
    const stepsMetrics = [
      { type: HealthDataType.STEPS, value: 1000, unit: 'count', source: 'test', timestamp: today },
      { type: HealthDataType.STEPS, value: 2000, unit: 'count', source: 'test', timestamp: today },
    ];
    const action = {
      type: fetchLatestHealthData.fulfilled.type,
      payload: {
        heartRate: [],
        steps: stepsMetrics,
        weight: [],
        bloodPressure: [],
        oxygenSaturation: [],
        bodyTemperature: [],
        bloodGlucose: [],
      },
    };
    const state = reducer(start, action as any);
    expect(state.healthData.steps.today).toBe(3000);
    expect(state.healthData.steps.latest?.value).toBe(2000);
    // Progress should be (3000 / goal(10000))*100
    expect(Math.round(state.healthData.steps.progress)).toBe(30);
  });

  it('addHealthMetric updates steps.today & progress incrementally', () => {
    const base = reducer(undefined as any, { type: '@@INIT' } as any);
    const metric: HealthMetric = {
      id: 'm1',
      type: HealthDataType.STEPS,
      value: 1500,
      unit: 'count',
      source: 'watch',
      timestamp: new Date(),
    };
    const state = reducer(base, addHealthMetric(metric));
    expect(state.healthData.steps.today).toBe(1500);
    expect(state.healthData.steps.progress).toBeCloseTo(15, 0); // ~15%
  });

  it('single permission request thunk updates granular state', async () => {
    const mockService: any = {
      requestPermissions: jest.fn().mockResolvedValue(true),
      getPermissions: jest.fn().mockResolvedValue([
        { type: HealthDataType.STEPS, granted: true, read: true, write: true },
        { type: HealthDataType.HEART_RATE, granted: false, read: true },
      ]),
      initialize: jest.fn().mockResolvedValue(true),
    };
    jest
      .spyOn(HealthDataServiceModule.HealthDataService, 'getInstance')
      .mockReturnValue(mockService);
    const store = configureStore({ reducer: { health: reducer } });
    await store.dispatch(requestPermissionsThunk([HealthDataType.STEPS]) as any);
    const state: any = store.getState().health;
    expect(mockService.requestPermissions).toHaveBeenCalledWith([HealthDataType.STEPS]);
    expect(state.permissions.types).toContain(HealthDataType.STEPS);
    expect(
      state.permissions.details.find((p: any) => p.type === HealthDataType.STEPS).granted
    ).toBe(true);
    expect(state.permissions.partiallyGranted).toBe(true);
  });
});
