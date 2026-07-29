# Decision 0005 — Scribbles platform and Theo agent identities are distinct

## Decision

Scribbles GameFrame is the game platform and service. Scribbles Runtime is the peer agent runtime. Theo is the public-facing agent and registered GameFrame player with stable player ID `theo`.

## Consequences

- Package, service, deployment, and repository identifiers use `scribbles-gameframe`.
- Runtime integration language uses Scribbles Runtime.
- User-facing opponent copy, deterministic fallback identity, service-principal authorization, observations, action IDs, and match seats use Theo and `theo`.
- Scribbles Runtime may select and submit actions on Theo's behalf but never becomes the player identity or game authority.

## Regression protection

Repository self-checks preserve the distinction between platform, runtime, and agent identities while allowing legitimate references to Theo.
