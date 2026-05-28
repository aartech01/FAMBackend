# FAM Backend — Master Test Plan

> Run integration tests: `node tests/run-tests.js`  
> Run load tests: `node tests/load-test.js`  
> Set target URL: `BASE_URL=https://web-production-bf889.up.railway.app node tests/run-tests.js`

---

## Test Environment Setup

| Item | Local | Production |
|------|-------|------------|
| BASE_URL | `http://localhost:8000` | `https://web-production-bf889.up.railway.app` |
| Admin Name | `adminFAM` | `adminFAM` |
| Admin Password | `adminPass@4569` | `adminPass@4569` |
| OTP Testing | Works (Gmail SMTP) | Works (Resend) |

---

## 1. Health Check

| ID | Test Case | Method | Endpoint | Expected |
|----|-----------|--------|----------|----------|
| H-01 | Server is running | GET | `/` | 200 or 404 (not 500) |
| H-02 | Health endpoint | GET | `/api/health` | 200 `{ success: true }` |

---

## 2. Authentication — User OTP Flow

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| A-01 | Send OTP to new user | POST | `/api/auth/send-otp` | `{ email: "test@example.com" }` | 200 `{ success: true, isNewUser: true }` |
| A-02 | Send OTP to existing user | POST | `/api/auth/send-otp` | `{ email: "existing@example.com" }` | 200 `{ success: true, isNewUser: false }` |
| A-03 | Send OTP with missing email | POST | `/api/auth/send-otp` | `{}` | 400 `{ success: false }` |
| A-04 | Send OTP with invalid email format | POST | `/api/auth/send-otp` | `{ email: "notanemail" }` | 400 `{ success: false }` |
| A-05 | Verify OTP — wrong code | POST | `/api/auth/verify-otp` | `{ email, otp: "000000" }` | 400 `{ success: false, message: "Invalid or expired OTP" }` |
| A-06 | Verify OTP — expired OTP | POST | `/api/auth/verify-otp` | 6+ min old OTP | 400 expired error |
| A-07 | Verify OTP — new user without username | POST | `/api/auth/verify-otp` | `{ email, otp }` (isNewUser, no username) | 400 "username required" |
| A-08 | Verify OTP — new user with all fields | POST | `/api/auth/verify-otp` | `{ email, otp, username, dob }` | 200 `{ token, refreshToken, user }` |
| A-09 | Verify OTP — existing user | POST | `/api/auth/verify-otp` | `{ email, otp }` | 200 `{ token, refreshToken, user }` |
| A-10 | Refresh token — valid | POST | `/api/auth/refresh-token` | `{ refreshToken: "<valid>" }` | 200 `{ token }` |
| A-11 | Refresh token — invalid/expired | POST | `/api/auth/refresh-token` | `{ refreshToken: "bad" }` | 401 |
| A-12 | Logout — with valid token | POST | `/api/auth/logout` | Bearer token | 200 |
| A-13 | Logout — no token | POST | `/api/auth/logout` | No auth header | 401 |
| A-14 | Get profile — authenticated | GET | `/api/auth/profile` | Bearer token | 200 user object |
| A-15 | Get profile — no token | GET | `/api/auth/profile` | None | 401 |

---

## 3. Admin Authentication

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| AD-01 | Admin login — valid credentials | POST | `/api/admin/login` | `{ name: "adminFAM", password: "adminPass@4569" }` | 200 `{ token, refreshToken, admin }` |
| AD-02 | Admin login — wrong password | POST | `/api/admin/login` | `{ name: "adminFAM", password: "wrong" }` | 401 |
| AD-03 | Admin login — wrong name | POST | `/api/admin/login` | `{ name: "badname", password: "pass" }` | 401 |
| AD-04 | Admin login — missing fields | POST | `/api/admin/login` | `{}` | 400 |
| AD-05 | Admin profile — valid token | GET | `/api/admin/profile` | Admin bearer token | 200 |
| AD-06 | Admin profile — user token | GET | `/api/admin/profile` | User bearer token | 403 "Forbidden" |
| AD-07 | Admin profile — no token | GET | `/api/admin/profile` | None | 401 |
| AD-08 | Admin logout | POST | `/api/admin/logout` | Admin bearer token | 200 |
| AD-09 | Dashboard stats | GET | `/api/admin/dashboard/stats` | Admin token | 200 `{ totalUsers, totalEvents, totalOrganizers }` |

---

