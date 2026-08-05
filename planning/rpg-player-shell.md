---
title: Monster Master RPG Player Shell
status: implemented-foundation
document_type: implementation_record
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
related:
  - rpg-gameframe-interface-contract.md
  - rpg-signed-edge-authentication.md
  - ../public/monster-master-rpg.html
---

# Monster Master RPG Player Shell

## Purpose

Provide the first usable authenticated campaign surface inside GameFrame while the richer character, party, inventory, map, choice, and encounter projections continue to develop.

The shell is a separate destination from Monster Master Arena Battles. The human Master remains the trainer/player character; the tactical battler remains an encounter destination controlled by campaign state rather than the RPG shell itself pretending to be a monster.

## Current route

```text
/monster-master-rpg.html?campaign=<campaign-id>
```

The existing GameFrame authentication launcher establishes either the hosted Discord session or the explicit local development identity. The browser never supplies authoritative player identity inside campaign request bodies.

## Implemented player flow

1. Open Monster Master RPG from the GameFrame library.
2. Enter or resume a campaign code.
3. Attach through protocol-v2 `POST /api/rpg/campaigns/{campaignId}/attach`.
4. Render the player-filtered campaign event feed.
5. Display GameFrame coordination, presentation, and linked narrative positions separately.
6. Submit a public freeform action through `campaign.submit_action`.
7. Retain one stable command ID across an unconfirmed network retry.
8. Refresh after command acceptance and poll for GM-authored presentation events.
9. Reattach when the page becomes visible after suspension.
10. Switch campaigns without retaining the previous campaign feed in memory.

## Presentation posture

The shell renders semantic events generically rather than hardcoding campaign lore. It recognizes narration, dialogue, prompts, checks/consequences, and player actions, while preserving a bounded fallback for new event payloads.

GameFrame continues to own layout, responsive behavior, accessibility, and event presentation. RPG GM Runtime owns semantic content and narrative truth.

## Correctness boundaries

- campaign IDs use the accepted identifier grammar;
- action text is bounded to 2,000 characters;
- every action carries a stable command ID and the current expected GameFrame coordination revision;
- stale revision conflicts cause a projection refresh before another action is created;
- network or timeout ambiguity preserves the exact command for idempotent retry;
- recovered presentation events are deduplicated by event ID;
- polling is recovery, not authority, and pauses while the page is hidden;
- the browser uses the established GameFrame identity adapter rather than injecting player headers directly.

## Deliberate current limits

This foundation does not yet provide:

- campaign discovery or invitation acceptance;
- character, party, inventory, equipment, ability, condition, quest, objective, location, or map projections;
- bounded choice controls;
- acknowledgements and signed resumable cursors;
- encounter transition UI;
- player-private labeling when the projection omits explicit audience metadata;
- offline command queueing beyond one ambiguous in-flight action;
- push updates or WebSocket campaign events.

Those remain additive slices on the same campaign application. They should not create a second RPG client or bypass the protocol-v2 campaign boundary.

## Validation

The focused RPG gate validates the browser model and syntax. Required browser acceptance verifies:

- the separate GameFrame library destination;
- authenticated campaign attach;
- revision display;
- public and private-looking event presentation from the supplied projection;
- freeform command construction with the current coordination revision;
- post-command refresh and GM response rendering.
