

# Lemoncode Employee Time & Activity Tracking

## Overview
Modern corporate-styled employee time & activity tracking app with lemon/green theme, sidebar navigation, and 3 role-based views (Employee, Manager, Admin). Custom auth against the `users` table. RBAC enforced in application logic, not database policies.

---

## Phase 1: Database Foundation

### Tables (exact schema as specified)
- **users** — id, email, password_hash, first_name, last_name, role (EMPLOYEE/MANAGER/ADMIN), team_id, status, timestamps
- **teams** — id, name, manager_id, timestamps
- **devices** — id, device_id, user_id, os_type, last_seen_at
- **events** — id, user_id, device_id, type (LOGIN/LOGOUT/ACTIVITY/IDLE_START/IDLE_END/MANUAL_CLOCK_IN/MANUAL_CLOCK_OUT), timestamp, metadata jsonb, processed fields
- **work_sessions** — id, user_id, date, start/end time, active/idle seconds, source, timestamps. Unique(user_id, date)
- **attendance** — id, user_id, date, status, work/overtime/undertime seconds, notes. Unique(user_id, date)
- **attendance_corrections** — id, user_id, date, original/requested in/out, reason, status, reviewer_id, reviewed_at

### Indexes
- events(user_id, timestamp), events(device_id, timestamp), devices(device_id) unique

### No RLS policies — access control handled entirely in edge functions via JWT + users.role

---

## Phase 2: Custom Authentication

### Edge Functions
- **auth/login** — Validates email + password_hash against users table, returns JWT containing user_id, role, and team_id
- **auth/signup** — Creates user with hashed password (admin-only or self-registration based on config)
- JWT tokens stored in localStorage, sent as Bearer token on all API requests

### Auth UI
- Login page with email/password, lemon/green corporate branding
- Protected routes — redirect to login if no valid token
- Role extracted from JWT for frontend view switching

---

## Phase 3: Core UI & Layout

### Sidebar Navigation
- Lemoncode branding with lemon/green accent colors
- Collapsible sidebar with icon-only mini mode
- Navigation items adapt based on user role (Employee sees fewer items than Admin)
- Top header with user name, role badge, logout button

### Dashboard (role-adaptive)
- **Employee**: Today's clock status, hours worked today, weekly summary card
- **Manager**: Team member count, today's attendance summary, pending correction requests count
- **Admin**: Total active users, company-wide hours today, system overview stats

---

## Phase 4: Employee Views

### My Timesheet
- Manual clock in / clock out buttons (creates MANUAL_CLOCK_IN/OUT events via edge function)
- Daily view showing work sessions with start/end times
- Weekly summary with total active and idle hours
- Edge function enforces that employees can only access their own data

### My Attendance
- Calendar-style monthly view with color-coded status (Present/Absent/Leave/Holiday)
- Daily detail showing total work, overtime, and undertime
- "Request Correction" button opening a form to submit attendance_corrections
- Edge function validates user_id matches JWT

---

## Phase 5: Manager & Admin Views

### Team View (Manager only)
- List of team members with today's status (clocked in/out, hours so far)
- Team attendance summary for the current week
- Pending correction requests queue with approve/reject actions
- Edge function checks role === MANAGER and filters by team_id

### Admin Panel (Admin only)
- User management: list users, create new users, toggle active/inactive status
- Team management: create/edit teams, assign managers
- Device overview: registered devices and last seen timestamps
- Edge function checks role === ADMIN for all admin operations

---

## API Layer (Edge Functions with RBAC)
All data access goes through edge functions that:
1. Extract and validate JWT from Authorization header
2. Query users.role from the token claims
3. Enforce role-based access rules in code (e.g., employees see only their data, managers see their team, admins see everything)
4. Return appropriate errors for unauthorized access

---

## Design Theme
- Lemon/green corporate color palette (#84cc16 / lime-500 as primary accent)
- Dark sidebar with light content area
- Data cards with stats, clean data tables
- Professional, readable typography
- Desktop-first responsive layout

