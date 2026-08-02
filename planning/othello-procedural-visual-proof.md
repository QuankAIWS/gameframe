# Othello Procedural Visual Proof

## Purpose

This slice tests the opposite production extreme from the Clockwork Eclipse generated-asset pipeline. Othello is rendered from Canvas primitives, gradients, paths, deterministic pseudo-random texture, typography, CSS layout, and time-based effects. No bespoke generated gameplay image is required.

The experiment is intentionally isolated from the authoritative multiplayer service during its first visual pass. It adds a deterministic, transport-neutral rules module and a standalone browser surface. Once the visual direction is reviewed, a later service slice can register the game with shared match dispatch, identity, persistence, invitations, replay, and agent providers without coupling visual iteration to those existing boundaries.

## Deliverables

- Deterministic 8×8 Othello rules module
- Canonical starting position and legal-move discovery
- Eight-direction capture resolution
- Pass-turn and terminal-state handling
- Deterministic weighted move chooser for solo demonstrations
- Responsive Canvas surface at `/othello.html`
- Three materially distinct procedural themes
- Browser coverage for theme switching, move progression, and mobile horizontal bounds

## Theme stress matrix

| Theme | Primary rendering stress | Piece metaphor | Board treatment | Motion language |
| --- | --- | --- | --- | --- |
| Obsidian & Ivory | material illusion, bevel, restrained texture, shadow hierarchy | mineral discs | carved dark stone in a framed physical board | weighty horizontal rotation |
| Neon Circuit | bloom-like glow, alpha layering, scanning fields, circuit detail | polarity nodes | energized lattice | rapid current propagation and polarity inversion |
| Living Garden | organic asymmetry, procedural veins, ambient particles, soft gradients | seed pods and blossoms | moss-framed garden cells | bloom, ripple, and seasonal change |

## Asset boundary

The first pass permits only source code, CSS, fonts already available to the browser, and generated-at-runtime visual data. Small SVG UI glyphs or generic texture overlays may be considered later only when their value exceeds the maintenance and provenance cost. Generated concept art may guide composition but should not become a runtime dependency for this proof.

## Review states

Curated screenshots should capture the same representative midgame position at desktop dimensions for all three themes. A mobile Garden state should confirm responsive composition and provide a fourth evidence frame. Review focuses on board readability, distinct theme identity, legal-move visibility, score hierarchy, material coherence, and whether the result still reads as intentional commercial presentation rather than programmer art.

## Promotion criteria

The visual proof is ready for authoritative integration when:

1. all rule tests pass;
2. browser syntax and interaction journeys pass;
3. each theme remains legible at desktop and mobile sizes;
4. the themes are distinct beyond palette changes;
5. screenshot review identifies no obscured state, clipped control, excessive visual noise, or misleading legal-action cue; and
6. the owner judges at least one theme strong enough to continue.
