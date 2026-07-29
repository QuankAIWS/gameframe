# Development Workflow

## Purpose

This repository uses assistant-local verification for routine iteration and deliberately triggered GitHub-hosted validation for completed feature candidates and major milestones. Public GameFrame code must not execute on the private self-hosted runner.

## Branch lifecycle

1. Start a dedicated branch from current `main` using the `agent/<feature>` naming convention.
2. Open or maintain a draft pull request for the branch.
3. Inspect affected code and tests before editing.
4. Run focused tests while implementing the feature.
5. Before each push described as locally verified, run `npm run validate` against the exact commit that will be pushed.
6. Record the validated head SHA, environment, commands, and result in the pull request.
7. Continue development without starting GitHub Actions.

## Final feature candidate

When the feature is complete:

1. Bring the branch up to date with `main`.
2. Resolve conflicts and rerun all affected focused tests.
3. Run `npm run validate` in the assistant execution environment.
4. Commit and push the exact validated tree.
5. Record the final locally validated SHA in the pull request.
6. Freeze the branch. Do not add commits while canonical validation is running or after it passes.
7. Start `.github/workflows/ci.yml`, displayed as `Canonical Validation`, either by manual workflow dispatch or by applying the `canonical-validation` label to the frozen pull request.
8. Confirm that the `validate` job passed on the final head using the configured GitHub-hosted runner.
9. Squash-merge the pull request unless preserving separate commits has a concrete value.

Any commit added after the canonical result requires the local final-candidate procedure and canonical workflow to be repeated.

## Evidence classes

### Assistant-local evidence

Proves repository behavior reproducible in the assistant execution environment. It must identify the exact commit and must not be presented as GitHub Actions evidence.

### Canonical GitHub evidence

The deliberately triggered GitHub-hosted workflow is the durable pre-merge repository marker. It reruns `npm run validate` in the canonical public GitHub Actions environment.

### External canary evidence

Discord, deployed Cloudflare, and Scribbles Runtime integration require their own compact canaries. Neither assistant-local nor canonical repository validation substitutes for those live-environment checks.

## Runner controls

The canonical workflow may be started only by manual dispatch or the explicit `canonical-validation` pull-request label. The only permitted pull-request event is `labeled`. Do not add `push`, `schedule`, `opened`, `synchronize`, `ready_for_review`, or other routine triggers without an explicit workflow-policy decision.

Public repository workflows must use GitHub-hosted runners. Do not target the private self-hosted runner from GameFrame workflows, including for pull requests, branches, manual dispatches, or reusable workflows.

## Public logs and artifacts

Workflow logs and artifacts are public information after the repository visibility changes. Do not print or upload credentials, cookies, private keys, private user or campaign data, internal administration screens, incident records, or secret-bearing environment output.

Passing runs should avoid broad artifact uploads. Failed runs may retain focused diagnostics for a short period, and intentionally selected milestone evidence may be preserved in a deliberate durable location after review.
