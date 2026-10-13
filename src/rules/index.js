import { NATIVE_RULES } from './native-rules.js';
import { ALT_RULES } from './alt-rules.js';

/**
 * Compare two semantic version strings (e.g. "20.6.0" vs "18.11.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1, v2) {
  const clean1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const clean2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Look up a native Node stdlib rule for a given package and target Node version.
 */
export function getNativeRule(packageName, targetNodeVersion = process.version) {
  const rule = NATIVE_RULES.find((r) => r.name === packageName);
  if (!rule) return null;

  // Verify if target Node version satisfies minimum required version
  const isSupported = compareVersions(targetNodeVersion, rule.minNode) >= 0;
  return { ...rule, isSupported };
}

/**
 * Look up a modern lightweight alternative rule for a package.
 */
export function getAltRule(packageName) {
  return ALT_RULES.find((r) => r.name === packageName) || null;
}
