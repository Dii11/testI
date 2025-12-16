import { PerformanceTier } from '../types/performance';

export interface DeviceOverride {
  forceTier?: PerformanceTier;
  disableNativeDriver?: boolean;
  disableGradients?: boolean;
  disableGlass?: boolean;
  disableShadows?: boolean;
  disableTransforms?: boolean;
  maxMemoryMB?: number;
  reason?: string;
}

/**
 * Device-specific overrides for known problematic models
 * Key: lowercase model name (partial match)
 * Value: override configuration
 */
export const DEVICE_OVERRIDES: Record<string, DeviceOverride> = {
  // Samsung Budget A-series (Mali-G52 GPU issues with complex rendering)
  'galaxy a01': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget device with limited GPU capabilities',
  },
  'galaxy a02': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget device with limited GPU capabilities',
  },
  'galaxy a03': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device with limited GPU capabilities',
  },
  'galaxy a10': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    maxMemoryMB: 2048,
    reason: 'OneUI animation conflicts with native driver',
  },
  'galaxy a11': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    maxMemoryMB: 3072,
    reason: 'OneUI animation conflicts with native driver',
  },
  'galaxy a12': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    disableGradients: true,
    disableGlass: true,
    maxMemoryMB: 3072,
    reason: 'Mali-G52 budget config struggles with gradients and glass effects',
  },
  'galaxy a13': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    disableGradients: true,
    disableGlass: true,
    maxMemoryMB: 3072,
    reason: 'Similar GPU issues as A12',
  },
  'galaxy a20': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device with limited GPU capabilities',
  },
  'galaxy a21': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device with limited GPU capabilities',
  },
  'galaxy a22': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    maxMemoryMB: 4096,
    reason: 'OneUI animation conflicts',
  },
  'galaxy a23': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 4096,
    reason: 'Budget A-series',
  },
  'galaxy a30': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Lower mid-range device',
  },
  'galaxy a31': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 4096,
    reason: 'Lower mid-range device',
  },
  'galaxy a32': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 4096,
    reason: 'Lower mid-range device',
  },
  'galaxy a33': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 6144,
    reason: 'Lower mid-range device',
  },

  // Samsung M-series (similar to A-series budget)
  'galaxy m01': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget M-series',
  },
  'galaxy m02': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget M-series',
  },
  'galaxy m11': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget M-series',
  },
  'galaxy m12': {
    forceTier: PerformanceTier.LOW,
    disableNativeDriver: true,
    maxMemoryMB: 3072,
    reason: 'Similar specs to A12',
  },

  // Tecno Budget Series (PowerVR GE8320 optimized for simple UI)
  'spark 5': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'PowerVR GE8320 optimized for simple UI',
  },
  'spark 6': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget device',
  },
  'spark 7': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget device',
  },
  'spark 8': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
  'camon 15': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget Tecno device',
  },
  'camon 16': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 4096,
    reason: 'Budget Tecno device',
  },

  // Infinix Budget Series
  'hot 9': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget device',
  },
  'hot 10': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
  'note 7': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Budget Infinix device',
  },

  // Xiaomi Redmi Budget Series
  'redmi 9a': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Entry-level device',
  },
  'redmi 9c': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Entry-level device',
  },
  'redmi 7': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Older budget device',
  },
  'redmi 8': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
  'redmi 8a': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Entry-level device',
  },

  // Realme Budget Series
  'realme c11': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Entry-level device',
  },
  'realme c12': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
  'realme c15': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
  'realme c20': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 2048,
    reason: 'Entry-level device',
  },
  'realme c21': {
    forceTier: PerformanceTier.LOW,
    maxMemoryMB: 3072,
    reason: 'Budget device',
  },
};

/**
 * Check if a device model has specific overrides
 * @param modelName Device model name (will be converted to lowercase)
 * @returns DeviceOverride if found, null otherwise
 */
export function getDeviceOverride(modelName: string): DeviceOverride | null {
  if (!modelName) return null;

  const lowerModel = modelName.toLowerCase();

  // Try exact match first
  if (DEVICE_OVERRIDES[lowerModel]) {
    return DEVICE_OVERRIDES[lowerModel];
  }

  // Try partial match (e.g., "SM-A125F" matches "galaxy a12")
  for (const [key, override] of Object.entries(DEVICE_OVERRIDES)) {
    if (lowerModel.includes(key) || key.includes(lowerModel)) {
      return override;
    }
  }

  return null;
}

/**
 * Apply device-specific overrides to capabilities
 */
export function applyDeviceOverrides(
  modelName: string,
  manufacturer: string,
  baseTier: PerformanceTier,
  baseMemoryMB: number
): {
  tier: PerformanceTier;
  memoryMB: number;
  useNativeDriver: boolean;
  supportsGradients: boolean;
  supportsGlass: boolean;
  supportsShadows: boolean;
  supportsTransforms: boolean;
} {
  const override = getDeviceOverride(modelName);

  if (!override) {
    // No overrides, return defaults
    return {
      tier: baseTier,
      memoryMB: baseMemoryMB,
      useNativeDriver: baseTier !== PerformanceTier.LOW,
      supportsGradients: baseTier !== PerformanceTier.LOW,
      supportsGlass: baseTier !== PerformanceTier.LOW,
      supportsShadows: baseTier !== PerformanceTier.LOW,
      supportsTransforms: baseTier !== PerformanceTier.LOW,
    };
  }

  console.log(`🔧 Applying device override for ${modelName}: ${override.reason}`);

  return {
    tier: override.forceTier ?? baseTier,
    memoryMB: override.maxMemoryMB ?? baseMemoryMB,
    useNativeDriver: override.disableNativeDriver ? false : baseTier !== PerformanceTier.LOW,
    supportsGradients: override.disableGradients ? false : true,
    supportsGlass: override.disableGlass ? false : true,
    supportsShadows: override.disableShadows ? false : baseTier !== PerformanceTier.LOW,
    supportsTransforms: override.disableTransforms ? false : baseTier !== PerformanceTier.LOW,
  };
}
