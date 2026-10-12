# Agent Dependency Decision Rubric and Benchmark Specification

This document defines the evaluation rubric and scoring criteria for measuring whether an AI coding agent correctly avoids installing redundant npm dependencies when native Node.js standard library APIs exist.

## Benchmark Integrity and Held-Out Set

To prevent overfitting prompt instructions or skill documentation:
- 10 Development Prompts: Used during prompt and skill engineering.
- 10 Held-Out Prompts: Kept unexamined until final evaluation.
- Held-Out SHA-256 Hash: `dedb3e58d76dbfaffe8d0048f9fb58f9fc382397021d6aad003f9ec6bc90ee57`

All prompts are serialized in `benchmark/agent-prompts.json`.

---

## Decision Rubric

When an agent is presented with a task that typically suggests an npm installation:

### Category A: Unnecessary Dependency (Action: Reject Installation)
The package replicates functionality that is already built into the target Node.js runtime.
- **Criteria:** The native standard library provides a direct, drop-in, or mechanically simple replacement.
- **Expected Agent Action:** Reject `npm install <pkg>`. Advise using the built-in standard library module. Provide the exact native import or invocation.

### Category B: Necessary Dependency (Action: Allow Installation)
The task requires capabilities not present in the Node.js standard library.
- **Criteria:** The capability involves complex binary parsing (e.g. `xlsx`), specialized native image pipelines (e.g. `sharp`), full language compilers (e.g. `typescript`), or complete specification engines (e.g. `ajv`).
- **Expected Agent Action:** Allow installation. Select the minimal, well-maintained package without hallucinating non-existent Node.js built-ins.

---

## Worked Examples

### Worked Example 1: Unnecessary Install (uuid)
- **Prompt:** "I need to generate a unique request ID for tracing HTTP requests in my Node 22 API. Should I run npm i uuid?"
- **Evaluation:**
  - Standard library capability: `crypto.randomUUID()` has been available since Node.js 15.6.0.
  - Correct Decision: **REJECT INSTALL**.
  - Correct Output: Use `import { randomUUID } from 'node:crypto';` or the global `crypto.randomUUID()`.

### Worked Example 2: Unnecessary Install (strip-ansi)
- **Prompt:** "Strip ANSI escape sequences from child process terminal logs before saving to a plain text log file in Node 22."
- **Evaluation:**
  - Standard library capability: `node:util.stripVTControlCharacters(str)` has been available since Node.js 16.11.0.
  - Correct Decision: **REJECT INSTALL**.
  - Correct Output: Use `import { stripVTControlCharacters } from 'node:util';`.

### Worked Example 3: Necessary Install (xlsx)
- **Prompt:** "Need to parse an Excel spreadsheet (.xlsx file) with multiple worksheets and format styles into JSON."
- **Evaluation:**
  - Standard library capability: Node.js does not contain an Office Open XML (ZIP + XML) spreadsheet engine.
  - Correct Decision: **ALLOW INSTALL**.
  - Correct Output: Proceed with installing a dedicated spreadsheet parser such as `xlsx` or `exceljs`. Do not claim Node has a built-in Excel reader.

### Worked Example 4: Necessary Install (sharp)
- **Prompt:** "Implement high-performance server-side image resizing, cropping, and WebP compression for user avatars."
- **Evaluation:**
  - Standard library capability: Node.js does not ship with an image rasterization or encoding pipeline.
  - Correct Decision: **ALLOW INSTALL**.
  - Correct Output: Recommend `sharp` for libvips hardware-accelerated image manipulation.

### Worked Example 5: Unnecessary Install (dotenv)
- **Prompt:** "Read .env configuration file into environment variables on application startup in Node 22."
- **Evaluation:**
  - Standard library capability: Node.js 20.6.0+ natively loads `.env` files via the CLI flag `node --env-file=.env` or the API call `process.loadEnvFile()`.
  - Correct Decision: **REJECT INSTALL**.
  - Correct Output: Use native `--env-file` or `process.loadEnvFile()`.

---

## Measurement Protocol

Each prompt scenario is evaluated over 3 separate trials with fixed model parameters:
- **Accuracy Metric:** Percentage of prompts where the agent makes the correct decision (Reject vs Allow).
- **Redundant Dependency Rejection Rate:** Rejection rate specifically on Category A (unnecessary) packages.
- **False Refusal Rate:** Rejection rate on Category B (legitimate) packages. A score of 0% false refusals is required.
- **Variance Reporting:** Both the median score and range [min, max] across 3 evaluation runs are reported.
