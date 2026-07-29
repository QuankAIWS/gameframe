# 0007 — Platform Proof Sequence and Mock Agents

- **Status:** Accepted
- **Date:** 2026-07-27
- **Scope:** Near-term GameFrame sequencing, agent integration, browser QA, deployment canaries, and test-artifact handling
- **Supersedes:** Any implication in `planning/tactical-battler-rpg-foundation.md` that the tactical battler should immediately follow the infrastructure walking skeleton

## Context

The tic-tac-toe walking skeleton has proven the basic server-authoritative contracts, but the remaining platform risks are not limited to game rules. GameFrame still needs stronger browser acceptance coverage, real Workers-runtime validation, deployed Cloudflare and Discord canaries, a stable external-agent decision contract, and evidence that the game-module abstractions generalize beyond tic-tac-toe.

The live Scribbles Runtime and Theo deployment are evolving in parallel. Requiring a live model-backed Theo integration before GameFrame can complete deployment and game-module validation would couple the repositories unnecessarily and delay independent progress.

The tactical battler remains the first substantial original GameFrame game and the intended combat foundation for the later RPG platform. However, it combines many new risks at once: camera and viewport behavior, pathfinding, initiative, combat effects, terrain, visibility, content production, agent decisions, and substantial Canvas presentation. A smaller intermediate game can expose platform defects more cheaply.

## Decision

GameFrame will use the following near-term proof sequence:

```text
tic-tac-toe platform completion
        -> local real-Workers validation
        -> standalone deployed GameFrame canary
        -> Discord Activity delivery canary
        -> versioned mock-agent decision contract
        -> production-complete American checkers module
        -> deployed checkers and mock-agent canary
        -> real Scribbles Runtime adapter when available
        -> monster-master tactical battler
```

This sequence does not reduce the tactical battler's importance. It changes the order in which platform risk is retired before tactical implementation begins.

## Tic-tac-toe completion target

Tic-tac-toe is the complete delivery-stack proof rather than only a rule-engine fixture. Before the platform advances to checkers, it should demonstrate:

- Human-versus-human and human-versus-deterministic-opponent play
- Match creation, joining, completion, resume, reconnect, and refresh
- Clear illegal, stale, duplicate, unauthorized, and completed-match behavior
- A usable standalone browser client at desktop and mobile viewport sizes
- Real automated browser interaction rather than syntax checking alone
- Local Workers-runtime coverage for Durable Object storage and WebSocket behavior
- A compact deployed Cloudflare canary
- Discord Activity launch, identity, invite or resume, and mobile canaries when the Discord adapter is ready

The live Scribbles Runtime is not a prerequisite for these proofs.

## Checkers as the intermediate module

After tic-tac-toe and the first delivery canaries are stable, GameFrame will implement **American checkers on an 8x8 board** as the first nontrivial reusable board-game proof.

The exact rules must be documented and tested, including:

- Play on dark squares
- Diagonal forward movement for ordinary pieces
- Mandatory captures
- Multi-jump continuation
- Promotion to kings
- King movement and capture rules
- Win conditions
- Draw conditions and repetition or no-progress handling

Checkers is selected because it exercises several contracts needed by the tactical battler without requiring tactical art and content production:

- Many independently selectable pieces
- Piece selection followed by destination or capture selection
- Legal-action highlighting across many pieces
- Forced actions
- Multi-step action sequences
- Promotion and changing piece capabilities
- Longer histories and replay streams
- Larger decision spaces for deterministic, mock, and model-backed agents

Checkers must use the same authoritative match service, identity boundary, event history, observations, legal-action contracts, browser delivery, and agent interface intended for later games. It must not become a special parallel implementation.

## Versioned agent decision contract

GameFrame will define a first-class, versioned decision-provider boundary before the real Scribbles Runtime adapter is required.

GameFrame sends a structured decision request containing at least:

- Protocol version
- Request ID
- Game ID
- Match ID
- Stable player ID
- Current revision
- Player-specific observation
- Enumerated legal actions
- Optional deadline or timeout metadata

The provider returns at least:

- Protocol version
- Matching request ID
- Expected revision
- Unique action ID
- One structured action
- Optional non-authoritative commentary or diagnostic metadata

