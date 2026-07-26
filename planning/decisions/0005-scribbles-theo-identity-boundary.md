# Decision 0005 — Scribbles platform and Theo agent identities are distinct

## Decision

Scribbles GameFrame is the game platform and service. Scribbles Runtime is the peer agent runtime. Theo is the public-facing agent and registered GameFrame player with stable player ID `theo`.

## Consequences

- Package, service, deployment, and repository identifiers use `scribbles-gameframe`.
- Runtime integration language uses Scribbles Runtime.
- User-facing opponent copy, deterministic fallback identity, service-principal authorization, observations, action IDs, and match seats use Theo and `theo`.
- Scribbles Runtime may select and submit actions on Theo's behalf but never becomes the player identity or game authority.
- Historical records may retain retired names when accurately describing what was executed at that time.

## Regression protection

Repository self-checks must reject the previous hyphenated project package and service identifiers, along with current-tense OpenClaw integration artifacts. They must not reject legitimate references to Theo.
