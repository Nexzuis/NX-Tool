# Frontend Bug Fix — Verified Issues Only

## Goal
Fix the 3 confirmed frontend bugs: unsafe non-null assertions on WebSocket data, missing structure validation on STATE_SNAPSHOT merge, and unvalidated incident data casting. Also fix hardcoded camera count.

## Dropped from plan (Codex verified as false positives)
- **Analytics optimistic update** — toggle already happens after `await`, not optimistic
- **Cameras stale closure** — `load` is memoized with empty deps, closure is stable
- **WebSocket listener cleanup** — already uses stable callback ref with proper cleanup

---

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-frontend/src/app/dashboard/page.tsx` | Replace `parsed.data!` with `parsed.data?.`, add structure validation on STATE_SNAPSHOT merge |
| `modules/ghosthome-frontend/src/app/incidents/page.tsx` | Validate WebSocket incident entries before casting, remove hardcoded "69 cameras" |

---

## Order of Operations

### 1. Dashboard — safe data access + STATE_SNAPSHOT validation

**Fix `parsed.data!` (line ~197-198):**
Replace all `parsed.data!.fieldName` with `parsed.data?.fieldName`. The `??` fallback already handles undefined.

**Validate STATE_SNAPSHOT structure before merge (line ~187-205):**
Before merging, check that `parsed.data` is a non-null object and each field exists before applying:
```ts
if (parsed.type === 'STATE_SNAPSHOT' && parsed.data && typeof parsed.data === 'object') {
  const d = parsed.data as Record<string, unknown>;
  setState(prev => ({
    ...prev,
    ...(d.serverHealth != null ? { serverHealth: d.serverHealth as ... } : {}),
    ...(d.workflows != null ? { workflows: d.workflows as ... } : {}),
    // etc — only overwrite fields that are present and non-null
  }));
}
```

### 2. Incidents — validate WebSocket data + remove hardcoded count

**Validate incident entries (line ~617-618):**
Backend incidents are heterogeneous — camera incidents have `deviceId`, server incidents may use key `server`. Accept any entry that has at minimum a truthy key and an object value:
```ts
if (wsIncidents && typeof wsIncidents === 'object') {
  const entries = Object.entries(wsIncidents as Record<string, unknown>)
    .filter(([, val]) => val != null && typeof val === 'object')
    .map(([deviceId, data]) => ({
      deviceId,
      ...(data as Record<string, unknown>),
    } as IncidentEntry));
  // update state with validated entries
}
```

**Remove hardcoded "69 cameras" (line ~386):**
Change to "All cameras are online" or use the fetched camera count from stats if available.

---

## Risks and Edge Cases

- **Dashboard merge too strict**: Use spread with conditional fields — only overwrite what's present, preserve existing state for missing fields
- **Incidents heterogeneous shapes**: Don't validate specific camera fields — just ensure each entry is a non-null object with a deviceId key
- **Server incidents keyed as "server"**: These are valid entries — don't filter them out

## Acceptance Criteria

1. Dashboard has zero `parsed.data!` non-null assertions — all use optional chaining `parsed.data?.`
2. Dashboard STATE_SNAPSHOT merge checks `typeof parsed.data === 'object'` before applying
3. Dashboard doesn't crash when STATE_SNAPSHOT contains null/undefined fields — preserves previous state
4. Incidents page filters out null/non-object WebSocket incident entries before casting
5. Incidents page has no hardcoded camera count
6. `cd modules/ghosthome-frontend && npx tsc --noEmit` passes
7. `cd modules/ghosthome-frontend && npm run build` passes
8. `cd modules/ghosthome-frontend && npm test` passes

## Verification Commands
```bash
cd modules/ghosthome-frontend && npx tsc --noEmit
cd modules/ghosthome-frontend && npm run build
cd modules/ghosthome-frontend && npm test
```
