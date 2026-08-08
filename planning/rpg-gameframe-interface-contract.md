---
title: RPG GameFrame Interface Contract
status: accepted
document_type: contract
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-08
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
depends_on:
  - rpg-campaign-experience-directions.md
  - rpg-gm-runtime-boundary.md
  - shared/rpg-scene-entity-and-knowledge-contract.md
related:
  - rpg-platform-delivery-plan.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
  - fixtures/rpg/v1/shared-rpg-fixtures.json
  - fixtures/rpg/v1/campaign-revision-linkage.json
---

# RPG GameFrame Interface Contract

## Purpose

GameFrame provides the complete authenticated player interface for the RPG while exchanging versioned commands, viewer-safe projections, and audience-scoped presentation events with RPG GM Runtime.

The interface must make campaign state legible without turning the Dungeon Master model into the database. Players should be able to see what their character knows, who they have met, who is currently present, what objectives matter, and what tactical encounter they are entering through stable structured projections.

## Required client modes

The first complete GameFrame RPG shell should support:

- campaign join, seat claim, invitation, and resume;
- scene/narration presentation;
- NPC dialogue with viewer-safe speaker identity;
- **Act / Speak** freeform input;
- **Ask Game Master** queries distinct from in-fiction action;
- bounded choices and confirmations;
- People/Characters view based on player knowledge;
- character, creature, party, inventory, equipment, ability, condition, quest, and objective views as implemented;
- location and point-of-interest views;
- player-private and party-private information;
- checks/dice/consequence presentation;
- tactical encounter transition and return;
- campaign history, recap, reconnect, and recovery.

These may be separate routes or layered modes, but they remain one campaign application and authenticated session.

## Player command families

### Act / Speak

An in-fiction declaration uses a dedicated semantic command such as:

```ts
type SubmitCampaignActionV2 = {
  kind: "campaign.submit_action";
  expectedGameframeCoordinationRevision: number;
  text: string;
};
```

The runtime interprets this as a fictional-world action. Present entities may perceive it according to scene/audience rules.

### Ask Game Master

A player-to-GM question uses a distinct command such as:

```ts
type AskGameMasterV1 = {
  kind: "campaign.ask_gm";
  expectedGameframeCoordinationRevision: number;
  question: string;
};
```

Examples include:

- "Would my license let me inspect that?"
- "Do I recognize this seal?"
- "What do I know about this monster species?"
- "Remind me what Pell told us about the road patrol."

This command does **not** automatically become speech in the fiction, does not make present NPCs hear the question, and should not advance fictional time merely because the player requested clarification.

The runtime answers from player-authorized knowledge, character state, committed mechanics, and campaign rules. If the requested fact is unknown to the character, the answer must preserve that uncertainty rather than exposing runtime truth.

### Choices and mechanical commands

GameFrame continues to support bounded structured choices and GameFrame-owned mechanical actions when a mechanic is active.

Every mutation carries a stable command identity, expected GameFrame coordination revision, bounded content, and exact-retry semantics. Player identity comes from authenticated GameFrame context and is never accepted from a client-authored player-ID field.

## Presentation event origin

Audience and semantic origin are separate concepts.

A presentation event should be able to identify an origin such as:

- `player`;
- `dungeon-master`;
- `entity`;
- `system`;
- `tactical-encounter`.

An entity-origin event references a stable runtime entity ID, but GameFrame renders only the viewer-authorized identity label supplied through the player-safe projection.

The UI may therefore render transcript labels such as:

- `PLAYER — Orange`;
- `GAME MASTER`;
- `Mara Venn` after her identity is known;
- `the woman in inspector's gear` before her name is known;
- `TACTICAL ENCOUNTER`.

GameFrame should not rely on bookkeeping event kinds such as `Action Submitted` as the primary human-readable speaker identity.

## Scene projection

GameFrame receives a viewer-safe current-scene projection derived from runtime authoritative scene state.

A first client projection should support:

```ts
type PlayerSceneProjectionV1 = {
  sceneId: string;
  locationId: string;
  locationLabel: string;
  presentPeople: ScenePersonProjectionV1[];
  presentCreatures: SceneCreatureProjectionV1[];
  visibleObjects: SceneObjectProjectionV1[];
  knownHazards: SceneHazardProjectionV1[];
  exits: SceneExitProjectionV1[];
};
```

Only viewer-authorized information appears. GameFrame does not receive hidden entity names, secret scene facts, or runtime-only object metadata.

The scene projection is not tactical authority by itself. It is the campaign presentation of current runtime world state.

## People / Characters projection

GameFrame should expose a People surface backed by a viewer-safe knowledge projection, not the complete runtime entity registry.

A first projection should support fields equivalent to:

```ts
type KnownPersonProjectionV1 = {
  entityId: string;
  displayLabel: string;
  knownRole?: string;
  knownFacts: string[];
  relationship?: string;
  firstMetLocationId?: string;
  lastSeenLocationId?: string;
  currentPresence?: "present" | "absent" | "unknown";
  portrait?: SemanticAssetReferenceV1;
};
```

Unknown people are omitted entirely. A canonical runtime name is shown only after that viewer has learned it.

A player may therefore see one stable entity evolve from:

```text
"the woman in inspector's gear"
→ "the checkpoint inspector"
→ "Mara Venn"
```

without changing the entity ID.

## Entity inspection

A player may request inspection of an exposed/known entity or view. The request identifies only an entity already authorized by the player projection.

GameFrame returns/presents player-safe details. It must not expose hidden runtime fields because an attacker guessed a stable entity ID.

## Runtime presentation events

RPG GM Runtime may emit audience-scoped semantic events including:

- scene opened/changed;
- narration;
- dialogue;
- entity/person/item/ability/quest/objective/handout cards;
- freeform input request;
- bounded choice;
- Ask-GM response;
- check requested/resolved/consequence;
- public, party-private, or player-private reveal;
- location transition;
- encounter requested/started/updated/completed/cancelled/failed;
- media reference with deterministic fallback;
- recap/resume marker.

One runtime narrative commit may contain several presentation events with different explicit audiences. GameFrame preserves each audience independently.

## Structured campaign views

GameFrame receives narrow player-visible projections for repeated systems rather than the runtime's full hidden semantic state.

Initial projections may cover:

- current scene;
- known people;
- character and companion state;
- party composition;
- known inventory/equipment/abilities/conditions;
- quests/objectives;
- current location and exposed points of interest;
- known clues/conclusions;
- active mechanic/encounter state.

## Encounter port

GameFrame provides launch, retrieval, lifecycle, reconnect, match access, and structured terminal-outcome operations for tactical encounters.

### Participant identity invariant

```text
runtime campaign entity/participant ID
→ GameFrame encounter participant record
→ authoritative tactical unit/object mapping
→ structured terminal result
→ runtime aftermath for the same campaign entity
```

GameFrame adapters may validate/enrich a supported rules profile but may not replace campaign entities with unrelated fixed-duel identities.

If the selected tactical rules cannot truthfully materialize a combat-relevant participant, role, objective, or scene requirement, launch fails closed.

## Encounter-scene projection

The target RPG encounter request is derived from the runtime Scene Registry through the shared Encounter Scene Compiler contract.

A validated request may include:

- exact participant entity IDs;
- campaign participant IDs;
- team/faction;
- controller or deterministic behavior authority;
- tactical role;
- creature/trainer rules profiles;
- relevant scene objects;
- exits/withdrawal zones;
- objectives and alternate terminal conditions;
- battlefield intent;
- package capability profile.

Monster Master campaign-specific behavior is controlled by `monster-master-rpg-encounter-rules.md`.

## Campaign tactical outcomes

The target structured participant-result vocabulary supports more than elimination:

- `active`;
- `incapacitated`;
- `withdrew`;
- `fled`;
- `surrendered`;
- `recalled`;
- `dead` only where an explicitly lethal rules profile supports it.

GameFrame may support a narrower subset during implementation. Unsupported requested semantics fail closed instead of being discarded.

