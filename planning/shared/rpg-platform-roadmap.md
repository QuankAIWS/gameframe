---
title: RPG Platform Roadmap
status: accepted
document_type: roadmap
owner: Scribbles GameFrame and RPG GM Runtime
last_updated: 2026-08-09
applies_to:
  - scribbles-gameframe
  - rpg-gm-runtime
  - Role-Playing Games
  - Battle Simulator
  - Monster Master RPG
  - Monster Master Arena Battles
  - future bespoke campaigns
shared_document_id: rpg-platform-roadmap-v1
shared_document_version: 9
canonical_repository: QuankAIWS/scribbles-gameframe
canonical_path: planning/shared/rpg-platform-roadmap.md
mirrors:
  - QuankAIWS/rpg-gm-runtime:docs/shared/rpg-platform-roadmap.md
sync_policy: exact-byte-copy
related:
  - rpg-platform-product-goals.md
  - rpg-agent-architecture-and-campaign-package.md
  - rpg-scene-entity-and-knowledge-contract.md
  - rpg-embodied-exploration-and-character-performance-contract.md
  - rpg-monster-master-reference-campaign.md
  - rpg-cloudflare-deployment-architecture.md
---

# RPG Platform Roadmap

## Objective

Build one campaign-agnostic GameFrame RPG Engine that turns validated CampaignPackages into persistent playable 2D worlds, accepts pluggable deterministic RPG Rulesets, and works with one Dungeon Master that remains a real referee/narrator while durable software owns identity, presence, Observer Knowledge, world state, mechanics, and recovery.

The player-facing hierarchy is **Games → Role-Playing Games / Battle Simulator / standalone games**. GameFrame RPG Engine is internal architecture.

Campaign combat happens through **Tactical Activation on the current materialized campaign scene**. It never launches Battle Simulator or compiles a substitute campaign battlefield.

## Authority

- GameFrame owns physical materialization, x/y/facing, collision/pathing/camera/picking/interaction range, deterministic rules/control/tactical state, and player-facing rendering.
- RPG GM Runtime owns CampaignPackages, WorldGraph/semantic scene/entity/objective truth, Observer Knowledge, Dungeon Master contexts/semantic decisions, and meaningful semantic consequences.
- **HTTP owns GameFrame RPG commands/mutations, including exploration movement.**
- **WebSockets are projection/notification-only and reconstructable from durable state.**
- Text/narration never becomes authoritative state merely because a model emitted it.

## Delivery mode

Primary progress is measured by a continuous player journey:

```text
SEE      ✅ COMPLETE
MOVE     ✅ COMPLETE
MOBILE   ✅ COMPLETE
TALK     ← ACTIVE
CHANGE
TRAVEL
FIGHT
PROVE
```

Every substantive RPG PR should advance that journey or remove a demonstrated correctness/deployment blocker.

The physical world is the primary product surface. Campaign-history/feed presentation remains important but is not the active product milestone while direct world interaction is incomplete.

## Completed foundations

Preserve the accepted substrate:

- CampaignPackage v5 and explicit Game Family/ruleset capability requirements;
- Entity Registry and Character Factory;
- Semantic Scene Registry with durable membership authority;
- Observer Knowledge / People;
- WorldGraph/location/materialization intent;
- viewer-safe Runtime → GameFrame exploration projection;
- private authenticated exploration ingress;
- deterministic Crooked Checkpoint Pixi materialization;
- GameFrame-owned durable x/y/facing position state;
- authenticated HTTP movement/collision/revision/recovery;
- desktop WASD/camera and mobile touch movement controls;
- Cloudflare/VM staging path and reset/reseed tooling;
- player-safe initial Crooked Checkpoint identity disclosure.

## Milestone 0 — Architecture/navigation alignment — complete

Accepted terms/boundaries:

- exactly two campaign agents: Campaign Architect and Dungeon Master;
- Role-Playing Games is the player-facing campaign surface;
- Battle Simulator is standalone tactical play;
- RPG Ruleset is deterministic game-specific mechanics;
- Game Family is reusable rules/content/assets identity;
- Battle Pack is simulator-safe content/configuration and never duplicates combat rules or leaks campaign secrets;
- semantic WorldGraph truth is separate from GameFrame geometry/materialization;
- Observer Knowledge supports viewer-safe projection and perspective-bounded entity performance;
- one shared active party scene is the first multiplayer posture.

## Milestone 1 — CampaignPackage/ruleset boundary — complete bounded foundation

CampaignPackage v5 is committed/versioned/reloadable and includes Monster Master Game Family/ruleset requirements, authored Crooked Checkpoint + West Woods WorldGraph/materialization intent, semantic tactical activation intent, and player-safe/runtime-only separation.

## Milestone 2 — Entity/Scene/Observer substrate — complete bounded foundation

