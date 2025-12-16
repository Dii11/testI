/**
 * Health Data Normalization & Validation Layer
 *
 * Ensures consistent data format across Apple HealthKit and Google Health Connect
 * Provides data validation, standardization, and integrity checks
 */

import { Platform } from 'react-native';

import type { HealthMetric, HealthDataRange } from '../../types/health';
import { HealthDataType } from '../../types/health';
import { sentryTracker } from '../../utils/sentryErrorTracker';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedData?: HealthMetric[];
}

export interface DataIntegrity {
  score: number; // 0-1, where 1 is perfect
  issues: string[];
  confidence: number;
}

export class HealthDataNormalizer {
  private static readonly MIN_VALID_TIMESTAMP = new Date('2020-01-01').getTime();
  private static readonly MAX_FUTURE_DAYS = 1; // Allow up to 1 day in future

  /**
   * Normalize health data from any platform to unified format
   */
  static normalizeHealthData(
    rawData: any[],
    dataType: HealthDataType,
    platform: 'ios' | 'android',
    source?: string
  ): ValidationResult {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      const normalizedData: HealthMetric[] = [];

      if (!Array.isArray(rawData)) {
        return {
          isValid: false,
          errors: ['Raw data must be an array'],
          warnings: [],
        };
      }

      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        const result = this.normalizeDataItem(item, dataType, platform, source, i);

        if (result.isValid && result.normalizedData) {
          normalizedData.push(result.normalizedData);
        }

        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }

      // Additional validation for the entire dataset
      const datasetValidation = this.validateDataset(normalizedData, dataType);
      errors.push(...datasetValidation.errors);
      warnings.push(...datasetValidation.warnings);

