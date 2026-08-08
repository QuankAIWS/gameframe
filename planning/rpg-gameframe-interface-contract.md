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
  - shared/rpg-embodied-exploration-and-character-performance-contract.md
related:
  - rpg-platform-delivery-plan.md
  - tactical-battler-rpg-foundation.md
  - monster-master-rpg-encounter-rules.md
  - fixtures/rpg/v1/shared-rpg-fixtures.json
  - fixtures/rpg/v1/campaign-revision-linkage.json
---

# RPG GameFrame Interface Contract

## Purpose

GameFrame provides the complete authenticated player interface and embodied exploration presentation for the RPG while exchanging versioned semantic commands, viewer-safe projections, materialization references, audience-scoped presentation events, and structured mechanic outcomes with RPG GM Runtime.

The interface must make campaign state legible without turning the Dungeon Master model, browser coordinates, or generated pixels into the database.

## Required client modes

The first complete embodied GameFrame RPG shell should support:

- campaign join, seat claim, invitation, and resume;
- **Explore** — materialized scene, avatar movement, camera, collision/picking, interaction targeting, and transitions;
- **Talk / Interact** — targeted in-fiction interaction with a present entity/object;
- **Do Something Else** — freeform plausible fictional intent not covered by a dedicated control;
- **Ask Game Master** — out-of-fiction rules/knowledge/clarification;
- **GM Intervention** — GM-origin advisory/narration/dramatic presentation;
- People/Characters based on viewer knowledge;
- current-scene/world views based on authoritative semantic scene state;
- player-safe entity/object inspection;
- character, creature, party, inventory, equipment, ability, condition, quest, and objective views as implemented;
- maps/known routes/points of interest;
- checks/dice/consequence presentation;
- tactical encounter transition and authoritative embodied return;
- GM communication history, recap, reconnect, and recovery.

These may be layered modes/routes, but they remain one campaign application and authenticated session.

## Authority split inside GameFrame

GameFrame owns:

- accepted exploration materialization identity/version;
- playable collision/navigation geometry;
- semantic anchor placement;
- spawn/transition zones;
- interaction hit-testing/range;
- camera and renderer state;
- ephemeral avatar transforms and movement session state;
- deterministic mechanics/tactical state;
- player-safe presentation.

RPG GM Runtime owns:

- semantic world/location truth;
- authoritative semantic scene membership;
- observer/player knowledge;
- hidden package truth;
- Dungeon Master adjudication and semantic consequences.

GameFrame may persist/reconstruct materialization state required for stable revisit/reconnect, but it does not infer hidden world truth from geometry.

## Exploration scene projection

Runtime provides a viewer-safe semantic scene projection. GameFrame binds it to an accepted materialization.

A target projection may evolve toward:

```ts
type PlayerExplorationSceneProjectionV1 = {
  sceneId: string;
  sceneRevision: number;
  locationId: string;
  locationLabel: string;
  materializationRef?: {
    materializationId: string;
    materializationVersion: number;
  };
  presentPeople: ScenePersonProjectionV1[];
  presentCreatures: SceneCreatureProjectionV1[];
  visibleObjects: SceneObjectProjectionV1[];
  knownHazards: SceneHazardProjectionV1[];
  exits: SceneExitProjectionV1[];
  knownRoutes?: SceneRouteProjectionV1[];
};
```

Only viewer-authorized semantic information appears. GameFrame does not receive hidden entity names, secret scene facts, unrevealed route metadata, or runtime-only object data.

The semantic projection does not prescribe exact screen/world coordinates.

## Materialized exploration state

GameFrame should represent enough accepted scene state for stable play/reconnect, conceptually:

```ts
type ExplorationMaterializationV1 = {
  materializationId: string;
  materializationVersion: number;
  sceneId: string;
  geometryProfile: string;
  seedOrRecipeRef?: string;
  semanticAnchors: Record<string, string>;
  transitionZones: string[];
  assetPackRefs: string[];
};
```

Exact schemas may differ. Invariants:

- stable identity independent of browser session;
- semantic anchors bind runtime entities/objects/exits to playable scene constructs;
- reconnect/revisit does not silently generate a different replacement map;
- generated source art never defines authoritative collision by itself;
- materialization may be superseded deliberately/versioned without changing semantic campaign truth.

## Realtime exploration session

High-frequency movement is GameFrame session state, not RPG journal traffic.

A realtime exploration protocol may carry bounded messages such as:

- movement input/vector;
- facing;
- current avatar transform;
- animation intent/state;
- nearby-player transform projection;
- local entity animation projection;
- scene-session heartbeat/reconnect metadata.

The exact protocol may use WebSocket through the existing Worker → Tunnel → VM path.

### Realtime invariants

- authenticated player identity is fixed at connection establishment;
- the socket is scoped to the authorized campaign/scene/session;
- client messages cannot replace player identity or semantic scene assignment;
- bounds/rate limits apply;
- socket state is disposable and never the only copy of campaign truth;
- reconnect restores from durable semantic/materialization state rather than replaying stale movement packets;
- frame-by-frame movement does not advance runtime narrative revision.

