import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.agents',
  'skills',
  '.cursor',
  '.github',
  '.windsurf'
]);

/**
 * Normalizes an import specifier to its root npm package name.
 * e.g. "lodash/map" -> "lodash", "@scoped/pkg/deep" -> "@scoped/pkg"
 */
export function normalizePackageName(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) {
    return null; // Local file or subpath import
  }

  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

/**
 * Regex patterns to extract imported package names from JavaScript / TypeScript code.
 */
const IMPORT_PATTERNS = [
  // ES Modules: import ... from 'pkg' or import 'pkg'
  /\bimport\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  // CommonJS: require('pkg')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic import: import('pkg')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Export from: export ... from 'pkg'
  /\bexport\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]/g
];

/**
 * Recursively find all source code files in a directory.
 */
async function getSourceFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await walk(join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(join(currentDir, entry.name));
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Scan project source files to locate package imports and detect unused dependencies.
 *
 * @param {string} rootDir - Root directory of the project
 * @param {string[]} declaredDependencies - List of package names from package.json
 * @returns {Promise<{ importsMap: Map<string, Array<{file: string, line: number, snippet: string}>>, unusedPackages: string[], scannedFilesCount: number }>}
 */
export async function locateImports(rootDir, declaredDependencies = [], scripts = {}) {
  const sourceFiles = await getSourceFiles(rootDir);
  const importsMap = new Map();
  const importedSet = new Set();

  // Scan package.json scripts for CLI tool references (e.g. nodemon, rimraf)
  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    if (typeof scriptCmd !== 'string') continue;
    for (const pkg of declaredDependencies) {
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|&&|;|\\|)${escaped}(\\s|$|;)`);
      if (regex.test(scriptCmd)) {
        importedSet.add(pkg);
        if (!importsMap.has(pkg)) {
          importsMap.set(pkg, []);
        }
        importsMap.get(pkg).push({
          file: 'package.json',
          line: 1,
          snippet: `scripts.${scriptName}: "${scriptCmd.slice(0, 80)}"`
        });
      }
    }
  }

  for (const filePath of sourceFiles) {
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const relPath = relative(rootDir, filePath).replace(/\\/g, '/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip empty or comment-only lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      for (const pattern of IMPORT_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const rawSpecifier = match[1];
          const pkg = normalizePackageName(rawSpecifier);
          if (pkg) {
            importedSet.add(pkg);
            if (!importsMap.has(pkg)) {
              importsMap.set(pkg, []);
            }
            importsMap.get(pkg).push({
              file: relPath,
              line: i + 1,
              snippet: trimmed.slice(0, 100)
            });
          }
        }
      }
    }
  }

  // Detect unused packages: declared in package.json but never imported in source code
  const unusedPackages = declaredDependencies.filter((pkg) => !importedSet.has(pkg));

  return {
    importsMap,
    unusedPackages,
    scannedFilesCount: sourceFiles.length
  };
}
