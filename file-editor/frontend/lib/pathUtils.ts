/**
 * Utilities for handling JSON paths that may contain dots in keys.
 * Uses backslash escaping (e.g., "ca\.crt") to differentiate between 
 * path levels and literal dots in key names.
 */

/**
 * Escapes literal dots in a single key name with a backslash.
 * Only use this on individual keys, not on full paths.
 */
export function escapeKey(key: string): string {
    if (!key) return '';
    return key.replace(/(?<!\\)\./g, '\\.');
}

/**
 * Joins path segments using a dot separator.
 * It assumes the segments have already been escaped if they contain literal dots.
 */
export function joinPaths(...parts: string[]): string {
    return parts.filter(Boolean).join('.');
}


/**
 * Unescapes a path for display purposes (removes backslashes before dots)
 */
export function unescapePath(path: string): string {
    if (!path) return '';
    return path.replace(/\\\./g, '.');
}

/**
 * Splits a path string by dots, respecting backslash escaping.
 */
export function splitPath(path: string): string[] {
    if (!path) return [];

    // Split by dot NOT preceded by backslash
    const regex = /(?<!\\)\./;
    return path.split(regex).map(part => part.replace(/\\\./g, '.'));
}
