# Phase A — Graceful Shutdown Fixes (Backend)

## Goal
Make WF-02, WF-03, and WF-04 stop cleanly within 5 seconds by cancelling in-flight sleep timers and preventing post-stop execution.

## Files to modify

| File | Changes |
|------|---------|
| `modules/ghosthome-monitor/wf02-camera-offline.js` | Add `if (!running) return;` guard after the 30-minute await |
| `modules/ghosthome-monitor/wf03-analytics.js` | Replace `sleep()` with cancellable version using ShutdownError class, track timers, clear in `stop()`, reset `cycleInProgress`, propagate shutdown through runCycle |
| `modules/ghosthome-monitor/wf04-server-health.js` | Same cancellable sleep pattern, track timers, clear in `stop()`, reset `operationInProgress` |

## Cancellable Sleep Pattern (Updated per Codex feedback)

### ShutdownError class (used by WF-03 and WF-04)
```javascript
class ShutdownError extends Error {
  constructor() {
    super('Workflow shutdown');
    this.code = 'WF_SHUTDOWN';
  }
}
```
Using a custom error class (not string matching) per Codex IMPORTANT #3.

### Cancellable sleep using Map (not timer mutation)
```javascript
const activeSleeps = new Map(); // timerId -> reject function
let sleepIdCounter = 0;

function sleep(ms) {
  return new Promise((resolve, reject) => {
    const id = ++sleepIdCounter;
    const timer = setTimeout(() => {
      activeSleeps.delete(id);
      resolve();
    }, ms);
    activeSleeps.set(id, { timer, reject });
  });
}

function cancelAllSleeps() {
  for (const [id, { timer, reject }] of activeSleeps) {
    clearTimeout(timer);
    reject(new ShutdownError());
  }
  activeSleeps.clear();
}
```
Using `Map(id -> {timer, reject})` per Codex IMPORTANT #2 — no timer object mutation.

## Order of Operations

### 1. WF-03: Cancellable sleep + shutdown-aware cycle

**Changes:**
- Add `ShutdownError` class at module scope
- Replace `sleep()` with cancellable version using `activeSleeps` Map
- Add `cancelAllSleeps()` function
- In `stop()`: call `cancelAllSleeps()`, set `cycleInProgress = false`
- In `restartAnalytics()`: let `ShutdownError` propagate (don't catch it)
- In `runCycle()`:
  - The existing `try { ... } catch` around each device (line 366-368) catches errors per-camera. ShutdownError must NOT be caught there — re-throw it.
  - Add `if (!running) break;` at the top of the device loop
  - The `finally { cycleInProgress = false }` block (line 388-390) already handles cleanup
  - **CRITICAL (Codex #1)**: When `restartAnalytics` throws `ShutdownError`, it propagates out of the per-camera catch (which re-throws it), through the for loop, into the outer try block. The `finally` resets `cycleInProgress`. No failure counts are incremented, no `ANALYTICS_RESTART_FAILED` events are emitted, because the throw happens BEFORE those lines.

**Why this is safe**: In the current code, `restartAnalytics` is called at lines 241 and 302. After the call, the code checks `result.success` and only THEN increments failure counts (lines 252-261, 312-322). If `restartAnalytics` throws (instead of returning `result`), execution jumps to the catch block at line 366, which we update to re-throw `ShutdownError`. So the failure counting code never runs.

### 2. WF-04: Cancellable sleep + shutdown-aware operations

**Changes:**
- Add `ShutdownError` class at module scope
- Replace `sleep()` with cancellable version using `activeSleeps` Map
- Add `cancelAllSleeps()` function
- In `stop()`: call `cancelAllSleeps()`, set `operationInProgress = false`
- In `handleServerRestart()`: add `if (!running) return;` after each `await sleep()`. The existing try/catch at lines 148-223 catches errors — re-throw `ShutdownError`.
- In `handleServerFailure()`: add `if (!running) return;` after each `await sleep()`. The existing try/catch at lines 233-263 catches errors — re-throw `ShutdownError`.
- In `runHealthCheck()`: the existing `finally { operationInProgress = false }` at line 137-139 handles cleanup.

### 3. WF-02: Post-stop execution guard

**Changes:**
- Add `if (!running) return;` immediately after the 30-minute await resolves (after line 61), before the `pendingWaits.has()` check at line 64.
- This is mostly redundant (per Codex MINOR #5) since `pendingWaits.clear()` in `stop()` already makes the existing check exit. But it's a good defensive guard.

## Risks and Edge Cases

1. **ShutdownError propagation through for loop**: When `restartAnalytics` throws `ShutdownError`, it propagates through the per-camera try/catch (which re-throws it), out of the for loop, into `runCycle`'s try block. The `finally` block resets `cycleInProgress`. This is correct — no failure side effects.
2. **Concurrent restartAnalytics calls**: Only one `restartAnalytics` runs at a time (sequential for loop, `cycleInProgress` guard). Cancelling sleeps affects only the active one.
3. **WF-04 nested handleServerRestart inside handleServerFailure**: Both functions share the same `activeSleeps` Map. `cancelAllSleeps()` cancels all of them regardless of which function created them.
4. **Multiple stop() calls**: Idempotent — `cancelAllSleeps()` on empty Map is a no-op.

## Acceptance Criteria

1. WF-02: `handleCameraOffline` returns immediately after `stop()` — no NX API calls post-stop
2. WF-03: `stop()` cancels all in-flight sleeps; `restartAnalytics` throws `ShutdownError` which exits `runCycle` without incrementing failure counts or emitting `ANALYTICS_RESTART_FAILED`
3. WF-03: `cycleInProgress` is reset to `false` in `stop()` (also via `finally`)
4. WF-04: `stop()` cancels all in-flight sleeps; `handleServerRestart`/`handleServerFailure` return early without emitting events
5. WF-04: `operationInProgress` is reset to `false` in `stop()`
6. No false failure events/counters during shutdown (Codex CRITICAL #1)
7. No syntax errors: `node -c` passes on all 3 files

## Verification Commands
```bash
node -c modules/ghosthome-monitor/wf02-camera-offline.js
node -c modules/ghosthome-monitor/wf03-analytics.js
node -c modules/ghosthome-monitor/wf04-server-health.js
```
