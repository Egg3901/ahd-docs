# Getting Started: Build a Dashboard

A walkthrough for building a live dashboard on top of the A House Divided public API: polling game state, tracking politicians, parties, and markets, and displaying it all on your own page.

Read [Public API v1](public-v1.html) first for authentication and the full endpoint reference. This guide focuses on how to put those endpoints together.

## Prerequisites

- A personal API key. In-game: Settings -> API Keys -> create a **public** scope key. A dashboard only ever needs read access.
- Any stack that can make HTTP requests. The examples below are plain JavaScript; React/Next/Svelte/Vue all work the same way.

## Architecture

A dashboard has three concerns:

1. **Polling** - fetch data from the API on a schedule
2. **State** - hold the latest snapshot per resource
3. **Rendering** - draw from state, not from fetches

Keep these separate. The most common mistake is coupling rendering to requests and re-rendering on every poll even when nothing changed.

## Step 1: Poll game state

`GET /api/public/v1/game` is your heartbeat. It tells you the current turn and when the next one lands, which tells you when everything else will change.

```js
const BASE = "https://ahousedividedgame.com";
const headers = { "X-API-Key": process.env.AHD_API_KEY };

async function getGame() {
  const res = await fetch(`${BASE}/api/public/v1/game`, { headers });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 60) * 1000;
    await new Promise(r => setTimeout(r, retryAfter));
    return getGame();
  }
  return res.json();
}
```

Poll it once per minute or less. Game state turns over every few minutes; faster polling gains nothing and burns quota.

## Step 2: Track what you care about

Fetch each resource you display, keyed by what changes when:

| Resource | Endpoint | Refresh cadence |
| --- | --- | --- |
| Turn clock | `/api/public/v1/game` | Every turn boundary (`nextTurnAt`) |
| Politicians | `/api/public/v1/character/[id]` | Every turn |
| Elections | `/api/public/v1/elections?country=US` | Every few minutes while open |
| Markets | `/api/public/v1/market?type=SECTOR&country=US` | Every few minutes |
| Legislation | `/api/public/v1/legislation?country=US&status=pending` | On turn boundary |

A simple scheduler:

```js
const jobs = [
  { everyMs: 60_000, run: () => refresh("/api/public/v1/game") },
  { everyMs: 180_000, run: () => refresh("/api/public/v1/market?type=TECH&country=US") },
];

setInterval(tick, 30_000); // check due jobs every 30s instead of N timers
```

## Step 3: Handle the response envelope

Successful responses carry `ok: true`; lookups can legitimately miss:

```js
const char = await fetch(`${BASE}/api/public/v1/character?name=smith`, { headers }).then(r => r.json());

if (!char.found) {
  // empty state, not an error
}
```

Handle three failure modes distinctly:

- **401** - your key is missing or revoked; alert, do not retry
- **429** - back off using `Retry-After`
- **Network errors** - keep showing the last good snapshot with a "stale since" timestamp

That last point matters: a dashboard that goes blank during a blip is worse than a dashboard that shows slightly old data.

## Step 4: Render deltas, not dumps

Compare against the previous snapshot so the UI shows movement:

```js
function diffPolitician(prev, next) {
  const fields = ["politicalInfluence", "nationalInfluence", "favorability", "netWorth"];
  return fields
    .filter(f => prev && prev[f] !== next[f])
    .map(f => ({ field: f, from: prev?.[f], to: next[f] }));
}
```

Green/red arrows on PI and favorability, sparklines on funds and net worth, seat-share bars from `legislatureComposition`. All of it derivable client-side from two consecutive snapshots.

## Example: minimal vanilla JS widget

```html
<div id="clock">loading...</div>
<script type="module">
  const BASE = "https://ahousedividedgame.com";
  const headers = { "X-API-Key": window.AHD_KEY };

  async function tick() {
    try {
      const g = await fetch(`${BASE}/api/public/v1/game`, { headers }).then(r => r.json());
      const next = g.nextTurnAt ? new Date(g.nextTurnAt) : null;
      document.getElementById("clock").textContent =
        `Turn ${g.currentTurn} - ${g.gameDate}${next ? ` - next in ${Math.max(0, Math.round((next - Date.now()) / 60000))}min` : ""}`;
    } catch {
      /* keep last value */
    }
  }
  tick();
  setInterval(tick, 60_000);
</script>
```

## Checklist before you ship

- Key lives in an environment variable or server-side proxy route, never in shipped client code
- One key for the dashboard, dedicated to it, so revocation is clean
- Backoff on 429, stale-snapshot fallback on network errors
- Nothing polls faster than once per minute
- You attribute the game somewhere visible (players find tools this way)
