# Cascade public-safe difficulty mirror

This directory is the **public-safe compact mirror** of Cascade Crush difficulty evidence. It is intentionally useful for repository-local comparison and CI archive-integrity checks, but it is not the canonical historical store.

The canonical long-term archive is the private `QuankAIWS/rpg-gm-runtime` repository under `archive/cascade-testing/`.

## What belongs here

- accepted compact bot-profile snapshots for completed level batches;
- historically useful bot snapshots that explain tuning decisions;
- accepted compact fragility scans;
- sanitized anonymous player aggregates containing no player/session/device identifiers;
- candidate snapshots clearly labeled as candidate while work is unmerged.

GitHub Actions artifacts are temporary working material. Meaningful accepted evidence must be retained in the private canonical archive; public-safe copies may also be committed here for local comparison and CI validation.

## What does not belong here

GameFrame is public. Never commit raw production/family telemetry, display names, Discord/player IDs, session IDs, attempt IDs, event streams, device fingerprints, diagnostics exports, incident/user records, or any raw player source containing those fields.

Public historical player evidence must be anonymous aggregate statistics with source filename and cryptographic hash provenance. Raw player exports remain private.

## Status

- `historical`: useful evidence from an earlier engine/level state.
- `accepted`: compact evidence for an accepted/merged batch.
- `candidate`: successful evidence for work not yet accepted.

## Workflow

1. Generate and tune a bounded level batch.
2. Run its ranged profile and fragility scan; use full/sentinel sweeps when justified.
3. Keep Actions artifacts for active debugging/comparison.
4. Retain meaningful accepted evidence in the private canonical archive with exact commit/workflow provenance.
5. Mirror compact public-safe bot/fragility evidence here when useful.
6. Update `manifest.json`; never overwrite history.
7. Compare future work against archived baselines and prefer older-family sentinels over constant full-campaign reruns.
8. Reserve expensive full sweeps for major milestones, material engine changes, or sentinel drift.

See `planning/cascade-testing-methodology.md`.
