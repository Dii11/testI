// Mock debug package for React Native
const debug = (namespace) => {
  const log = (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${namespace}]`, ...args);
    }
  };
  
  log.enabled = process.env.NODE_ENV === 'development';
  log.namespace = namespace;
  
  return log;
};

debug.enabled = process.env.NODE_ENV === 'development';
debug.namespace = '';

module.exports = debug;

