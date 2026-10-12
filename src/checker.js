import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { locateImports, stripComments, extractScriptContent } from './locator.js';
import { getNativeRule } from './rules/index.js';
import pc from './colors.js';

export const VERDICTS = {
  SAFE: 'safe',
  NOT_A_DROP_IN: 'not a drop-in',
  CANT_DETERMINE: "can't determine"
};

export const EXIT_CODES = {
  [VERDICTS.SAFE]: 0,
  [VERDICTS.CANT_DETERMINE]: 1,
  [VERDICTS.NOT_A_DROP_IN]: 2
};

export async function checkPackageUsage(projectDir, packageName) {
  const pkgJsonPath = join(projectDir, 'package.json');
  let pkgJson;
  try {
    const raw = await readFile(pkgJsonPath, 'utf8');
    pkgJson = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Unable to read package.json in ${projectDir}: ${err.message}`);
  }

  const allDeclared = [
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {})
  ];

  if (!allDeclared.includes(packageName)) {
    return {
      package: packageName,
      isDeclared: false,
      verdict: VERDICTS.CANT_DETERMINE,
      reason: `Package "${packageName}" is not declared in dependencies or devDependencies.`,
      behaviorDifferences: [],
      occurrences: []
    };
  }

  const { importsMap, unusedPackages } = await locateImports(projectDir, [packageName], pkgJson.scripts || {});
  const occurrences = importsMap.get(packageName) || [];

  if (unusedPackages.includes(packageName) || occurrences.length === 0) {
    return {
      package: packageName,
      isDeclared: true,
      verdict: VERDICTS.SAFE,
      reason: '0 active references found in project source. Safe to remove via package manager.',
      behaviorDifferences: [],
      occurrences: []
    };
  }

  const fileContents = new Map();
  for (const occ of occurrences) {
    if (occ.file === 'package.json' || occ.file === 'tsconfig.json') continue;
    if (!fileContents.has(occ.file)) {
      try {
        const raw = await readFile(join(projectDir, occ.file), 'utf8');
        const ext = occ.file.slice(occ.file.lastIndexOf('.')).toLowerCase();
        const script = extractScriptContent(raw, ext);
        fileContents.set(occ.file, stripComments(script));
      } catch {
        // file could not be read
      }
    }
  }

  if (packageName === 'axios') {
    return analyzeAxiosUsage(fileContents, occurrences);
  }

  if (packageName === 'uuid') {
    return analyzeUuidUsage(fileContents, occurrences);
  }

  if (packageName === 'lodash' || packageName === 'lodash-es') {
    return analyzeLodashUsage(fileContents, occurrences);
  }

  const nativeRule = getNativeRule(packageName);
  if (nativeRule) {
    return {
      package: packageName,
      isDeclared: true,
      verdict: VERDICTS.SAFE,
      reason: `Native Node.js built-in available: ${nativeRule.description}`,
      replacement: nativeRule.replacement || nativeRule.command,
      diff: nativeRule.diff,
      behaviorDifferences: [
        `Target project Node.js runtime must satisfy ${nativeRule.minNode}.`
      ],
      occurrences
    };
  }

  return {
    package: packageName,
    isDeclared: true,
    verdict: VERDICTS.CANT_DETERMINE,
    reason: `No specialized API inspector or native drop-in rule registered for "${packageName}". Manual code review required.`,
    behaviorDifferences: [],
    occurrences
  };
}

function analyzeAxiosUsage(fileContents, occurrences) {
  let hasInterceptors = false;
  let hasCustomInstance = false;
  let hasCustomAdapters = false;
  let hasCancelToken = false;
  let hasUntracedFlow = false;
  let hasDirectVerbs = false;

  for (const [file, content] of fileContents.entries()) {
    if (content.includes('.interceptors')) hasInterceptors = true;
    if (content.includes('.create(')) hasCustomInstance = true;
    if (content.includes('adapter') || content.includes('httpAgent')) hasCustomAdapters = true;
    if (content.includes('CancelToken')) hasCancelToken = true;

    const directVerbRegex = /\baxios\s*\.\s*(get|post|put|delete|patch|head|options)\s*\(/g;
    if (directVerbRegex.test(content)) {
      hasDirectVerbs = true;
    }

    const assignmentRegex = /(?:const|let|var)\s+([\w$]+)\s*=\s*axios(?!\s*\.\s*(?:get|post|put|delete|patch))/;
    if (assignmentRegex.test(content)) {
      hasUntracedFlow = true;
    }
  }

  if (hasInterceptors || hasCustomAdapters || hasCancelToken) {
    const reasons = [];
    if (hasInterceptors) reasons.push('axios.interceptors');
    if (hasCustomAdapters) reasons.push('custom adapters/agents');
    if (hasCancelToken) reasons.push('legacy CancelToken');
    return {
      package: 'axios',
      isDeclared: true,
      verdict: VERDICTS.NOT_A_DROP_IN,
      reason: `Project uses advanced axios features (${reasons.join(', ')}) that native fetch does not cover.`,
      recommendation: 'Consider using ky or creating a custom fetch wrapper before removing axios.',
      behaviorDifferences: [
        'Native fetch has no interceptor pipeline without custom middleware.',
        'Cancellation in native fetch requires standard AbortController instead of CancelToken.'
      ],
      occurrences
    };
  }

  if (hasCustomInstance || hasUntracedFlow || !hasDirectVerbs) {
    return {
      package: 'axios',
      isDeclared: true,
      verdict: VERDICTS.CANT_DETERMINE,
      reason: hasCustomInstance
        ? 'Project uses axios.create() instance configurations. Cannot verify base URL and timeout flow statically.'
        : 'Value flow passes through variables or wrappers. Cannot guarantee drop-in safety without manual review.',
      recommendation: 'Inspect API client wrapper files to determine if fetch satisfies configuration needs.',
      behaviorDifferences: [
        'Native fetch does not support baseURL or timeout options natively.'
      ],
      occurrences
    };
  }

  return {
    package: 'axios',
    isDeclared: true,
    verdict: VERDICTS.SAFE,
    reason: 'Only direct HTTP method calls (axios.get, axios.post, etc.) detected. Replaceable with native fetch using mechanical code updates.',
    behaviorDifferences: [
      'Native fetch() does not reject promises on HTTP 4xx or 5xx responses (manually check res.ok or res.status).',
      'Native fetch() does not automatically parse JSON responses (call await res.json() instead of accessing res.data).',
      'Native fetch() requires explicit JSON.stringify(body) and headers: { "Content-Type": "application/json" } on POST and PUT requests.'
    ],
    occurrences
  };
}

function analyzeUuidUsage(fileContents, occurrences) {
  let usesNonV4 = false;
  let usesUtilityMethods = false;
  let usesV4 = false;

  for (const [file, content] of fileContents.entries()) {
    if (/\bv[135]\b/.test(content)) usesNonV4 = true;
    if (/\b(?:parse|stringify|validate|version)\s*\(/.test(content)) usesUtilityMethods = true;
    if (/\bv4\b/.test(content) || /crypto\.randomUUID/.test(content)) usesV4 = true;
  }

  if (usesNonV4 || usesUtilityMethods) {
    return {
      package: 'uuid',
      isDeclared: true,
      verdict: VERDICTS.NOT_A_DROP_IN,
      reason: 'Project uses non-v4 UUIDs (v1/v3/v5) or utility methods (validate/parse) not provided by crypto.randomUUID().',
      behaviorDifferences: [
        'Native crypto.randomUUID() only generates RFC 4122 v4 UUIDs.'
      ],
      occurrences
    };
  }

  if (usesV4) {
    return {
      package: 'uuid',
      isDeclared: true,
      verdict: VERDICTS.SAFE,
      reason: 'Only UUID v4 generation detected. 100% replaceable with native crypto.randomUUID().',
      behaviorDifferences: [
        'crypto.randomUUID() is built into Node.js (15.6.0+) and modern browsers with zero external packages.'
      ],
      occurrences
    };
  }

  return {
    package: 'uuid',
    isDeclared: true,
    verdict: VERDICTS.CANT_DETERMINE,
    reason: 'Cannot determine exact UUID variant used.',
    behaviorDifferences: [],
    occurrences
  };
}

function analyzeLodashUsage(fileContents, occurrences) {
  let hasChaining = false;
  let methodsUsed = new Set();

  for (const [file, content] of fileContents.entries()) {
    if (/\_\([\s\S]*?\)\s*\.\s*value\(/.test(content)) hasChaining = true;

    const methodMatches = content.match(/_\.([a-zA-Z0-9_$]+)/g) || [];
    for (const m of methodMatches) {
      methodsUsed.add(m.replace(/^_\./, ''));
    }
  }

  if (hasChaining) {
    return {
      package: 'lodash',
      isDeclared: true,
      verdict: VERDICTS.NOT_A_DROP_IN,
      reason: 'Project uses lodash chaining sequences (_(...).value()). Chaining has no native JavaScript equivalent.',
      behaviorDifferences: [],
      occurrences
    };
  }

  return {
    package: 'lodash',
    isDeclared: true,
    verdict: VERDICTS.CANT_DETERMINE,
    reason: `Project references lodash methods: [${[...methodsUsed].slice(0, 5).join(', ')}]. Statically verifying drop-in replacement depends on input types and deep reference handling.`,
    behaviorDifferences: [
      'structuredClone() replaces cloneDeep() but throws on functions and DOM nodes.',
      'Optional chaining (?.) replaces get() for static access paths.'
    ],
    occurrences
  };
}

export function printCheckReport(report) {
  console.log('\n+--------------------------------------------------------------------------+');
  console.log(`| depshred check: ${report.package}`);
  console.log('+--------------------------------------------------------------------------+');

  let verdictColor = pc.cyan;
  if (report.verdict === VERDICTS.SAFE) verdictColor = pc.green;
  if (report.verdict === VERDICTS.NOT_A_DROP_IN) verdictColor = pc.red;
  if (report.verdict === VERDICTS.CANT_DETERMINE) verdictColor = pc.yellow;

  console.log(`| Verdict:        ${verdictColor(pc.bold(report.verdict.toUpperCase()))}`);
  console.log(`| Reason:         ${report.reason}`);

  if (report.recommendation) {
    console.log(`| Recommendation: ${report.recommendation}`);
  }

  if (report.behaviorDifferences && report.behaviorDifferences.length > 0) {
    console.log('|');
    console.log('| Behavioral Differences (Must check before swapping):');
    for (const diff of report.behaviorDifferences) {
      console.log(`|   * ${diff}`);
    }
  }

  if (report.occurrences && report.occurrences.length > 0) {
    console.log('|');
    console.log(`| Call Sites Found (${report.occurrences.length} file reference(s)):\n` +
      report.occurrences.slice(0, 5).map(o => `|   - ${o.file}:${o.line} -> ${o.snippet}`).join('\n'));
    if (report.occurrences.length > 5) {
      console.log(`|   ... and ${report.occurrences.length - 5} more`);
    }
  }
  console.log('+--------------------------------------------------------------------------+\n');
}
