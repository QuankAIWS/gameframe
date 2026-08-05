---
title: Monster Master RPG Player Shell
status: implemented-freeform-foundation
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

The primary RPG interaction is open-ended conversation with an LLM Game Master. This is not a fixed dialogue-tree interface. The player must be able to describe an action, speak, ask a question, negotiate, investigate, improvise, or attempt something the interface did not anticipate.

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
6. Write any public freeform action or dialogue through `campaign.submit_action`.
7. Render authored `choice.presented` options as optional action suggestions.
8. Let a suggestion populate the composer without sending anything.
9. Let the player edit, replace, or ignore the suggestion before submission.
10. Retain one stable command ID across an unconfirmed freeform-action retry.
11. Refresh after command acceptance and poll for GM-authored presentation events.
12. Reattach when the page becomes visible after suspension.
13. Switch campaigns without retaining the previous campaign feed in memory.

## Freeform-first interaction policy

The text composer is the authoritative player-input surface for ordinary narrative play.

- It remains available while suggested approaches are visible.
- Clicking a suggestion drafts text; it does not submit a command.
- Suggested approaches are never exhaustive and never imply that unlisted actions are invalid.
- The player may alter every word of a suggestion or ignore it completely.
- The GM runtime receives the final written text and interprets it semantically in campaign context.
- UI recommendations exist to reduce blank-page friction, not to constrain the model or simulate a branching video-game dialogue tree.

Structured `campaign.submit_choice` remains a supported lower-level contract for future explicit selection surfaces where exact identifiers are materially required, such as a party vote, inventory selection, or non-narrative confirmation. The ordinary RPG shell does not use that command for conversational play.

## Presentation posture

The shell renders semantic events generically rather than hardcoding campaign lore. It recognizes narration, dialogue, optional approaches, prompts, checks/consequences, and player actions, while preserving a bounded fallback for new event payloads.

GameFrame continues to own layout, responsive behavior, accessibility, and event presentation. RPG GM Runtime owns semantic content, contextual interpretation, NPC responses, consequences, and narrative truth.

## Correctness boundaries

- campaign and command IDs use the accepted identifier grammar;
- action text is bounded to 2,000 characters;
- authored suggestion groups contain from one through 16 unique options;
- optional `actionText` is treated only as editable draft copy;
- every submitted action carries a stable command ID and the current expected GameFrame coordination revision;
- stale revision conflicts cause a projection refresh before another command is created;
- network or timeout ambiguity preserves the exact written action for idempotent retry;
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
- offline command queueing beyond one ambiguous in-flight action;
- push updates or WebSocket campaign events.

Those remain additive slices on the same campaign application. They should not create a second RPG client, replace freeform input with menu traversal, or bypass the protocol-v2 campaign boundary.

## Validation

The focused RPG gate validates the browser model, durable service, atomic acceptance transaction, outbox payload, and syntax. Required browser acceptance verifies:

- the separate GameFrame library destination;
- authenticated campaign attach;
- revision display;
- public and private-looking event presentation from the supplied projection;
- optional suggestion rendering;
- suggestion-to-draft behavior without network submission;
- replacement of the suggestion with an unrelated player-authored action;
- `campaign.submit_action` construction with the final text and current coordination revision;
- exact retry after ambiguous delivery;
- post-command refresh and GM response rendering.
