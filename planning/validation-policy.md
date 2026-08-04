---
title: GameFrame validation policy
status: accepted
owner: GameFrame
created: 2026-08-04
updated: 2026-08-04
applies_to:
  - pull-request validation
  - merge validation
  - manual regression validation
---

# GameFrame validation policy

## Purpose

GameFrame validation must protect current authority, rendering, and player-facing contracts without making every pull request execute historical browser journeys for superseded prototypes.

## Required pull-request gate

The required `npm run validate` command covers:

- deterministic unit, service, replay, schema, and authority tests;
- Cloudflare workerd tests;
- asset and browser-bundle reproducibility;
- browser syntax checks;
- repository self-checks;
- a bounded active-product browser smoke suite covering the game hub and current Monster Master command, camera, recovery, and motion flows.

The required gate does not execute the complete historical browser suite or the complete visual-baseline matrix.

## Full regression gate

`npm run validate:full` retains the complete browser and visual-baseline suites for deliberate manual or scheduled regression work. A failing historical journey does not block an unrelated pull request unless the journey describes a currently supported product contract affected by that change.

The full gate should remain manual while known browser debt is red. It may become scheduled once the active-product suite is green and historical prototype coverage has been retired or rewritten.

## Prototype coverage

Prototype mechanics remain covered through deterministic engine, service, pathfinding, replay, line-of-sight, revision, and authority tests.

Browser journeys that only exercise removed prototype navigation, headings, controls, or layouts should be deleted or archived rather than kept in required CI. Current products should receive replacement journeys against their current interface contracts.

## Current-product failures

Failures involving current Monster Master interaction, state projection, or presentation are not classified as harmless prototype debt. They must be repaired or intentionally rewritten before their replacement journey is promoted into the required smoke suite.

Examples identified during the August 4, 2026 backlog runs include Pixi pointer interception over command controls, stale deployment actions containing no position, and defeated roster presentation drift.

## Change-scoped UI review

Player UI Review remains path-scoped. Terrain or Monster Master UI changes must run their focused contract, browser, and screenshot evidence. Shared-document-only changes must not trigger the UI review workflow.