## 4. Admin — Event Management

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| AE-01 | Create event — all fields | POST | `/api/admin/events` | `{ title, organizerEmail, eventDate, approvalMode: "auto" }` | 201 `{ event, organizer }` |
| AE-02 | Create event — missing title | POST | `/api/admin/events` | `{ organizerEmail, eventDate }` | 400 |
| AE-03 | Create event — invalid date | POST | `/api/admin/events` | `{ title, organizerEmail, eventDate: "not-a-date" }` | 400 |
| AE-04 | List all events | GET | `/api/admin/events` | Admin token | 200 array |
| AE-05 | Get event by ID | GET | `/api/admin/events/id/:id` | Valid event ID | 200 event object |
| AE-06 | Get event by code | GET | `/api/admin/events/code/:code` | Valid event code | 200 event object |
| AE-07 | Update event | PATCH | `/api/admin/events/:id` | `{ title: "Updated" }` | 200 updated event |
| AE-08 | Delete event | DELETE | `/api/admin/events/:id` | Admin token | 200 |
| AE-09 | Set approval mode to manual | PATCH | `/api/admin/events/:id/approval-mode` | `{ approvalMode: "manual" }` | 200 |
| AE-10 | Toggle tree visibility | PATCH | `/api/admin/events/:id/tree-visibility` | `{ treeVisible: true }` | 200 |
| AE-11 | Events summary (with user counts) | GET | `/api/admin/events/summary` | Admin token | 200 array with counts |

---

## 5. Admin — User & Organizer Management

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| AU-01 | List all users | GET | `/api/admin/users` | Admin token | 200 array |
| AU-02 | Block a user | PATCH | `/api/admin/users/:id/block` | `{ reason: "Spam" }` | 200 |
| AU-03 | Unblock a user | PATCH | `/api/admin/users/:id/unblock` | Admin token | 200 |
| AU-04 | Get blocked users | GET | `/api/admin/users/blocked` | Admin token | 200 array |
| AU-05 | Create organizer | POST | `/api/admin/organizers` | `{ name, email, eventId }` | 201 |
| AU-06 | List organizers | GET | `/api/admin/organizers` | Admin token | 200 array |
| AU-07 | Update organizer | PATCH | `/api/admin/organizers/:id` | `{ name: "New Name" }` | 200 |
| AU-08 | Remove organizer | DELETE | `/api/admin/organizers/:id` | Admin token | 200 |
| AU-09 | Reactivate organizer | PATCH | `/api/admin/organizers/:id/reactivate` | Admin token | 200 |

---

## 6. Organizer Authentication & Management

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| O-01 | Organizer login — valid | POST | `/api/organizer/login` | `{ email, password }` | 200 `{ token, refreshToken, organizer }` |
| O-02 | Organizer login — wrong password | POST | `/api/organizer/login` | `{ email, password: "wrong" }` | 401 |
| O-03 | Get assigned event | GET | `/api/organizer/assigned-event` | Organizer token | 200 event |
| O-04 | Get participants | GET | `/api/organizer/participants` | Organizer token | 200 array |
| O-05 | Get pending approvals | GET | `/api/organizer/pending-approvals` | Organizer token | 200 array |
| O-06 | Get approval mode | GET | `/api/organizer/event/get-approval-mode` | Organizer token | 200 `{ approvalMode }` |
| O-07 | Approve a user | PATCH | `/api/organizer/approve/:userId` | Organizer token + valid userId | 200 |
| O-08 | Reject a user | PATCH | `/api/organizer/reject/:userId` | Organizer token + valid userId | 200 |
| O-09 | Update approval mode | PATCH | `/api/organizer/event/approval-mode` | `{ approvalMode: "manual" }` | 200 |
| O-10 | Organizer stats | GET | `/api/organizer/stats` | Organizer token | 200 stats object |
| O-11 | Access admin route as organizer | GET | `/api/admin/profile` | Organizer token | 403 |
| O-12 | Update event schedule | PATCH | `/api/organizer/schedule` | `{ schedule: [...] }` | 200 |

---

## 7. Events (User-facing)

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| E-01 | Validate valid event code (public) | POST | `/api/events/validate-code` | `{ eventCode: "VALID" }` | 200 event preview |
| E-02 | Validate invalid event code | POST | `/api/events/validate-code` | `{ eventCode: "XXXXX" }` | 404 |
| E-03 | Validate missing event code | POST | `/api/events/validate-code` | `{}` | 400 |
| E-04 | Join event | POST | `/api/events/join` | User token + `{ eventCode }` | 200 `{ joinStatus: "approved" or "pending_approval" }` |
| E-05 | Join already-joined event | POST | `/api/events/join` | Same event code again | 400 "Already joined" |
| E-06 | List user's events | GET | `/api/events` | User token | 200 array |
| E-07 | Get event by ID | GET | `/api/events/:id` | User token | 200 event |
| E-08 | Get event QR code | GET | `/api/events/:id/qr` | User token | 200 QR data |
| E-09 | Get event participants | GET | `/api/events/:id/participants` | User token | 200 array |

