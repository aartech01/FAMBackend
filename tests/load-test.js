/**
 * FAM Load Test — Concurrent User Simulation
 *
 * Usage:
 *   node tests/load-test.js                            (200 users, 30s, localhost)
 *   node tests/load-test.js --users=2000 --duration=60
 *   BASE_URL=https://web-production-bf889.up.railway.app node tests/load-test.js --users=2000
 *   node tests/load-test.js --scenario=spike
 *   node tests/load-test.js --scenario=all
 *
 * Scenarios:
 *   baseline  — 10 users, 10s  (smoke test — everything should work)
 *   normal    — 200 users, 30s (expected daily load)
 *   high      — 2000 users, 60s (stress test)
 *   spike     — ramp 0→2000 in 5s then drop (burst resilience)
 *   sustained — 500 users, 5 min (memory leak / degradation check)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace("--", "").split("=");
  acc[k] = v || true;
  return acc;
}, {});

const SCENARIO = args.scenario || "normal";
const USERS    = parseInt(args.users    || "200", 10);
const DURATION = parseInt(args.duration || "30",  10) * 1000;

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

// ── Endpoints to hit under load ───────────────────────────────────────────────
// Mix of public and semi-public endpoints (no auth required = most realistic for 2000 strangers)
const ENDPOINTS = [
  { method: "GET",  path: "/",                          weight: 5  },
  { method: "POST", path: "/api/events/validate-code",  weight: 40, body: { eventCode: "TESTCODE" } },
  { method: "POST", path: "/api/auth/send-otp",         weight: 30, body: { email: "loadtest@example.com" } },
  { method: "GET",  path: "/api/qr/event-form/507f1f77bcf86cd799439011", weight: 25 },
];

function pickEndpoint() {
  const total = ENDPOINTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ep of ENDPOINTS) {
    r -= ep.weight;
    if (r <= 0) return ep;
  }
  return ENDPOINTS[0];
}

// ── Single request ────────────────────────────────────────────────────────────
async function makeRequest(ep) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      headers: { "Content-Type": "application/json" },
      body: ep.body ? JSON.stringify(ep.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    const duration = performance.now() - start;
    return { ok: res.status < 500, status: res.status, duration };
  } catch (err) {
    const duration = performance.now() - start;
    return { ok: false, status: 0, duration, error: err.message };
  }
}

// ── Stats tracker ─────────────────────────────────────────────────────────────
class Stats {
  constructor(name) {
    this.name = name;
    this.total = 0;
    this.success = 0;
    this.clientError = 0;   // 4xx
    this.serverError = 0;   // 5xx
    this.networkError = 0;  // timeout / connection refused
    this.rateLimited = 0;   // 429
    this.latencies = [];
  }

  record(result) {
    this.total++;
    this.latencies.push(result.duration);

    if (result.status === 429)          this.rateLimited++;
    else if (result.status === 0)       this.networkError++;
    else if (result.status >= 500)      this.serverError++;
    else if (result.status >= 400)      this.clientError++;
    else                                this.success++;
  }

  percentile(p) {
    if (!this.latencies.length) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  print() {
    const successRate = this.total ? ((this.success / this.total) * 100).toFixed(1) : "0.0";
    const color = parseFloat(successRate) >= 95 ? GREEN : parseFloat(successRate) >= 80 ? YELLOW : RED;

    console.log(`\n${BOLD}${CYAN}  ── ${this.name} ──${RESET}`);
    console.log(`  Total requests  : ${BOLD}${this.total}${RESET}`);
    console.log(`  Success (2xx/3xx): ${color}${this.success} (${successRate}%)${RESET}`);
    console.log(`  Rate limited 429: ${YELLOW}${this.rateLimited}${RESET}  ← expected under high load`);
    console.log(`  Client errors 4xx: ${this.clientError}`);
    console.log(`  Server errors 5xx: ${RED}${this.serverError}${RESET}  ← MUST be 0`);
    console.log(`  Network errors   : ${RED}${this.networkError}${RESET}`);
    console.log(`  Latency (ms):`);
    console.log(`    min  : ${Math.min(...this.latencies).toFixed(0)}`);
    console.log(`    avg  : ${(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(0)}`);
    console.log(`    p50  : ${this.percentile(50).toFixed(0)}`);
    console.log(`    p95  : ${this.percentile(95).toFixed(0)}`);
    console.log(`    p99  : ${this.percentile(99).toFixed(0)}`);
    console.log(`    max  : ${Math.max(...this.latencies).toFixed(0)}`);
  }

  verdict(scenario) {
    const thresholds = {
      baseline:  { minSuccess: 100, p95: 500  },
      normal:    { minSuccess: 99,  p95: 1000 },
      high:      { minSuccess: 95,  p95: 3000 },
      spike:     { minSuccess: 90,  p95: 5000 },
      sustained: { minSuccess: 95,  p95: 2000 },
    };
    const t = thresholds[scenario] || thresholds.normal;
    const successRate = this.total ? (this.success / this.total) * 100 : 0;
    const p95 = this.percentile(95);
    const noServerErrors = this.serverError === 0;

    const passList = [
      { check: `Success rate ≥ ${t.minSuccess}%`,      pass: successRate >= t.minSuccess },
      { check: `p95 latency ≤ ${t.p95}ms`,             pass: p95 <= t.p95 },
      { check: `Zero 5xx errors`,                       pass: noServerErrors },
    ];

    console.log(`\n  ${BOLD}Pass/Fail Criteria (${scenario}):${RESET}`);
    let allPassed = true;
    for (const { check, pass } of passList) {
      console.log(`    ${pass ? GREEN + "✅" : RED + "❌"} ${check}${RESET}`);
      if (!pass) allPassed = false;
    }

    if (this.rateLimited > 0) {
      console.log(`\n  ${YELLOW}ℹ  ${this.rateLimited} requests were rate-limited (429).${RESET}`);
      console.log(`     This is ${YELLOW}correct behaviour${RESET} — the server is protecting itself.`);
      console.log(`     To reduce 429s, increase RATE_LIMIT_MAX env var or spread requests over time.`);
    }

    if (this.serverError > 0) {
      console.log(`\n  ${RED}⚠  ${this.serverError} server errors (5xx) detected — investigate logs!${RESET}`);
    }

    return allPassed;
  }
}

// ── Virtual user (one concurrent goroutine) ───────────────────────────────────
async function virtualUser(stats, stopSignal) {
  while (!stopSignal.stop) {
    const ep = pickEndpoint();
    const result = await makeRequest(ep);
    stats.record(result);
    // Small think-time between requests (realistic user behaviour)
    await new Promise((r) => setTimeout(r, Math.random() * 200 + 50));
  }
}

// ── Progress indicator ────────────────────────────────────────────────────────
function startProgress(durationMs) {
  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
    const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r  [${CYAN}${bar}${RESET}] ${pct}% — ${Math.floor(elapsed / 1000)}s elapsed`);
  }, 500);
  return interval;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

async function runScenario(name, concurrentUsers, durationMs) {
  const stats = new Stats(name);
  const stop  = { stop: false };

  console.log(`\n${BOLD}${CYAN}▶ Scenario: ${name}${RESET}`);
  console.log(`  Concurrent users : ${BOLD}${concurrentUsers}${RESET}`);
  console.log(`  Duration         : ${BOLD}${durationMs / 1000}s${RESET}`);
  console.log(`  Target           : ${BOLD}${BASE_URL}${RESET}`);
  console.log(`  Starting...\n`);

  const progressTimer = startProgress(durationMs);

  // Spawn virtual users in batches (avoid blocking the event loop)
  const BATCH = 50;
  const userPromises = [];
  for (let i = 0; i < concurrentUsers; i++) {
    if (i > 0 && i % BATCH === 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
    userPromises.push(virtualUser(stats, stop));
  }

  // Run for the specified duration
  await new Promise((r) => setTimeout(r, durationMs));
  stop.stop = true;

  clearInterval(progressTimer);
  process.stdout.write("\n");

  // Wait for in-flight requests to finish (up to 10s)
  await Promise.race([
    Promise.allSettled(userPromises),
    new Promise((r) => setTimeout(r, 10_000)),
  ]);

  stats.print();
  return stats.verdict(name);
}

async function runSpikeScenario() {
  console.log(`\n${BOLD}${CYAN}▶ Scenario: spike${RESET}`);
  console.log(`  Pattern: 0 → 2000 users in 5s, hold 10s, drop to 0`);

  const stats = new Stats("spike");
  const stop  = { stop: false };
  const allUsers = [];

  // Ramp up: spawn 2000 users over 5 seconds
  for (let i = 0; i < 2000; i++) {
    await new Promise((r) => setTimeout(r, 2.5));
    allUsers.push(virtualUser(stats, stop));
  }

  console.log(`  Peak reached — holding for 10s...`);
  await new Promise((r) => setTimeout(r, 10_000));

  stop.stop = true;
  await Promise.race([
    Promise.allSettled(allUsers),
    new Promise((r) => setTimeout(r, 10_000)),
  ]);

  stats.print();
  return stats.verdict("spike");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  FAM Backend — Load Test${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════${RESET}`);
  console.log(`  Note: 429 responses are EXPECTED under high load.`);
  console.log(`  Only 5xx errors indicate real problems.\n`);

  const results = {};

  if (SCENARIO === "all") {
    results.baseline  = await runScenario("baseline",  10,   10_000);
    results.normal    = await runScenario("normal",    200,  30_000);
    results.high      = await runScenario("high",      2000, 60_000);
    results.spike     = await runSpikeScenario();
    results.sustained = await runScenario("sustained", 500, 300_000);
  } else if (SCENARIO === "baseline")  {
    results.baseline = await runScenario("baseline", 10, 10_000);
  } else if (SCENARIO === "high") {
    results.high = await runScenario("high", USERS, DURATION);
  } else if (SCENARIO === "spike") {
    results.spike = await runSpikeScenario();
  } else if (SCENARIO === "sustained") {
    results.sustained = await runScenario("sustained", 500, 300_000);
  } else {
    // default: normal
    results.normal = await runScenario("normal", USERS, DURATION);
  }

  // Final summary
  console.log(`\n${BOLD}${"═".repeat(47)}${RESET}`);
  console.log(`${BOLD}  Load Test Summary${RESET}`);
  console.log(`${"═".repeat(47)}`);
  let allPassed = true;
  for (const [name, passed] of Object.entries(results)) {
    const icon = passed ? `${GREEN}✅ PASS${RESET}` : `${RED}❌ FAIL${RESET}`;
    console.log(`  ${icon}  ${name}`);
    if (!passed) allPassed = false;
  }

  console.log(`\n${allPassed ? GREEN + "Load tests passed! ✅" : RED + "Load tests failed ❌"}${RESET}\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(1);
});
