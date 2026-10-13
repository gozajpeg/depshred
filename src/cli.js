import { parseArgs } from 'node:util';
import { resolve, join, dirname } from 'node:path';
import { statSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import pc from './colors.js';
import { auditProject } from './audit.js';
import { printScorecard, evaluateExitCode } from './reporter.js';
import { runInteractive } from './interactive.js';
import { checkPackageUsage, printCheckReport, EXIT_CODES } from './checker.js';
import { generateMigrationPatch } from './patcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HELP_TEXT = `
${pc.bold('depshred')} - Shred dependency bloat. Embrace modern Node.

${pc.bold('USAGE:')}
  npx depshred [options] [path]

${pc.bold('OPTIONS:')}
  --check               CI mode. Exits with code 1 if critical or unused packages exist.
  --strict              With --check, also exits with code 1 on advisory warnings.
  --json                Output audit data in structured JSON format.
  --no-interactive      Disable the interactive TUI menu and output a summary report.
  --path <dir>          Target directory to audit (defaults to current working directory).
  --dormant-years <n>   Threshold in years to flag unmaintained packages (default: 3).
  --ignore <pkgs>       Comma-separated list of packages to ignore.
  --init-skill [target] Install depshred skill into project (cursor|copilot|windsurf|claude|cline|antigravity|all).
  --from-knip <path>    Ingest upstream Knip JSON report (knip --reporter json).
  --patch [file]        Generate a unified git patch file (default: depshred-migration.patch).

COMMANDS:
  check <package>       Inspect API usage of a specific package and emit verdict (safe|not a drop-in|can't determine).
  -h, --help            Show command help.
  -v, --version         Show version number.

${pc.bold('EXAMPLES:')}
  npx depshred
  npx depshred --check
  npx depshred --init-skill cursor
  npx depshred ./path/to/your-project --json
`;

function normalizeTargetDir(inputPath) {
  const resolved = resolve(inputPath || process.cwd());
  try {
    if (statSync(resolved).isFile()) {
      return dirname(resolved);
    }
  } catch {
    if (resolved.endsWith('package.json') || resolved.endsWith('.json')) {
      return dirname(resolved);
    }
  }
  return resolved;
}

export async function run(rawArgs = []) {
  const args = [...rawArgs];
  // If --init-skill is provided without an explicit target, set empty string to prompt
  const initSkillIdx = args.indexOf('--init-skill');
  if (initSkillIdx !== -1) {
    const nextArg = args[initSkillIdx + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      args.splice(initSkillIdx + 1, 0, '');
    }
  }

  const optionsConfig = {
    check: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    'no-interactive': { type: 'boolean', default: false },
    path: { type: 'string' },
    'dormant-years': { type: 'string', default: '3' },
    ignore: { type: 'string' },
    'init-skill': { type: 'string' },
    'from-knip': { type: 'string' },
    patch: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false }
  };

  let parsed;
  try {
    parsed = parseArgs({ args, options: optionsConfig, allowPositionals: true });
  } catch (err) {
    console.error(pc.red(`Error: ${err.message}`));
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const { values, positionals } = parsed;

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (values.version) {
    console.log('depshred v1.1.1');
    return;
  }

  // Handle "depshred check <package>" command
  if (positionals[0] === 'check') {
    const pkgName = positionals[1];
    if (!pkgName) {
      console.error(pc.red('Error: Please specify package to check. Usage: depshred check <package>'));
      process.exit(1);
    }
    const checkDir = normalizeTargetDir(values.path || positionals[2] || process.cwd());
    const report = await checkPackageUsage(checkDir, pkgName);
    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printCheckReport(report);
    }
    process.exit(EXIT_CODES[report.verdict] ?? 1);
  }

  // Handle skill installation command
  if (values['init-skill'] !== undefined) {
    await handleInitSkill(values['init-skill']);
    return;
  }

  const targetPath = normalizeTargetDir(values.path || positionals[0] || process.cwd());
  const dormantYears = Number(values['dormant-years']) || 3;
  const ignoreList = values.ignore ? values.ignore.split(',').map((s) => s.trim()) : [];
  const isNoInteractive = values['no-interactive'] || values.check || values.json || !process.stdout.isTTY;

  try {
    const auditData = await auditProject({
      path: targetPath,
      dormantYears,
      ignore: ignoreList,
      strict: values.strict,
      fromKnip: values['from-knip']
    });

    let patchResult = null;
    if (values.patch !== undefined) {
      const patchFileName = typeof values.patch === 'string' && values.patch ? values.patch : undefined;
      patchResult = await generateMigrationPatch(targetPath, { outputFileName: patchFileName });
    }

    if (values.json) {
      const outputJson = patchResult ? { ...auditData, patch: patchResult } : auditData;
      console.log(JSON.stringify(outputJson, null, 2));
      process.exit(values.check ? evaluateExitCode(auditData, values.strict) : 0);
    }

    if (isNoInteractive) {
      printScorecard(auditData);
      if (patchResult) {
        if (patchResult.patchPath) {
          console.log(pc.green(`\nMigration patch generated: ${patchResult.patchPath}`));
          console.log(pc.gray(`Changed files: ${patchResult.changedFiles.join(', ')}`));
          console.log(pc.gray(`Verify with:  git apply --check ${patchResult.patchPath}`));
          console.log(pc.gray(`Apply with:   git apply ${patchResult.patchPath}\n`));
        } else {
          console.log(pc.gray('\nNo mechanical native migrations detected. No patch generated.\n'));
        }
      }
      if (values.check) {
        process.exit(evaluateExitCode(auditData, values.strict));
      }
      return;
    }

    const interactiveLaunched = await runInteractive(auditData);
    if (!interactiveLaunched) {
      printScorecard(auditData);
      if (patchResult && patchResult.patchPath) {
        console.log(pc.green(`\nMigration patch generated: ${patchResult.patchPath}`));
        console.log(pc.gray(`Verify with: git apply --check ${patchResult.patchPath}\n`));
      }
    }
  } catch (err) {
    console.error(pc.red(`Audit error: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Handle copying skill rule templates into the current project.
 */
async function handleInitSkill(target) {
  const rootSkillsDir = join(__dirname, '..', 'skills');
  const cwd = process.cwd();

  const mappings = {
    cursor: { name: 'Cursor (.cursor/rules/depshred.mdc)', src: 'cursor/depshred.mdc', dest: '.cursor/rules/depshred.mdc' },
    copilot: { name: 'GitHub Copilot (.github/copilot-instructions.md)', src: 'copilot/copilot-instructions.md', dest: '.github/copilot-instructions.md' },
    windsurf: { name: 'Windsurf (.windsurf/rules/depshred.md)', src: 'windsurf/depshred.md', dest: '.windsurf/rules/depshred.md' },
    claude: { name: 'Claude Code (CLAUDE.md)', src: 'claude/CLAUDE.md', dest: 'CLAUDE.md' },
    cline: { name: 'Cline / Roo Code (.clinerules)', src: 'cline/.clinerules', dest: '.clinerules' },
    antigravity: { name: 'Google Antigravity (.agents/skills/depshred/SKILL.md)', src: 'antigravity/SKILL.md', dest: '.agents/skills/depshred/SKILL.md' },
    agents: { name: 'Universal AGENTS.md (AGENTS.md)', src: 'agents/AGENTS.md', dest: 'AGENTS.md' },
    universal: { name: 'Universal Agent (.agents/skills/depshred/SKILL.md)', src: 'antigravity/SKILL.md', dest: '.agents/skills/depshred/SKILL.md' }
  };

  const keys = Object.keys(mappings);
  let selectedTarget = (target || '').toLowerCase().trim();

  // If no target provided or target is unknown / 'skills', prompt interactively if in TTY
  if (!selectedTarget || selectedTarget === 'skills' || (!mappings[selectedTarget] && selectedTarget !== 'all')) {
    if (process.stdin.isTTY) {
      console.log(pc.bold('\nWhich editor or agent are you using?'));
      keys.forEach((k, idx) => {
        console.log(`  ${idx + 1}) ${mappings[k].name}`);
      });
      console.log(`  ${keys.length + 1}) All of the above\n`);

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = (await rl.question(pc.cyan(`Enter choice [1-${keys.length + 1}] (default: 1): `))).trim();
        const num = parseInt(answer || '1', 10);
        if (num >= 1 && num <= keys.length) {
          selectedTarget = keys[num - 1];
        } else if (num === keys.length + 1) {
          selectedTarget = 'all';
        } else {
          selectedTarget = 'cursor';
        }
      } finally {
        rl.close();
      }
    } else {
      console.error(pc.red(`\nPlease specify your editor target:\n  npx depshred --init-skill <${keys.join('|')}|all>\n`));
      return;
    }
  }

  const targetsToCopy = selectedTarget === 'all' ? keys : [selectedTarget];

  for (const t of targetsToCopy) {
    const map = mappings[t];
    if (!map) continue;

    const srcFile = join(rootSkillsDir, map.src);
    const destFile = join(cwd, map.dest);
    const destDir = dirname(destFile);

    try {
      await mkdir(destDir, { recursive: true });
      await copyFile(srcFile, destFile);
      console.log(pc.green(`Installed ${t} skill -> ${map.dest}`));
    } catch (err) {
      console.error(pc.red(`Failed to install ${t} skill: ${err.message}`));
    }
  }
}