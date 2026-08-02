# Othello Procedural Visual Proof

## Purpose

This slice tests the opposite production extreme from the Clockwork Eclipse generated-asset pipeline. Othello is rendered from Canvas primitives, gradients, paths, deterministic pseudo-random texture, inline SVG ornament, typography, CSS layout, and time-based effects. No generated or bespoke gameplay image is a runtime dependency.

The experiment remains isolated from the authoritative multiplayer service during its visual pass. It includes a deterministic, transport-neutral rules module and a standalone browser surface. A later service slice can register the reviewed game with shared match dispatch, identity, persistence, invitations, replay, and agent providers without coupling visual iteration to those existing boundaries.

## Selected product directions

The visual target is no longer a neutral “procedural demo” shell. Each theme receives a complete product composition while preserving one rules surface and one renderer architecture:

- **Obsidian & Ivory:** restrained luxury, charcoal space, bronze-gold line work, mineral pieces, framed side scores, and a lower command surface.
- **Neon Circuit:** cyan/magenta polarity, a centered emblem-and-title lockup, a wide luminous instrument enclosure around the square board, circuit traces, legal-action nodes, and a compact cyber HUD matching the selected first-batch reference.
- **Living Garden:** a quiet pond composition, sage cells, charcoal leaf stones, pale lotus stones, visible lily pads, lotus blossoms, ripples, foliage, petals, subdued botanical ornament, and generous negative space.

All desktop compositions reserve an explicit empty upper-right safe zone for the Discord user/profile overlay. No game control, score, title, or state indication may depend on that region.

## Deliverables

- Deterministic 8×8 Othello rules module
- Canonical starting position and legal-move discovery
- Eight-direction capture resolution
- Pass-turn and terminal-state handling
- Deterministic weighted move chooser for solo demonstrations
- Responsive Canvas surface at `/othello.html`
- Three materially distinct product-quality procedural themes
- Inline SVG emblems, token marks, and control glyphs
- Browser coverage for theme switching, move progression, Discord-safe placement, and mobile horizontal bounds
- Curated 1440×1080 desktop captures plus a 390×844 Garden mobile capture

## Theme stress matrix

| Theme | Primary rendering stress | Piece metaphor | Board treatment | Motion language |
| --- | --- | --- | --- | --- |
| Obsidian & Ivory | material illusion, bevel, restrained texture, shadow hierarchy | polished mineral discs | deep green-black cells in a bronze-framed physical board | weighty horizontal rotation |
| Neon Circuit | glow, alpha layering, wide instrument framing, circuit geometry | polarity nodes | energized cyan/magenta lattice inside a broad HUD enclosure | rapid current propagation and polarity inversion |
| Living Garden | organic marks, procedural water atmosphere, calm hierarchy | leaf stones and lotus medallions | moss-edged sage garden cells | ripple, pollen drift, and gentle growth |

## Asset boundary

Permitted production inputs are source code, CSS, browser-available fonts, inline or committed SVG glyphs, and generated-at-runtime visual data. Generic low-cost texture overlays may be considered only when their provenance and maintenance value are explicit. Generated concept art can guide composition but is not copied into the repository, shipped to the browser, or treated as a production asset.

## Screenshot method

Curated screenshots use stable reference states selected to resemble the three approved concepts: move 34 for Obsidian & Ivory and move 27 for Neon Circuit and Living Garden. The Garden mobile state verifies the compact composition. Screenshot review checks board readability, legal-move visibility, score hierarchy, theme identity, Discord-safe spacing, viewport bounds, and whether the total interface reads as a finished game rather than a development demonstration.

## Promotion criteria

The visual proof is ready for authoritative integration when:

1. all rule tests pass;
2. browser syntax and interaction journeys pass;
3. each theme remains legible at desktop and mobile sizes;
4. the themes are distinct beyond palette changes;
5. the upper-right Discord-safe region remains free of required UI;
6. screenshot review identifies no obscured state, clipped board crown or ornament, clipped control, excessive noise, or misleading legal-action cue; and
7. the owner judges at least one theme strong enough to continue.
