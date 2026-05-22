# FAM Platform — Complete Workflow Guide

**FAM** (Family & Ancestry Mapping) is an event-based family tree platform. Each event is an isolated space where a group of people (a family, wedding guests, etc.) can map their relationships to each other and explore the family tree.

---

## System Roles

| Role | How Created | What They Do |
|------|-------------|-------------|
| **Admin** | Seeded via `node adminSeed.js` | Creates events + organizers, manages all users, reviews reports |
| **Organizer** | Created by admin when an event is created | Manages one assigned event, approves members, validates relationships |
| **User** | Self-registers via OTP | Joins events, builds family tree, views tree |

---

## Step 1 — Admin Sets Up the Platform

```
node adminSeed.js
```
This creates the first admin account. Admin logs in at `POST /api/admin/login`.

---

## Step 2 — Admin Creates an Event

`POST /api/admin/events`

When admin creates an event:
1. A unique `eventCode` (e.g. `SHAR-1042`) is auto-generated.
2. A QR code is generated and uploaded to Cloudinary. The URL is stored on the event.
3. An **Organizer** account is automatically created with:
   - A temporary password
   - Assigned to the new event
   - A validity date (`validTill`)
4. The organizer's login credentials are emailed to `organizerEmail`.

Admin also sets:
- `treeType`: `"common"` (single family tree) | `"wedding"` / `"anniversary"` (groom + bride split)
- `approvalMode`: `"auto"` (users join instantly) | `"manual"` (organizer must approve each person)
- `treeVisibility`: `"participants"` | `"organizer_only"` | `"admin_only"`

---

## Step 3 — Organizer Logs In

`POST /api/organizer/login`  
Credentials come from the email sent in Step 2.

The organizer can:
- View the assigned event and all participants
- Set or change `approvalMode`
- Manually add users to the event
- Manage the event schedule

---

## Step 4 — Users Join the Event

There are **two paths** to join:

### Path A — QR Code Scan
1. Admin/Organizer shares the printed QR code at the physical event.
2. User scans with phone → lands on `GET /api/qr/event-form/:eventId` (public page).
3. User fills in the form: name, email, DOB, **profile photo** (required).
4. `POST /api/qr/join-from-qr` → photo uploads to Cloudinary, user record created/updated.

### Path B — Event Code Entry
1. User navigates to the join page on the web app.
2. Enters the `eventCode` → `POST /api/events/validate-code` confirms the event is active.
3. Submits name, email, DOB → `POST /api/events/join`.

### After Joining:
| `approvalMode` | Result |
|----------------|--------|
| `"auto"` | User is immediately added to `event.participants`. Gets a welcome notification. |
| `"manual"` | User is added to `event.pendingApprovals`. Organizer gets a notification. |

---

## Step 5 — Organizer Reviews Join Requests (Manual Mode Only)

`GET /api/organizer/pending-approvals`  
Returns list of users waiting.

`PATCH /api/organizer/approve/:userId`  
- Moves user from `pendingApprovals` → `participants`
- User receives an approval notification

`PATCH /api/organizer/reject/:userId`  
- Removes from `pendingApprovals`
- User receives a rejection notification

---

## Step 6 — Users Log In (Returning)

Users have no passwords. Every login is OTP-based:

1. `POST /api/auth/send-otp` → OTP emailed (valid 5 min)
2. `POST /api/auth/verify-otp` → Returns `token` (7d) + `refreshToken` (30d)
3. Token is included as `Authorization: Bearer <token>` on all subsequent requests
4. When token expires, use `POST /api/auth/refresh-token` to get a new one

---

## Step 7 — Tree Setup (Organizer/Admin)

Before users can add relationships, the **main person(s)** must be configured:

**For `treeType: "common"` events:**
```
POST /api/tree/set-main-person
{ "eventId": "...", "userId": "..." }
```

**For `treeType: "wedding"` or `"anniversary"` events:**
```
POST /api/tree/set-wedding-couple
{ "eventId": "...", "groomId": "...", "brideId": "..." }
```
This also auto-creates a `"spouse"` relationship between groom and bride.

---

## Step 8 — Users Build the Family Tree

Any approved participant can submit relationships:

`POST /api/tree/add-relation`
```json
{
  "eventId": "...",
  "person1Id": "<my userId>",
  "person2Id": "<their userId>",
  "relationType": "parent",
  "familySide": "groom"
}
```

**Before saving, the system validates:**
- Duplicate check: same pair + same relationType doesn't exist
- Circular relation check: adding "parent A → B" when B is already an ancestor of A (BFS traversal)
- Age validation: parent must be ≥12 years older than child
- Limit check: regular users can add at most **4 relationships** total

**Validation flag:**
- User-submitted relationships → `isValidated: false` (visible in tree only after organizer approves)
- Organizer/admin submissions → `isValidated: true` immediately

---

## Step 9 — Organizer Validates Relationships

`GET /api/organizer/unvalidated-relationships`  
Returns all pending submissions for the assigned event.

`PATCH /api/organizer/validate-relationship/:id`  
`{ "isValidated": true }` → Relationship appears in the live tree  
`{ "isValidated": false }` → Keeps it hidden/rejected

