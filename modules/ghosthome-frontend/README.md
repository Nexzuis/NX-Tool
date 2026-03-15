# Ghosthome Frontend

Next.js dashboard for the Ghosthome Monitor system. The app renders live infrastructure status from the backend API and WebSocket stream, including workflow health, camera state, incidents, and operator controls.

## Prerequisites

- Node.js 20 or newer
- The backend service from `modules/ghosthome-monitor` running on port `4301`

## Setup

Install dependencies:

```bash
npm install
```

Create `modules/ghosthome-frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4301
NEXT_PUBLIC_WS_URL=ws://localhost:4301/ws
```

## Running the app

Recommended from the project root:

```bash
start-ghosthome.bat
```

That launcher starts:
- backend API on `http://localhost:4301`
- frontend on `http://localhost:4300`

Manual frontend startup:

```bash
npm run dev -- -p 4300
```

The package `dev` script itself does not pin the port, so omit `-p 4300` only if you are okay with the Next.js default port behavior.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Main operations overview |
| `/workflows` | Workflow summaries and manual triggers |
| `/cameras` | Camera inventory and analytics controls |
| `/incidents` | Incident feed and filtering |
| `/settings` | Backend URL, polling, and connection details |

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Lucide React
- clsx

## UI notes

The current frontend uses a dark dashboard style with green accenting and motion-heavy status cards. There is no separate design-system file in active use at the repo root, so treat the implementation in `src/app`, `src/components`, and `src/lib` as the source of truth.

## Project structure

```text
src/
  app/
    page.tsx          Root redirect to /dashboard
    dashboard/        Main dashboard route
    workflows/        Workflow monitoring route
    cameras/          Camera management route
    incidents/        Incident route
    settings/         Settings route
  components/         Shared UI and layout components
  hooks/              Shared hooks, including WebSocket handling
  lib/                API helpers, event parsing, and shared types
```

## Backend integration

- HTTP requests go through `src/lib/api.ts`
- Real-time updates come from `src/hooks/use-websocket.ts`
- The frontend assumes the backend returns an `{ ok, data }` style envelope for API responses

## Current gaps

- No route-level `error.tsx` boundaries exist yet
- Incident cards still show shortened device IDs instead of resolved camera names
