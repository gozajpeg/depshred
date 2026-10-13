import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { locateImports } from './locator.js';
import { batchFetchMetadata } from './registry.js';
import { getNativeRule, getAltRule } from './rules/index.js';

/**
 * Format bytes into human-readable string (e.g. 1024 -> "1.0 KB", 1048576 -> "1.0 MB")
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i] || 'B'}`;
}

/**
 * Audit dependencies of a target project.
 *
 * @param {object} options
 * @param {string} options.path - Target project directory
 * @param {number} options.dormantYears - Threshold for dormancy warnings (default: 3)
 * @param {string[]} options.ignore - Array of package names to ignore
 * @param {boolean} options.strict - Strict mode flag
 * @returns {Promise<object>} Comprehensive audit result
 */
/**
 * Parse an upstream Knip JSON report.
 */
async function loadKnipFindings(knipPath) {
  if (!knipPath) return new Set();
  try {
    const raw = await readFile(knipPath, 'utf8');
    const data = JSON.parse(raw);
    const knipPkgs = new Set();
    if (Array.isArray(data.dependencies)) {
      for (const item of data.dependencies) {
        if (typeof item === 'string') knipPkgs.add(item);
        else if (item && item.name) knipPkgs.add(item.name);
      }
    }
    if (Array.isArray(data.devDependencies)) {
      for (const item of data.devDependencies) {
        if (typeof item === 'string') knipPkgs.add(item);
        else if (item && item.name) knipPkgs.add(item.name);
      }
    }
    if (Array.isArray(data.issues)) {
      for (const issue of data.issues) {
        if (issue && (issue.type === 'dependencies' || issue.type === 'devDependencies') && issue.name) {
          knipPkgs.add(issue.name);
        }
      }
    }
    return knipPkgs;
  } catch (err) {
    console.error(`Warning: Could not read Knip report from ${knipPath}: ${err.message}`);
    return new Set();
  }
}

