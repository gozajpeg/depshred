import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte']);
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

const CONFIG_FILE_PATTERNS = [
  /^\.babelrc(\.json|\.js|\.cjs|\.mjs)?$/,
  /^babel\.config(\.json|\.js|\.cjs|\.mjs)?$/,
  /^\.eslintrc(\.json|\.js|\.cjs|\.yaml|\.yml)?$/,
  /^eslint\.config(\.js|\.mjs|\.cjs)?$/,
  /^\.prettierrc(\.json|\.js|\.cjs|\.yaml|\.yml)?$/,
  /^prettier\.config(\.js|\.mjs|\.cjs)?$/,
  /^tsconfig(\..+)?\.json$/,
  /^jsconfig(\..+)?\.json$/,
  /^postcss\.config(\.js|\.cjs|\.mjs|\.json)?$/,
  /^tailwind\.config(\.js|\.cjs|\.mjs|\.ts)?$/,
  /^vite\.config(\.js|\.ts|\.mjs)?$/,
  /^webpack\.config(\.js|\.cjs|\.mjs|\.ts)?$/,
  /^rollup\.config(\.js|\.mjs)?$/,
  /^next\.config(\.js|\.mjs|\.ts)?$/,
  /^jest\.config(\.js|\.ts|\.json)?$/,
  /^vitest\.config(\.js|\.ts)?$/
];

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
 * Find root-level config files in a directory.
 */
async function getRootConfigFiles(dir) {
  const configFiles = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return configFiles;
  }

  for (const entry of entries) {
    if (entry.isFile()) {
      const name = entry.name.toLowerCase();
      if (CONFIG_FILE_PATTERNS.some((pat) => pat.test(name))) {
        configFiles.push(entry.name);
      }
    }
  }
  return configFiles;
}

/**
 * Scan project source files and config files to locate package imports and detect unused dependencies.
 *
 * @param {string} rootDir - Root directory of the project
 * @param {string[]} declaredDependencies - List of package names from package.json
 * @param {object} scripts - package.json scripts object
 * @returns {Promise<{ importsMap: Map<string, Array<{file: string, line: number, snippet: string}>>, unusedPackages: string[], scannedFilesCount: number }>}
 */
export async function locateImports(rootDir, declaredDependencies = [], scripts = {}) {
  const sourceFiles = await getSourceFiles(rootDir);
  const importsMap = new Map();
  const importedSet = new Set();

  // Rule 1: Always ignore depshred itself (never flag depshred as unused within a project)
  if (declaredDependencies.includes('depshred')) {
    importedSet.add('depshred');
    importsMap.set('depshred', [{
      file: 'package.json',
      line: 1,
      snippet: 'depshred CLI dependency auditor'
    }]);
  }

  // Rule 2: Ambient TypeScript definitions (@types/*) are used by compiler, never imported in source code
  for (const pkg of declaredDependencies) {
    if (pkg.startsWith('@types/')) {
      importedSet.add(pkg);
      if (!importsMap.has(pkg)) importsMap.set(pkg, []);
      importsMap.get(pkg).push({
        file: 'tsconfig.json',
        line: 1,
        snippet: 'TypeScript ambient type definition'
      });
    }
  }

  // Rule 3: Scan root configuration files for package names and plugin/preset references
  const rootConfigFiles = await getRootConfigFiles(rootDir);
  for (const configName of rootConfigFiles) {
    let content;
    try {
      content = await readFile(join(rootDir, configName), 'utf8');
    } catch {
      continue;
    }

    for (const pkg of declaredDependencies) {
      if (importedSet.has(pkg)) continue;

      // Exact package match (quoted or word boundary)
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const directRegex = new RegExp(`['"]${escaped}['"]|\\b${escaped}\\b`);

      // Shorthand matches for common config tools (e.g. "react" for "eslint-plugin-react" or "react-app" for "eslint-config-react-app")
      let shorthandMatch = false;
      if (configName.includes('eslint')) {
        const eslintPlugin = pkg.replace(/^eslint-plugin-/, '');
        const eslintConfig = pkg.replace(/^eslint-config-/, '');
        if (eslintPlugin !== pkg && new RegExp(`['"]${eslintPlugin}['"]`).test(content)) shorthandMatch = true;
        if (eslintConfig !== pkg && new RegExp(`['"]${eslintConfig}['"]`).test(content)) shorthandMatch = true;
      } else if (configName.includes('babel')) {
        const babelPreset = pkg.replace(/^(@babel\/preset-|babel-preset-)/, '');
        const babelPlugin = pkg.replace(/^(@babel\/plugin-|babel-plugin-)/, '');
        if (babelPreset !== pkg && new RegExp(`['"]${babelPreset}['"]`).test(content)) shorthandMatch = true;
        if (babelPlugin !== pkg && new RegExp(`['"]${babelPlugin}['"]`).test(content)) shorthandMatch = true;
      }

      if (directRegex.test(content) || shorthandMatch) {
        importedSet.add(pkg);
        if (!importsMap.has(pkg)) importsMap.set(pkg, []);
        importsMap.get(pkg).push({
          file: configName,
          line: 1,
          snippet: `Config reference in ${configName}`
        });
      }
    }
  }

  // Rule 4: Scan package.json scripts for CLI tool references (e.g. nodemon, rimraf, tsc, prettier)
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

  // Rule 5: Scan project source files for import / require / export from
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

  // Detect unused packages: declared in package.json but never referenced anywhere
  const unusedPackages = declaredDependencies.filter((pkg) => !importedSet.has(pkg));

  return {
    importsMap,
    unusedPackages,
    scannedFilesCount: sourceFiles.length
  };
}