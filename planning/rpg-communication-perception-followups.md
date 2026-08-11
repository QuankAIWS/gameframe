---
title: RPG Communication, Perception, and Chronicle Follow-ups
status: active
document_type: implementation-note
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-10
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Monster Master RPG
related:
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
---

# RPG Communication, Perception, and Chronicle Follow-ups

## Current interim speech rule

For the current bounded Monster Master exploration maps, normal `Talk` may address any viewer-authorized actor physically present in the active materialized scene. Treat this as ordinary speech or calling/yelling across the current map, not telepathy.

GameFrame must still resolve the target from the current viewer-safe materialization and Runtime must still prove semantic scene presence. Off-scene actors are never legal Talk targets merely because the player names them in text.

Physical object interactions and route traversal remain range-gated.

## Future acoustics and whisper

Do not encode the current map-wide speech rule as the final acoustics model.

Future larger maps may add authoritative audibility inputs such as distance, walls/doors, line of sight where relevant, environmental noise, voice volume, special senses, and explicit communication mechanics.

Adjacent or otherwise acoustically private positioning should later enable a `whisper` mode. A whisper is an in-fiction speech event with restricted audibility; it is not equivalent to Ask-GM/private out-of-fiction communication.

## Viewer-relative Campaign Chronicle

The Campaign Chronicle / world ledger is an observer-authorized projection, not a globally identical transcript.

Different players may legitimately receive different Chronicle entries for the same underlying scene because of:

- physical presence and audibility;
- line of sight or other senses;
- character perception/awareness mechanics;
- private or whispered speech;
- Observer Knowledge and identity stage;
- player-private Game Master communication.

Example:

```text
Player A whispers to Pell
→ Player A and Pell hear the words
→ nearby high-perception Player B may notice that a whisper occurred, and perhaps only that fact
→ low-perception Player C may receive no Chronicle event at all
→ no client receives content its observer is not authorized to know
```

The UI must not reconstruct hidden events and then redact them. Viewer authorization precedes projection/presentation.

## Diegetic interaction hints

Map interaction affordances should be viewer-safe presentation derived from already-authorized information.

Near-term examples:

- speech-bubble affordance over an actor the viewer may Talk to;
- attention/exclamation affordance over an already-visible actionable object;
- disabled/crossed interaction affordance when a known actor is presently unwilling or unable to engage.

Future perception mechanics may reveal an attention marker only when the character notices something the player has not noticed. This is a positive player aid: the character can be more perceptive or knowledgeable than the human player.

An attention marker must never be inferred from hidden package truth in the browser. Runtime/Rules authority must first authorize the discovery or viewer-safe hint, then GameFrame may render it.

## Presentation direction

Direct character interaction should increasingly feel embodied:

```text
click actor / speech affordance
→ compact in-world speech composer
→ speech bubble/subtitle response near actor
→ same authorized dialogue retained in Campaign Chronicle when appropriate
```

One semantic event may have both ephemeral in-world presentation and durable Chronicle presentation. Presentation duplication must not create duplicate semantic events.

## Deferred work

- generic typed `inspect` interaction for landmarks/objects such as signs;
- perception/awareness rules and viewer-safe attention-hint schema;
- whisper command and audibility receipts;
- larger-map acoustics/LOS model;
- per-observer Chronicle projection and multiplayer proof;
- conversation refusal/availability states and crossed Talk affordance.
