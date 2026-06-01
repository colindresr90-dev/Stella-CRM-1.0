# Stella CRM 1.0 — Product Specification & Documentation

Stella CRM 1.0 (also referred to as Precision CRM) is a high-performance, real-time Customer Relationship Management (CRM) dashboard designed for modern sales teams. Built on top of Next.js, React 19, and Supabase, it leverages a premium visual design language characterized by glassmorphism, smooth animations, and role-based operational modules.

---

## 1. Core Modules & Product Features

### 👤 Role-Based Portals & Dashboards
The application dynamically adjusts the user interface based on the user's role:
*   **Admin Dashboard:**
    *   High-level overview of team performance, metrics, and conversion funnels.
    *   **Agent Impersonation Mode:** Admins can preview the dashboard and views exactly as a specific Agent does (`View As Agent`), facilitating debugging and training.
    *   Management of team members, sales targets, and organizational parameters.
*   **Agent (Advisor) Dashboard:**
    *   Personalized lead counts, daily schedule/meetings, and active pipeline value.
    *   Task-centric interface focusing on follow-ups and lead interactions.

### 🎯 Lead & Customer Management
*   **Visual Pipeline & Kanban:** Real-time tracking of leads across standard phases (`Nuevo` → `Contactado` → `Reunión` → `Propuesta` → `Venta`/`Perdido`).
*   **Lead Detail View:**
    *   **Status Path:** Visual indicator showing current stage with options to transition leads.
    *   **Lead Information Panel:** Detailed fields for contact details, value, assignee, status, source/type, and intent tier (high, medium, low).
    *   **Activity History:** Timeline auditing all interactions (calls, proposals, status changes).
    *   **Notes:** Collaborative text notes attached to leads.
    *   **Files & Attachments:** File uploads to associate documents directly with specific leads.

### 💰 Sales Ledger & Revenue Analytics
*   **Income Control (Ledger):** Register sales with package options (Standard packages or custom items).
*   **Installment Tracking:** Ability to register deposits and partial payments against pending balances.
*   **Conversion Funnel Analytics:** Advanced visual charts depicting conversion rates, velocity of sales, and loss distribution reasons.
*   **Dynamic Goals:** Configurable monthly sales targets saved per organization, dynamically updating progress meters.

### 📧 Bidirectional Email Hub
*   **Background Email Queue:** Robust queueing system (`email_queue` table in Supabase) tracking emails with statuses: `pending`, `processing`, `sent`, `failed`.
*   **Full SMTP/IMAP Integration:** Integration with `imapflow`, `nodemailer`, and `resend` to send outbound communication directly from lead records and stream inbound/outbound history dynamically.
*   **Thread Tracking:** Logs and displays complete email conversation threads in the lead's email history.

### 📅 Google Calendar & Meeting Scheduler
*   Schedule meetings directly from lead files.
*   Binds with Google Calendar APIs (`googleapis`) to automatically sync meeting times, update descriptions, and maintain notifications.

### 🔔 Real-Time Notification Center
*   Central hub that triggers instantly on important events (e.g., *new lead assigned*, *sale registered*, *payment received*).
*   Powered by WebSocket endpoints (`socket.io`) to stream notifications seamlessly.

---

## 2. Technology Stack

| Technology | Layer | Purpose |
| :--- | :--- | :--- |
| **Next.js 16.2.4 (App Router)** | Framework | Core SSR, page routing, and API route endpoints. |
| **React 19** | Frontend | Reactive UI layer and component architecture. |
| **Supabase** | Database & Auth | PostgreSQL database storage, Authentication, and Row Level Security (RLS). |
| **Tailwind CSS v4** | Styling | Utility styling using CSS-first tokens and variables. |
| **TanStack React Query v5** | State/Caching | Server-state caching, automatic data re-validation. |
| **Upstash Redis** | Caching/Queues | Job queue handling and API rate limiting. |
| **Framer Motion & Motion** | Animation | Fluid page transitions, loading states, and modal animations. |
| **Socket.io** | WebSockets | Real-time messaging and notification sync. |
| **Imapflow / Nodemailer** | Communication | Bidirectional mail integration and SMTP transport. |

---

## 3. Database Schema Highlights

The database is built on Supabase PostgreSQL with heavy optimization indexes for low-latency queries:

*   **`profiles`**: User metadata, system roles (`admin`, `agent`), onboarding status, and password constraints.
*   **`leads`**: Central entities containing business name, contact info, status, assignee, closed timestamp, and estimated value.
*   **`sales`**: Connects to `leads` to represent closed contracts. Contains total amount, deposit amount, pending amount, package names, and status (`pendiente`/`pagado`).
*   **`email_queue`**: Background queue tracking outgoing mail attempts, CC, BCC, status checks, and retries.
*   **`activities`**: Standard audit trail logging all lead actions and history.
*   **`meetings`**: Scheduled calendar entries mapped to leads.
*   **`reminders`**: Pending alerts linked to dates and specific team members.
*   **`notifications`**: Persistent alert states for user channels.

### Performance Indexes
Critical paths such as dashboard lists, activity logs, and kanban transitions are optimized with custom composite indexes:
*   `idx_leads_status_created_at` — Optimizes status-based list filtration.
*   `idx_activities_lead_id_created_at` — Ensures lead details load audit histories under <5ms.
*   `idx_email_queue_pending_idx` — Index filtered to pending rows only for high-speed queue worker claiming.

---

## 4. Key UX & UI Patterns

*   **Glassmorphic Design:** Translucent backgrounds (`bg-white/60 backdrop-blur-md`), ambient glowing backdrops, and thin borders (`border-outline-variant/20`) to create depth.
*   **Optimistic UI:** Fast feedback states for quick status updates, switching statuses instantly while updating database tables asynchronously in the background.
*   **Visual Path Indicators:** Interactive step progress bars indicating exact sales pipeline status.
*   **Progressive Disclosures:** Interactive filters and action modals to minimize layout noise.
