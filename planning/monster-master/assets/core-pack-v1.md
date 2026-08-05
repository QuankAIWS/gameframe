# Monster Master Core Asset Pack v1

## Status

Accepted production contract. Runtime renderer integration remains a separate implementation slice.

## Purpose

`monster-master-core-v1` is the prepared, versioned asset foundation shared by Monster Master: Arena Battles and Monster Master RPG. It must remain usable without live image generation.

## Identity layers

The pack distinguishes:

- **registry ID** — product planning and lifecycle identity;
- **semantic role ID** — the function requested by GameFrame or RPG GM Runtime;
- **continuity ID** — the durable character or creature identity;
- **rules content ID** — the authoritative gameplay content reference;
- **runtime derivative ID/path** — the accepted rendered resource.

These layers must be mapped explicitly. They are not interchangeable names.

## Trainer and monster separation

The Master is a human trainer/player character. Trainer art must never be registered as a monster species.

The compatibility-era rules ID `warden-master-v1` refers to the current human-trainer bootstrap presentation. It remains a temporary fallback until an explicit rules and presentation migration replaces it.

Stone Bulwark and Emberling Skirmisher are monsters. Their current low-resolution atlas frames are legacy fallbacks, not accepted final art.

## Core pack contract

The pack requires:

- versioned manifest and geometry profile;
- explicit trainer, monster, effect, environment, and interface families;
- continuity references and replacement targets;
- retained source masters;
- deterministic derivatives with dimensions, transform metadata, and hashes;
- stable anchors, scale, facing, mirror policy, shadows, and fallbacks;
- provenance and rights records;
- focused validation and visual acceptance evidence.

## Legacy entries

- `warden-master-v1` — family `trainer`; replacement target `trainer-default-master-v1-battlefield`.
- `stone-bulwark-v1` — family `monster`; replacement target `monster-stone-bulwark-v2-battlefield`.
- `emberling-skirmisher-v1` — family `monster`; replacement target `monster-emberling-skirmisher-v2-battlefield`.

No legacy entry is final product art.

## Source and derivative policy

Important trainers and monsters receive individual retained source masters. Runtime derivatives are produced deterministically after alpha, crop, edge, anchor, scale, and direction review.

A replacement is accepted only when the manifest records:

- stable IDs and mappings;
- source and runtime paths;
- dimensions and SHA-256 values;
- transform tool and version;
- anchor, scale, facing, and mirror behavior;
- provenance;
- fallback and supersession relationships.

## Production order

The product-wide asset register controls sequence. The core pack contributes the runtime identity and lifecycle contract.

Current order:

1. audit existing terrain, UI, effects, and unit art;
2. keep pack identities, validation, and deterministic tooling stable;
3. approve the default human trainer source;
4. integrate the resolver into the Pixi renderer while preserving legacy fallback;
5. replace Stone Bulwark and Emberling through the full source-to-runtime pipeline;
6. complete portraits, roster icons, silhouettes, movement, abilities, damage, defeat, summon, anchors, and shadows;
7. validate desktop, mobile, camera rotations, selection, damage, defeat, and summon states;
8. add new monster roles and wider environment coverage.

## Non-authority

This pack does not change roster rules, health, movement, initiative, damage, legal actions, command energy, victory, persistence, replay, identity, or invitations. Gameplay changes require explicit authoritative rules work.
