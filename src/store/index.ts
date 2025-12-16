import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import { persistStore, persistReducer, createTransform } from 'redux-persist';

import { baseApi } from './api/baseApi';
import appointmentsSlice from './slices/appointmentsSlice';
import authSlice from './slices/authSlice';
import customersSlice from './slices/customersSlice';
import doctorsSlice from './slices/doctorsSlice';
import entitiesSlice from './slices/entitiesSlice';
import healthSlice from './slices/healthSlice';
import permissionSlice from './slices/permissionSlice';

// Use appropriate storage for platform
const getStorage = () => {
  if (Platform.OS === 'web') {
    // For web, use localStorage with fallback
    return {
      getItem: (key: string) => {
        try {
          return Promise.resolve(localStorage.getItem(key) || null);
        } catch {
          return Promise.resolve(null);
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
    };
  }
  return AsyncStorage;
};

// ✅ CRITICAL FIX: Transform to exclude transient auth state from persistence
// This prevents incomplete registration flows from persisting across app terminations
// while keeping user credentials and tokens persistent
const authTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any, key: any) => {
    if (key !== 'auth') return inboundState;

    // Exclude registrationFlow from persistence
    // This prevents users from being stuck on auth screens after app restart
    const { registrationFlow, ...persistedState } = inboundState;
    return persistedState;
  },
  // Transform state being rehydrated
  (outboundState: any, key: any) => {
    if (key !== 'auth') return outboundState;

    // Restore registrationFlow to initial state when rehydrating
    return {
      ...outboundState,
      registrationFlow: {
        isActive: false,
        currentStep: null,
        formData: null,
        phoneNumber: undefined,
      },
    };
  },
  // Define which reducer this transform applies to
  { whitelist: ['auth'] }
);

const persistConfig = {
  key: 'hopmed_root',
  storage: getStorage(),
  whitelist: ['auth'], // Only persist auth state
  version: 1,
  transforms: [authTransform], // ✅ Apply auth transform to exclude transient state
  migrate: (state: any) => {
    // Handle migration from old storage keys if needed
    return Promise.resolve(state);
  },
  // Persist the auth state immediately when it changes
  writeFailHandler: (err: any) => {
    console.error('Failed to persist state:', err);
  },
};

const rootReducer = combineReducers({
  auth: authSlice,
  doctors: doctorsSlice,
  customers: customersSlice,
  appointments: appointmentsSlice,
  health: healthSlice,
  permissions: permissionSlice,
  entities: entitiesSlice,
  [baseApi.reducerPath]: baseApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