## Durable command families

Meaningful semantic mutations remain versioned durable commands/service operations.

### Targeted in-fiction interaction

A dedicated interaction may identify a viewer-authorized present target:

```ts
type InteractWithEntityV1 = {
  kind: "campaign.interact_entity";
  expectedGameframeCoordinationRevision: number;
  targetEntityId: string;
  interaction: "talk" | "inspect" | "use";
  text?: string;
};
```

Exact field names/version may differ.

The target must already be authorized/present under the semantic projection or another explicit interaction authority. Guessing an entity ID never bypasses scene/knowledge authorization.

Talking is fictional-world speech/action and may be perceived according to scene/audibility rules.

### Do Something Else

A freeform fictional declaration uses a dedicated semantic command:

```ts
type SubmitFreeformIntentV1 = {
  kind: "campaign.submit_freeform_intent";
  expectedGameframeCoordinationRevision: number;
  text: string;
};
```

This is the tabletop escape hatch for plausible unsupported actions. The runtime/Dungeon Master interprets it and returns validated semantic consequences or a bounded refusal/clarification when necessary.

The old broad Act/Speak concept remains a semantic ancestor, but the mature UI should prefer direct embodied controls and targeted interaction when supported.

### Ask Game Master

```ts
type AskGameMasterV1 = {
  kind: "campaign.ask_gm";
  expectedGameframeCoordinationRevision: number;
  question: string;
};
```

Examples:

- "Would my license let me inspect that?"
- "Do I recognize this seal?"
- "What do I know about this monster species?"
- "Remind me what Pell told us about the road patrol."

This command does not automatically become speech in the fiction and should not advance fictional time merely because clarification was requested.

Ask-GM request/response is player-private by default. A future explicit command may request party/table visibility.

### Scene transfer

A meaningful map/location transition is a durable operation, not merely crossing a client pixel coordinate.

A first party-cohesion transition command may conceptually identify:

- source scene/revision;
- target exit/route;
- eligible/required party members;
- materialization intent/ref if already known;
- stable command identity.

GameFrame may detect that players are standing in a transition zone, but runtime validates semantic transfer/route authority.

## Single-scene party transition posture

The first embodied multiplayer client should maintain one shared exploration scene for the required active party.

A transition UX may:

1. show the destination/edge zone;
2. indicate which relevant party members are ready/in-zone;
3. permit/trigger transfer when cohesion conditions are satisfied;
4. commit one semantic scene transfer;
5. load/materialize destination;
6. reconnect realtime scene session there.

This is a product simplification, not a permanent one-scene authority assumption.

## Multi-scene client posture

Later split-party play requires GameFrame to maintain player-specific scene/session subscriptions.

At minimum:

- each authenticated player has an authoritative current semantic scene;
- realtime subscriptions are scene-scoped;
- only authorized scene/entity projections are delivered;
- party UI distinguishes remote/separated members from locally present members;
- cross-scene communication uses explicit mechanics/policy;
- one subgroup entering tactical mode does not automatically freeze or relocate another subgroup;
- reconnect restores each player to the correct scene/materialization.

Do not implement this by sending every player every active scene and filtering only in the browser.

## People / Characters projection

GameFrame exposes a People surface backed by viewer-safe knowledge projection, not the complete runtime entity registry.

A first display projection may support:

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

`knownFacts` is derived presentation material, not authoritative knowledge state.

Unknown people are omitted entirely. A canonical runtime name is shown only after that viewer has learned it.

## Perspective-bounded entity dialogue

An entity-origin dialogue event references a stable entity internally but carries only viewer-safe presentation identity.

GameFrame must preserve the distinction between:

- targeted fictional entity conversation;
- GM communication;
- system/tactical presentation.

The client should not label Pell dialogue as `GAME MASTER` merely because the Dungeon Master capability produced the text.

A conversation panel/log may be attached to the target entity/session while the GM communication log remains separate.

## GM intervention events

A GM-origin event may include explicit metadata for presentation intensity/control behavior, conceptually:

```ts
type GmInterventionPresentationV1 = {
  origin: "dungeon-master";
  audience: AudienceV1;
  intensity: "advisory" | "narration" | "dramatic";
  interaction: "nonblocking" | "pause-local-control" | "freeze-scene";
  body: string;
};
```

Exact schema may differ.

The UI may render a dramatic intervention as a large text bubble/frame with the world paused until acknowledged or presentation completes.

Presentation metadata never grants semantic mutation authority by itself.

## Presentation event origin

Audience and semantic origin are separate.

Supported origins include:

- `player`;
- `dungeon-master`;
- `entity`;
- `system`;
- `tactical-encounter`.

Entity-origin events use viewer-safe labels. GameFrame should not rely on bookkeeping event kinds as the human-readable speaker identity.

## World/object interaction

Repeated supported world actions should become deterministic mechanics/interactions when useful.

Examples may include:

- open/close door;
- pick up/use item;
- inspect evidence;
- activate switch;
- interact with capture cube;
- enter exit/transition zone.

One-off unusual manipulation may remain Do Something Else and produce semantic object-state operations after Dungeon Master adjudication.

GameFrame must not parse prose to infer durable object state.

## Cinematic presentation

GameFrame should support validated semantic cinematic scripts for ordinary cutscenes rather than requiring generated video.

Supported operations may include camera focus/pan/shake, entity move/face/pose, dialogue, GM intervention, effects, sound/music cues, and encounter transition.

Cinematic scripts are presentation. Any campaign-world mutation still requires semantic authority.

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

## Encounter-scene provenance

Every encounter request derived from the runtime Scene Registry carries enough provenance to reject stale tactical truth:

- source scene ID;
- source scene revision/authoritative position;
- deterministic digest over combat-relevant semantic state.

A validated request may additionally include exact participant IDs, team/faction, controller, tactical role, creature/trainer rules profiles, relevant scene objects, exits/withdrawal zones, objectives, battlefield intent, and package capability profile.

## Campaign tactical outcomes

Target structured participant results support more than elimination:

- `active`;
- `incapacitated`;
- `withdrew`;
- `fled`;
- `surrendered`;
- `recalled`;
- `dead` only where an explicitly lethal rules profile supports it.

Unsupported requested semantics fail closed instead of being discarded.

## Embodied campaign return

A campaign-bound Arena match is not a standalone replay loop.

When terminal:

- primary action is **Return to Campaign**;
- generic `New Duel` is suppressed;
- generic `Return Home` is not the primary continuation path;
- runtime consumes/reconciles the exact outcome;
- GameFrame receives later post-encounter semantic scene state;
- exploration materialization reflects supported consequences;
- movement/interaction remain fenced until authoritative return is ready;
- ordinary exploration resumes in the same campaign world.

URL navigation alone never authorizes exploration resume.

## Monster Master current bounded surface

The current durable configured Monster Master RPG tactical path remains valid substrate:

- exact `participantUnitIds` mapping;
- supported Emberling/Bulwark creature profiles;
- one through three creatures per side;
- equal creature counts under current deployment algorithm;
- compact-duel battlefield;
- normal difficulty;
- defeat-opposition objective;
- trainers remain controllers rather than tactical units.

That is implementation boundary, not final campaign rules.

## Revision and ordering model

Keep separate:

- GameFrame coordination revision;
- GameFrame presentation sequence;
- runtime narrative revision;
- runtime scene revision;
- exploration materialization identity/version;
- ephemeral realtime scene-session sequence/state;
- encounter/tactical revisions.

Do not increment runtime narrative revision for every movement frame.

## Correctness requirements

- server-derived player identity;
- runtime validation at every semantic boundary;
- explicit payload/collection/frame bounds;
- expected revision checks in the authority domain being mutated;
- durable idempotency/exact retry for semantic commands;
- event-time audience authorization;
- scene-scoped realtime authorization;
- reconnect/recovery without correctness dependency on a permanent WebSocket;
- no direct cross-repository storage access;
- unknown people/entities omitted from unauthorized projections;
- canonical runtime names never inferred as viewer knowledge;
- character dialogue never gains unrelated GM-only hidden facts;
- Ask-GM never silently becomes fictional speech;
- Do Something Else remains available even when no dedicated control exists;
- semantic scene transitions remain durable while frame movement stays ephemeral;
- tactical launch never silently drops combat-relevant scene entities/roles;
- campaign-bound return never bypasses authoritative aftermath/materialization update.

## First embodied conformance sequence

A deterministic cross-repository fixture/journey should eventually prove:

1. Player attaches to Monster Master.
2. GameFrame receives semantic Crooked Checkpoint scene and accepted materialization.
3. Player moves through the scene without runtime narrative commits per frame.
4. Player approaches Pell and starts targeted dialogue.
5. Pell performance context lacks a hidden fact Pell does not know.
6. Player uses Ask-GM; answer is player-private and not fictional dialogue.
7. Player inspects/interacts with one world object.
8. Player uses Do Something Else for one unsupported plausible action.
9. Player takes a connected alternate route and transfers/materializes a second scene.
10. Player revisits a prior materialization without replacement drift.
11. A deterministic check/event resolves based on current world state.
12. Current scene enters a real tactical encounter carrying source scene/revision/digest.
13. Exact participant identities survive launch/outcome.
14. Runtime reconciles outcome and GameFrame returns to updated exploration world.
15. Refresh/restart does not duplicate people/scenes/materializations/commands/aftermath.

The stronger two-human fixture adds separate avatars, one shared active scene, party-cohesion transition, player-private/party-private divergence, and cooperative tactical control. Split-party/multi-map conformance is later and separate.

## Governing rule

> GameFrame presents the campaign as a world the player can inhabit: realtime movement is cheap/session-scoped, meaningful changes are semantic/durable, NPCs speak from their own perspectives, the real GM remains separately accessible, and freeform intent survives whenever fixed controls run out.