---

## 8. QR Join (Public — No Auth Required)

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| Q-01 | Get event join form | GET | `/api/qr/event-form/:eventId` | Valid event ID | 200 form fields |
| Q-02 | Get form for invalid event | GET | `/api/qr/event-form/badid` | N/A | 404 |
| Q-03 | Submit QR join — all fields | POST | `/api/qr/join-from-qr` | `{ eventId, name, email }` | 200 `{ joinStatus }` |
| Q-04 | Submit QR join — missing email | POST | `/api/qr/join-from-qr` | `{ eventId, name }` | 400 |
| Q-05 | Submit QR join — missing name | POST | `/api/qr/join-from-qr` | `{ eventId, email }` | 400 |
| Q-06 | Submit QR join — duplicate email | POST | `/api/qr/join-from-qr` | Same email for same event | 400 "Already joined" |

---

## 9. Family Tree

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| T-01 | Generate tree | GET | `/api/tree/generate/:eventId` | User token | 200 `{ nodes, edges, mermaidCode }` |
| T-02 | Generate tree — invalid eventId | GET | `/api/tree/generate/badid` | User token | 404 or 400 |
| T-03 | Add relationship — valid | POST | `/api/tree/add-relation` | `{ eventId, relatedUserId, relationshipType: "parent" }` | 201 |
| T-04 | Add relationship — duplicate | POST | `/api/tree/add-relation` | Same pair again | 400 "Duplicate relationship" |
| T-05 | Add relationship — circular (A→B, B→A as parent) | POST | `/api/tree/add-relation` | Circular pair | 400 "Circular relationship" |
| T-06 | Add relationship — age gap violation | POST | `/api/tree/add-relation` | Parent younger than child | 400 "Age gap" |
| T-07 | Add more than 4 people | POST | `/api/tree/add-relation` | 5th person | 400 "Limit reached" |
| T-08 | Remove relationship (admin/organizer) | DELETE | `/api/tree/remove-relation/:id` | Admin token | 200 |
| T-09 | Remove relationship (regular user) | DELETE | `/api/tree/remove-relation/:id` | User token | 403 |
| T-10 | Tree history | GET | `/api/tree/history/:eventId` | User token | 200 array of snapshots |
| T-11 | Find relationship path | GET | `/api/tree/path/:eventId?fromUserId=X&toUserId=Y` | User token | 200 path array |
| T-12 | Set main person (organizer) | POST | `/api/tree/set-main-person` | `{ eventId, userId }` | 200 |
| T-13 | Set wedding couple | POST | `/api/tree/set-wedding-couple` | `{ eventId, groomId, brideId }` | 200 |

---

## 10. User Profile & Notifications

| ID | Test Case | Method | Endpoint | Input | Expected |
|----|-----------|--------|----------|-------|----------|
| U-01 | Get user profile | GET | `/api/user/profile` | User token | 200 profile |
| U-02 | Update profile — username | PATCH | `/api/user/profile` | `{ username: "NewName" }` | 200 updated profile |
| U-03 | Update profile — dob | PATCH | `/api/user/profile` | `{ dob: "1990-05-15" }` | 200 |
| U-04 | Get other user's profile | GET | `/api/user/profile/:userId` | User token + valid userId | 200 |
| U-05 | Get notifications | GET | `/api/user/notifications` | User token | 200 array |
| U-06 | Update notification prefs | PATCH | `/api/user/notifications/preferences` | `{ email: true, push: false }` | 200 |
| U-07 | Get user history | GET | `/api/user/history` | User token | 200 array |

---

## 11. Security Tests

