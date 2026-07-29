# Canonical baseline validation — 2026-07-27

## Scope

This record closes the repository-only validation gate for the Scribbles namespace and Theo identity baseline merged through pull request `#3`.

Validated scope:

- active platform naming uses Scribbles GameFrame
- Scribbles Runtime is documented as a peer integration runtime
- Theo remains the public-facing agent and stable GameFrame player identity `theo`
- deterministic match, HTTP, authentication, signed-session, Cloudflare-adapter, and WebSocket projection tests remain green
- repository workflow policy prevents ordinary pushes and routine pull-request updates from starting canonical validation

## Canonical GitHub Actions evidence

- Workflow: `Canonical Validation`
- Run number: `#8`
- Run ID: `30283559393`
- Job: `validate`
- Node.js selected from `.nvmrc`: `22.16.0`
- Result: success
- Artifact uploads: none

The successful job completed repository checkout, Node.js setup, the full `npm run validate` command, post-action cleanup, and job completion without failures.

## Git and merge identity

- Base `main` before validation: `f9d5d36c5ab569f7a39722bb4909c9804d256881`
- Frozen feature head: `d2f404dfb76c03f5568ea3869eaccd6997423005`
- GitHub PR merge ref checked out by run `#8`: `932a1f5e0a185399b0a992ac2807903618ba0661`
- Final squash commit on `main`: `01584a43777ddc97a6439101ac4eff79aae1d876`

Because the canonical run was started by the deliberate `pull_request:labeled` event, GitHub Actions checked out the generated pull-request merge ref rather than the raw feature branch head. That merge ref combined the frozen feature head with the then-current `main` base. No feature-branch commit was added after the successful run. Pull request `#3` was then squash-merged.

## Evidence boundary

This validation proves the checked-in repository suite in its recorded GitHub Actions environment. It does not prove:

- deployed Cloudflare Worker or Durable Object behavior
- real `workerd` eviction or WebSocket hibernation behavior
- Discord Activity authorization, launch, participant, invite, resume, desktop, or mobile behavior
- Scribbles Runtime service authentication or model-driven Theo actions
- production recovery, quotas, or operational durability

Those remain explicit external-canary milestones.
