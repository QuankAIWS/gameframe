---
title: Monster Master RPG Player Shell
status: implemented-choice-foundation
document_type: implementation_record
owner: Scribbles GameFrame
last_updated: 2026-08-05
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

Provide the first usable authenticated campaign surface inside GameFrame while richer character, party, inventory, map, and encounter projections continue to develop.

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
7. Render bounded `choice.presented` events as authored option controls.
8. Submit one structured `campaign.submit_choice` command using the choice and option identifiers supplied by RPG GM Runtime.
9. Retain one stable command ID across an unconfirmed action or choice retry.
10. Refresh after command acceptance and poll for GM-authored presentation events.
11. Reattach when the page becomes visible after suspension.
12. Switch campaigns without retaining the previous campaign feed in memory.

## Structured choice authority

GameFrame treats choice presentation as authorization data, not decorative copy. Before accepting a choice it verifies:

- the choice is present in the authenticated player's projection;
- the player is listed in `allowedPlayerIds` when that field is supplied;
- the submitted option ID exists in the bounded authored option list;
- another command has not already closed the choice;
- the expected GameFrame coordination revision still matches.

The browser sends only `choiceId` and `optionId`. The option label shown in the committed presentation event is recovered from the trusted presentation event rather than accepted from the browser. Choice acceptance, the public `campaign.choice_submitted` event, the coordination advance, the command receipt, and runtime outbox custody commit in one SQLite transaction. Exact retry returns the original receipt. Conflicting reuse remains a stable error.

RPG GM Runtime receives the structured choice delivery, records `campaign.choice_submitted` in its campaign journal, and preserves the choice and option identifiers through deterministic fallback or a configured semantic planner.

## Presentation posture

The shell renders semantic events generically rather than hardcoding campaign lore. It recognizes narration, dialogue, bounded choices, prompts, checks/consequences, and player actions, while preserving a bounded fallback for new event payloads.

GameFrame continues to own layout, responsive behavior, accessibility, and event presentation. RPG GM Runtime owns semantic content and narrative truth.

## Correctness boundaries

- campaign, choice, option, and command IDs use the accepted identifier grammar;
- action text is bounded to 2,000 characters;
- authored choices contain from one through 16 unique options;
- every mutation carries a stable command ID and the current expected GameFrame coordination revision;
- stale revision conflicts cause a projection refresh before another command is created;
- network or timeout ambiguity preserves the exact command for idempotent retry;
- only the exact pending choice option remains retryable while delivery is ambiguous;
- recovered presentation events are deduplicated by event ID;
- polling is recovery, not authority, and pauses while the page is hidden;
- the browser uses the established GameFrame identity adapter rather than injecting player headers directly.

## Deliberate current limits

This foundation does not yet provide:

- campaign discovery or invitation acceptance;
- character, party, inventory, equipment, ability, condition, quest, objective, location, or map projections;
- acknowledgements and signed resumable cursors;
- encounter transition UI and a campaign-to-battle binding;
- player-private labeling when the projection omits explicit audience metadata;
- offline command queueing beyond one ambiguous in-flight command;
- push updates or WebSocket campaign events.

Those remain additive slices on the same campaign application. They should not create a second RPG client or bypass the protocol-v2 campaign boundary.

## Validation

The focused RPG gate validates the browser model, durable service, atomic acceptance transaction, outbox payload, and syntax. Required browser acceptance verifies:

- the separate GameFrame library destination;
- authenticated campaign attach;
- revision display;
- public and private-looking event presentation from the supplied projection;
- freeform command construction with the current coordination revision;
- bounded choice rendering and authorization state;
- structured choice command construction;
- exact browser retry after ambiguous delivery;
- post-command refresh and GM response rendering.
