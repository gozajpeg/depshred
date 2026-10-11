import pc from 'picocolors';
import readline from 'node:readline';
import { formatBytes } from './audit.js';

/**
 * Launch terminal interactive browser.
 * Returns a promise that resolves when the user exits.
 */
export async function runInteractive(auditData) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false; // Fallback to static reporter
  }

  const { results, summary, totalDependencies, totalSaveableBytes, projectName, targetNode } = auditData;
  if (results.length === 0) {
    return false;
  }

  let selectedIndex = 0;
  let inspecting = false;

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  function render() {
    // Clear console
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

    console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));
    console.log(pc.bold(pc.white(`| depshred v1.0.0 (Target Node: ${targetNode})`)));
    console.log(pc.bold(pc.white(`| Project: ${projectName} (${totalDependencies} dependencies scanned)`)));
    console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));
    console.log(pc.red(`| [CRITICAL] ${summary.critical} native replacements (saves ~${formatBytes(totalSaveableBytes)})`));
    console.log(pc.yellow(`| [UNUSED]   ${summary.unused} packages with 0 imports`));
    console.log(pc.cyan(`| [WARN]     ${summary.warn} heavy/dormant/deprecated packages`));
    console.log(pc.green(`| [OK]       ${summary.ok} lean & active dependencies`));
    console.log(pc.bold(pc.white('+--------------------------------------------------------------------------+')));
    console.log('');

    if (inspecting) {
      const item = results[selectedIndex];
      console.log(pc.bold(`=== INSPECTING: ${item.name} (${item.tier}) ===`));
      console.log(`Details: ${item.details}`);
      console.log(`Unpacked Size: ${formatBytes(item.size)}`);
      console.log(`Sub-dependencies: ${item.dependenciesCount}`);
      console.log('');



      if (item.imports && item.imports.length > 0) {
        console.log(pc.bold(`Imports found (${item.imports.length}):`));
        for (const imp of item.imports.slice(0, 5)) {
          console.log(pc.dim(`  - ${imp.file}:${imp.line} -> ${imp.snippet}`));
        }
        if (item.imports.length > 5) {
          console.log(pc.dim(`  ... and ${item.imports.length - 5} more`));
        }
        console.log('');
      }

      if (item.tier === 'UNUSED') {
        console.log(pc.cyan(`Run: npm uninstall ${item.name}`));
        console.log('');
      }

      console.log(pc.dim('Press [Esc] or [Enter] to return to list, [q] to quit.'));
      return;
    }

    console.log('Use [Up/Down] arrows to navigate, [Enter] to inspect, [q] to quit:\n');

    const visibleRange = 12;
    const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(visibleRange / 2), results.length - visibleRange));
    const endIdx = Math.min(results.length, startIdx + visibleRange);

    for (let i = startIdx; i < endIdx; i++) {
      const item = results[i];
      const isSelected = i === selectedIndex;
      const cursor = isSelected ? pc.bold(pc.cyan('> ')) : '  ';

      let badge = pc.green('[OK]      ');
      if (item.tier === 'CRITICAL') badge = pc.red('[CRITICAL]');
      if (item.tier === 'UNUSED') badge = pc.yellow('[UNUSED]  ');
      if (item.tier === 'WARN') badge = pc.cyan('[WARN]    ');
      if (item.tier === 'DEPRECATED') badge = pc.magenta('[DEPRECATED]');

      const nameStr = isSelected ? pc.bold(pc.underline(item.name.padEnd(20))) : item.name.padEnd(20);
      const descStr = pc.dim(item.details.slice(0, 40));

      console.log(`${cursor}${badge} ${nameStr} ${descStr}`);
    }
  }

  return new Promise((resolve) => {
    function cleanup() {
      process.stdin.removeListener('keypress', onKey);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    }

    function onKey(str, key) {
      if (!key) return;

      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        cleanup();
        console.log('\nExited depshred.\n');
        resolve(true);
        return;
      }

      if (inspecting) {
        if (key.name === 'escape' || key.name === 'return' || key.name === 'enter') {
          inspecting = false;
          render();
        }
        return;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        render();
      } else if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % results.length;
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        inspecting = true;
        render();
      }
    }

    process.stdin.on('keypress', onKey);
    process.stdin.resume();
    render();
  });
}