Entity Registry, Character Factory, Scene Registry, Observer Knowledge / People, descriptor→role→name identity progression, atomic immediate-scene creation, and viewer-safe exploration projection are implemented/reconstructable.

## Milestone 3 — SEE: Crooked Checkpoint — complete

Exit gate is met in deployed staging: an authenticated player can open Monster Master RPG and see a deterministic Crooked Checkpoint materialized from viewer-safe Runtime semantic state, with stable materialization identity across refresh/restart.

The physical scene includes player/Pell/object/route affordances sufficient for the current semantic package. West Woods is currently only a projected/visible route mouth, not a completed transfer.

## Milestone 4 — MOVE + mobile — complete

Exit gate is met in deployed staging:

- desktop and mobile movement;
- collision against bounds/terrain/visible actors/objects;
- facing/camera rotation/follow;
- GameFrame SQLite physical-position durability;
- exact-materialization recovery;
- stale revision rejection;
- no Runtime per-step movement traffic;
- HTTP-only mutation authority.

## Milestone 5 — TALK: generic interaction, character performance, and GM surfaces — ACTIVE

Drive Dungeon Master context-mode work through real physical interaction.

### GameFrame

- generic nearby target selection/interaction range;
- desktop + mobile Interact;
- Talk targeting a present viewer-authorized entity;
- clear Do Something Else and Ask Game Master surfaces;
- presentation hooks for later bubbles/subtitles/history without making presentation authority.

### Runtime

- referee/world context;
- entity-performance context;
- GM communication / Ask-GM context;
- aftermath/intervention context;
- semantic origin/audience/audibility handling sufficient for dialogue.

### Pell custody canary

```text
referee knows hidden X
Pell does not know X
→ Pell context excludes X
→ Pell output cannot use X

Pell legitimately learns X
→ Observer Knowledge commits X
→ Pell may use X later
```

### Speech semantics

Normal speech, whisper/private speech, Ask-GM, and later multiplayer presentation must not be collapsed into one global transcript. Physical presence, audibility, audience, Observer Knowledge, and UI presentation are distinct.

**Exit gate:** the player walks to Pell, interacts/talks naturally, receives Pell-scoped dialogue without hidden leakage, and separately uses Ask-GM/Do Something Else.

## Milestone 6 — CHANGE: meaningful world state + freeform parity

Promote concrete operations only as the chapter proves them necessary.

Key acceptance:

```text
player: "I pull out Cinder's cube and release her beside me."
→ interpret deploy intent
→ validate rules/ownership/current state
→ commit semantic + physical deployment
→ Cinder appears in current scene
→ narration/history reports accepted result
→ refresh/restart preserves it
```

Dedicated controls and freeform intent should converge on the same underlying world/mechanic authorities.

Other likely operations: inspect/use/take/open/change important objects, knowledge reveal/correction, checks, objective/event changes, relationships/memory, deploy/recall.

**Exit gate:** at least one meaningful persistent world change is caused through ordinary play and survives recovery.

## Milestone 7 — TRAVEL: Crooked Checkpoint ↔ West Woods

Turn current WorldGraph/exit/route-mouth evidence into real travel:

- physical route interaction/transition eligibility;
- validate current available semantic exit;
- commit source→destination semantic scene transfer;
- materialize/recover `scene.west-woods`;
- establish valid physical arrival state;
- return to the same Crooked Checkpoint materialization/state.

**Exit gate:** West Woods is a real persistent place the player can visit and revisit without world/materialization drift.

## Milestone 8 — FIGHT foundation: rules/control/Tactical Activation

Promote only same-map campaign combat requirements:

- Monster Master Ruleset/profile/version;
- principal → Master/player-character → deployed/controlled entity set;
- class/ruleset deployment limits;
- Master tactical participation;
- initiative/action economy/legal actions;
- movement/range/targeting/resources/conditions/objectives/outcomes;
- escape/withdrawal/surrender/recall/incapacitation where supported;
- semantic Tactical Activation validation and reconciliation.

Do not hardcode one player = one unit or exactly one monster into the generic engine.

## Milestone 9 — FIGHT: same-map campaign combat

```text
exploration
→ tactical trigger
→ validate semantic/materialized/ruleset/control state
→ Tactical Activation
→ current positions become tactical starting positions
→ deterministic turn-based actions on current geometry
→ deterministic result
→ semantic reconciliation
→ exploration resumes in place
```

No replacement battlefield or Return-to-Campaign step.

**Exit gate:** initiative begins/ends on the existing campaign scene and reconnect/restart preserves the resulting world.

## Milestone 10 — PROVE: complete single-player embodied Monster Master

```text
Role-Playing Games
→ Monster Master RPG
→ Crooked Checkpoint SEE/MOVE
→ TALK / Ask-GM / Do Something Else
→ persistent CHANGE
→ West Woods TRAVEL/revisit
→ event/check consequence
→ same-map FIGHT
→ exploration resume
→ bounded campaign resolution
→ restart/reconnect
```

