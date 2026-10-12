import pc from 'picocolors';
import { formatBytes } from './audit.js';

/**
 * Format and print audit scorecard to terminal.
 */
export function printScorecard(auditData, options = {}) {
  const { summary, results, totalDependencies, totalSaveableBytes, projectName, targetNode } = auditData;

  console.log('');
  console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));
  console.log(pc.bold(pc.white(`| depshred v1.1.0 (Target Node: ${targetNode})`)));
  console.log(pc.bold(pc.white(`| Project: ${projectName} (${totalDependencies} dependencies scanned)`)));
  console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));

  if (summary.critical > 0) {
    console.log(pc.red(`| [CRITICAL] ${summary.critical} package(s) have native Node.js replacements (saves ~${formatBytes(totalSaveableBytes)})`));
  }
  if (summary.unused > 0) {
    console.log(pc.yellow(`| [UNUSED]   ${summary.unused} package(s) have 0 imports in project source code`));
  }
  if (summary.warn > 0) {
    console.log(pc.cyan(`| [WARN]     ${summary.warn} package(s) are heavy, dormant, or deprecated`));
  }
  console.log(pc.green(`| [OK]       ${summary.ok} package(s) are lean and actively maintained`));
  console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));
  console.log('');

  // Print Actionable Items: Critical & Unused First
  const criticalItems = results.filter((r) => r.tier === 'CRITICAL');
  const unusedItems = results.filter((r) => r.tier === 'UNUSED');
  const warnItems = results.filter((r) => r.tier === 'WARN' || r.tier === 'DEPRECATED');
  const okItems = results.filter((r) => r.tier === 'OK');

  if (criticalItems.length > 0) {
    console.log(pc.bold(pc.red('=== NATIVE STANDARD LIBRARY REPLACEMENTS ===')));
    for (const item of criticalItems) {
      console.log(`  ${pc.bold(pc.red('[CRITICAL]'))} ${pc.bold(item.name)} -> ${item.details}`);
      if (item.imports.length > 0) {
        console.log(pc.dim(`             Imported in ${item.imports[0].file}:${item.imports[0].line}`));
      }
    }
    console.log('');
  }

  if (unusedItems.length > 0) {
    console.log(pc.bold(pc.yellow('=== UNUSED DEPENDENCIES (0 IMPORTS DETECTED) ===')));
    for (const item of unusedItems) {
      console.log(`  ${pc.bold(pc.yellow('[UNUSED]'))}   ${pc.bold(item.name)} (unpacked: ${formatBytes(item.size)})`);
    }
    const uninstallCmd = `npm uninstall ${unusedItems.map((i) => i.name).join(' ')}`;
    console.log('');
    console.log(`  ${pc.bold('Quick removal command:')}`);
    console.log(`  ${pc.cyan(uninstallCmd)}`);
    console.log('');
  }

  if (warnItems.length > 0) {
    console.log(pc.bold(pc.cyan('=== ADVISORY WARNINGS (DORMANT / HEAVY) ===')));
    for (const item of warnItems) {
      const tag = item.tier === 'DEPRECATED' ? pc.magenta('[DEPRECATED]') : pc.cyan('[WARN]');
      console.log(`  ${tag}     ${pc.bold(item.name)} | ${item.details}`);
    }
    console.log('');
  }

  if (options.verbose && okItems.length > 0) {
    console.log(pc.bold(pc.green('=== HEALTHY DEPENDENCIES ===')));
    for (const item of okItems) {
      console.log(`  ${pc.green('[OK]')}       ${item.name} (${formatBytes(item.size)})`);
    }
    console.log('');
  }
}

/**
 * Handle CI exit code evaluation.
 */
export function evaluateExitCode(auditData, strict = false) {
  const { summary } = auditData;
  if (summary.critical > 0 || summary.unused > 0) {
    return 1;
  }
  if (strict && summary.warn > 0) {
    return 1;
  }
  return 0;
}
