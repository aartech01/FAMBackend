/**
 * FAM API Integration Test Runner
 * Usage:
 *   node tests/run-tests.js                          (tests localhost:8000)
 *   BASE_URL=https://web-production-bf889.up.railway.app node tests/run-tests.js
 *   SKIP_SLOW=1 node tests/run-tests.js              (skip rate limit tests)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const SKIP_SLOW = process.env.SKIP_SLOW === "1";
const ADMIN_NAME = process.env.ADMIN_NAME || "adminFAM";
const ADMIN_PASS = process.env.ADMIN_PASS || "adminPass@4569";

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`${GREEN}✅ PASS${RESET} ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`${RED}❌ FAIL${RESET} ${name}\n`);
    process.stdout.write(`       ${RED}→ ${err.message}${RESET}\n`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function skip(name, reason) {
  process.stdout.write(`${YELLOW}⏭  SKIP${RESET} ${name} — ${reason}\n`);
  skipped++;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertRange(actual, min, max, label) {
  if (actual < min || actual > max) {
    throw new Error(`${label}: ${actual} not in [${min}, ${max}]`);
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function request(method, path, { body, token, expectStatus, raw } = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (expectStatus !== undefined && res.status !== expectStatus) {
    let text = "";
    try { text = await res.text(); } catch {}
    throw new Error(`Expected HTTP ${expectStatus}, got ${res.status}. Body: ${text.slice(0, 200)}`);
  }

  if (raw) return res;
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ── Shared state (populated by auth tests) ────────────────────────────────────
let adminToken = null;
let organizerToken = null;
let userToken = null;
let createdEventId = null;
let createdOrganizerId = null;
let testEventCode = null;

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Health
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteHealth() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Health Check${RESET}`);

  await test("H-01 Server responds (not a crash)", async () => {
    const res = await request("GET", "/", { raw: true });
    assert(res.status < 500, `Got 5xx: ${res.status}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Admin Authentication
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteAdminAuth() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Admin Authentication${RESET}`);

  await test("AD-01 Admin login — valid credentials", async () => {
    const data = await request("POST", "/api/admin/login", {
      body: { name: ADMIN_NAME, password: ADMIN_PASS },
      expectStatus: 200,
    });
    assert(data.success === true, `success not true: ${JSON.stringify(data)}`);
    assert(data.token, "No token returned");
    adminToken = data.token;
  });

  await test("AD-02 Admin login — wrong password", async () => {
    const data = await request("POST", "/api/admin/login", {
      body: { name: ADMIN_NAME, password: "wrongpassword" },
      expectStatus: 401,
    });
    assert(data.success === false, "Should return success: false");
  });

  await test("AD-03 Admin login — missing fields", async () => {
    const res = await request("POST", "/api/admin/login", { body: {}, raw: true });
    assertRange(res.status, 400, 422, "Status for missing fields");
  });

  await test("AD-04 Admin profile — valid token", async () => {
    assert(adminToken, "No admin token available — AD-01 must pass first");
    const data = await request("GET", "/api/admin/profile", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true, "Profile request failed");
  });

  await test("AD-05 Admin profile — no token → 401", async () => {
    await request("GET", "/api/admin/profile", { expectStatus: 401 });
  });

  await test("AD-06 Admin profile — fake token → 401", async () => {
    await request("GET", "/api/admin/profile", {
      token: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImZha2UiLCJyb2xlIjoiYWRtaW4ifQ.invalidsig",
      expectStatus: 401,
    });
  });

  await test("AD-07 Dashboard stats", async () => {
    assert(adminToken, "No admin token");
    const data = await request("GET", "/api/admin/dashboard/stats", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true, "Stats request failed");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Admin Event Management
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteAdminEvents() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Admin — Event Management${RESET}`);

  if (!adminToken) {
    skip("AE-*", "Admin token not available — admin auth suite failed");
    return;
  }

  await test("AE-01 Create event", async () => {
    const data = await request("POST", "/api/admin/events", {
      token: adminToken,
      body: {
        title: "TEST_EVENT_" + Date.now(),
        organizerEmail: `organizer_${Date.now()}@test.com`,
        eventDate: "2026-12-25",
        approvalMode: "auto",
        treeType: "common",
      },
      expectStatus: 201,
    });
    assert(data.success === true || data.event, `Event creation failed: ${JSON.stringify(data)}`);
    createdEventId = data.event?._id || data.data?.event?._id || data._id;
    testEventCode = data.event?.eventCode || data.data?.event?.eventCode || data.eventCode;
    if (data.organizer || data.data?.organizer) {
      createdOrganizerId = (data.organizer || data.data?.organizer)?._id;
    }
  });

  await test("AE-02 Create event — missing title → 400", async () => {
    const res = await request("POST", "/api/admin/events", {
      token: adminToken,
      body: { organizerEmail: "test@test.com", eventDate: "2026-12-25" },
      raw: true,
    });
    assertRange(res.status, 400, 422, "Status for missing title");
  });

  await test("AE-03 List all events", async () => {
    const data = await request("GET", "/api/admin/events", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(Array.isArray(data.events || data.data || data) || data.success, "Should return events array");
  });

  await test("AE-04 Events summary with user counts", async () => {
    const data = await request("GET", "/api/admin/events/summary", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true || Array.isArray(data.data || data.events || data), "Summary failed");
  });

  await test("AE-05 Get event by ID", async () => {
    if (!createdEventId) throw new Error("No event ID from AE-01");
    const data = await request("GET", `/api/admin/events/id/${createdEventId}`, {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true || data.event || data._id, "Event not found");
  });

  await test("AE-06 Update event approval mode", async () => {
    if (!createdEventId) throw new Error("No event ID from AE-01");
    const data = await request("PATCH", `/api/admin/events/${createdEventId}/approval-mode`, {
      token: adminToken,
      body: { approvalMode: "manual" },
      expectStatus: 200,
    });
    assert(data.success === true, "Approval mode update failed");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Admin User Management
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteAdminUsers() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Admin — User Management${RESET}`);

  if (!adminToken) {
    skip("AU-*", "Admin token not available");
    return;
  }

  await test("AU-01 List all users", async () => {
    const data = await request("GET", "/api/admin/users", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true || Array.isArray(data.users || data.data || data), "Should return users");
  });

  await test("AU-02 Get blocked users", async () => {
    const data = await request("GET", "/api/admin/users/blocked", {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true || Array.isArray(data.users || data.data || data), "Should return blocked users list");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — Organizer Auth
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteOrganizerAuth() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Organizer Authentication${RESET}`);

  await test("O-01 Organizer login — wrong password → 401", async () => {
    const data = await request("POST", "/api/organizer/login", {
      body: { email: "nonexistent@test.com", password: "wrongpass" },
      expectStatus: 401,
    });
    assert(data.success === false, "Should fail with success: false");
  });

  await test("O-02 Organizer route without token → 401", async () => {
    await request("GET", "/api/organizer/profile", { expectStatus: 401 });
  });

  await test("O-03 Organizer route with admin token → 403", async () => {
    if (!adminToken) throw new Error("No admin token");
    await request("GET", "/api/organizer/profile", {
      token: adminToken,
      expectStatus: 403,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — User Auth (OTP flow, partial — can't trigger real email)
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteUserAuth() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: User — OTP Auth Flow${RESET}`);

  await test("A-03 Send OTP — missing email → 400", async () => {
    const res = await request("POST", "/api/auth/send-otp", { body: {}, raw: true });
    assertRange(res.status, 400, 422, "Missing email");
  });

  await test("A-04 Send OTP — invalid email format → 400", async () => {
    const res = await request("POST", "/api/auth/send-otp", {
      body: { email: "notanemail" },
      raw: true,
    });
    assertRange(res.status, 400, 422, "Invalid email format");
  });

  await test("A-05 Verify OTP — wrong code → 400", async () => {
    const data = await request("POST", "/api/auth/verify-otp", {
      body: { email: "noexist_test_user@example.com", otp: "000000" },
      expectStatus: 400,
    });
    assert(data.success === false, "Wrong OTP should fail");
  });

  await test("A-11 Refresh token — invalid token → 401", async () => {
    await request("POST", "/api/auth/refresh-token", {
      body: { refreshToken: "totallyinvalidtoken" },
      expectStatus: 401,
    });
  });

  await test("A-13 Logout — no token → 401", async () => {
    await request("POST", "/api/auth/logout", { expectStatus: 401 });
  });

  await test("A-15 Get auth profile — no token → 401", async () => {
    await request("GET", "/api/auth/profile", { expectStatus: 401 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7 — Events (Public)
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteEvents() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Events${RESET}`);

  await test("E-02 Validate event code — invalid → 404", async () => {
    const res = await request("POST", "/api/events/validate-code", {
      body: { eventCode: "XXXXXX_NOTREAL" },
      raw: true,
    });
    assert(res.status === 404 || res.status === 400, `Expected 404/400, got ${res.status}`);
  });

  await test("E-03 Validate event code — missing code → 400", async () => {
    const res = await request("POST", "/api/events/validate-code", { body: {}, raw: true });
    assertRange(res.status, 400, 422, "Missing eventCode");
  });

  if (testEventCode) {
    await test("E-01 Validate event code — real code → 200", async () => {
      const data = await request("POST", "/api/events/validate-code", {
        body: { eventCode: testEventCode },
        expectStatus: 200,
      });
      assert(data.success === true || data.event || data.title, "Event not found");
    });
  } else {
    skip("E-01", "No event code available (AE-01 must pass first)");
  }

  await test("E-06 List events — no token → 401", async () => {
    await request("GET", "/api/events", { expectStatus: 401 });
  });

  await test("E-07 Get event by ID — no token → 401", async () => {
    await request("GET", "/api/events/507f1f77bcf86cd799439011", { expectStatus: 401 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8 — QR Join (Public)
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteQR() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: QR Join (Public)${RESET}`);

  await test("Q-02 QR event form — invalid eventId → 404 or 400", async () => {
    const res = await request("GET", "/api/qr/event-form/notanid", { raw: true });
    assert(res.status === 404 || res.status === 400, `Expected 404/400, got ${res.status}`);
  });

  await test("Q-04 QR join — missing email → 400", async () => {
    const res = await request("POST", "/api/qr/join-from-qr", {
      body: { eventId: "507f1f77bcf86cd799439011", name: "Test User" },
      raw: true,
    });
    assertRange(res.status, 400, 422, "Missing email");
  });

  await test("Q-05 QR join — missing name → 400", async () => {
    const res = await request("POST", "/api/qr/join-from-qr", {
      body: { eventId: "507f1f77bcf86cd799439011", email: "test@example.com" },
      raw: true,
    });
    assertRange(res.status, 400, 422, "Missing name");
  });

  if (createdEventId) {
    await test("Q-01 QR event form — valid eventId → form fields", async () => {
      const data = await request("GET", `/api/qr/event-form/${createdEventId}`, {
        expectStatus: 200,
      });
      assert(data.success === true || Array.isArray(data.fields || data.data || data), "No form fields returned");
    });
  } else {
    skip("Q-01", "No event ID from AE-01");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9 — Family Tree
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteTree() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Family Tree${RESET}`);

  await test("T-01 Generate tree — no token → 401", async () => {
    await request("GET", "/api/tree/generate/507f1f77bcf86cd799439011", { expectStatus: 401 });
  });

  await test("T-03 Add relation — no token → 401", async () => {
    await request("POST", "/api/tree/add-relation", {
      body: { eventId: "507f1f77bcf86cd799439011", relatedUserId: "abc", relationshipType: "parent" },
      expectStatus: 401,
    });
  });

  await test("T-08 Remove relation — no token → 401", async () => {
    await request("DELETE", "/api/tree/remove-relation/507f1f77bcf86cd799439011", { expectStatus: 401 });
  });

  if (adminToken && createdEventId) {
    await test("T-01 Generate tree — admin token + real event", async () => {
      const data = await request("GET", `/api/tree/generate/${createdEventId}`, {
        token: adminToken,
        expectStatus: 200,
      });
      assert(data.success === true || data.nodes !== undefined, `Tree generation failed: ${JSON.stringify(data)}`);
    });

    await test("T-10 Tree history — admin token + real event", async () => {
      const data = await request("GET", `/api/tree/history/${createdEventId}`, {
        token: adminToken,
        expectStatus: 200,
      });
      assert(data.success === true || Array.isArray(data.history || data.data || data), "History not returned");
    });
  } else {
    skip("T-01 (live)", "Need admin token + event ID");
    skip("T-10 (live)", "Need admin token + event ID");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 10 — Security
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteSecurity() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Security${RESET}`);

  await test("S-01 No auth header on /api/user/profile → 401", async () => {
    await request("GET", "/api/user/profile", { expectStatus: 401 });
  });

  await test("S-02 Tampered JWT on admin route → 401", async () => {
    await request("GET", "/api/admin/profile", {
      token: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImhhY2tlciIsInJvbGUiOiJhZG1pbiJ9.badsignature",
      expectStatus: 401,
    });
  });

  await test("S-04 User token on admin route → 403 or 401", async () => {
    // Use a well-formed but wrong-role token (or we test that admin route rejects non-admin tokens)
    // We'll use the admin token to verify admin works, then simulate user token attempt
    const res = await request("GET", "/api/admin/users", {
      token: "Bearer_not_valid_user_token",
      raw: true,
    });
    assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
  });

  await test("S-07 NoSQL injection in email field", async () => {
    const res = await request("POST", "/api/auth/send-otp", {
      body: { email: { "$gt": "" } },
      raw: true,
    });
    // Should NOT return 200 with success (injection worked) — should sanitize or reject
    assert(res.status !== 200, `NoSQL injection was not blocked (got 200)`);
  });

  await test("S-09 Extremely long input does not crash server", async () => {
    const longString = "a".repeat(5000);
    const res = await request("POST", "/api/auth/send-otp", {
      body: { email: longString + "@test.com" },
      raw: true,
    });
    assert(res.status < 500, `Server crashed with long input: ${res.status}`);
  });

  await test("S-10 XSS payload in username does not execute", async () => {
    // We just verify the server doesn't 500 on XSS input
    const res = await request("POST", "/api/auth/send-otp", {
      body: { email: "<script>alert(1)</script>@test.com" },
      raw: true,
    });
    assert(res.status < 500, `Server crashed on XSS input: ${res.status}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 11 — Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteRateLimiting() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Rate Limiting${RESET}`);

  if (SKIP_SLOW) {
    skip("R-01", "SKIP_SLOW=1");
    skip("R-02", "SKIP_SLOW=1");
    return;
  }

  await test("R-01 Login rate limit kicks in after 5 attempts (15min window)", async () => {
    const promises = Array.from({ length: 7 }, () =>
      request("POST", "/api/admin/login", {
        body: { name: "fakeadmin", password: "fakepass" },
        raw: true,
      })
    );
    const responses = await Promise.all(promises);
    const statusCodes = responses.map((r) => r.status);
    const has429 = statusCodes.some((s) => s === 429);
    assert(has429, `Expected 429 after 5 failed logins. Got: ${statusCodes.join(", ")}`);
  });

  await test("R-04 RateLimit headers present on login route", async () => {
    const res = await request("POST", "/api/admin/login", {
      body: { name: "test", password: "test" },
      raw: true,
    });
    const hasLimit = res.headers.get("ratelimit-limit") || res.headers.get("x-ratelimit-limit");
    assert(hasLimit, "No RateLimit headers found in response");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 12 — Cleanup
// ═══════════════════════════════════════════════════════════════════════════════
async function suiteCleanup() {
  console.log(`\n${BOLD}${CYAN}▶ SUITE: Cleanup (delete test data)${RESET}`);

  if (!adminToken || !createdEventId) {
    skip("Cleanup", "No test data to clean up");
    return;
  }

  await test("Cleanup — delete test event", async () => {
    const data = await request("DELETE", `/api/admin/events/${createdEventId}`, {
      token: adminToken,
      expectStatus: 200,
    });
    assert(data.success === true, "Delete failed");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  FAM API Integration Test Suite${RESET}`);
  console.log(`${BOLD}${CYAN}  Target: ${BASE_URL}${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════${RESET}`);

  const startTime = Date.now();

  await suiteHealth();
  await suiteAdminAuth();
  await suiteAdminEvents();
  await suiteAdminUsers();
  await suiteOrganizerAuth();
  await suiteUserAuth();
  await suiteEvents();
  await suiteQR();
  await suiteTree();
  await suiteSecurity();
  await suiteRateLimiting();
  await suiteCleanup();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${BOLD}${"─".repeat(45)}${RESET}`);
  console.log(`${BOLD}  Results  (${duration}s)${RESET}`);
  console.log(`${"─".repeat(45)}`);
  console.log(`  ${GREEN}Passed : ${passed}${RESET}`);
  console.log(`  ${RED}Failed : ${failed}${RESET}`);
  console.log(`  ${YELLOW}Skipped: ${skipped}${RESET}`);
  console.log(`  Total  : ${passed + failed + skipped}`);

  if (failures.length > 0) {
    console.log(`\n${RED}${BOLD}Failed tests:${RESET}`);
    failures.forEach((f) => {
      console.log(`  ${RED}✗ ${f.name}${RESET}`);
      console.log(`    ${f.error}`);
    });
  }

  const exitCode = failed > 0 ? 1 : 0;
  console.log(`\n${exitCode === 0 ? GREEN + "All tests passed! ✅" : RED + "Some tests failed ❌"}${RESET}\n`);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${err.message}${RESET}`);
  process.exit(1);
});
