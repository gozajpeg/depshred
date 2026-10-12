# depshred Empirical False-Positive Benchmark

This document tracks the verified false-positive and accuracy metrics of `depshred` across real, open-source Node.js repositories.

---

## 1. Environment & Run Metadata

| Parameter | Value |
| :--- | :--- |
| **depshred Commit** | `a959f57` |
| **Node.js Version** | `v22.13.1` |
| **Operating System** | `win32 10.0.26200` |
| **Benchmark Timestamp** | `2026-10-12T12:04:09.988Z` |
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
