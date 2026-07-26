# Deployment Topology

## Recommended first public deployment

Theo GameFrame should be deployable independently from Theo's OpenClaw host.

```text
Discord users
    │
    ▼
Discord Activity / standalone browser
    │ HTTPS commands + hibernating WebSocket projections
    ▼
Cloudflare Worker
    ├── static browser assets
    ├── authentication and public API boundary
    └── match routing
            │
            ▼
      Durable Object per match
      ├── authoritative state
      ├── revisions and idempotency
      ├── event history
      └── deterministic fallback players

Theo host
├── OpenClaw Gateway
├── Discord channel integration
└── Theo GameFrame plugin/client
        │ outbound authenticated HTTPS
        └──────────────────────────────► Cloudflare GameFrame API
```

This topology keeps active games available when Theo's computer is busy, rebooting, or offline. Theo is a participant and narrator, not the game server.

## Component placement

### Cloudflare

- Static web and Discord Activity assets
- Public API routing and authenticated session enforcement
- One Durable Object authority per active match
- Durable snapshots and event history
- Deterministic fallback opponents
- Hibernating WebSocket fan-out and reconnect coordination

### Theo host

- OpenClaw and Theo's model access
- The Discord bot/channel runtime
- A narrow GameFrame integration plugin
- Optional local development and administration tools
- No authoritative public match state

### Development machine or local server

- Standalone Node development server
- Fake Discord host
- Fake Theo player
- Local deterministic tests
- Optional conventional deployment adapter if Cloudflare proves unsuitable

## Failure behavior

- If Theo is offline, human-versus-human games continue.
- A game configured for deterministic fallback can continue without Theo.
- A game requiring Theo pauses his seat and exposes a clear unavailable state; it does not transfer authority to the browser.
- Restarting or replacing Theo's host must not lose Cloudflare-hosted matches.
- Cloudflare failure affects public game availability but does not expose or compromise the private Theo host.

## Resource posture

Tic-tac-toe and compact turn-based tactics require negligible local compute when hosted on Cloudflare. Theo's host performs model calls and plugin work only when Theo must decide, explain, narrate, or react. Real-time simulation may later require a dedicated server, but should retain the same public API and Theo-player contracts.

## Identity placement

Discord user authentication terminates at the public Cloudflare application boundary. The Activity obtains an authorization code through the Embedded App SDK; a backend route exchanges it using the application secret, verifies the Discord user, and establishes the GameFrame principal used by HTTP and WebSocket requests. Durable Objects receive only the already-derived player identity.

Theo does not reuse a Discord human session. The OpenClaw plugin receives a narrow service credential that maps only to Theo's registered agent identity and cannot impersonate human seats.

## Session secret

The public Worker requires a `SESSION_SECRET` provisioned through Cloudflare's secret store. It signs short-lived Activity sessions after Discord verification and validates them before routing any match request. Removing or rotating the secret invalidates sessions signed by the previous value; rotation therefore requires an explicit operator procedure once live sessions matter.
