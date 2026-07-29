# Development Workflow

## Purpose

This repository uses local verification for routine iteration and deliberately triggered GitHub-hosted validation for completed feature candidates and major milestones. Development should maximize deterministic, service, Workers-runtime, browser, and visual confidence before deployment. Deployment canaries confirm environment integration; they are not the normal debugging loop.

Public GameFrame code must not execute on persistent self-hosted runners.

## Branch lifecycle

1. Start a dedicated branch from current `main` using the `agent/<feature>` naming convention.
2. Open or maintain a draft pull request for the branch.
3. Inspect affected code, tests, planning decisions, and current architecture before editing.
4. Run focused tests while implementing the feature.
5. Run browser interaction and screenshot checks when the change affects the public client.
6. Before each push described as locally verified, run `npm run validate` against the exact commit that will be pushed.
7. Record the validated head SHA, environment, commands, result, and evidence class in the pull request.
8. Continue development without starting GitHub Actions.

## Final feature candidate

When the feature is complete:

1. Bring the branch up to date with `main`.
2. Resolve conflicts and rerun all affected focused tests.
3. Run `npm run validate` in the local development environment.
4. Review any browser screenshots or visual differences that are part of the acceptance target.
5. Commit and push the exact validated tree.
6. Record the final locally validated SHA in the pull request.
7. Freeze the branch. Do not add commits while canonical validation is running or after it passes.
8. Start `.github/workflows/ci.yml`, displayed as `Canonical Validation`, either by manual workflow dispatch or by applying the `canonical-validation` label to the frozen pull request.
9. Confirm that the `validate` job passed on the final head.
10. Review any failure-only diagnostic artifact before rerunning.
11. Squash-merge the pull request unless preserving separate commits has a concrete value.

Any commit added after the canonical result requires the local final-candidate procedure and canonical workflow to be repeated.

## Evidence classes

### Local development evidence

Proves repository behavior reproducible in the recorded development environment. It must identify the exact commit and must not be presented as GitHub Actions, deployed Cloudflare, Discord, or real Scribbles Runtime evidence.

### Canonical GitHub evidence

The deliberately triggered GitHub-hosted workflow is the durable pre-merge repository marker. It installs the committed dependency lock with `npm ci` and reruns `npm run validate` in the canonical public GitHub Actions environment.

The canonical environment is also the authority for accepted environment-sensitive visual-regression baselines when browser rendering differs across machines.

### External canary evidence

External canaries are compact, deliberately triggered checks of live integrations. They are separate from the merge gate and should identify exactly which boundary was exercised:

- Standalone deployed Cloudflare Worker and Durable Objects
- Discord Activity launch and identity
- Mock remote-agent transport
- Real Scribbles Runtime adapter
- Production or staging recovery

Standalone GameFrame, Discord, and mock-agent canaries may be completed before the live Scribbles Runtime is deployed. Human and deterministic seats remain valid canary participants.

## Runner controls

The canonical workflow may be started only by manual dispatch or the explicit `canonical-validation` pull-request label. The only permitted pull-request event is `labeled`.

Do not add `push`, `schedule`, `opened`, `synchronize`, `ready_for_review`, or other routine triggers without an explicit workflow-policy decision.

Public repository workflows must use GitHub-hosted runners. Do not target persistent self-hosted runners from GameFrame workflows, including for pull requests, branches, manual dispatches, or reusable workflows.

## Artifact handling

### Default behavior

- Passing canonical runs should upload no large artifact bundle.
- Job logs and the GitHub check result are the durable evidence for successful runs.
- Browser videos, traces, and screenshot bundles should not be generated or retained routinely.

### Failure diagnostics

A failed browser, visual, or Workers-runtime run may upload one compressed diagnostic bundle with only the relevant screenshots, expected images, differences, trace, focused logs, and commit metadata.

Use a provisional retention period of three days for failure diagnostics.

### Visual-review milestones

A manually selected visual-review run may upload one curated screenshot bundle with a provisional retention period of no more than seven days unless the material is moved to an intentional durable location.

### Local archive escalation

Do not create a runner-local artifact archive merely because browser tests are introduced. First use failure-only uploads, compression, short retention, and workflow-run cleanup.

If GitHub artifact storage remains inadequate, a local archive may be added outside any ephemeral Actions workspace. It must:

- Enforce a total disk-size ceiling
- Rotate by age and retained-run count
- Keep only explicitly selected failed or milestone evidence
- Expose enough monitoring that the archive cannot silently fill its disk
- Avoid treating local files as the only durable merge record
- Remain isolated from execution of untrusted public repository code

## Public logs and artifacts

Workflow logs and artifacts are public information after the repository visibility changes. Do not print or upload credentials, cookies, private keys, private user or campaign data, internal administration screens, incident records, or secret-bearing environment output.
