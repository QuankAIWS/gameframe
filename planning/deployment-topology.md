# Deployment Topology

## Recommended first public deployment

Scribbles GameFrame should be deployable independently from the Scribbles Runtime host.

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

Scribbles Runtime host
├── Scribbles Runtime
├── Theo personality, model, memory, and Discord channel integration
└── Scribbles GameFrame adapter/client
        │ outbound authenticated HTTPS as Theo
        └──────────────────────────────► Cloudflare GameFrame API
```

This topology keeps active games available when the Scribbles Runtime host is busy, rebooting, or offline. Scribbles Runtime hosts Theo's cognition and narration; it is not the game server. Theo is the registered participant represented through the runtime adapter.

## Component placement

### Cloudflare

- Static web and Discord Activity assets
- Public API routing and authenticated session enforcement
- One Durable Object authority per active match
- Durable snapshots and event history
- Deterministic fallback opponents
- Hibernating WebSocket fan-out and reconnect coordination

### Scribbles Runtime host

- Scribbles Runtime and model access
- Theo's personality, memory, and Discord integration
- A narrow GameFrame integration adapter bound to Theo's player identity
- Optional local development and administration tools
- No authoritative public match state

### Development machine or local server

- Standalone Node development server
- Fake Discord host
- Fake Scribbles Runtime adapter acting for Theo
- Local deterministic tests
- Optional conventional deployment adapter if Cloudflare proves unsuitable

## Failure behavior

- If Scribbles Runtime is offline, human-versus-human games continue.
- A game configured for deterministic Theo fallback can continue without Scribbles Runtime.
- A game requiring live Theo decisions pauses the `theo` seat and exposes a clear unavailable state; it does not transfer authority to the browser.
- Restarting or replacing the runtime host must not lose Cloudflare-hosted matches.
- Cloudflare failure affects public game availability but does not expose or compromise the private runtime host.

## Resource posture

Tic-tac-toe and compact turn-based tactics require negligible local compute when hosted on Cloudflare. The Scribbles Runtime host performs model calls and adapter work only when Theo must decide, explain, narrate, or react. Real-time simulation may later require a dedicated server, but should retain the same public API and agent-player contracts.

## Identity placement

Discord user authentication terminates at the public Cloudflare application boundary. The Activity obtains an authorization code through the Embedded App SDK; a backend route exchanges it using the application secret, verifies the Discord user, and establishes the GameFrame principal used by HTTP and WebSocket requests. Durable Objects receive only the already-derived player identity.

Scribbles Runtime does not reuse a Discord human session. Its adapter receives a narrow service credential that maps only to the registered `theo` agent identity and cannot impersonate human seats.

## Session secret

The public Worker requires a `SESSION_SECRET` provisioned through Cloudflare's secret store. It signs short-lived Activity sessions after Discord verification and validates them before routing any match request. Removing or rotating the secret invalidates sessions signed by the previous value; rotation therefore requires an explicit operator procedure once live sessions matter.
