// Watch connectivity stripped. Placeholder no-op service to avoid import errors if referenced.
export const WatchConnectivityService = {
  supported: () => false,
  addListener: () => () => {},
  ensureListenerActive: () => false,
  sendMessage: async () => false,
};
