# Phase 2: Write Tools + Permissions UI

## Goal
AI can execute write actions on NX Witness (with confirmation), all write operations are audit-logged, and the settings page has a full capabilities toggle grid with presets.

## Files to create/modify

### Modified backend files:
1. **`modules/ghosthome-monitor/llm-tools.js`** — Add 20 write tools (12 device management + 8 server admin) with backup-before-modify, WF-03 conflict checks, WF-02 incident awareness, audit logging
2. **`modules/ghosthome-monitor/nx-client.js`** — Add Tier 2 NX API methods (event rules CRUD, device update, user CRUD, group CRUD, layout CRUD, storage update, PTZ, triggers, bookmarks, server restart, db backup, site settings, analytics engine settings)
3. **`modules/ghosthome-monitor/llm-agent.js`** — Add AI audit logging for write operations
4. **`modules/ghosthome-monitor/api-server.js`** — Add AI activity event forwarding to WebSocket

### Modified frontend files:
5. **`modules/ghosthome-frontend/src/app/settings/page.tsx`** — Add capabilities toggle grid with 3 categories + preset buttons (Read Only / Standard / Full Admin)
6. **`modules/ghosthome-frontend/src/lib/api.ts`** — Add AI capabilities update types

## Order of operations
1. Add Tier 2 nx-client methods (CRUD methods for all write operations)
2. Add AI audit logger to llm-tools.js
3. Add all 20 write tools to llm-tools.js with NX protection patterns
4. Update llm-agent.js with audit logging hooks
5. Add WebSocket AI event forwarding to api-server.js
6. Add capabilities toggle UI + presets to settings page
7. Update api.ts types
8. Verify build/tests

## Risks and edge cases
- Write tools that conflict with WF-03 analytics cycles (mitigated by checking isCycleInProgress)
- Server restart tool must warn about 2-5 minute downtime
- Backup-before-modify could fail if NX is unreachable (tool returns error, no modification attempted)
- Delete operations are destructive — extra confirmation language in tool descriptions

## Acceptance criteria
1. `node -e "require('./llm-tools')"` loads without errors and exports 38+ tools
2. `node -e "require('./nx-client')"` loads without errors with all new methods
3. Frontend build passes (`npm run build` in ghosthome-frontend)
4. Existing backend tests pass (44/46, same 2 pre-existing failures)
5. AI audit log written on any write tool execution (to logs/ai-audit-YYYY-MM-DD.jsonl)
6. Settings page shows 3 toggle categories with working preset buttons

## Verification commands
- Backend modules: `node -e "require('./llm-tools'); require('./nx-client'); require('./api-server'); console.log('OK')"`
- Frontend: `cd modules/ghosthome-frontend && npx next build`
- Tests: `cd modules/ghosthome-monitor && npm test`