| ID | Test Case | Method | Expected | Risk |
|----|-----------|--------|----------|------|
| S-01 | No Authorization header on protected route | Any | 401 | Auth bypass |
| S-02 | Malformed JWT (tampered payload) | Any | 401 | Token forgery |
| S-03 | Expired JWT | Any | 401 | Token replay |
| S-04 | User token on admin route | GET /api/admin/profile | 403 | Role escalation |
| S-05 | Organizer token on admin route | GET /api/admin/profile | 403 | Role escalation |
| S-06 | Admin token on organizer route | GET /api/organizer/profile | 403 | Role mix |
| S-07 | SQL/NoSQL injection in email | POST /api/auth/send-otp | 400 or sanitized | Injection |
| S-08 | XSS payload in username | PATCH /api/user/profile | Sanitized, not executed | XSS |
| S-09 | Extremely long email string (2000 chars) | POST /api/auth/send-otp | 400 | DoS |
| S-10 | Admin login brute force (6+ attempts/15min) | POST /api/admin/login | 429 after 5 | Brute force |
| S-11 | OTP brute force (6+ attempts/15min) | POST /api/auth/verify-otp | 429 after 5 | OTP crack |
| S-12 | Access blocked user's resources | Any user route | 403 "Account blocked" | Block bypass |

---

## 12. Rate Limiting Tests

| ID | Test Case | Limit | Expected After Limit |
|----|-----------|-------|---------------------|
| R-01 | Login attempts (any role) | 5/15min | 429 `{ success: false, message: "Too many login attempts..." }` |
| R-02 | Global API rate limit | 200/min | 429 |
| R-03 | Strict operations | 10/hour | 429 |
| R-04 | Rate limit headers present | N/A | `RateLimit-Limit`, `RateLimit-Remaining` in response headers |

---

## 13. Load Tests — Concurrent Users

### 13.1 Baseline (Smoke Test)
- **Users**: 10 concurrent
- **Duration**: 10 seconds
- **Endpoint**: `GET /api/admin/login` with valid creds
- **Pass criteria**: 100% success, p95 < 500ms

### 13.2 Normal Load
- **Users**: 200 concurrent
- **Duration**: 30 seconds
- **Endpoints**: Mixed (health, validate-code, protected routes)
- **Pass criteria**: ≥ 99% success, p95 < 1000ms, p99 < 2000ms

### 13.3 High Load (2000 Users)
- **Users**: 2000 concurrent
- **Duration**: 60 seconds
- **Endpoints**: `POST /api/events/validate-code` (most common unauthenticated path)
- **Pass criteria**: ≥ 95% success, p95 < 3000ms, no 500 errors (429 is OK)
- **Known rate limit**: At 200+ req/min the `apiRateLimiter` returns 429 — this is correct behavior, not a failure

### 13.4 Spike Test (Sudden burst)
- **Pattern**: 0 → 2000 users in 5 seconds, then back to 0
- **Endpoint**: `GET /` 
- **Pass criteria**: Server stays up, no memory crash, recovers within 10s

### 13.5 Sustained Load (Stress)
- **Users**: 500 concurrent
- **Duration**: 5 minutes
- **Pass criteria**: No memory leak (response times don't degrade over time), ≥ 95% success

---

## 14. Database / Mongoose Tests

| ID | Test Case | Expected |
|----|-----------|----------|
| DB-01 | Create User without username (temporary user) | Success — username not required |
| DB-02 | Create User with duplicate email | 409 or 400 duplicate key |
| DB-03 | Find user with OTP fields selected | `otp` and `otpExpiry` hidden by default (select: false) |
| DB-04 | Event indexes exist | `eventCode` index, `isActive` index |
| DB-05 | Notification TTL index | Documents older than 90 days auto-deleted |
| DB-06 | Relationship — unique constraint | Duplicate (userId + relatedUserId + eventId) rejected |

---

## 15. Email Service Tests

| ID | Test Case | Expected |
|----|-----------|----------|
| EM-01 | Test email endpoint (local) | 200 `{ success: true }` when nodemailer configured |
| EM-02 | Test email endpoint (production) | 200 `{ success: true }` when RESEND_API_KEY set |
| EM-03 | Missing RESEND_API_KEY and invalid Gmail creds | `{ success: false, error: "..." }` — does not crash server |
| EM-04 | Test-email diagnostic route | GET `/api/auth/test-email?to=myemail@gmail.com` → email received |

---

## Pass/Fail Summary Template

After running `node tests/run-tests.js`, check:

```
Total:  XX tests
Passed: XX ✅
Failed: XX ❌
Skipped: XX ⏭️

Critical failures (must fix before deploy):
- [ ] Admin login works
- [ ] JWT auth protects routes
- [ ] Rate limiting returns 429
- [ ] No 500 errors on valid requests

Warning (investigate):
- [ ] Load test p95 > 2000ms
- [ ] Any 500 under normal load
```
