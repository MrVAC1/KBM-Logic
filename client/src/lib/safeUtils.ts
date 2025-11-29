/**
 * Safe Utility Functions
 * 
 * These functions prevent runtime crashes by ensuring safe data access
 * and always returning valid types (arrays, objects, etc.)
 */

/**
 * Always returns an array, even if input is null/undefined
 * Prevents .map(), .filter(), .forEach() crashes
 */
export function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data === null || data === undefined) {
    return [];
  }
  // If it's an object with a data property that's an array
  if (typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
    return (data as any).data;
  }
  // If it's an object with a results property that's an array
  if (typeof data === 'object' && 'results' in data && Array.isArray((data as any).results)) {
    return (data as any).results;
  }
  // Last resort: return empty array
  return [];
}

/**
 * Safely extracts array from API response
 * Handles: { data: [...] }, { success: true, data: [...] }, or direct array
 */
export function extractArrayFromResponse<T>(response: unknown): T[] {
  if (!response) return [];
  
  // Direct array
  if (Array.isArray(response)) {
    return response;
  }
  
  // Axios response structure: { data: { success: true, data: [...] } }
  if (typeof response === 'object' && response !== null) {
    const resp = response as any;
    
    // Case 1: response.data is an array
    if (Array.isArray(resp.data)) {
      return resp.data;
    }
    
    // Case 2: response.data.data is an array (standard backend format)
    if (resp.data && Array.isArray(resp.data.data)) {
      return resp.data.data;
    }
    
    // Case 3: response.data.projects/results/etc is an array
    if (resp.data && typeof resp.data === 'object') {
      for (const key of ['projects', 'results', 'items', 'list']) {
        if (Array.isArray(resp.data[key])) {
          return resp.data[key];
        }
      }
    }
  }
  
  return [];
}

/**
 * Safely gets a property from an object, with fallback
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  const keys = path.split('.');
  let current: any = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined && current !== null ? current : defaultValue;
}

/**
 * Safely checks if a value is an array and has items
 */
export function hasItems(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}

/**
 * Safely maps over an array, returns empty array if input is invalid
 */
export function safeMap<T, R>(
  data: unknown,
  mapper: (item: T, index: number) => R
): R[] {
  const array = safeArray<T>(data);
  return array.map(mapper);
}

/**
 * Safely filters an array, returns empty array if input is invalid
 */
export function safeFilter<T>(
  data: unknown,
  predicate: (item: T) => boolean
): T[] {
  const array = safeArray<T>(data);
  return array.filter(predicate);
}

/**
 * Safely finds an item in an array, returns null if not found or invalid input
 */
export function safeFind<T>(
  data: unknown,
  predicate: (item: T) => boolean
): T | null {
  const array = safeArray<T>(data);
  return array.find(predicate) || null;
}

/**
 * Safely gets array length, returns 0 if invalid
 */
export function safeLength(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  return 0;
}

/**
 * Type guard to check if value is a valid object (not null/undefined)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely accesses nested object property
 */
export function safeAccess<T>(obj: unknown, ...keys: string[]): T | undefined {
  if (!isObject(obj)) {
    return undefined;
  }
  
  let current: any = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current as T;
}

