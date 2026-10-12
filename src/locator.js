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
/**
 * Strips single-line and multi-line comments from JavaScript/TypeScript/Vue/Svelte code.
 * Preserves newlines in multi-line comments so calculated line numbers remain exact.
 */
export function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (match) => {
      const newlines = match.match(/\n/g);
      return newlines ? newlines.join('') : ' ';
    })
    .replace(/\/\/[^\r\n]*/g, '');
}

/**
 * Extracts script content from .vue and .svelte single-file components.
 * Template markup and <style lang="scss"> are out of scope and excluded.
 */
export function extractScriptContent(fileContent, ext) {
  if (ext !== '.vue' && ext !== '.svelte') {
    return fileContent;
  }
  const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let combined = '';
  let match;
  while ((match = scriptRegex.exec(fileContent)) !== null) {
    combined += match[1] + '\n';
  }
  return combined;
}

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
  // ESM import: import ... from 'pkg' or import 'pkg' (handles multi-line, import type, destructuring)
  /\bimport\s+(?:[\w*\s{},$:*]+\s+from\s+)?['"]([^'"]+)['"]/g,
  // ESM export from: export ... from 'pkg' (handles export type { X } from 'pkg')
  /\bexport\s+(?:[\w*\s{},$:*]+\s+from\s+)?['"]([^'"]+)['"]/g,
  // CommonJS: require('pkg')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic import or type import: import('pkg')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
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

  // Rule 3: Bundler, linter, and build configuration plugins
  for (const pkg of declaredDependencies) {
    if (
      pkg.startsWith('@vitejs/plugin-') ||
      pkg.startsWith('vite-plugin-') ||
      pkg.startsWith('@rollup/plugin-') ||
      pkg.startsWith('rollup-plugin-') ||
      pkg.startsWith('@rolldown/plugin-') ||
      pkg.endsWith('-webpack-plugin') ||
      pkg.startsWith('eslint-config-') ||
      pkg.startsWith('eslint-plugin-') ||
      pkg.startsWith('@eslint/') ||
      pkg.startsWith('prettier-plugin-')
    ) {
      importedSet.add(pkg);
      if (!importsMap.has(pkg)) importsMap.set(pkg, []);
      importsMap.get(pkg).push({
        file: 'package.json',
        line: 1,
        snippet: 'Bundler or linter build plugin'
      });
    }
  }

  // Rule 4: Compiler engines and toolchain infrastructure
  // Babel toolchain detection: @babel/core, plugins, presets, react-compiler
  const hasBabelTool = declaredDependencies.some((p) =>
    p.includes('babel') || p === '@vitejs/plugin-react' || p.includes('react-compiler')
  );
  if (hasBabelTool) {
    for (const pkg of declaredDependencies) {
      if (
        pkg === '@babel/core' ||
        pkg === '@babel/runtime' ||
        pkg.startsWith('babel-plugin-') ||
        pkg.startsWith('@babel/plugin-') ||
        pkg.startsWith('babel-preset-') ||
        pkg.startsWith('@babel/preset-') ||
        pkg.includes('plugin-babel')
      ) {
        importedSet.add(pkg);
        if (!importsMap.has(pkg)) importsMap.set(pkg, []);
        importsMap.get(pkg).push({
          file: 'package.json',
          line: 1,
          snippet: 'Babel compiler infrastructure / plugin'
        });
      }
    }
  }

  // PostCSS toolchain detection: postcss, autoprefixer, tailwindcss
  const hasPostcssTool = declaredDependencies.some((p) =>
    p.includes('postcss') || p === 'tailwindcss' || p === 'autoprefixer'
  );
  if (hasPostcssTool) {
    for (const pkg of declaredDependencies) {
      if (pkg === 'postcss' || pkg.startsWith('postcss-')) {
        importedSet.add(pkg);
        if (!importsMap.has(pkg)) importsMap.set(pkg, []);
        importsMap.get(pkg).push({
          file: 'package.json',
          line: 1,
          snippet: 'PostCSS compiler infrastructure / plugin'
        });
      }
    }
  }

  // Rule 5: Scan root configuration files for package names and plugin/preset references
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

      // Shorthand matches for common config tools
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

  // Rule 6: Scan package.json scripts for CLI tool references (e.g. nodemon, rimraf, tsc, prettier)
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

  // Rule 7: Multi-line, comment-safe scan of source files for import / require / export from
  for (const filePath of sourceFiles) {
    let rawContent;
    try {
      rawContent = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const ext = extname(filePath).toLowerCase();
    const scriptContent = extractScriptContent(rawContent, ext);
    const cleanedCode = stripComments(scriptContent);
    const relPath = relative(rootDir, filePath).replace(/\\/g, '/');

    const rawLines = rawContent.split(/\r?\n/);
    const lineOffsets = [0];
    for (let i = 0; i < rawContent.length; i++) {
      if (rawContent[i] === '\n') {
        lineOffsets.push(i + 1);
      }
    }

    function getLineNumber(charIndex) {
      let low = 0, high = lineOffsets.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineOffsets[mid] <= charIndex) {
          if (mid === lineOffsets.length - 1 || lineOffsets[mid + 1] > charIndex) {
            return mid + 1;
          }
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return 1;
    }

    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(cleanedCode)) !== null) {
        const rawSpecifier = match[1];
        const pkg = normalizePackageName(rawSpecifier);
        if (pkg) {
          importedSet.add(pkg);
          if (!importsMap.has(pkg)) {
            importsMap.set(pkg, []);
          }
          const lineNum = getLineNumber(match.index);
          const snippet = rawLines[lineNum - 1] ? rawLines[lineNum - 1].trim() : match[0].trim();
          importsMap.get(pkg).push({
            file: relPath,
            line: lineNum,
            snippet: snippet.slice(0, 100)
          });
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