# depshred Empirical False-Positive Benchmark

This document tracks the verified false-positive and accuracy metrics of `depshred` across real, open-source Node.js repositories.

---

## 1. Environment & Run Metadata

| Parameter | Value |
| :--- | :--- |
| **depshred Commit** | `3631f22` |
| **Node.js Version** | `v22.13.1` |
| **Operating System** | `win32 10.0.26200` |
| **Benchmark Timestamp** | `2026-10-12T15:39:17.029Z` |
| **Total Corpus Size** | 25 repositories |
| **Tested in Run** | 1 repositories |

---

## 2. Methodology & Rigor

1. **Mechanical Selection:** Applications, backends, and standalone CLI tools only. Split between popular (>3,000 stars) and mid-tier (200 - 2,000 stars).
2. **Two-Pass Health Check:** Repositories must pass clean install and verification scripts (`build`, `test`, `lint`, `typecheck`) two consecutive times at the pinned commit. Flaky or failing repositories are dropped from evaluation.
3. **Isolated Removal Testing:** Each package flagged as "unused" by `depshred` is removed from `package.json` individually. `node_modules` is cleared, reinstalled via lockfile, and all scripts are executed.
   - **True Positive:** The package is removed and all verification scripts continue to pass.
   - **False Positive:** The package removal causes clean install, build, test, typecheck, or lint to fail.

---

## 3. Summary Scorecard

| Metric | Measured Result |
| :--- | :--- |
| **Healthy Repositories Evaluated** | 1 |
| **Total Declared Dependencies Scanned** | 3 |
| **Packages Flagged as Unused** | 0 |
| **Confirmed True Positives (Safe Removals)** | 0 |
| **Confirmed False Positives (Broken Builds/Tests)** | 0 |
| **Measured False-Positive Rate** | **0.0%** (0 / 0) |

---

## 4. Per-Repository Results

| Repository | Tier | Category | Declared Deps | Flagged Unused | True Positives | False Positives | FP Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **mri** | mid-tier | CLI Arg Parser | 3 | 0 | 0 | 0 | 0.0% | Verified |

---

## 5. False-Positive Incident Log

*No false positives were detected in this run.*

---

## 6. Dropped Repositories (Baseline Failures)

*All tested repositories passed baseline verification.*

---

## 7. Agent Benchmark Scorecard

This section tracks the verified decision accuracy of agents using `depshred` rules to reject redundant npm installs when native Node.js standard library APIs exist.

### Integrity & Protocol
- **Held-Out Prompts SHA-256**: `dedb3e58d76dbfaffe8d0048f9fb58f9fc382397021d6aad003f9ec6bc90ee57`
- **Target Runtime**: Node.js `>=22.0.0`
- **Runs per Prompt**: 3 evaluation runs with fixed parameters
- **Specification & Rubric**: See [agent-rubric.md](file:///benchmark/agent-rubric.md) and [agent-prompts.json](file:///benchmark/agent-prompts.json)

### Summary Metrics

| Evaluation Set | Prompts | Accuracy Median | Accuracy Range | Redundant Rejection Rate | False Refusal Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Development Set** | 10 | **100.0%** | [100.0%, 100.0%] | 100.0% (7 / 7) | 0.0% (0 / 3) |
| **Held-Out Set** | 10 | **100.0%** | [100.0%, 100.0%] | 100.0% (6 / 6) | 0.0% (0 / 4) |

### Detailed Prompt Breakdown

#### Development Set (10 Scenarios)
| ID | Package | Expected Action | Agent Decision | Native Alternative | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **dev-01** | `uuid` | Reject Install | Reject Install | `node:crypto` `randomUUID()` | Correct |
| **dev-02** | `xlsx` | Allow Install | Allow Install | None (binary format parsing) | Correct |
| **dev-03** | `strip-ansi` | Reject Install | Reject Install | `node:util` `stripVTControlCharacters()` | Correct |
| **dev-04** | `rimraf` | Reject Install | Reject Install | `node:fs` `rmSync({ recursive: true, force: true })` | Correct |
| **dev-05** | `sharp` | Allow Install | Allow Install | None (libvips image pipeline) | Correct |
| **dev-06** | `dotenv` | Reject Install | Reject Install | `node --env-file=.env` or `process.loadEnvFile()` | Correct |
| **dev-07** | `glob` | Reject Install | Reject Install | `node:fs` `fs.globSync()` / `fs.promises.glob()` | Correct |
| **dev-08** | `typescript` | Allow Install | Allow Install | None (compiler and type-checker) | Correct |
| **dev-09** | `axios` | Reject Install | Reject Install | Global `fetch()` | Correct |
| **dev-10** | `mkdirp` | Reject Install | Reject Install | `node:fs` `mkdirSync({ recursive: true })` | Correct |

#### Held-Out Set (10 Scenarios)
| ID | Package | Expected Action | Agent Decision | Native Alternative | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **heldout-01** | `deep-equal` | Reject Install | Reject Install | `node:assert` `assert.deepStrictEqual()` | Correct |
| **heldout-02** | `better-sqlite3` | Allow Install | Allow Install | None (dedicated SQLite engine) | Correct |
| **heldout-03** | `delay` | Reject Install | Reject Install | `node:timers/promises` `setTimeout()` | Correct |
| **heldout-04** | `ajv` | Allow Install | Allow Install | None (JSON Schema validator) | Correct |
| **heldout-05** | `crypto-js` | Reject Install | Reject Install | `node:crypto` `createHash()` | Correct |
| **heldout-06** | `moment` | Reject Install | Reject Install | Built-in `Intl.DateTimeFormat` | Correct |
| **heldout-07** | `chalk` | Reject Install | Reject Install | `node:util` `styleText()` (Node 22+) | Correct |
| **heldout-08** | `tar` | Allow Install | Allow Install | None (streaming tarball extractor) | Correct |
| **heldout-09** | `cheerio` | Allow Install | Allow Install | None (DOM parser and query engine) | Correct |
| **heldout-10** | `form-data` | Reject Install | Reject Install | Global `FormData` and `Blob` | Correct |
