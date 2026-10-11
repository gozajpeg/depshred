# depshred Agent Skills & IDE Rules Catalog

This directory contains pre-configured dependency hygiene and pre-flight vetting instructions formatted for all major AI coding agents and IDEs.

## Supported IDEs & Agents

| IDE / Agent | Configuration File | Native Location |
| :--- | :--- | :--- |
| **Cursor** | `skills/cursor/depshred.mdc` | `.cursor/rules/depshred.mdc` |
| **GitHub Copilot / VS Code** | `skills/copilot/copilot-instructions.md` | `.github/copilot-instructions.md` |
| **Windsurf (Codeium)** | `skills/windsurf/depshred.md` | `.windsurf/rules/depshred.md` or `.windsurfrules` |
| **Claude Code (Anthropic)** | `skills/claude/CLAUDE.md` | `CLAUDE.md` |
| **Cline / Roo Code** | `skills/cline/.clinerules` | `.clinerules` |
| **Universal / Antigravity** | `skills/depshred/SKILL.md` | `.agents/skills/depshred/SKILL.md` |

## How It Works

Each configuration prevents AI agents from blindly executing `npm install <package>` by enforcing a mandatory 4-step pre-flight check:
1. **Step 0:** Native Node.js standard library check (zero external packages).
2. **Step 1:** Existing codebase and unused dependency inspection.
3. **Step 2:** Vetting new dependencies (avoiding dormancy >3 years, checking sub-dependencies, preferring lightweight alternatives).
4. **Step 3:** Post-change verification (`depshred --check`).
