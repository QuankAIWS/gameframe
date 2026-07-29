# 0008 — Publicly Viewable Proprietary Repository

- **Status:** Accepted
- **Date:** 2026-07-28
- **Scope:** Repository visibility, ownership, contribution rights, secrets, deployment information, GitHub Actions, and public artifacts

## Context

Scribbles GameFrame benefits from public GitHub-hosted Actions capacity, public inspection, easier sharing, and the possibility of later community interest. The project will retain maximum control over original code while the platform remains experimental and its future licensing model is unsettled.

Making a repository public changes who can inspect, clone, and fork it through GitHub. It does not require granting an open-source license or transferring copyright. However, every tracked branch, reachable commit, pull request, workflow log, and artifact must be treated as potentially public once visibility changes.

Public repositories also create a material security boundary around CI. Untrusted fork code must not be executed on persistent self-hosted runners.

## Decision

`QuankAIWS/scribbles-gameframe` will be publicly visible while remaining proprietary and all rights reserved.

The repository will not contain an open-source `LICENSE` file. `NOTICE` and the README will state that public visibility does not grant permission to reuse, modify, redistribute, sell, deploy, or create derivative works without prior written authorization.

The licensing posture may be reconsidered later through a separate explicit decision. No current change prejudges whether a future release uses MIT, Apache-2.0, MPL-2.0, GPL, AGPL, dual licensing, or another model.

## Contribution rights

Unsolicited code contributions are not accepted while ownership centralization is the priority.

Issues and design feedback may be accepted, but code may be merged from an external contributor only after an explicit invitation and an approved contributor-rights agreement. Depending on the future licensing model, that agreement may be a copyright assignment or a contributor license agreement granting sufficient relicensing and commercial rights.

Third-party code, art, audio, text, data, models, or other material requires documented provenance, applicable license terms, attribution, and compatibility review before inclusion.

## Secrets and deployment information

Secrets do not belong in either a public or private Git repository. Production credentials, API tokens, private keys, cookies, signing secrets, and similar values must live in GitHub, Cloudflare, or equivalent secret stores and enter the deployment only through environment bindings.

A second private repository is not required merely to store secrets.

A separate private operations repository may be created later only for material that is legitimately version-controlled but inappropriate for public disclosure, such as:

- Sensitive infrastructure inventories or network topology
- Private deployment automation containing nonsecret but operationally sensitive details
- Incident records and forensic notes
- Private campaign or user data
- Proprietary content packs or licensed assets that cannot be redistributed publicly
- Recovery procedures whose publication would materially increase attack risk

That private repository must still exclude raw credentials.

## GitHub Actions and artifacts

Public-repository workflows must use GitHub-hosted runners unless a later security decision establishes an isolated, ephemeral runner designed for untrusted public code.

Persistent self-hosted runners must not execute public GameFrame branches or pull-request code.

Workflow permissions remain least-privilege. Ordinary pushes and routine pull-request events do not trigger canonical validation. Public logs, screenshots, traces, and artifacts must not contain secrets, private user data, private campaign data, privileged administration views, or internal incident information.

Artifacts remain failure-oriented and short-lived by default. Curated milestone evidence may be preserved deliberately, but GitHub Actions artifacts are not treated as a permanent historical archive.

## Publication gate

The repository may be made public only after all of the following are complete:

1. Ownership and no-license notices are present.
2. Contribution and security policies are present.
3. Secret-bearing and local deployment files are excluded.
4. Public workflows do not target persistent self-hosted runners.
5. Active branches, pull requests, commit history, workflow logs, and artifacts are reviewed for sensitive information.
6. Any exposed or uncertain credential is revoked or rotated before publication.
7. Private vulnerability reporting and public-repository security features are enabled where available.
8. Branch protection or rulesets are reviewed after the visibility change because visibility transitions may alter repository rules.

## Consequences

### Positive

- Copyright ownership remains centralized and no general reuse license is granted.
- Public GitHub-hosted validation can replace private infrastructure consumption for this repository.
- The project can be inspected and shared without committing to an open-source governance model.
- Security and contribution boundaries are explicit before public attention arrives.

### Costs and risks

- Anyone can inspect, clone, and fork the visible repository through GitHub even though broader reuse is not licensed.
- Enforcement remains legal rather than technical once code is public.
- Historical branches, logs, and artifacts require review, not only the current `main` tree.
- External contributors may be discouraged by the proprietary posture and contributor-rights requirements.
- Returning the repository to private later cannot recall existing clones or public forks.

## Reconsideration triggers

Revisit this decision if the project begins accepting regular external code contributions, adopts third-party copyleft code, seeks broad ecosystem adoption, offers commercial hosting, establishes a legal entity, or needs dual licensing.
