import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Generate a standard unified diff between original and modified strings.
 */
export function generateUnifiedDiff(filePath, original, modified, context = 3) {
  const normOld = original.replace(/\r\n/g, '\n');
  const normNew = modified.replace(/\r\n/g, '\n');

  if (normOld === normNew) return null;

  // Split into lines without trailing empty artifact
  const oldHasTrailingNewline = normOld.endsWith('\n');
  const newHasTrailingNewline = normNew.endsWith('\n');

  let oldLines = normOld.split('\n');
  if (oldHasTrailingNewline && oldLines[oldLines.length - 1] === '') {
    oldLines.pop();
  }

  let newLines = normNew.split('\n');
  if (newHasTrailingNewline && newLines[newLines.length - 1] === '') {
    newLines.pop();
  }

  // Prefix matching
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix++;
  }

  // Suffix matching
  let oldSuffix = oldLines.length - 1;
  let newSuffix = newLines.length - 1;
  while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
    oldSuffix--;
    newSuffix--;
  }

  const oldMid = oldLines.slice(prefix, oldSuffix + 1);
  const newMid = newLines.slice(prefix, newSuffix + 1);

  const m = oldMid.length;
  const n = newMid.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldMid[i] === newMid[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const edits = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldMid[i - 1] === newMid[j - 1]) {
      edits.push({ type: ' ', line: oldMid[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ type: '+', line: newMid[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      edits.push({ type: '-', line: oldMid[i - 1] });
      i--;
    }
  }
  edits.reverse();

  // Context lines
  const contextStart = Math.max(0, prefix - context);
  const prefixContext = [];
  for (let k = contextStart; k < prefix; k++) {
    prefixContext.push({ type: ' ', line: oldLines[k] });
  }

  const suffixStart = oldSuffix + 1;
  const suffixEnd = Math.min(oldLines.length, suffixStart + context);
  const suffixContext = [];
  for (let k = suffixStart; k < suffixEnd; k++) {
    suffixContext.push({ type: ' ', line: oldLines[k] });
  }

  const allLines = [...prefixContext, ...edits, ...suffixContext];

  let oldCount = 0;
  let newCount = 0;
  for (const item of allLines) {
    if (item.type === ' ' || item.type === '-') oldCount++;
    if (item.type === ' ' || item.type === '+') newCount++;
  }

  const oldStart = contextStart + 1;
  const newStart = contextStart + 1;

  const rel = filePath.replace(/\\/g, '/');
  const header = `--- a/${rel}\n+++ b/${rel}`;
  const hunkHeader = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
  const body = allLines.map(l => `${l.type}${l.line}`).join('\n');

  return `${header}\n${hunkHeader}\n${body}\n`;
}

/**
 * Scan directory recursively for source files.
 */
function findSourceFiles(dir, fileList = []) {
  const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage'
  ]);
  const SUPPORTED_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          findSourceFiles(join(dir, entry.name), fileList);
        }
      } else if (entry.isFile()) {
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex !== -1) {
          const ext = entry.name.slice(dotIndex);
          if (SUPPORTED_EXTS.has(ext)) {
            fileList.push(join(dir, entry.name));
          }
        }
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
  return fileList;
}

/**
 * Generate a migration patch for a project.
 * Never modifies project source files directly.
 */
