**Root Cause Report (prioritized)**

1. **Primary breakage: API base URL defaults to empty string, so requests go to the frontend origin, not backend `:4301` unless env is set.**  
   - Code:
     - [api.ts:1](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:1) `const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';`
     - [api.ts:106](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:106) all reads use ``${API_BASE}${path}``
     - [next.config.ts:3](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/next.config.ts:3) no rewrite/proxy to `http://localhost:4301`
   - Why this matches symptoms:
     - Every page fetch depends on this client API layer; wrong origin causes repeated failures/timeouts and pages staying in loading/error-ish states.
     - Polling keeps retrying:
       - [dashboard/page.tsx:183](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/dashboard/page.tsx:183)
       - [workflows/page.tsx:1048](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/workflows/page.tsx:1048)
       - [incidents/page.tsx:596](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/incidents/page.tsx:596)
       - [cameras/page.tsx:222](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/cameras/page.tsx:222)
   - Extra inconsistency:
     - Settings *displays* fallback `http://localhost:4301` ([settings/page.tsx:257](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/settings/page.tsx:257)), but API client does not use that fallback.

2. **WebSocket defaults to frontend host (`:4300`) in browser, causing reconnect churn and global rerenders.**  
   - Code:
     - [use-websocket.ts:19](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:19) `return \`${proto}//${window.location.host}/ws\`;`
     - [use-websocket.ts:80](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:80) reconnect scheduling
     - [shell-client.tsx:13](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/components/layout/shell-client.tsx:13) root layout subscribes via `useWebSocket()`
     - [use-websocket.ts:103](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:103), [use-websocket.ts:116](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:116), [use-websocket.ts:173](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:173)
   - Impact:
     - Failed WS does not block first render, but reconnect + notify + root subscription can make navigation feel sluggish/hung under failure/event churn.

3. **Direct “endless Loading…” UI bug in Cameras page on fetch failure.**  
   - Code:
     - [cameras/page.tsx:213](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/cameras/page.tsx:213) catch swallows error
     - [cameras/page.tsx:616](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/cameras/page.tsx:616) checks only `cameras === null`
     - [cameras/page.tsx:617](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/cameras/page.tsx:617) shows `'Loading cameras.'` forever when initial fetch fails
   - This reproduces one of your reported symptoms exactly.

4. **429 behavior is minimal; no backoff/jitter in API layer, while pages keep polling.**  
   - Code:
     - [api.ts:111](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:111) non-OK just throws generic error
   - Combined with polling intervals above, 429 can become a persistent failure loop.

---

**Checks you requested**

- **Sidebar links**: Correct Next.js links, not the bug.  
  - [sidebar.tsx:13](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/components/layout/sidebar.tsx:13), [sidebar.tsx:91](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/components/layout/sidebar.tsx:91), [sidebar.tsx:92](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/components/layout/sidebar.tsx:92)

- **`fetchWithTimeout` / AbortController**: Implemented correctly in principle.  
  - [api.ts:86](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:86), [api.ts:91](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:91), [api.ts:92](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:92), [api.ts:101](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/lib/api.ts:101)

- **WebSocket blocks rendering?** No hard blocking; it runs in effect.  
  - [use-websocket.ts:176](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/hooks/use-websocket.ts:176)

- **`shell-client` remounting children every nav?** No explicit remount key; but it rerenders whole shell on WS updates.  
  - [shell-client.tsx:37](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/components/layout/shell-client.tsx:37)

- **`loading.tsx` files**: none found under `src/app` (no route-level loading boundaries).

- **`error.tsx` crash loop?** Basic boundary with `reset`; no obvious loop source.  
  - [error.tsx:27](C:/Users/Nexzuis/Desktop/Ghosthome%20APPS/NX%20Wintess%20Agents%20and%20Front%20end/modules/ghosthome-frontend/src/app/error.tsx:27)

**Bottom line:** the dominant failure is URL wiring: API/WS defaults do not reliably target the backend on `4301` in-browser, and there is no rewrite fallback. The perceived navigation hangs are then amplified by global WS-driven rerenders and repeated polling under failure.