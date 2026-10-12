import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { platform, release } from 'node:os';
import { auditProject } from '../src/audit.js';

/**
 * Execute a child process asynchronously and capture stdout/stderr.
 */
function runCommand(cmd, args, { cwd, env = process.env, timeout = 180000 } = {}) {
  return new Promise((resolveResult) => {
    const isWindows = process.platform === 'win32';
    let executable = cmd;
    if (isWindows && (cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn')) {
      executable = `${cmd}.cmd`;
    }

    let stdout = '';
    let stderr = '';
    let timer;

    const child = spawn(executable, args, {
      cwd,
      env: { ...env, CI: 'true', NO_COLOR: '1' },
      shell: isWindows
    });

    if (timeout > 0) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolveResult({
          code: -1,
          stdout,
          stderr: stderr + '\n[TIMEOUT: Process exceeded execution limit]',
          timedOut: true
        });
      }, timeout);
    }

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolveResult({ code: 1, stdout, stderr: stderr + '\n' + err.message, timedOut: false });
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolveResult({ code: code ?? 0, stdout, stderr, timedOut: false });
    });
  });
}

/**
 * Main Benchmark Harness Runner.
 */
async function main() {
  const optionsConfig = {
    corpus: { type: 'string', default: 'benchmark/corpus.json' },
    'work-dir': { type: 'string', default: 'benchmark/work' },
    'output-json': { type: 'string', default: 'benchmark/results.json' },
    'output-md': { type: 'string', default: 'BENCHMARK.md' },
    repo: { type: 'string' },
    limit: { type: 'string' },
    'skip-clone': { type: 'boolean', default: false }
  };

  const { values } = parseArgs({ options: optionsConfig, allowPositionals: true });

  const rootDir = process.cwd();
  const corpusPath = resolve(rootDir, values.corpus);
  const workDir = resolve(rootDir, values['work-dir']);
  mkdirSync(workDir, { recursive: true });

  if (!existsSync(corpusPath)) {
    console.error(`Corpus file not found: ${corpusPath}`);
    process.exit(1);
  }

  const corpusData = JSON.parse(readFileSync(corpusPath, 'utf8'));
  let reposToTest = corpusData.repositories;

  if (values.repo) {
    reposToTest = reposToTest.filter((r) => r.name === values.repo);
    if (reposToTest.length === 0) {
      console.error(`Repository "${values.repo}" not found in corpus.`);
      process.exit(1);
    }
  }

  if (values.limit) {
    const limitNum = parseInt(values.limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      reposToTest = reposToTest.slice(0, limitNum);
    }
  }

  // Get current git commit of depshred
  const gitCommitRes = await runCommand('git', ['rev-parse', '--short', 'HEAD'], { cwd: rootDir });
  const depshredCommit = gitCommitRes.stdout.trim() || 'unknown';

  const benchmarkMetadata = {
    depshredCommit,
    nodeVersion: process.version,
    os: `${platform()} ${release()}`,
    timestamp: new Date().toISOString(),
    totalRepositoriesInCorpus: corpusData.repositories.length,
    repositoriesTested: reposToTest.length
  };

  console.log(`================================================================`);
  console.log(`depshred Benchmark Harness`);
  console.log(`Commit: ${depshredCommit} | Node: ${process.version} | OS: ${benchmarkMetadata.os}`);
  console.log(`Testing ${reposToTest.length} repos`);
  console.log(`================================================================\n`);

  const results = [];

  for (const repo of reposToTest) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[${repo.tier.toUpperCase()}] ${repo.owner}/${repo.name} (${repo.category})`);
    console.log(`Pinned Commit: ${repo.commit}`);
    console.log(`----------------------------------------------------------------`);

    const repoWorkDir = join(workDir, repo.name);

    // Step 1: Clone or Checkout at pinned commit
    if (!existsSync(repoWorkDir) || !values['skip-clone']) {
      if (existsSync(repoWorkDir)) {
        try {
          rmSync(repoWorkDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
      console.log(`Cloning ${repo.url}...`);
      const cloneRes = await runCommand('git', ['clone', '--depth', '100', repo.url, repoWorkDir], { cwd: workDir });
      if (cloneRes.code !== 0) {
        console.error(`Failed to clone: ${cloneRes.stderr}`);
        results.push({ ...repo, status: 'CLONE_FAILED', error: cloneRes.stderr });
        continue;
      }

      console.log(`Checking out pinned commit ${repo.commit}...`);
      const checkoutRes = await runCommand('git', ['checkout', repo.commit], { cwd: repoWorkDir });
      if (checkoutRes.code !== 0) {
        console.error(`Failed to checkout commit: ${checkoutRes.stderr}`);
        results.push({ ...repo, status: 'CHECKOUT_FAILED', error: checkoutRes.stderr });
        continue;
      }
    }

    // Read target repo package.json
    const repoPkgPath = join(repoWorkDir, 'package.json');
    if (!existsSync(repoPkgPath)) {
      results.push({ ...repo, status: 'NO_PACKAGE_JSON' });
      continue;
    }

    const repoPkg = JSON.parse(readFileSync(repoPkgPath, 'utf8'));
    const totalDeps = Object.keys(repoPkg.dependencies || {}).length + Object.keys(repoPkg.devDependencies || {}).length;

    // Filter available verification scripts from repo scripts
    const availableScripts = repo.scripts.filter((s) => repoPkg.scripts && repoPkg.scripts[s]);
    console.log(`Total declared dependencies: ${totalDeps}`);
    console.log(`Verification scripts to check: ${availableScripts.join(', ') || 'none'}`);

    // Step 2: Pre-flight Health Check (Clean install + 2x verification runs)
    console.log(`Running clean install (${repo.packageManager})...`);
    const hasNpmLock = existsSync(join(repoWorkDir, 'package-lock.json'));
    const installArgs = repo.packageManager === 'pnpm'
      ? ['install']
      : (repo.packageManager === 'yarn'
        ? ['install']
        : (hasNpmLock ? ['ci'] : ['install']));

    let installRes = await runCommand(repo.packageManager, installArgs, { cwd: repoWorkDir });
    if (installRes.code !== 0) {
      console.error(`Install failed: ${installRes.stderr.slice(0, 300)}`);
      results.push({ ...repo, totalDeps, status: 'UNHEALTHY_BASELINE_INSTALL_FAILED', error: installRes.stderr.slice(0, 300) });
      continue;
    }

    // Run verification scripts twice to confirm zero flakiness
    let baselinePassed = true;
    let baselineError = '';

    for (let runIndex = 1; runIndex <= 2; runIndex++) {
      console.log(`Baseline verification run ${runIndex}/2...`);
      for (const scriptName of availableScripts) {
        const testRes = await runCommand(repo.packageManager, ['run', scriptName], { cwd: repoWorkDir });
        if (testRes.code !== 0) {
          baselinePassed = false;
          baselineError = `Baseline run ${runIndex} failed on "${scriptName}": ${testRes.stderr.slice(0, 200) || testRes.stdout.slice(0, 200)}`;
          break;
        }
      }
      if (!baselinePassed) break;
    }

    if (!baselinePassed) {
      console.warn(`DROPPED: Repo failed baseline verification: ${baselineError}`);
      results.push({
        ...repo,
        totalDeps,
        status: 'UNHEALTHY_BASELINE',
        error: baselineError
      });
      continue;
    }

    console.log(`Baseline verification PASSED cleanly (2/2 runs).`);

    // Step 3: Run depshred Audit on Target Repo
    console.log(`Running depshred audit...`);
    let auditData;
    try {
      auditData = await auditProject({ path: repoWorkDir });
    } catch (err) {
      console.error(`depshred audit crashed: ${err.message}`);
      results.push({ ...repo, totalDeps, status: 'DEPSHRED_CRASHED', error: err.message });
      continue;
    }

    const unusedPkgs = auditData.results.filter((r) => r.tier === 'UNUSED').map((r) => r.name);
    console.log(`depshred flagged ${unusedPkgs.length} unused package(s): ${unusedPkgs.join(', ') || 'none'}`);

    // Step 4: Isolated Clean-Install Removal Testing (One package at a time)
    const verificationDetails = [];
    let falsePositivesCount = 0;
    let truePositivesCount = 0;

    const originalPkgContent = readFileSync(repoPkgPath, 'utf8');

    for (const pkg of unusedPkgs) {
      console.log(`Testing isolated removal of: ${pkg}...`);
      const modifiedPkg = JSON.parse(originalPkgContent);
      if (modifiedPkg.dependencies) delete modifiedPkg.dependencies[pkg];
      if (modifiedPkg.devDependencies) delete modifiedPkg.devDependencies[pkg];
      writeFileSync(repoPkgPath, JSON.stringify(modifiedPkg, null, 2), 'utf8');

      const nodeModulesDir = join(repoWorkDir, 'node_modules');
      if (existsSync(nodeModulesDir)) {
        try {
          rmSync(nodeModulesDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }

      const cleanInstallRes = await runCommand(repo.packageManager, installArgs, { cwd: repoWorkDir });
      if (cleanInstallRes.code !== 0) {
        console.log(`  -> FALSE POSITIVE: Clean install failed without ${pkg}`);
        falsePositivesCount++;
        verificationDetails.push({
          package: pkg,
          verdict: 'FALSE_POSITIVE',
          reason: 'Clean install failed',
          errorSnippet: cleanInstallRes.stderr.slice(0, 200)
        });
        writeFileSync(repoPkgPath, originalPkgContent, 'utf8');
        continue;
      }

      let scriptsPassed = true;
      let failureScript = '';
      let failureSnippet = '';

      for (const scriptName of availableScripts) {
        const runRes = await runCommand(repo.packageManager, ['run', scriptName], { cwd: repoWorkDir });
        if (runRes.code !== 0) {
          scriptsPassed = false;
          failureScript = scriptName;
          failureSnippet = (runRes.stderr || runRes.stdout).slice(0, 250);
          break;
        }
      }

      if (!scriptsPassed) {
        console.log(`  -> FALSE POSITIVE: Script "${failureScript}" failed without ${pkg}`);
        falsePositivesCount++;
        verificationDetails.push({
          package: pkg,
          verdict: 'FALSE_POSITIVE',
          reason: `Failed script "${failureScript}"`,
          errorSnippet: failureSnippet
        });
      } else {
        console.log(`  -> TRUE POSITIVE: Verified clean removal (all scripts passed)`);
        truePositivesCount++;
        verificationDetails.push({
          package: pkg,
          verdict: 'TRUE_POSITIVE'
        });
      }

      writeFileSync(repoPkgPath, originalPkgContent, 'utf8');
    }

    results.push({
      name: repo.name,
      owner: repo.owner,
      tier: repo.tier,
      category: repo.category,
      commit: repo.commit,
      totalDeps,
      flaggedUnused: unusedPkgs.length,
      truePositives: truePositivesCount,
      falsePositives: falsePositivesCount,
      falsePositiveRate: unusedPkgs.length > 0 ? `${((falsePositivesCount / unusedPkgs.length) * 100).toFixed(1)}%` : '0.0%',
      status: 'VERIFIED',
      verificationDetails
    });
  }

  // Step 5: Save JSON results and generate BENCHMARK.md
  const finalReport = {
    metadata: benchmarkMetadata,
    results
  };

  const outputJsonPath = resolve(rootDir, values['output-json']);
  writeFileSync(outputJsonPath, JSON.stringify(finalReport, null, 2), 'utf8');
  console.log(`\nSaved machine-readable results to ${values['output-json']}`);

  generateBenchmarkMarkdown(finalReport, resolve(rootDir, values['output-md']));
  console.log(`Generated ${values['output-md']}`);
}

/**
 * Generate human-readable BENCHMARK.md report.
 */
function generateBenchmarkMarkdown(report, outputPath) {
  const meta = report.metadata;
  const verifiedRepos = report.results.filter((r) => r.status === 'VERIFIED');
  const droppedRepos = report.results.filter((r) => r.status !== 'VERIFIED');

  const totalScannedDeps = verifiedRepos.reduce((acc, r) => acc + (r.totalDeps || 0), 0);
  const totalFlagged = verifiedRepos.reduce((acc, r) => acc + (r.flaggedUnused || 0), 0);
  const totalTruePositives = verifiedRepos.reduce((acc, r) => acc + (r.truePositives || 0), 0);
  const totalFalsePositives = verifiedRepos.reduce((acc, r) => acc + (r.falsePositives || 0), 0);
  const overallFPRate = totalFlagged > 0 ? `${((totalFalsePositives / totalFlagged) * 100).toFixed(1)}%` : '0.0%';

  const md = `# depshred Empirical False-Positive Benchmark

This document tracks the verified false-positive and accuracy metrics of \`depshred\` across real, open-source Node.js repositories.

---

## 1. Environment & Run Metadata

| Parameter | Value |
| :--- | :--- |
| **depshred Commit** | \`${meta.depshredCommit}\` |
| **Node.js Version** | \`${meta.nodeVersion}\` |
| **Operating System** | \`${meta.os}\` |
| **Benchmark Timestamp** | \`${meta.timestamp}\` |
| **Total Corpus Size** | ${meta.totalRepositoriesInCorpus} repositories |
| **Tested in Run** | ${meta.repositoriesTested} repositories |

---

## 2. Methodology & Rigor

1. **Mechanical Selection:** Applications, backends, and standalone CLI tools only. Split between popular (>3,000 stars) and mid-tier (200 - 2,000 stars).
2. **Two-Pass Health Check:** Repositories must pass clean install and verification scripts (\`build\`, \`test\`, \`lint\`, \`typecheck\`) two consecutive times at the pinned commit. Flaky or failing repositories are dropped from evaluation.
3. **Isolated Removal Testing:** Each package flagged as "unused" by \`depshred\` is removed from \`package.json\` individually. \`node_modules\` is cleared, reinstalled via lockfile, and all scripts are executed.
   - **True Positive:** The package is removed and all verification scripts continue to pass.
   - **False Positive:** The package removal causes clean install, build, test, typecheck, or lint to fail.

---

## 3. Summary Scorecard

| Metric | Measured Result |
| :--- | :--- |
| **Healthy Repositories Evaluated** | ${verifiedRepos.length} |
| **Total Declared Dependencies Scanned** | ${totalScannedDeps} |
| **Packages Flagged as Unused** | ${totalFlagged} |
| **Confirmed True Positives (Safe Removals)** | ${totalTruePositives} |
| **Confirmed False Positives (Broken Builds/Tests)** | ${totalFalsePositives} |
| **Measured False-Positive Rate** | **${overallFPRate}** (${totalFalsePositives} / ${totalFlagged}) |

---

## 4. Per-Repository Results

| Repository | Tier | Category | Declared Deps | Flagged Unused | True Positives | False Positives | FP Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${report.results.map((r) => {
  if (r.status !== 'VERIFIED') {
    return `| **${r.name}** | ${r.tier || '-'} | ${r.category || '-'} | - | - | - | - | - | DROPPED (${r.status}) |`;
  }
  return `| **${r.name}** | ${r.tier} | ${r.category} | ${r.totalDeps} | ${r.flaggedUnused} | ${r.truePositives} | ${r.falsePositives} | ${r.falsePositiveRate} | Verified |`;
}).join('\n')}

---

## 5. False-Positive Incident Log

${totalFalsePositives === 0
  ? '*No false positives were detected in this run.*'
  : verifiedRepos.flatMap((r) => r.verificationDetails || [])
      .filter((d) => d.verdict === 'FALSE_POSITIVE')
      .map((d) => `- **${d.package}**: ${d.reason}\n  \`\`\`\n  ${d.errorSnippet}\n  \`\`\``)
      .join('\n')
}

---

## 6. Dropped Repositories (Baseline Failures)

${droppedRepos.length === 0
  ? '*All tested repositories passed baseline verification.*'
  : droppedRepos.map((r) => `- **${r.name}**: ${r.status} (${r.error || 'Pre-flight failure'})`).join('\n')
}
`;

  writeFileSync(outputPath, md, 'utf8');
}

main().catch((err) => {
  console.error('Fatal benchmark harness error:', err);
  process.exit(1);
});