Validation order: human play → deterministic/machine-play → live provider → deployed staging.

## Campaign Chronicle direction

The existing campaign feed should mature into an observer-authorized **campaign chronicle**.

It should retain meaningful narration, heard dialogue, discoveries, consequential actions, mechanic outcomes, persistent world changes, travel, and relevant GM interventions/rulings. It should not become a tiny combat log, but it should not remain the primary control surface once direct world interaction is mature.

One semantic event may have multiple authorized presentations—for example in-world speech plus later history. Different observers may legitimately have different chronicle content.

Do not make chronicle UI polish a blocker for TALK/CHANGE/TRAVEL. Preserve correct origin/audience/audibility/knowledge semantics now.

## Monster Master opening correction

The first Crooked Checkpoint framing should orient and release control rather than repeatedly force option selection.

Ordinary capture cubes are handheld externally. They must not be authored as physically shaking/jumping a full cart merely because a monster moves inside the cube interior. If physical disturbance is needed, author an explicit physically plausible source/specialist containment mechanism.

## Milestone 11 — Two-human one-scene

After single-player proof, add separate authenticated avatars, one shared active scene, public/party/player-private presentation, explicit audibility/Observer Knowledge divergence, cohesive group transitions, cooperative tactical control, and reconnect.

Split-party simultaneous scenes remain later.

## Milestone 12 — Second handcrafted Game Family

Run a materially different handcrafted campaign/family through the same engine/runtime/ruleset/context/materialization/Tactical Activation architecture. Repair generic abstractions rather than adding campaign-specific engine branches.

## Milestone 13 — Campaign Architect + dynamic Role-Playing Games / Battle Pack authoring

Only after two handcrafted families prove the architecture, activate dynamic campaign discovery/create/import, Campaign Architect draft/refinement/preview/commit, validated ruleset/family generation/selection, and simulator-safe Battle Pack authoring.

## Milestone 14 — Dynamic Battle Simulator convergence

Battle Pack discovery/setup, character/loadout/opponent/team/map/objective/deployment configuration, humans/BattleBot, replay/rematch/analysis, imported/generated packs, and campaign/simulator tactical equivalence.

## Milestone 15 — Split-party multi-scene

Only after one-scene multiplayer is trustworthy, add simultaneous scene subscriptions, scene-local audibility/knowledge, cross-scene communication, independent recovery/materialization, and explicit cross-scene time/tactical rules.

## Milestone 16 — Rich media/multi-session systems

Promote only systems proven useful by real campaigns: richer authoring/world kits/assets/cinematics, progression/rest/inventory/equipment/injury/care, recurring factions/objectives/relationships, inspection/correction, backup/restore/export/retention, and observability.

## Explicitly deferred while the first loop is incomplete

Do not prioritize Campaign Architect implementation, generated RPG productization, dynamic Battle Pack expansion, split-party concurrency, unrestricted procedural/open-world generation, generalized RPG DSLs, giant final-art production, elaborate autonomous NPC processes, Cloudflare-native semantic-state migration, Theo integration, or deeper legacy separate-match campaign features.

## Deployment sequencing

Initial production remains GameFrame + RPG GM Runtime as separate services on one private VM behind Cloudflare, with GameFrame public and Runtime/data/admin surfaces private.

HTTP owns GameFrame RPG mutations/commands. WebSockets remain projection/notification-only. No frame-by-frame movement enters Runtime semantic authority.

## Validation policy

Use evidence matching the claim:

- schema/unit tests for package/ruleset/entity/scene/knowledge invariants;
- materialization/geometry tests for physical world correctness;
- browser tests for SEE/MOVE/TALK/TRAVEL/FIGHT journeys;
- deterministic/mock-provider tests for context custody;
- actual cross-repository services for semantic/materialization seams;
- deterministic tactical tests for same-map rules;
- human + machine-play + live provider + staging for full chapter proof.

## Immediate order

1. **TALK** — generic interaction + Pell context custody + speech audience semantics.
2. **CHANGE** — concrete persistent world operations + freeform parity.
3. **TRAVEL** — Crooked Checkpoint ↔ West Woods.
4. **FIGHT** — rules/control + same-map Tactical Activation.
5. **PROVE** — complete single-player chapter/recovery/live/staging.
6. two-human one-scene.
7. second handcrafted Game Family.
8. Campaign Architect / dynamic Role-Playing Games / Battle Packs.
9. dynamic Battle Simulator convergence.
10. split-party later.

## Governing rule

> The graphics visualize the imagination; they do not define its boundaries. Build one truthful playable journey first, keep Runtime semantic and GameFrame physical/deterministic, preserve observer-scoped communication/history, and derive abstractions from requirements exposed by real play.
