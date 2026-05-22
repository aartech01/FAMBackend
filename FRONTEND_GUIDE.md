# FAM Frontend — Developer Guide
**Stack:** React 18 + Vite + TailwindCSS + React Router v6

---

## Project Setup

```bash
npm create vite@latest fam-frontend -- --template react
cd fam-frontend
npm install
npm install axios react-router-dom @tanstack/react-query react-hot-toast socket.io-client
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**tailwind.config.js:**
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Environment Variables

```env
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
```

---

## API Client Setup

**`src/lib/axios.js`**
```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/refresh-token`, { refreshToken });
        localStorage.setItem("token", data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## Auth Context

**`src/context/AuthContext.jsx`**
```jsx
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "user" | "admin" | "organizer"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const storedRole = localStorage.getItem("role");
    if (stored) { setUser(JSON.parse(stored)); setRole(storedRole); }
    setLoading(false);
  }, []);

  const login = (userData, token, refreshToken, userRole) => {
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("role", userRole);
    setUser(userData);
    setRole(userRole);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

## Router Structure

**`src/App.jsx`**
```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Lazy imports for code splitting
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const OrganizerDashboard = lazy(() => import("./pages/organizer/Dashboard"));
const UserDashboard = lazy(() => import("./pages/user/Dashboard"));
const TreeView = lazy(() => import("./pages/tree/TreeView"));
const QRJoinPage = lazy(() => import("./pages/QRJoinPage"));

function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/organizer/login" element={<OrganizerLoginPage />} />
            <Route path="/join" element={<QRJoinPage />} />
            <Route path="/join/:eventId" element={<QRJoinPage />} />

            {/* User routes */}
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["user"]}><UserDashboard /></ProtectedRoute>} />
            <Route path="/tree/:eventId" element={<ProtectedRoute allowedRoles={["user","organizer","admin"]}><TreeView /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin/*" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

            {/* Organizer routes */}
            <Route path="/organizer/*" element={<ProtectedRoute allowedRoles={["organizer"]}><OrganizerDashboard /></ProtectedRoute>} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## Key Pages & Components

### 1. OTP Login Flow (User)

```jsx
// src/pages/auth/LoginPage.jsx
import { useState } from "react";
import api from "../../lib/axios";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [step, setStep] = useState("email"); // "email" | "otp" | "profile"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: "", dob: "", gender: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const sendOtp = async () => {
    try {
      const { data } = await api.post("/api/auth/send-otp", { email });
      setIsNewUser(data.isNewUser);
      setStep("otp");
      toast.success("OTP sent to your email");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    }
  };

  const verifyOtp = async () => {
    try {
      const body = { email, otp };
      if (isNewUser) Object.assign(body, newUserData);
      const { data } = await api.post("/api/auth/verify-otp", body);
      login(data.user, data.token, data.refreshToken, "user");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome to FAM</h1>

        {step === "email" && (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={sendOtp} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
              Send OTP
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            {isNewUser && (
              <>
                <input placeholder="Username" value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  className="w-full border rounded-lg px-4 py-3" />
                <input type="date" value={newUserData.dob}
                  onChange={(e) => setNewUserData({ ...newUserData, dob: e.target.value })}
                  className="w-full border rounded-lg px-4 py-3" />
              </>
            )}
            <input placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest" maxLength={6} />
            <button onClick={verifyOtp} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold">
              Verify & Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 2. QR Join Page

When a user scans a QR code, they land on `/join/:eventId`. Fetch form fields from the API and build the form dynamically.

```jsx
// src/pages/QRJoinPage.jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/axios";
import toast from "react-hot-toast";

export default function QRJoinPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", dob: "", profilePhoto: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get(`/api/qr/event-form/${eventId}`).then(({ data }) => setEvent(data.event));
  }, [eventId]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setForm({ ...form, profilePhoto: reader.result }); // base64
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/api/qr/join-from-qr", { eventId, userData: form });
      setSubmitted(true);
      toast.success(data.requiresApproval ? "Join request sent! Awaiting approval." : "Joined successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to join");
    }
  };

  if (!event) return <div className="flex justify-center mt-20">Loading event...</div>;
  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold">You're in!</h2>
      <p className="text-gray-500 mt-2">{event.approvalMode === "manual" ? "Your request is pending approval." : "You've joined the event."}</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
      <p className="text-gray-500 mb-6">Fill in your details to join</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-lg px-4 py-3" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded-lg px-4 py-3" />
        <input required type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })}
          className="w-full border rounded-lg px-4 py-3" />
        <div>
          <label className="block text-sm font-medium mb-1">Profile Photo *</label>
          <input required type="file" accept="image/*" onChange={handlePhotoChange}
            className="w-full border rounded-lg px-4 py-2" />
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
          Join Event
        </button>
      </form>
    </div>
  );
}
```

---

### 3. Tree Visualization

The API returns `mermaidCode` (a Mermaid.js flowchart string) and a structured `nodes`/`edges` array. Use whichever fits your UI.

**Option A — Mermaid.js rendering:**
```bash
npm install mermaid
```
```jsx
import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default" });

export function MermaidChart({ code }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && code) {
      mermaid.render("tree-chart", code).then(({ svg }) => {
        ref.current.innerHTML = svg;
      });
    }
  }, [code]);
  return <div ref={ref} className="overflow-auto" />;
}
```

**Option B — React Flow (recommended for interactive trees):**
```bash
npm install reactflow
```
```jsx
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

export function FamilyTree({ nodes, edges }) {
  // Map API nodes to ReactFlow format
  const rfNodes = nodes.map((n, i) => ({
    id: n.id.toString(),
    data: { label: <NodeCard person={n} /> },
    position: { x: (i % 5) * 200, y: Math.floor(i / 5) * 120 },
    type: "default",
  }));

  const rfEdges = edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.relation,
    type: "smoothstep",
  }));

  return (
    <div className="h-[600px] border rounded-xl overflow-hidden">
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function NodeCard({ person }) {
  return (
    <div className="bg-white border rounded-lg p-2 text-center shadow-sm w-32">
      <img src={person.profileImage || "/avatar.png"} alt="" className="w-10 h-10 rounded-full mx-auto mb-1 object-cover" />
      <p className="text-xs font-semibold truncate">{person.name}</p>
      {person.isDeceased && <span className="text-xs text-gray-400">†{person.deathYear}</span>}
    </div>
  );
}
```

---

### 4. Real-time Notifications (Socket.IO)

```jsx
// src/hooks/useSocket.js
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

let socket = null;

export function useSocket(onNotification) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    socket = io(import.meta.env.VITE_SOCKET_URL, { auth: { token } });

    socket.on("notification", (data) => {
      toast(data.message, { icon: "🔔" });
      if (onNotification) onNotification(data);
    });

    return () => { socket?.disconnect(); socket = null; };
  }, [user]);
}
```

Use in any component:
```jsx
const [notifications, setNotifications] = useState([]);
useSocket((n) => setNotifications((prev) => [n, ...prev]));
```

---

### 5. Add Relationship Form

```jsx
const RELATION_TYPES = [
  "parent","child","spouse","sibling","friend",
  "step-parent","step-child","step-sibling",
  "grandparent","grandchild","cousin",
  "uncle","aunt","nephew","niece",
  "father-in-law","mother-in-law","brother-in-law","sister-in-law"
];

export function AddRelationForm({ eventId, participants, isWeddingEvent, onSuccess }) {
  const [form, setForm] = useState({ person1Id: "", person2Id: "", relationType: "parent", familySide: "common" });

  const submit = async () => {
    try {
      await api.post("/api/tree/add-relation", { ...form, eventId });
      toast.success("Relationship submitted for review");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.errors?.join(", ") || err.response?.data?.message);
    }
  };

  return (
    <div className="space-y-3">
      <select value={form.person1Id} onChange={(e) => setForm({ ...form, person1Id: e.target.value })}
        className="w-full border rounded-lg px-3 py-2">
        <option value="">Select Person 1</option>
        {participants.map((p) => <option key={p._id} value={p._id}>{p.username}</option>)}
      </select>
      <select value={form.relationType} onChange={(e) => setForm({ ...form, relationType: e.target.value })}
        className="w-full border rounded-lg px-3 py-2">
        {RELATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={form.person2Id} onChange={(e) => setForm({ ...form, person2Id: e.target.value })}
        className="w-full border rounded-lg px-3 py-2">
        <option value="">Select Person 2</option>
        {participants.map((p) => <option key={p._id} value={p._id}>{p.username}</option>)}
      </select>
      {isWeddingEvent && (
        <select value={form.familySide} onChange={(e) => setForm({ ...form, familySide: e.target.value })}
          className="w-full border rounded-lg px-3 py-2">
          <option value="groom">Groom's Side</option>
          <option value="bride">Bride's Side</option>
          <option value="common">Common</option>
        </select>
      )}
      <button onClick={submit} className="w-full bg-indigo-600 text-white py-2 rounded-lg">Add Relationship</button>
    </div>
  );
}
```

---

## Suggested Page Map

```
/login                        OTP login (user)
/admin/login                  Admin login
/organizer/login              Organizer login

/dashboard                    User: joined events, notifications
/profile                      User: edit profile
/events                       All events list
/events/:id                   Event detail + schedule
/tree/:eventId                Family tree view + add relation
/join/:eventId                QR scan join form

/admin                        Admin dashboard (stats)
/admin/events                 Manage events
/admin/events/new             Create event
/admin/organizers             Manage organizers
/admin/users                  Manage users (block/unblock)
/admin/reports                Review abuse reports
/admin/logs                   Audit logs

/organizer                    Organizer dashboard (stats)
/organizer/event              Assigned event details
/organizer/approvals          Pending user approvals
/organizer/tree               Tree validation queue
/organizer/schedule           Edit event schedule
```

---

## Token Storage & Security Notes

- Store `token` and `refreshToken` in `localStorage`. For higher security, consider `httpOnly` cookies (requires backend change).
- Never store in `sessionStorage` if you want persistence across tabs.
- Clear both tokens on logout, 401 refresh failure, or account blocking.
- Admin and organizer tokens also carry `role` in the JWT payload — but always verify role server-side too.

---

## Common Tailwind Patterns Used

```jsx
// Card
<div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow">

// Primary button
<button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">

// Input
<input className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500">

// Badge
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Active
</span>

// Status colors
// pending  → bg-yellow-100 text-yellow-800
// approved → bg-green-100 text-green-800
// rejected → bg-red-100 text-red-800
// admin    → bg-purple-100 text-purple-800
// organizer→ bg-blue-100 text-blue-800
```
