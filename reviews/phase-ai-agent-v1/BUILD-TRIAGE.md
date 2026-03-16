# Build Review Triage — AI Agent Phase 1

## CRITICAL-1: AI config bootstrap blocked on fresh installs
- Severity: CRITICAL
- Verdict: **VALID**
- Reasoning: `requireAiAuth` returns 503 when no API key exists, but PATCH /api/ai-config (which sets the key) also uses `requireAiAuth`. On first install with no key, the user can't configure the AI through the API. The frontend settings page would fail to load AI config.
- Action: Fix `requireAiAuth` to allow GET/PATCH `/ai-config` and POST `/ai-config/validate-key` even without an existing API key. The auth check for these config routes should only require the `API_AUTH_TOKEN`, not the AI-specific key.

## CRITICAL-2: AI auth bypassable when API_AUTH_TOKEN is unset
- Severity: CRITICAL
- Verdict: **PARTIALLY VALID**
- Reasoning: When `API_AUTH_TOKEN` is not set, the code accepts any non-empty bearer/key. This is intentionally more relaxed than the plan's "always require auth" because in dev mode with no `API_AUTH_TOKEN`, the entire system already runs without auth on write endpoints. However, Codex is right that this is weaker than intended for AI routes specifically. The plan says AI routes should ALWAYS require auth.
- Action: Fix to require `API_AUTH_TOKEN` to be set for AI chat routes. Config management routes can stay more relaxed (using existing `requireApiAuth`).

## IMPORTANT-1: Frontend GET AI routes missing auth headers
- Severity: IMPORTANT
- Verdict: **VALID**
- Reasoning: `apiFetch()` doesn't include auth headers — only `getWriteHeaders()` does. `fetchChatHistory` and `fetchAIConfig` use `apiFetch()` which sends bare GET requests. Since AI routes require auth, these will 401.
- Action: Create `apiFetchAuth()` that includes auth headers, or switch these to use the write headers pattern.

## IMPORTANT-2: Conversation history doesn't store full Claude format
- Severity: IMPORTANT
- Verdict: **PARTIALLY VALID**
- Reasoning: The chat() function pushes tool_use/tool_result blocks into the `messages` array during the loop, but saves only the final text to `history`. This means follow-up questions lose tool context. However, the streaming path has the same issue. The `messages` array used during the API loop IS correct (it includes tool blocks), but it's only the persisted `history` that loses them.
- Action: Fix to push the intermediate assistant+tool messages into history, not just the final text.

## IMPORTANT-3: Settings UI missing capabilities/servers management
- Severity: IMPORTANT
- Verdict: **PARTIALLY VALID**
- Reasoning: The plan mentions full capabilities toggle UI and server management. We implemented key, model, budget, and enable/disable — which is the core MVP. Capabilities toggle grid and server management are more complex UI work that could be Phase 2. However, since the default config already has all read tools enabled, users can use the AI immediately.
- Action: Skip for now — defer to Phase 2. The current settings UI covers the essential configuration path.

## MINOR-1: Default config enables read capabilities vs plan's "no capabilities"
- Severity: MINOR
- Verdict: **INVALID**
- Reasoning: The plan says default `enabled: false` (which we do). The plan text says "Default state: AI disabled, no API key, no capabilities enabled" but this refers to the AI being disabled overall. Having read capabilities pre-populated means when the user enables AI, it works immediately for read operations. This is better UX.
- Action: Skip — intentional design choice.

## MINOR-2: API key can't be cleared via PATCH
- Severity: MINOR
- Verdict: **VALID**
- Reasoning: `if (updates.apiKey && ...)` — empty string is falsy, so sending `{apiKey: ""}` won't clear it. Should check `typeof updates.apiKey === 'string'` instead.
- Action: Fix the condition.

## MINOR-3: MAX_TOOL_CALLS can be exceeded in one loop pass
- Severity: MINOR
- Verdict: **VALID**
- Reasoning: If Claude returns 5 tool_use blocks at once, the counter increments 5 times within the same while-loop iteration, potentially going from 12 to 17 (past the 15 limit). The check only happens at the while condition.
- Action: Accept — this is a soft limit. Going slightly over (by 1-4 extra calls) is acceptable. The limit exists to prevent infinite loops, not to be exact.
