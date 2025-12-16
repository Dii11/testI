/*
  Simple dev-gated logger.
  - In __DEV__ (development), logs to console with a consistent prefix.
  - In production, all methods are no-ops.
*/

/* eslint-disable no-console */

type LogArgs = [message?: any, ...optionalParams: any[]];

const prefix = '[HopMed]';

function devLog(method: 'log' | 'info' | 'warn' | 'error', ...args: LogArgs) {
  if (__DEV__) {
    // Prepend a consistent prefix for filtering

    console[method](prefix, ...args);
  }
}

export const Logger = {
  log: (...args: LogArgs) => devLog('log', ...args),
  info: (...args: LogArgs) => devLog('info', ...args),
  warn: (...args: LogArgs) => devLog('warn', ...args),
  error: (...args: LogArgs) => devLog('error', ...args),
};

export default Logger;