      return {
        isValid: errors.length === 0 && normalizedData.length > 0,
        errors,
        warnings,
        normalizedData: normalizedData.length > 0 ? normalizedData : undefined,
      };
    } catch (error) {
      console.error('🔧 Data normalization failed:', error);
      sentryTracker.trackServiceError(
        error instanceof Error ? error : 'Data normalization failed',
        {
          service: 'healthDataNormalizer',
          action: 'normalizeHealthData',
          additional: { dataType, platform, dataLength: rawData.length || 0 },
        }
      );

      return {
        isValid: false,
        errors: ['Normalization process failed'],
        warnings: [],
      };
    }
  }

  /**
   * Normalize individual data item
   */
  private static normalizeDataItem(
    item: any,
    dataType: HealthDataType,
    platform: 'ios' | 'android',
    source: string | undefined,
    index: number
  ): { isValid: boolean; errors: string[]; warnings: string[]; normalizedData?: HealthMetric } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!item || typeof item !== 'object') {
      return {
        isValid: false,
        errors: [`Item ${index}: Invalid data structure`],
        warnings: [],
      };
    }

    try {
      const normalized = this.createNormalizedMetric(item, dataType, platform, source, index);

      // Validate the normalized data
      const validation = this.validateMetric(normalized, dataType);

      return {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        normalizedData: validation.isValid ? normalized : undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Item ${index}: Normalization failed - ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Create normalized metric from platform-specific data
   */
  private static createNormalizedMetric(
    item: any,
    dataType: HealthDataType,
    platform: 'ios' | 'android',
    source: string | undefined,
    index: number
  ): HealthMetric {
    const baseId = `${platform}_${dataType}_${index}`;
    const timestamp = this.extractTimestamp(item, platform);
    const value = this.extractValue(item, dataType, platform);
    const unit = this.getStandardUnit(dataType);
    const deviceSource = this.determineSource(item, platform, source);

    return {
      id: `${baseId}_${timestamp.getTime()}`,
      type: dataType,
      value,
      unit,
      timestamp,
      source: deviceSource,
      deviceId: this.extractDeviceId(item, platform),
      metadata: {
        quality: this.assessDataQuality(item, platform),
        confidence: this.calculateConfidence(item, dataType, platform),
        context: `${platform}_normalized`,
        platform,
        originalSource: source || 'unknown',
        validationScore: 1.0, // Will be updated during validation
      },
    };
  }

  /**
   * Extract timestamp from platform-specific data
   */
  private static extractTimestamp(item: any, platform: 'ios' | 'android'): Date {
    let timestamp: Date;

    if (platform === 'ios') {
      timestamp = new Date(item.startDate || item.endDate || item.date);
    } else {
      timestamp = new Date(item.startTime || item.endTime || item.time);
    }

    // Fallback to current time if timestamp is invalid
    if (isNaN(timestamp.getTime())) {
      console.warn('🔧 Invalid timestamp detected, using current time');
      timestamp = new Date();
    }

    return timestamp;
  }

  /**
   * Extract value from platform-specific data structure
   */
  private static extractValue(
    item: any,
    dataType: HealthDataType,
    platform: 'ios' | 'android'
  ): number {
    switch (dataType) {
      case HealthDataType.STEPS:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.count || item.value || 0;
        }

      case HealthDataType.HEART_RATE:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.beatsPerMinute || item.value || 0;
        }

      case HealthDataType.WEIGHT:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.weight ? item.weight.inKilograms : item.value || 0;
        }

      case HealthDataType.SLEEP:
        if (platform === 'ios') {
          const start = new Date(item.startDate).getTime();
          const end = new Date(item.endDate).getTime();
          return Math.round((end - start) / 60000); // minutes
        } else {
          const start = new Date(item.startTime).getTime();
          const end = new Date(item.endTime).getTime();
          return Math.round((end - start) / 60000); // minutes
        }

      case HealthDataType.BLOOD_PRESSURE:
        if (platform === 'ios') {
          return item.bloodPressureSystolicValue || item.value || 0;
        } else {
          return item.systolic || item.value || 0;
        }

      case HealthDataType.OXYGEN_SATURATION:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.percentage || item.value || 0;
        }

      case HealthDataType.BODY_TEMPERATURE:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.temperature ? item.temperature.inCelsius : item.value || 0;
        }

      case HealthDataType.CALORIES_BURNED:
      case HealthDataType.ACTIVE_ENERGY:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.energy ? item.energy.inCalories : item.value || 0;
        }

      case HealthDataType.DISTANCE:
        if (platform === 'ios') {
          return item.value || 0;
        } else {
          return item.distance ? item.distance.inMeters : item.value || 0;
        }

      default:
        return item.value || 0;
    }
  }

  /**
   * Get standard unit for data type
   */
  private static getStandardUnit(dataType: HealthDataType): string {
    const unitMap: Record<HealthDataType, string> = {
      [HealthDataType.STEPS]: 'steps',
      [HealthDataType.HEART_RATE]: 'bpm',
      [HealthDataType.WEIGHT]: 'kg',
      [HealthDataType.SLEEP]: 'minutes',
      [HealthDataType.BLOOD_PRESSURE]: 'mmHg',
      [HealthDataType.OXYGEN_SATURATION]: '%',
      [HealthDataType.BODY_TEMPERATURE]: '°C',
      [HealthDataType.CALORIES_BURNED]: 'kcal',
      [HealthDataType.ACTIVE_ENERGY]: 'kcal',
      [HealthDataType.DISTANCE]: 'meters',
      [HealthDataType.BLOOD_GLUCOSE]: 'mg/dL',
      [HealthDataType.EXERCISE]: 'minutes',
      [HealthDataType.RESTING_HEART_RATE]: 'bpm',
      [HealthDataType.RESPIRATORY_RATE]: 'breaths/min',
    };

    return unitMap[dataType] || 'units';
  }

  /**
   * Determine data source (watch, phone, manual)
   */
  private static determineSource(
    item: any,
    platform: 'ios' | 'android',
    fallback?: string
  ): 'watch' | 'phone' | 'manual' {
    if (platform === 'android') {
      const dataOrigin = item.metadata?.dataOrigin?.packageName || '';
      if (
        dataOrigin.includes('wear') ||
        dataOrigin.includes('watch') ||
        dataOrigin.includes('galaxy')
      ) {
        return 'watch';
      }
      if (dataOrigin.includes('manual') || dataOrigin.includes('user')) {
        return 'manual';
      }
    } else {
      // iOS
      const sourceName = item.sourceName || item.device || '';
      if (sourceName.toLowerCase().includes('watch')) {
        return 'watch';
      }
      if (
        sourceName.toLowerCase().includes('manual') ||
        sourceName.toLowerCase().includes('user')
      ) {
        return 'manual';
      }
    }

    return fallback === 'watch' ? 'watch' : 'phone';
  }

  /**
   * Extract device ID
   */
  private static extractDeviceId(item: any, platform: 'ios' | 'android'): string {
    if (platform === 'ios') {
      return item.device || item.sourceName || 'apple_device';
    } else {
      return item.metadata?.device || item.metadata?.dataOrigin?.packageName || 'android_device';
    }
  }

  /**
   * Assess data quality
   */
  private static assessDataQuality(
    item: any,
    platform: 'ios' | 'android'
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Check if timestamp is reasonable
    const timestamp = this.extractTimestamp(item, platform);
    if (timestamp.getTime() > this.MIN_VALID_TIMESTAMP) score += 25;

    // Check if value is present and reasonable
    if (item.value !== undefined && item.value !== null && !isNaN(item.value)) score += 25;

    // Check if source information is available
    if (platform === 'ios' && (item.device || item.sourceName)) score += 25;
    if (platform === 'android' && item.metadata?.dataOrigin) score += 25;

    // Check platform-specific quality indicators
    if (platform === 'ios' && item.startDate && item.endDate) score += 25;
    if (platform === 'android' && item.startTime && item.endTime) score += 25;

    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence score
   */
  private static calculateConfidence(
    item: any,
    dataType: HealthDataType,
    platform: 'ios' | 'android'
  ): number {
    let confidence = 0.5; // Base confidence

    // High confidence for watch data
    const source = this.determineSource(item, platform);
    if (source === 'watch') confidence += 0.3;
    else if (source === 'phone') confidence += 0.2;

    // Data type specific confidence adjustments
    switch (dataType) {
      case HealthDataType.STEPS:
      case HealthDataType.HEART_RATE:
        confidence += 0.2; // These are typically accurate
        break;
      case HealthDataType.SLEEP:
        confidence += 0.1; // Sleep tracking can be less precise
        break;
      case HealthDataType.WEIGHT:
        confidence += 0.3; // Usually manually entered, high precision
        break;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Validate individual metric
   */
  private static validateMetric(metric: HealthMetric, dataType: HealthDataType): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate timestamp
    if (!metric.timestamp || isNaN(metric.timestamp.getTime())) {
      errors.push('Invalid timestamp');
    } else {
      const now = Date.now();
      const maxFuture = now + this.MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000;

      if (metric.timestamp.getTime() < this.MIN_VALID_TIMESTAMP) {
        errors.push('Timestamp too old (before 2020)');
      } else if (metric.timestamp.getTime() > maxFuture) {
        errors.push('Timestamp too far in future');
      }
    }

    // Validate value ranges
    const valueValidation = this.validateValueRange(metric.value, dataType);
    if (!valueValidation.isValid) {
      if (valueValidation.severity === 'error') {
        errors.push(valueValidation.message);
      } else {
        warnings.push(valueValidation.message);
      }
    }

    // Validate required fields
    if (!metric.id || typeof metric.id !== 'string') {
      errors.push('Missing or invalid ID');
    }

    if (!metric.unit || typeof metric.unit !== 'string') {
      errors.push('Missing or invalid unit');
    }

    if (!metric.source) {
      warnings.push('Missing source information');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate value ranges for specific data types
   */
  private static validateValueRange(
    value: number,
    dataType: HealthDataType
  ): {
    isValid: boolean;
    message: string;
    severity: 'error' | 'warning';
  } {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        message: 'Value must be a valid number',
        severity: 'error',
      };
    }

    switch (dataType) {
      case HealthDataType.STEPS:
        if (value < 0)
          return { isValid: false, message: 'Steps cannot be negative', severity: 'error' };
        if (value > 100000)
          return { isValid: false, message: 'Steps unusually high (>100k)', severity: 'warning' };
        break;

      case HealthDataType.HEART_RATE:
        if (value < 30)
          return { isValid: false, message: 'Heart rate too low (<30 bpm)', severity: 'error' };
        if (value > 250)
          return { isValid: false, message: 'Heart rate too high (>250 bpm)', severity: 'error' };
        break;

      case HealthDataType.WEIGHT:
        if (value <= 0)
          return { isValid: false, message: 'Weight must be positive', severity: 'error' };
        if (value > 500)
          return { isValid: false, message: 'Weight unusually high (>500kg)', severity: 'warning' };
        break;

      case HealthDataType.SLEEP:
        if (value < 0)
          return {
            isValid: false,
            message: 'Sleep duration cannot be negative',
            severity: 'error',
          };
        if (value > 1440)
          return { isValid: false, message: 'Sleep duration > 24 hours', severity: 'warning' };
        break;

      case HealthDataType.BLOOD_PRESSURE:
        if (value < 50)
          return { isValid: false, message: 'Blood pressure too low', severity: 'warning' };
        if (value > 250)
          return { isValid: false, message: 'Blood pressure too high', severity: 'warning' };
        break;

      case HealthDataType.OXYGEN_SATURATION:
        if (value < 0 || value > 100)
          return { isValid: false, message: 'Oxygen saturation must be 0-100%', severity: 'error' };
        if (value < 80)
          return {
            isValid: false,
            message: 'Oxygen saturation critically low',
            severity: 'warning',
          };
        break;

      case HealthDataType.BODY_TEMPERATURE:
        if (value < 30 || value > 45)
          return {
            isValid: false,
            message: 'Body temperature out of viable range',
            severity: 'error',
          };
        break;
    }

    return { isValid: true, message: 'Value is valid', severity: 'error' };
  }

  /**
   * Validate entire dataset for consistency
   */
  private static validateDataset(
    data: HealthMetric[],
    dataType: HealthDataType
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.length === 0) {
      warnings.push('Empty dataset');
      return { errors, warnings };
    }

    // Check for duplicate timestamps
    const timestamps = data.map(d => d.timestamp.getTime());
    const uniqueTimestamps = new Set(timestamps);
    if (uniqueTimestamps.size !== timestamps.length) {
      warnings.push('Duplicate timestamps detected');
    }

    // Check chronological order
    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const isChronological = data.every(
      (item, index) => item.timestamp.getTime() === sortedData[index].timestamp.getTime()
    );

    if (!isChronological) {
      warnings.push('Data not in chronological order');
    }

    // Check for outliers
    const values = data.map(d => d.value);
    const outliers = this.detectOutliers(values);
    if (outliers.length > 0) {
      warnings.push(`${outliers.length} potential outliers detected`);
    }

    return { errors, warnings };
  }

  /**
   * Detect statistical outliers using IQR method
   */
  private static detectOutliers(values: number[]): number[] {
    if (values.length < 4) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.filter(value => value < lowerBound || value > upperBound);
  }

  /**
   * Calculate data integrity score
   */
  static calculateDataIntegrity(data: HealthMetric[]): DataIntegrity {
    if (data.length === 0) {
      return {
        score: 0,
        issues: ['No data available'],
        confidence: 0,
      };
    }

    const issues: string[] = [];
    let score = 1.0;

    // Check completeness
    const missingFields = data.filter(d => !d.id || !d.timestamp || d.value === undefined);
    if (missingFields.length > 0) {
      issues.push(`${missingFields.length} records with missing fields`);
      score -= (missingFields.length / data.length) * 0.3;
    }

    // Check quality distribution
    const qualityScores = data.map(d => {
      switch (d.metadata?.quality) {
        case 'high':
          return 1.0;
        case 'medium':
          return 0.7;
        case 'low':
          return 0.4;
        default:
          return 0.5;
      }
    });

    const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    score *= avgQuality;

    // Check confidence distribution
    const confidenceScores = data.map(d => d.metadata?.confidence || 0.5);
    const avgConfidence = confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length;

    if (avgConfidence < 0.7) {
      issues.push('Low average confidence score');
      score *= 0.9;
    }

    // Check data recency
    const latestTimestamp = Math.max(...data.map(d => d.timestamp.getTime()));
    const hoursOld = (Date.now() - latestTimestamp) / (1000 * 60 * 60);

    if (hoursOld > 24) {
      issues.push('Data is more than 24 hours old');
      score *= 0.95;
    }

    return {
      score: Math.max(score, 0),
      issues,
      confidence: avgConfidence,
    };
  }
}
