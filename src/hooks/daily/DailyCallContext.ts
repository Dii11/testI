import type { DailyCall } from '@daily-co/react-native-daily-js';
import React from 'react';

/**
 * React Context for Daily.co call object
 * Based on official Daily.co React Native example patterns
 */
export default React.createContext<DailyCall | null>(null);
