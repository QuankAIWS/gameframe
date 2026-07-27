# Development Workflow

## Purpose

This repository preserves the self-hosted GitHub runner for completed feature candidates and major milestones. Routine development verification is performed in the assistant execution environment.

## Branch lifecycle

1. Start a dedicated branch from current `main` using the `agent/<feature>` naming convention.
2. Open or maintain a draft pull request for the branch.
3. Inspect affected code and tests before editing.
4. Run focused tests while implementing the feature.
5. Before each push described as locally verified, run `npm run validate` against the exact commit that will be pushed.
6. Record the validated head SHA, environment, commands, and result in the pull request.
7. Continue development without dispatching GitHub Actions.

## Final feature candidate

When the feature is complete:

1. Bring the branch up to date with `main`.
2. Resolve conflicts and rerun all affected focused tests.
3. Run `npm run validate` in the assistant execution environment.
4. Commit and push the exact validated tree.
5. Record the final locally validated SHA in the pull request.
6. Freeze the branch. Do not add commits while canonical validation is running or after it passes.
7. Manually dispatch `.github/workflows/ci.yml`, displayed as `Canonical Validation`, against the feature branch.
8. Confirm that the `validate` job passed on the final head.
9. Squash-merge the pull request unless preserving separate commits has a concrete value.

Any commit added after the canonical result requires the local final-candidate procedure and canonical workflow to be repeated.

## Evidence classes

### Assistant-local evidence

Proves repository behavior reproducible in the assistant execution environment. It must identify the exact commit and must not be presented as GitHub Actions evidence.

### Canonical GitHub evidence

The manually dispatched self-hosted workflow is the durable pre-merge repository marker. It reruns `npm run validate` in the canonical GitHub Actions environment.

### External canary evidence

Discord, deployed Cloudflare, and Scribbles Runtime integration require their own compact canaries. Neither assistant-local nor canonical repository validation substitutes for those live-environment checks.

## Runner controls

The canonical workflow must remain manual-dispatch-only. Do not add `push`, `pull_request`, `schedule`, or other automatic triggers without an explicit workflow-policy decision.
