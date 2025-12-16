/**
 * UUID Validation Utility
 * 
 * Provides consistent UUID validation across the application
 * to prevent 400 Bad Request errors from invalid UUID formats.
 */

/**
 * Validates if a string is a valid UUID v4 format
 * @param uuid - The string to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUUIDv4(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates UUID and throws descriptive error if invalid
 * @param uuid - The string to validate
 * @param fieldName - The field name for error message
 * @throws Error if UUID is invalid
 */
export function validateUUID(uuid: string, fieldName: string = 'UUID'): void {
  if (!uuid) {
    throw new Error(`${fieldName} is missing or empty`);
  }
  
  if (!isValidUUIDv4(uuid)) {
    throw new Error(`Invalid ${fieldName} format: "${uuid}". Expected valid UUID v4 format (e.g., 550e8400-e29b-41d4-a716-446655440000)`);
  }
}

/**
 * Safely validates UUID and returns boolean result
 * @param uuid - The string to validate
 * @param fieldName - The field name for logging
 * @returns true if valid, false otherwise (logs error)
 */
export function safeValidateUUID(uuid: string, fieldName: string = 'UUID'): boolean {
  try {
    validateUUID(uuid, fieldName);
    return true;
  } catch (error) {
    console.error(`❌ ${fieldName} validation failed:`, error.message);
    return false;
  }
}
