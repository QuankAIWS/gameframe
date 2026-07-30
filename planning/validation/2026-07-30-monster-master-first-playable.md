# MM-0001 First Playable Monster Master Validation

Date: July 30, 2026

## Scope

This checkpoint records the first playable Monster Master repository candidate built as a separate game definition over the validated Scribbles GameFrame tactical and platform substrate.

The candidate is developed on `agent/mm-0001-current-foundation` through PR #39. This document records repository evidence and visual inspection. It does not convert the draft candidate into a deployed, merged, balanced, or production-complete game.

## Implemented duel

Each player controls a stable three-unit roster:

- Warden Master
- Stone Bulwark
- Emberling

The authoritative duel proves:

- alternating left and right deployment zones;
- stable unit and content IDs;
- deterministic initiative and living-unit activation order;
- one movement opportunity and one primary-action opportunity per activation;
- weighted cardinal movement and canonical complete paths;
- row, column, and exact 45-degree diagonal line of sight;
- deterministic attacks, damage, health, defeat, and occupancy removal;
- immediate victory when the opposing Warden Master is defeated;
- deterministic bounded draw after the maximum round;
- visible command energy with capped round regeneration;
- Warden `Mend`, including friendly targeting, line of sight, resource expenditure, and bounded healing;
- structured deployment, movement, damage, healing, command, defeat, round, activation, and completion effects;
- deterministic Theo deployment and combat choices; and
- bounded complete self-play.

The normative MM-0001 rules are in `planning/monster-master-rules.md`.

## Platform integration

The candidate uses the ordinary GameFrame boundaries rather than a parallel test implementation:

- `monster-master-duel` is registered in the in-memory and Cloudflare multi-game dispatchers;
- create, view, and action requests use the shared authenticated HTTP routes;
- accepted actions retain revision, idempotency, event-history, replay, and snapshot semantics;
- the migration-stable Durable Object runtime stores and restores Monster Master snapshots;
- player-specific observations and legal actions survive Durable Object eviction;
- WebSockets remain projection-only and obtain views through the shared multi-game runtime;
- signed authenticated invitations recognize Monster Master and resume at `/monster-master.html`;
- Discord-authenticated friend play intercepts the local synthetic-seat handler before it can create an untrusted seat; and
- the shared health manifests advertise Monster Master in both local and real Workers runtimes.

## Browser proof

The dedicated `/monster-master.html` surface provides:

- Theo and local two-human match creation;
- deployment roster selection and Canvas coordinate submission;
- pan, zoom, active-unit centering, and field centering;
- movement, attack, Mend, and end-activation controls;
- health, initiative, command, action-budget, roster, effect, revision, and connection presentation;
- refresh and URL-based resume;
- local invitation links and hosted signed-invitation integration;
- mobile deployment without horizontal overflow;
- safe setup reset and creation of a distinct replacement match;
- navigation to Tactical Combat and the main game lobby; and
- authoritative diagnostics disclosure.

Dedicated browser journeys cover:

- complete human deployment against deterministic Theo;
- alternating two-browser deployment;
- legal attack and damage presentation;
- legal Mend, healing, and command expenditure;
- unit defeat and roster presentation;
- Master-defeat victory with disabled controls;
- bounded draw presentation;
- round-start command regeneration;
- stale-revision refresh without duplicate mutation;
- unknown match, wrong-game resume, unauthorized seat, and failed-creation recovery; and
- mobile Canvas deployment and camera controls.

## Executable evidence before final documentation freeze

GitHub-hosted Canonical Validation run #91 (`30568023523`) executed on Ubuntu 24.04 with the committed dependency lock and Chromium against implementation head `d03812b56a2d3cc3bb1d555be9fa96830d67c593`.

Results:

- 163 core repository tests passed;
- 15 real Workers-runtime tests passed across five test files;
- the committed Discord Activity bundle reproduced byte-for-byte;
- every browser entry passed syntax validation;
- 41 Playwright browser journeys passed;
- four stable visual baselines passed; and
- repository self-check passed.

That run directly included the Monster Master attack, Mend, defeat, victory, bounded draw, mobile, recovery, and command-regeneration journeys. Failure diagnostics were skipped because the run was green.

Two additional direct shell journeys were added after that implementation run for the Monster Master main-lobby link and diagnostics open/close behavior. Because any later commit invalidates exact-head evidence, PR #39 must receive a final Canonical Validation pass after this checkpoint and the visual-review corrections are committed.

## Curated visual review

GitHub-hosted visual-review run #93 (`30568548628`) successfully captured the complete curated artifact at rendering head `6a9b0ce9b9eb586d9c4fb0b17bfe507d2ccf1b19`.

The artifact contained 23 public-safe synthetic screenshots spanning:

- ordinary desktop and mobile lobby states;
- Tic-Tac-Toe, Checkers, tactical movement, and tactical combat;
- hosted authentication and signed-session presentation;
- invitation pending, success, and error states; and
- Monster Master desktop lobby, mobile lobby, deployment, combat activation, and movement options.

The screenshots were downloaded and inspected rather than accepted from workflow status alone.

Monster Master findings:

- desktop and mobile lobby composition was readable without clipping or horizontal overflow;
- deployment zones, terrain, roster, action controls, and camera controls were visible and coherent;
- combat activation and movement highlighting were readable;
- the initial visual helper required an authoritative revision wait between human deployment and Theo response;
- the combat activation screenshot exposed stale deployment-only help copy;
- the help copy was changed to a phase-neutral default while action-specific instructions remain dynamic; and
- capture IDs were normalized to a globally unique 1–23 sequence after the invitation error and Monster Master desktop captures were found to share number 18 in separate directories.

Monster Master remains curated-only for MM-0001. No new pixel baseline is accepted because the Canvas, camera, legal actions, roster state, and match identifiers are deliberately dynamic.

## Evidence boundary

This checkpoint does not claim:

- merge into `main`;
- a deployed Cloudflare Worker canary;
- real Discord website OAuth or Activity launch;
- live authenticated two-user public-network play;
- live Scribbles Runtime control of Theo;
- final rules balance or content progression;
- final art, animation, audio, effects, or accessibility review;
- open-world exploration, campaign persistence, NPC interaction, or generated narrative;
- D&D rules or compatibility with any specific licensed ruleset; or
- production quota, observability, incident, or recovery behavior.

## Remaining acceptance gates

Before merge:

1. freeze the final branch head after documentation and visual corrections;
2. run Canonical Validation on that exact head;
3. rerun curated visual capture if any rendering source changes;
4. keep PR #39 draft until the owner is ready for human review; and
5. merge only if the exact validated head remains unchanged.

After repository merge, owner-controlled external work remains:

- local subjective gameplay and presentation review;
- Cloudflare deployment;
- website OAuth and Discord Activity canaries;
- authenticated two-user invitation and WebSocket testing over the public network; and
- later balance, content, art, animation, audio, and product decisions.