The tactical result may additionally carry supported injuries/conditions, spent resources, objective state, object custody/damage, exit destination, and authoritative revision/commit metadata.

## Monster Master current bounded surface

The current durable configured Monster Master RPG path remains valid substrate:

- exact `participantUnitIds` mapping;
- supported Emberling/Bulwark creature profiles;
- one through three creatures per side;
- equal creature counts under the existing deployment algorithm;
- compact-duel battlefield;
- normal difficulty;
- defeat-opposition objective;
- trainers remain controllers rather than tactical units.

That is the current implementation boundary, **not** the final campaign rules contract.

The next campaign-specific evolution is scene fidelity: withdrawal/escape, asymmetric materialization, trainer profiles, and other participant roles only as actual campaign needs justify them.

## Identity model

- Human players use stable principals derived from authenticated sessions.
- RPG GM Runtime uses a dedicated narrowly scoped service principal.
- Built-in deterministic opponents remain GameFrameBot/game-specific bots.
- Theo, if later connected, occupies an ordinary player seat through Scribbles Runtime and receives no hidden campaign authority.
- Display names, avatars, client-supplied Discord IDs, URLs, and synthetic tactical team seats are not canonical authentication identities.

## Revision and ordering model

Keep the three production positions separate:

### GameFrame coordination revision

`gameframeCoordinationRevision` advances once per accepted GameFrame coordination transaction such as command acceptance, membership change, runtime-linkage mutation, or encounter reference update.

### GameFrame presentation sequence

`presentationSequence` advances once per appended player presentation event and is the ordering basis for cursors/recovery.

### Runtime narrative revision

`narrativeRevision` is owned exclusively by RPG GM Runtime and advances once per accepted runtime narrative commit.

A runtime receipt records the exact source GameFrame coordination revision. GameFrame links it only when that provenance remains valid.

Exact retries return original receipts without advancing a position twice.

## Correctness requirements

- server-derived player identity;
- runtime validation at every boundary;
- explicit payload/collection bounds;
- expected revision checks in the authority domain being mutated;
- durable idempotency and exact retry;
- stable machine-readable errors;
- event-time audience authorization;
- viewer-bound resumable cursors;
- polling recovery when realtime projections are missed;
- no correctness dependency on a permanently connected WebSocket;
- no direct cross-repository storage access;
- unknown people/entities omitted from unauthorized projections;
- canonical runtime names never inferred as player knowledge;
- player-to-GM queries never silently converted into fictional speech;
- tactical launch never silently drops combat-relevant scene entities/roles.

## First upgraded conformance sequence

A deterministic cross-repository fixture should eventually prove:

1. Player attaches to a Monster Master campaign.
2. Current scene projection lists only viewer-authorized present entities.
3. A package actor appears first through a descriptor, not a hidden canonical name.
4. Player uses **Ask Game Master**; the answer does not become fictional dialogue or advance the scene.
5. Player uses **Act / Speak** and the action enters the ordinary Dungeon Master path.
6. A name revelation updates the same People entity rather than creating a duplicate.
7. An incidental NPC is requested/materialized, later revisited, and retains identity.
8. A deterministic check resolves.
9. Current scene enters a real tactical encounter.
10. Exact participant identities survive launch and terminal outcome.
11. At least one non-elimination outcome such as escape/withdrawal is represented once supported.
12. Runtime commits aftermath and GameFrame resumes the campaign.
13. Restart/reconnect does not duplicate people, scenes, commands, encounters, or aftermath.

The stronger two-human fixture adds player-private/party-private divergence and cooperative tactical control.

## Protocol-v2 compatibility

Existing protocol-v2 coordination/narrative linkage remains the production transport basis. New commands and projections must extend versioned contracts deliberately and must not reintroduce the old ambiguous single `campaignRevision` model.

Legacy protocol-v1 reducer fixtures remain regression-only.

## Governing rule

> GameFrame presents the campaign the player is actually in: their actions are distinct from questions to the GM, people are shown only as the character knows them, scenes list who is truly present, and Arena Battles receives the same campaign entities rather than a replacement duel cast.
