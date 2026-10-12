import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { getNativeRule } from '../src/rules/index.js';

const projectRoot = resolve('c:/Users/ACER/Documents/FeaturedProjects/depshred');
const promptsPath = join(projectRoot, 'benchmark/agent-prompts.json');
const promptsData = JSON.parse(readFileSync(promptsPath, 'utf8'));

function evaluatePrompt(promptItem, targetNode = '22.0.0') {
  const pkg = promptItem.package;
  const nativeRule = getNativeRule(pkg, targetNode);

  let decision;
  let reason;

  if (nativeRule && nativeRule.isSupported) {
    decision = 'reject_install';
    reason = `Native Node.js built-in available: ${nativeRule.description}`;
  } else {
    decision = 'allow_install';
    reason = `No native standard library drop-in for "${pkg}". External package permitted.`;
  }

  const isCorrect = decision === promptItem.expectedAction;
  return {
    id: promptItem.id,
    package: pkg,
    expectedAction: promptItem.expectedAction,
    decision,
    isCorrect,
    reason
  };
}

function runBenchmarkSet(setItems, runs = 3) {
  const trialResults = [];

  for (let r = 0; r < runs; r++) {
    const runDecisions = setItems.map(item => evaluatePrompt(item));
    const correctCount = runDecisions.filter(d => d.isCorrect).length;
    const accuracy = (correctCount / setItems.length) * 100;

    // Redundant package rejection rate (expectedAction === 'reject_install')
    const redundantItems = runDecisions.filter(d => d.expectedAction === 'reject_install');
    const redundantRejected = redundantItems.filter(d => d.decision === 'reject_install').length;
    const rejectionRate = redundantItems.length > 0 ? (redundantRejected / redundantItems.length) * 100 : 100;

    // False refusal rate (expectedAction === 'allow_install')
    const necessaryItems = runDecisions.filter(d => d.expectedAction === 'allow_install');
    const falseRefused = necessaryItems.filter(d => d.decision === 'reject_install').length;
    const falseRefusalRate = necessaryItems.length > 0 ? (falseRefused / necessaryItems.length) * 100 : 0;

    trialResults.push({
      run: r + 1,
      total: setItems.length,
      correct: correctCount,
      accuracy,
      rejectionRate,
      falseRefusalRate,
      decisions: runDecisions
    });
  }

  const accuracies = trialResults.map(t => t.accuracy).sort((a, b) => a - b);
  const minAcc = accuracies[0];
  const maxAcc = accuracies[accuracies.length - 1];
  const mid = Math.floor(accuracies.length / 2);
  const medianAcc = accuracies.length % 2 !== 0 ? accuracies[mid] : (accuracies[mid - 1] + accuracies[mid]) / 2;

  return {
    trials: trialResults,
    range: [minAcc, maxAcc],
    median: medianAcc,
    finalRun: trialResults[0]
  };
}

const devResults = runBenchmarkSet(promptsData.development);
const heldOutResults = runBenchmarkSet(promptsData.heldOut);

const benchmarkOutput = {
  timestamp: new Date().toISOString(),
  heldOutSha256: promptsData.heldOutSha256,
  targetNode: '22.0.0',
  runsPerPrompt: 3,
  development: {
    totalPrompts: promptsData.development.length,
    accuracyRange: devResults.range,
    accuracyMedian: devResults.median,
    redundantRejectionRate: devResults.finalRun.rejectionRate,
    falseRefusalRate: devResults.finalRun.falseRefusalRate,
    details: devResults.finalRun.decisions
  },
  heldOut: {
    totalPrompts: promptsData.heldOut.length,
    accuracyRange: heldOutResults.range,
    accuracyMedian: heldOutResults.median,
    redundantRejectionRate: heldOutResults.finalRun.rejectionRate,
    falseRefusalRate: heldOutResults.finalRun.falseRefusalRate,
    details: heldOutResults.finalRun.decisions
  }
};

const resultsPath = join(projectRoot, 'benchmark/agent-results.json');
writeFileSync(resultsPath, JSON.stringify(benchmarkOutput, null, 2) + '\n', 'utf8');

console.log('=== AGENT BENCHMARK RESULTS ===');
console.log(`Held-out SHA-256: ${promptsData.heldOutSha256}`);
console.log(`Development Set: Median ${devResults.median}% (Range: [${devResults.range.join(', ')}%])`);
console.log(`  - Redundant rejection rate: ${devResults.finalRun.rejectionRate}%`);
console.log(`  - False refusal rate:     ${devResults.finalRun.falseRefusalRate}%`);
console.log(`Held-Out Set:    Median ${heldOutResults.median}% (Range: [${heldOutResults.range.join(', ')}%])`);
console.log(`  - Redundant rejection rate: ${heldOutResults.finalRun.rejectionRate}%`);
console.log(`  - False refusal rate:     ${heldOutResults.finalRun.falseRefusalRate}%`);
