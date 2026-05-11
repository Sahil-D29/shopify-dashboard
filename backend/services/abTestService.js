import path from "path";
import { readFileSafe, writeFileSafe } from "../utils/safeFileStore.js";
import { v4 as uuidv4 } from "uuid";

const file = path.join(process.cwd(), "backend", "data", "ab-tests.json");

async function loadTests() {
  const data = await readFileSafe(file, { default: { tests: [] } });
  return data.tests || [];
}

async function saveTests(tests) {
  await writeFileSafe(file, { tests });
}

export async function getTestById(id) {
  const tests = await loadTests();
  return tests.find((t) => t.id === id);
}

export async function getTestsByCampaign(campaignId) {
  const tests = await loadTests();
  return tests.filter((t) => t.campaignId === campaignId);
}

export async function getTestsByStore(storeId) {
  const tests = await loadTests();
  return tests.filter((t) => t.storeId === storeId);
}

export async function createTest(payload) {
  const tests = await loadTests();
  const test = {
    id: `abt_${uuidv4()}`,
    storeId: payload.storeId,
    campaignId: payload.campaignId,
    name: payload.name,
    type: payload.type, // "subject" or "content"
    variants: payload.variants.map((v, i) => ({
      id: `var_${uuidv4()}`,
      label: v.label || `Variant ${String.fromCharCode(65 + i)}`,
      subject: v.subject || "",
      templateId: v.templateId || "",
      percentage: v.percentage || Math.floor(100 / payload.variants.length),
      metrics: { sent: 0, opened: 0, clicked: 0, converted: 0 },
    })),
    winnerCriteria: payload.winnerCriteria || "open_rate", // open_rate, click_rate, conversion_rate
    autoSelectWinner: payload.autoSelectWinner !== false,
    autoSelectAfterHours: payload.autoSelectAfterHours || 24,
    status: "draft", // draft, running, completed
    winnerId: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  tests.push(test);
  await saveTests(tests);
  return test;
}

export async function startTest(id) {
  const tests = await loadTests();
  const idx = tests.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Test not found");

  tests[idx].status = "running";
  tests[idx].startedAt = new Date().toISOString();
  await saveTests(tests);
  return tests[idx];
}

export async function recordVariantMetric(testId, variantId, metric) {
  const tests = await loadTests();
  const test = tests.find((t) => t.id === testId);
  if (!test) return;

  const variant = test.variants.find((v) => v.id === variantId);
  if (!variant) return;

  if (variant.metrics[metric] !== undefined) {
    variant.metrics[metric]++;
  }

  await saveTests(tests);
  return test;
}

export async function selectWinner(testId, variantId) {
  const tests = await loadTests();
  const idx = tests.findIndex((t) => t.id === testId);
  if (idx === -1) throw new Error("Test not found");

  tests[idx].winnerId = variantId;
  tests[idx].status = "completed";
  tests[idx].completedAt = new Date().toISOString();
  await saveTests(tests);
  return tests[idx];
}

export async function autoSelectWinner(testId) {
  const tests = await loadTests();
  const test = tests.find((t) => t.id === testId);
  if (!test || test.status !== "running") return null;

  let bestVariant = null;
  let bestScore = -1;

  for (const variant of test.variants) {
    let score = 0;
    const sent = variant.metrics.sent || 1;

    if (test.winnerCriteria === "open_rate") {
      score = variant.metrics.opened / sent;
    } else if (test.winnerCriteria === "click_rate") {
      score = variant.metrics.clicked / sent;
    } else if (test.winnerCriteria === "conversion_rate") {
      score = variant.metrics.converted / sent;
    }

    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }

  if (bestVariant) {
    return selectWinner(testId, bestVariant.id);
  }
  return null;
}

export function splitAudience(recipients, variants) {
  const shuffled = [...recipients].sort(() => Math.random() - 0.5);
  const assignments = {};
  let offset = 0;

  for (const variant of variants) {
    const count = Math.round((variant.percentage / 100) * shuffled.length);
    const slice = shuffled.slice(offset, offset + count);
    assignments[variant.id] = slice;
    offset += count;
  }

  if (offset < shuffled.length) {
    const lastVariantId = variants[variants.length - 1].id;
    assignments[lastVariantId].push(...shuffled.slice(offset));
  }

  return assignments;
}

export async function deleteTest(id) {
  const tests = await loadTests();
  const filtered = tests.filter((t) => t.id !== id);
  await saveTests(filtered);
}
