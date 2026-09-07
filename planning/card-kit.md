---
title: GameFrame CardKit
status: active
document_type: architecture
owner: Scribbles GameFrame
last_updated: 2026-09-07
applies_to:
  - card games
  - Spider Solitaire
---

# GameFrame CardKit

## Purpose

CardKit is the shared presentation substrate for traditional card games inside GameFrame. It does not own game rules, turns, scoring, legal actions, hidden information, persistence, or multiplayer authority.

Game-specific deterministic engines remain under `src/games/*`. CardKit owns reusable browser-facing card presentation concerns:

- rank and suit labeling;
- high-contrast card faces;
- face geometry;
- stack overlap fitting;
- readable covered-card rank sizing;
- reusable stock, waste, hand, fan, and tableau primitives as they are actually needed;
- renderer-independent card metrics.

Spider Solitaire is the first consumer.

## Rendering direction

The current renderer is DOM-hosted with an SVG text face. This keeps ordinary browser controls, touch input, keyboard behavior, and accessibility straightforward while eliminating fragile CSS line-box placement for card ranks.

PixiJS is already a GameFrame dependency and may later become an additional CardKit renderer backend for animation-heavy card games. Pixi is not the card-game authority and is not required for Spider Solitaire.

## Boundary

```text
game-specific deterministic rules
        ↓
game state / card model
        ↓
CardKit geometry + face semantics
        ↓
DOM/SVG renderer today
        ↓
optional Pixi renderer later
```

A future Pixi backend must consume the same card semantics and layout metrics rather than becoming a second rules implementation.

## Old-eyes defaults

Traditional card games intended for older family players should prefer:

- rank-first hierarchy;
- strong black/red on white contrast;
- minimal redundant suit decoration when the suit is already implied by the game mode;
- large covered-card ranks sized to the actual exposed overlap band;
- full final/top cards rather than shrinking the card body to make a stack fit;
- overlap compression before card-face compression;
- no horizontal or vertical page scrolling for bounded solitaire/tableau layouts where the game can reasonably fit the viewport.

## Visual-development contract

`/card-lab.html` is the shared development surface for card face and stack review. It is not a game and contains no authoritative rules.

Card presentation changes require:

1. focused browser assertions for glyph containment and stack bounds;
2. representative mobile and desktop screenshots;
3. visual inspection of the actual screenshots;
4. iteration when clipping, hierarchy, spacing, or proportions are visibly poor.

A successful screenshot capture is evidence collection, not visual approval.
