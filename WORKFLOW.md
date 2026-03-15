# Ghosthome Monitor - Workflow & Collaboration Standards

## Development Principles

### Priority Order
1. **Stabilisation** — fix what's broken before improving what works
2. **Reliability** — make existing features robust before adding new ones
3. **New features** — only after the foundation is solid

### Code Standards
- Fix root causes, not cosmetic symptoms
- Don't over-engineer — minimum complexity for the current task
- Keep changes small and reviewable — one concern per commit
- If code and spec disagree, reconcile before proceeding

### Backend Rules
- CommonJS only (`require`/`module.exports`)
- All workflows follow `init(deps)`, `start()`, `stop()` pattern
- All API responses use `ok(res, data)` or `fail(res, status, message)`
- State changes go through `state.js` — never hold state in workflow locals across restarts
- NX Witness is the source of truth — in-memory state is a cache, not a database

### Frontend Rules
- TypeScript strict — no `any` types, no unsafe casts
- `'use client'` on all interactive pages
- All API calls through `src/lib/api.ts` — never `fetch()` directly
- All WebSocket usage through `src/hooks/use-websocket.ts` — never raw WebSocket
- Design tokens from `globals.css` `@theme` block — never hardcode colors

## Review Standards

### What a reviewer should check
1. **Spec compliance** — does the code match what SPEC.md says?
2. **Bugs** — logic errors, null access, race conditions, unhandled promises
3. **Security** — auth bypass, injection risks, exposed secrets, missing validation
4. **Regressions** — could this break existing functionality?
5. **Error handling** — what happens when NX Witness is down, when Telegram fails, when the frontend can't reach the backend?
6. **Simplicity** — is there a less complex way to achieve the same result?

### Issue severity
- **CRITICAL** — must fix before merging: security holes, data loss, spec violations, broken core functionality
- **IMPORTANT** — should fix before merging: missing error handling, edge cases, regression risks
- **MINOR** — fix if convenient: style, naming, minor optimizations

## Adversarial Build Process

This project uses a multi-model adversarial workflow for substantial features:
1. Claude plans and builds
2. Codex (OpenAI) independently reviews the plan and code
3. Claude fixes issues Codex finds
4. Loop until Codex approves

See the `/adversarial-build` skill for the full 7-step workflow. Use it for new pages, workflow modules, multi-file changes, and anything complex enough to benefit from independent review. Don't use it for small bug fixes or one-line changes.

## Commit Messages

Use conventional commit format:
- `feat:` — new feature or capability
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — maintenance, dependencies, config

Keep the first line under 72 characters. Add detail in the body if needed.

## Testing

No automated test suite exists yet (see PLAN.md Phase 2.1). Until then:
- Verify `npm run build` passes in the frontend before committing
- Verify `npm run lint` passes in the frontend before committing
- Manually verify backend starts without errors (`node index.js`)
- Check the dashboard loads and displays data after changes
