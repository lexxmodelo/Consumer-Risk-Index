
/**
 * Safely ensures validation of array data
 * @param data The data to check
 * @returns The data if it is an array, otherwise an empty array
 */
export const safeArray = <T>(data: any): T[] => {
  return Array.isArray(data) ? data : [];
};

/**
 * Validates that a required property exists in an object
 * @param obj The object to check
 * @param key The key to check for
 * @returns True if the key exists and is not null/undefined
 */
export const hasProperty = (obj: any, key: string): boolean => {
  return obj && typeof obj === 'object' && obj[key] !== null && obj[key] !== undefined;
};