export async function generateMigrationPatch(projectDir, options = {}) {
  let dir = projectDir || process.cwd();
  try {
    const st = await stat(dir);
    if (st.isFile()) {
      dir = dirname(dir);
    }
  } catch {
    if (dir.endsWith('package.json') || dir.endsWith('.json')) {
      dir = dirname(dir);
    }
  }
  const pkgJsonPath = join(dir, 'package.json');
  let originalPkgRaw;
  try {
    originalPkgRaw = await readFile(pkgJsonPath, 'utf8');
  } catch (err) {
    throw new Error(`Unable to read package.json in ${projectDir}: ${err.message}`);
  }

  const pkgJson = JSON.parse(originalPkgRaw);
  const declaredDeps = { ...pkgJson.dependencies };
  const declaredDevDeps = { ...pkgJson.devDependencies };

  const removablePackages = new Set();
  const sourceFiles = findSourceFiles(projectDir);
  const diffHunks = [];
  const changedFiles = [];

  // 1. Analyze and transform source files
  for (const file of sourceFiles) {
    const originalContent = await readFile(file, 'utf8');
    let modified = originalContent;

    // Transform uuid
    if ('uuid' in declaredDeps || 'uuid' in declaredDevDeps) {
      // Check if file uses uuid v4
      if (/from\s*['"]uuid['"]/.test(modified) || /require\s*\(\s*['"]uuid['"]\s*\)/.test(modified)) {
        if (!/\bv[135]\b/.test(modified) && !/\b(?:parse|stringify|validate|version)\s*\(/.test(modified)) {
          // Safe v4 replacement
          modified = modified.replace(
            /import\s*\{\s*v4\s*as\s*([\w$]+)\s*\}\s*from\s*['"]uuid['"];?/g,
            "import { randomUUID as $1 } from 'node:crypto';"
          );
          modified = modified.replace(
            /import\s*\{\s*v4\s*\}\s*from\s*['"]uuid['"];?/g,
            "import { randomUUID } from 'node:crypto';"
          );
          // If v4 imported directly without alias, update call site v4() -> randomUUID()
          if (originalContent.includes("import { v4 } from 'uuid'") || originalContent.includes('import { v4 } from "uuid"')) {
            modified = modified.replace(/\bv4\s*\(\s*\)/g, 'randomUUID()');
          }
          removablePackages.add('uuid');
        }
      }
    }

    // Transform rimraf
    if ('rimraf' in declaredDeps || 'rimraf' in declaredDevDeps) {
      if (/from\s*['"]rimraf['"]/.test(modified) || /require\s*\(\s*['"]rimraf['"]\s*\)/.test(modified)) {
        modified = modified.replace(
          /import\s+rimraf\s+from\s*['"]rimraf['"];?/g,
          "import { rmSync } from 'node:fs';"
        );
        modified = modified.replace(
          /\brimraf\.sync\s*\(/g,
          'rmSync('
        );
        removablePackages.add('rimraf');
      }
    }

    // Transform mkdirp
    if ('mkdirp' in declaredDeps || 'mkdirp' in declaredDevDeps) {
      if (/from\s*['"]mkdirp['"]/.test(modified) || /require\s*\(\s*['"]mkdirp['"]\s*\)/.test(modified)) {
        modified = modified.replace(
          /import\s+mkdirp\s+from\s*['"]mkdirp['"];?/g,
          "import { mkdirSync } from 'node:fs';"
        );
        modified = modified.replace(
          /\bmkdirp\.sync\s*\(/g,
          'mkdirSync('
        );
        removablePackages.add('mkdirp');
      }
    }

    // Transform strip-ansi
    if ('strip-ansi' in declaredDeps || 'strip-ansi' in declaredDevDeps) {
      if (/from\s*['"]strip-ansi['"]/.test(modified)) {
        modified = modified.replace(
          /import\s+stripAnsi\s+from\s*['"]strip-ansi['"];?/g,
          "import { stripVTControlCharacters } from 'node:util';"
        );
        modified = modified.replace(
          /\bstripAnsi\s*\(/g,
          'stripVTControlCharacters('
        );
        removablePackages.add('strip-ansi');
      }
    }

    // Transform node-fetch, cross-fetch, isomorphic-fetch
    for (const fetchPkg of ['node-fetch', 'cross-fetch', 'isomorphic-fetch', 'whatwg-fetch']) {
      if (fetchPkg in declaredDeps || fetchPkg in declaredDevDeps) {
        if (modified.includes(`from '${fetchPkg}'`) || modified.includes(`from "${fetchPkg}"`) || modified.includes(`'${fetchPkg}'`)) {
          modified = modified.replace(new RegExp(`import\\s+fetch\\s+from\\s*['"]${fetchPkg}['"];?\\r?\\n?`, 'g'), '');
          modified = modified.replace(new RegExp(`import\\s*['"]${fetchPkg}['"];?\\r?\\n?`, 'g'), '');
          removablePackages.add(fetchPkg);
        }
      }
    }

    if (modified !== originalContent) {
      const relPath = relative(projectDir, file);
      const diff = generateUnifiedDiff(relPath, originalContent, modified);
      if (diff) {
        diffHunks.push(diff);
        changedFiles.push(relPath);
      }
    }
  }

  // 2. Remove migrated packages from package.json
  if (removablePackages.size > 0) {
    const updatedPkg = JSON.parse(originalPkgRaw);
    let pkgChanged = false;

    if (updatedPkg.dependencies) {
      for (const pkg of removablePackages) {
        if (pkg in updatedPkg.dependencies) {
          delete updatedPkg.dependencies[pkg];
          pkgChanged = true;
        }
      }
    }

    if (updatedPkg.devDependencies) {
      for (const pkg of removablePackages) {
        if (pkg in updatedPkg.devDependencies) {
          delete updatedPkg.devDependencies[pkg];
          pkgChanged = true;
        }
      }
    }

    if (pkgChanged) {
      const modifiedPkgRaw = JSON.stringify(updatedPkg, null, 2) + '\n';
      const pkgDiff = generateUnifiedDiff('package.json', originalPkgRaw, modifiedPkgRaw);
      if (pkgDiff) {
        diffHunks.unshift(pkgDiff); // package.json first
        changedFiles.unshift('package.json');
      }
    }
  }

  const patchContent = diffHunks.join('');
  const patchFileName = options.outputFileName || 'depshred-migration.patch';
  let patchPath;
  if (isAbsolute(patchFileName)) {
    patchPath = patchFileName;
  } else if (patchFileName.includes('/') || patchFileName.includes('\\')) {
    patchPath = resolve(process.cwd(), patchFileName);
  } else {
    patchPath = resolve(projectDir, patchFileName);
  }

  if (patchContent) {
    await writeFile(patchPath, patchContent, 'utf8');
  }

  return {
    patchPath: patchContent ? patchPath : null,
    patchContent,
    changedFiles,
    removedPackages: [...removablePackages]
  };
}