export async function auditProject(options = {}) {
  let projectDir = options.path || process.cwd();
  try {
    const st = await stat(projectDir);
    if (st.isFile()) {
      projectDir = dirname(projectDir);
    }
  } catch {
    if (projectDir.endsWith('package.json') || projectDir.endsWith('.json')) {
      projectDir = dirname(projectDir);
    }
  }
  const pkgJsonPath = join(projectDir, 'package.json');

  let pkgJson;
  try {
    const raw = await readFile(pkgJsonPath, 'utf8');
    const cleanRaw = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    pkgJson = JSON.parse(cleanRaw);
  } catch (err) {
    throw new Error(`Unable to read package.json in ${projectDir}: ${err.message}`);
  }

  const prodDeps = Object.keys(pkgJson.dependencies || {});
  const devDeps = Object.keys(pkgJson.devDependencies || {});
  const allDeps = [...new Set([...prodDeps, ...devDeps])];

  // Merge configuration from package.json ("depshred")
  const config = pkgJson.depshred || {};
  const dormantThreshold = Number(options.dormantYears || config.dormantYears || 3);
  const ignoreSet = new Set([...(options.ignore || []), ...(config.ignore || [])]);

  // Determine target Node version from engines.node or fallback to process.version
  const targetNode = (pkgJson.engines && pkgJson.engines.node)
    ? pkgJson.engines.node.replace(/[^0-9.]/g, '') || process.version
    : process.version;

  // Step 1: Scan imports and identify unused packages
  const { importsMap, unusedPackages, scannedFilesCount } = await locateImports(projectDir, allDeps, pkgJson.scripts || {});
  const unusedSet = new Set(unusedPackages);

  // Step 1b: Load upstream Knip findings if provided
  const knipSet = await loadKnipFindings(options.fromKnip);

  // Step 2: Fetch registry metrics for all dependencies
  const registryMetadata = await batchFetchMetadata(allDeps);

  // Step 3: Classify each package
  const results = [];
  let totalSaveableBytes = 0;
  let criticalCount = 0;
  let unusedCount = 0;
  let warnCount = 0;
  let okCount = 0;

  for (const pkg of allDeps) {
    const isDev = devDeps.includes(pkg) && !prodDeps.includes(pkg);
    const meta = registryMetadata.get(pkg) || {
      unpackedSize: 0,
      dependenciesCount: 0,
      deprecated: null,
      yearsDormant: 0,
      isOffline: false
    };

    const imports = importsMap.get(pkg) || [];
    const nativeRule = getNativeRule(pkg, targetNode);
    const altRule = getAltRule(pkg);

    // If ignored by user configuration
    if (ignoreSet.has(pkg)) {
      results.push({
        name: pkg,
        tier: 'OK',
        status: 'IGNORED',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        details: 'Allowlisted via ignore configuration',
        imports
      });
      okCount++;
      continue;
    }

    // 1. Unused: 0 imports in source code or reported by upstream Knip
    if (unusedSet.has(pkg) || knipSet.has(pkg)) {
      unusedCount++;
      totalSaveableBytes += meta.unpackedSize;
      const isKnip = knipSet.has(pkg);
      const detailsMsg = isKnip
        ? `[Knip Upstream Finding] Unused dependency reported by Knip (run: npm uninstall ${pkg})`
        : `0 imports detected in project (run: npm uninstall ${pkg})`;
      results.push({
        name: pkg,
        tier: 'UNUSED',
        status: isKnip ? 'KNIP_UNUSED' : 'UNUSED',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        details: detailsMsg,
        action: `npm uninstall ${pkg}`,
        imports: []
      });
      continue;
    }

    // 2. Critical: Native Node.js built-in available in code
    if (nativeRule && nativeRule.isSupported) {
      criticalCount++;
      totalSaveableBytes += meta.unpackedSize;
      results.push({
        name: pkg,
        tier: 'CRITICAL',
        status: 'NATIVE',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        details: nativeRule.description,
        diff: nativeRule.diff,
        rule: nativeRule,
        imports
      });
      continue;
    }

    // 3. Deprecated on npm
    if (meta.deprecated) {
      warnCount++;
      results.push({
        name: pkg,
        tier: 'DEPRECATED',
        status: 'DEPRECATED',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        details: `Deprecated: ${meta.deprecated}`,
        imports
      });
      continue;
    }

    // 4. Advisory Warning: Dormant (> dormantThreshold years)
    if (meta.yearsDormant >= dormantThreshold) {
      warnCount++;
      const selfContained = meta.dependenciesCount === 0;
      const desc = selfContained
        ? `Dormant >${meta.yearsDormant}y (0 sub-deps, self-contained)`
        : `Dormant >${meta.yearsDormant}y (${meta.dependenciesCount} sub-dependencies)`;

      results.push({
        name: pkg,
        tier: 'WARN',
        status: 'DORMANT',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        yearsDormant: meta.yearsDormant,
        selfContained,
        details: desc,
        imports
      });
      continue;
    }

    // 5. Heavy or has lighter alternative
    if (altRule || meta.unpackedSize > 5 * 1024 * 1024) {
      warnCount++;
      const desc = altRule ? altRule.description : `Heavy unpacked size (${formatBytes(meta.unpackedSize)})`;
      results.push({
        name: pkg,
        tier: 'WARN',
        status: 'HEAVY',
        isDev,
        size: meta.unpackedSize,
        dependenciesCount: meta.dependenciesCount,
        altRule,
        details: desc,
        imports
      });
      continue;
    }

    // 6. Healthy / Lean
    okCount++;
    results.push({
      name: pkg,
      tier: 'OK',
      status: 'OK',
      isDev,
      size: meta.unpackedSize,
      dependenciesCount: meta.dependenciesCount,
      details: 'Actively maintained and lean',
      imports
    });
  }

  return {
    projectName: pkgJson.name || 'project',
    projectDir,
    targetNode,
    totalDependencies: allDeps.length,
    scannedFilesCount,
    totalSaveableBytes,
    summary: {
      critical: criticalCount,
      unused: unusedCount,
      warn: warnCount,
      ok: okCount
    },
    results
  };
}