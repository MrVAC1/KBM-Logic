/**
 * Safe Utility Functions
 * 
 * Auto-fix utilities for common defensive coding patterns.
 * Use these functions to prevent crashes from null/undefined values.
 */

/**
 * Safely access array methods without crashing
 */
export const safeArray = {
  /**
   * Safely filter an array
   * @param array - The array to filter (can be null/undefined)
   * @param predicate - Filter function
   * @returns Filtered array or empty array
   */
  filter: <T>(array: T[] | null | undefined, predicate: (item: T) => boolean): T[] => {
    return Array.isArray(array) ? array.filter(predicate) : [];
  },

  /**
   * Safely map over an array
   * @param array - The array to map (can be null/undefined)
   * @param mapper - Map function
   * @returns Mapped array or empty array
   */
  map: <T, R>(array: T[] | null | undefined, mapper: (item: T, index: number) => R): R[] => {
    return Array.isArray(array) ? array.map(mapper) : [];
  },

  /**
   * Safely find an item in an array
   * @param array - The array to search (can be null/undefined)
   * @param predicate - Find predicate
   * @returns Found item or undefined
   */
  find: <T>(array: T[] | null | undefined, predicate: (item: T) => boolean): T | undefined => {
    return Array.isArray(array) ? array.find(predicate) : undefined;
  },

  /**
   * Safely reduce an array
   * @param array - The array to reduce (can be null/undefined)
   * @param reducer - Reduce function
   * @param initialValue - Initial value
   * @returns Reduced value or initial value
   */
  reduce: <T, R>(
    array: T[] | null | undefined,
    reducer: (acc: R, item: T, index: number) => R,
    initialValue: R
  ): R => {
    return Array.isArray(array) ? array.reduce(reducer, initialValue) : initialValue;
  },

  /**
   * Safely check if array includes a value
   * @param array - The array to check (can be null/undefined)
   * @param value - Value to check for
   * @returns true if includes, false otherwise
   */
  includes: <T>(array: T[] | null | undefined, value: T): boolean => {
    return Array.isArray(array) ? array.includes(value) : false;
  },

  /**
   * Safely get array length
   * @param array - The array (can be null/undefined)
   * @returns Array length or 0
   */
  length: <T>(array: T[] | null | undefined): number => {
    return Array.isArray(array) ? array.length : 0;
  },

  /**
   * Ensure value is an array
   * @param value - Value to ensure is array
   * @param defaultValue - Default value if not array
   * @returns Array or default value
   */
  ensure: <T>(value: T[] | null | undefined, defaultValue: T[] = []): T[] => {
    return Array.isArray(value) ? value : defaultValue;
  },
};

/**
 * Safely access object properties
 */
export const safeObject = {
  /**
   * Safely get nested property
   * @param obj - Object to access
   * @param path - Property path (e.g., 'user.profile.name')
   * @param defaultValue - Default value if path doesn't exist
   * @returns Property value or default
   */
  get: <T>(obj: any, path: string, defaultValue: T): T => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }
    return current !== undefined ? current : defaultValue;
  },

  /**
   * Safely check if property exists
   * @param obj - Object to check
   * @param path - Property path
   * @returns true if property exists
   */
  has: (obj: any, path: string): boolean => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return false;
      }
      current = current[key];
    }
    return current !== undefined;
  },
};

/**
 * Safely execute async operations
 */
export const safeAsync = {
  /**
   * Safely execute async function with error handling
   * @param fn - Async function to execute
   * @param onError - Error handler
   * @returns Result or null on error
   */
  execute: async <T>(
    fn: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      } else {
        console.error('Safe async execution failed:', err);
      }
      return null;
    }
  },

  /**
   * Safely execute async function with default value
   * @param fn - Async function to execute
   * @param defaultValue - Default value on error
   * @returns Result or default value
   */
  executeWithDefault: async <T>(
    fn: () => Promise<T>,
    defaultValue: T
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      console.error('Safe async execution failed:', error);
      return defaultValue;
    }
  },
};

/**
 * React-specific safe utilities
 */
export const safeReact = {
  /**
   * Safely get state value or default
   * @param state - State value (can be null/undefined)
   * @param defaultValue - Default value
   * @returns State value or default
   */
  state: <T>(state: T | null | undefined, defaultValue: T): T => {
    return state ?? defaultValue;
  },

  /**
   * Safely get array state or empty array
   * @param state - Array state (can be null/undefined)
   * @returns Array state or empty array
   */
  arrayState: <T>(state: T[] | null | undefined): T[] => {
    return Array.isArray(state) ? state : [];
  },
};

/**
 * Type guard: Check if value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard: Check if value is not null/undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard: Check if value is a valid object
 */
export function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}


