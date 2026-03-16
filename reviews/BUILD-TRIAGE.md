# Phase 2 Build Review Triage

## CRITICAL-1: restart_server can return success even when NX restart failed
- Verdict: **VALID**
- Action: Check restartServer() return value, report failure if null

## CRITICAL-2: AI events broadcast to all WebSocket clients without auth
- Verdict: **INVALID**
- Reasoning: The existing WebSocket has NEVER had auth — all other events (CRITICAL_SERVER, MASS_OFFLINE, etc.) are broadcast the same way. This is a LAN-only system. AI events contain metadata (chatId, toolName, duration) not sensitive content. Adding WS auth would be a system-wide change, not a Phase 2 scope item. See CLAUDE.md "AI Route Auth — INTENTIONAL DESIGN DECISION".
- Action: Skip — not a regression, matches existing pattern

## IMPORTANT-3: restart_analytics doesn't check disable/re-enable results
- Verdict: **VALID**
- Action: Check patchDeviceAgent results, return error on failure

## IMPORTANT-4: modify_camera_settings previousState captures wrong values
- Verdict: **VALID**
- Action: Capture actual device state before modification, not input settings

## IMPORTANT-5: Audit log missing requestedBy/confirmed fields
- Verdict: **PARTIALLY VALID**
- Reasoning: The `requestedBy` field requires context from llm-agent.js (chatId, source) which isn't passed to tool execution. The `confirmed` field is a Claude conversation flow concept, not something the tool layer knows about. However, we should log on failure too.
- Action: Add failure audit logging. requestedBy/confirmed deferred to when tool execution context is enhanced.

## IMPORTANT-6: toggle_analytics missing incident awareness check
- Verdict: **VALID**
- Action: Add NX-08 incident check to toggle_analytics

## IMPORTANT-7: Tool count mismatch (13+7 vs plan's 12+8)
- Verdict: **INVALID**
- Reasoning: The plan's numbers were approximate. Some tools were consolidated or split differently. The actual capability coverage matches the plan's intent. All listed capabilities are implemented.
- Action: Skip

## MINOR-8: trigger_* tools swallow errors
- Verdict: **PARTIALLY VALID**
- Action: Return "not available" if workflow function doesn't exist

## MINOR-9: Capabilities UI may crash on missing fields
- Verdict: **VALID**
- Action: Add fallback defaults for capabilities arrays
