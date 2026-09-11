# mistri360 Frontend

React 19 + Vite + TailwindCSS v4 frontend application for mistri360 Fleet Maintenance platform.

## Features
- **Modern React 19** with Vite & TypeScript
- **TailwindCSS v4** with Shadcn UI & Radix primitives
- **TanStack React Query** for server state management
- **Wouter** routing
- **Fleet Management UI**:
  - Real-time Fleet Dashboard with stats & alerts
  - Vehicle management (add, edit, status, specs, odometer tracking)
  - Work Orders & Labour management
  - Digital Inspections, Checklists & Driver DVIR
  - Defects reporting & resolution workflow
  - Preventative Maintenance (PM) schedules & reminders
  - Roadside Violations & Compliance tracking
  - Customer & Estimate management
  - Platform Admin management

## Getting Started

### 1. Requirements
- Node.js >= 20

### 2. Setup Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default ports:
- Frontend: `http://localhost:18231/fleet/`
- API Target: `http://localhost:8090`

### 3. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm run preview
```