---

## Step 10 — Viewing the Family Tree

`GET /api/tree/generate/:eventId`

Access control based on `treeVisibility`:
- `"participants"` → user must be in `event.participants`
- `"organizer_only"` → only organizer or admin
- `"admin_only"` → only admin

**What the response contains:**
- `nodes`: array of user objects (name, photo, DOB, gender, isDeceased)
- `edges`: array of `{ from, to, relation }` directed connections
- `mermaidCode`: ready-to-render Mermaid.js flowchart string
- A snapshot is auto-saved to `TreeHistory` each time

**For wedding events**, pass `?familySide=groom` or `?familySide=bride` to view each side separately.

---

## Step 11 — Relationship Discovery

`GET /api/tree/path/:eventId?fromUserId=<id>&toUserId=<id>`

This runs a BFS traversal across all validated relationships in the event.

**Example result:**
```json
{
  "found": true,
  "length": 3,
  "path": [
    { "userId": "...", "relation": "parent" },
    { "userId": "...", "relation": "sibling" },
    { "userId": "...", "relation": "child" }
  ]
}
```
Useful for the UI feature: *"How are Priya and Rahul related?"*

---

## Step 12 — Participant Discovery

`GET /api/events/:eventId/participants?search=sharma&page=1&limit=20`

Lets approved participants search for other members of the event. Useful for:
- Selecting person1 / person2 when adding a relationship
- Displaying a member directory for the event

---

## Step 13 — Reporting Abuse

Any participant can report a user or relationship:

`POST /api/reports`
```json
{
  "eventId": "...",
  "reportedUser": "<userId>",
  "reason": "fake_relationship",
  "description": "This person claims to be my uncle but is not."
}
```

**Admin review flow:**
1. `GET /api/admin/reports?status=pending` — see new reports
2. `PATCH /api/admin/reports/:id/review` with `{ "status": "actioned", "reviewNote": "..." }`
3. Status options: `"reviewed"` → acknowledged | `"dismissed"` → not valid | `"actioned"` → action taken (e.g. user blocked)

---

## Step 14 — Notifications

Notifications are delivered in **three ways simultaneously:**
1. **Persisted** in MongoDB (user can fetch history)
2. **Real-time** via Socket.IO (`user_<id>` room)
3. **Email** (for critical events like approvals)

**Notification triggers:**
| Trigger | Who Gets It |
|---------|-------------|
| Join request submitted (manual mode) | Organizer |
| Join approved/rejected | User |
| Added to event by organizer | User |
| Birthday of a family member | Connected users |
| Anniversary reminder | Relevant users |
| Event date approaching | All participants |

**Cron schedule:**
- Daily at midnight: birthday/anniversary checks, organizer validity check
- Monthly: log archival (purge logs older than 30 days)

---

## Step 15 — Admin Ongoing Management

| Task | Endpoint |
|------|----------|
| Change approval mode | `PATCH /api/admin/events/:id/approval-mode` |
| Change tree visibility | `PATCH /api/admin/events/:id/tree-visibility` |
| Block a user | `PATCH /api/admin/users/:id/block` |
| Deactivate organizer | `DELETE /api/admin/organizers/:id` |
| View all audit logs | `GET /api/admin/logs` |
| View dashboard stats | `GET /api/admin/dashboard/stats` |

---

## World Tree (Premium Feature)

A personal tree separate from any event. Payment gateway is not yet implemented.

1. User completes payment (external flow, not yet built)
2. `POST /api/world-tree/activate` with `paymentId`
3. `POST /api/world-tree/add-data` to add nodes/edges
4. `GET /api/world-tree/my-tree` to view

Valid for 1 year from activation.

---

## Data Flow Summary

```
Admin
  └── Creates Event + Organizer
        ├── QR Code → Cloudinary
        └── Organizer Credentials → Email

Organizer
  ├── Manages join approvals
  ├── Sets event schedule
  └── Validates relationships submitted by users

User
  ├── Scans QR / enters event code → Joins event
  ├── Logs in via OTP (no password)
  ├── Submits relationships (isValidated = false)
  ├── Views validated tree
  ├── Discovers how two people are related
  └── Reports suspicious content

Tree Engine
  ├── Validates (duplicate, circular, age)
  ├── Generates nodes + edges + Mermaid code
  └── Saves snapshot to TreeHistory on each generation

Notifications
  ├── Socket.IO → real-time browser push
  ├── MongoDB → persistent history
  └── Email → critical alerts (approvals, OTP)
```

---

## Security Layers

1. **Helmet** — HTTP security headers
2. **CORS** — configured via `CLIENT_URL` env var
3. **Rate limiting** — 100 req/min global, 5/15min on login
4. **JWT verification** — every protected route; dispatches to correct model by `role` claim
5. **Role middleware** — `isAdmin`, `isOrganizer`, `isAdminOrOrganizer` on sensitive routes
6. **Block check** — blocked users are rejected at the `verifyToken` step (full DB lookup)
7. **Input sanitization** — inline `sanitizeInput` helper (Helmet replaces xss-clean which is incompatible with Express 5)
8. **Organizer validity** — expired organizers are auto-deactivated by nightly cron