GameFrame validates identity, request correlation, revision, idempotency, and current legality before committing the action. Provider prose is never parsed as the authoritative action.

The initial mock provider must support:

- Deterministic legal choice
- Scripted action sequences
- Seeded random legal choice
- Delayed responses
- Timeout or unavailable service
- Malformed schema
- Illegal action
- Duplicate response
- Stale revision

These modes are durable QA tools, not disposable scaffolding. When Scribbles Runtime is ready, Theo implements the same contract. The decision provider changes; GameFrame authority does not.

## Verification model

Ordinary development should discover game and browser defects before deployment.

The required verification layers are:

1. **Deterministic rules and simulation** — rules, legal-action invariants, exhaustive or property-based scenarios where practical, replay equivalence, and complete bot-versus-bot games.
2. **Match and service contracts** — identity, authorization, revisions, idempotency, reconnect, recovery, player-specific observations, and agent failures.
3. **Local Workers runtime** — real `workerd` or supported Workers test runtime behavior for Durable Objects, storage, eviction, competing commands, and WebSockets.
4. **Browser acceptance** — real headless interaction through the public application boundary at desktop and mobile viewports.
5. **Visual evidence** — deterministic screenshot checks for stable screens and curated screen captures for design review.
6. **Canonical GitHub validation** — the deliberately triggered GitHub-hosted runner verifies the frozen merge candidate.
7. **External canaries** — deployed Cloudflare, Discord Activity, mock remote agent, and later real Scribbles Runtime proofs.

Each report must identify which evidence class was actually obtained.

## Browser and visual QA

The current JavaScript syntax check is not sufficient browser acceptance. The roadmap should add a headless browser harness, expected to use Playwright unless implementation evidence favors another tool.

Browser coverage should eventually include:

- Match creation and joining
- Board or piece selection
- Legal-action highlighting
- Complete deterministic game flows
- Reconnect and refresh
- Error presentation
- Keyboard, pointer, and touch-oriented viewport behavior
- Canvas or DOM screenshot capture

Visual-regression baselines should be generated and compared in a stable environment. The canonical GitHub-hosted environment is the authority for accepted baselines when font and rendering differences make cross-environment screenshots noisy. Local screenshots remain useful development evidence and design-review material.

## Artifact policy

GitHub Actions artifact storage must be treated as a constrained diagnostic channel, not a permanent test archive.

Default policy:

- Passing routine and canonical runs upload no large artifact bundle.
- Failed browser or visual runs may upload one compressed diagnostic bundle containing only relevant screenshots, expected images, diffs, trace, logs, and commit metadata.
- Failure artifacts should use short retention, provisionally three days.
- A manually selected visual milestone may retain one curated bundle for up to seven days unless copied into a deliberate durable location.
- Videos and traces should be retained only for failures or explicit diagnostic runs.
- Approved small visual baselines belong in the repository when their size and licensing are appropriate.

The first response to artifact pressure is failure-only uploads, compression, short retention, and deletion of obsolete workflow runs. A local archive is permitted later only if this policy remains insufficient and is isolated from public workflow execution.

A future local archive must live outside any ephemeral Actions workspace, enforce a total size ceiling, and rotate by age and count. It is not required for the current documentation or canonical workflow.

## Consequences

### Positive

- GameFrame can deploy and mature independently of the live Scribbles Runtime.
- The real Theo integration receives a tested, versioned contract rather than defining the boundary under production pressure.
- Checkers exposes generalization defects before tactical complexity obscures them.
- Browser and visual defects are expected to be caught before deployment.
- Canonical validation remains deliberate while public hosted capacity removes dependence on persistent private infrastructure.
- Artifact storage remains bounded by policy.

### Costs

- Checkers delays direct tactical-battler implementation.
- Browser automation and mock-agent infrastructure require work before producing the first original tactical game.
- Deployment canaries must be maintained separately from repository-only validation.
- Visual regression requires stable baselines and careful handling of rendering variance.

The accepted judgment is that these costs are lower than discovering platform, browser, or agent-contract defects after the tactical renderer and combat systems are already large.
