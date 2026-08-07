# Decision 0005 — GameFrameBot and external-agent identities are distinct

## Decision

Scribbles GameFrame is the authoritative game platform. Its built-in deterministic opponents use the stable internal player ID `gameframe-bot` and the generic name **GameFrameBot**.

Game-specific presentation may use clearer bot labels such as **CPU Opponent**, **CheckersBot**, **ArenaBot**, or **Monster Master BattleBot**. These participants are rules-based bots used for local play, testing, demonstrations, and deterministic fallback behavior. They must not be described as model-driven AI.

Theo is a separate agent hosted by the separate Scribbles Runtime project. Theo is not a built-in GameFrame opponent, deterministic fallback, Dungeon Master, or required participant. A future explicit connector may allow Scribbles Runtime to submit legal GameFrame actions on Theo's behalf when Theo has been deliberately assigned an ordinary player seat.

The Dungeon Master is owned by the separate `rpg-gm-runtime` project. GameFrame owns tactical rules, legal actions, match state, and outcomes; the Dungeon Master owns campaign narration and campaign decisions.

## Consequences

- Built-in bot seats, observations, action IDs, tests, fixtures, and default services use `gameframe-bot`.
- Active player-facing copy never presents a deterministic bot as Theo or as an AI.
- Game-specific bot names are presentation aliases for the same generic built-in bot identity unless a game explicitly defines otherwise.
- Scribbles Runtime integration is optional and external. It cannot silently replace GameFrameBot or acquire game authority.
- RPG integration depends on `rpg-gm-runtime`, not Scribbles Runtime.
- No compatibility alias for the retired built-in `theo` seat is retained because GameFrame has not been deployed or used with persistent production data.

## Regression protection

Repository checks must reject `theo` as a built-in seat, deterministic opponent, fallback, service property, browser selector, fixture identity, or test participant. Legitimate active references to Theo are limited to documentation of the future external Scribbles Runtime player connector.
