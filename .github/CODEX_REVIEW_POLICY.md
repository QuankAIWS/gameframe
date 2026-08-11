# Codex review usage policy

Codex review is a scarce merge-quality gate, not an iteration loop.

## Required PR lifecycle

1. Open development pull requests as **drafts**.
2. Keep the PR draft while implementation, ordinary fixes, test iteration, screenshot iteration, and deterministic CI continue.
3. Do not comment `@codex review` during routine development.
4. Freeze the intended merge-candidate head and complete the required deterministic CI first.
5. Mark the PR **Ready for review exactly once** when that exact head is intended to merge. The Ready transition is the normal Codex review trigger.
6. Address valid Codex findings and rerun deterministic CI.
7. Request a second Codex review only when remediation materially changes a high-risk surface such as authentication/authorization, authority boundaries, secrets, persistence/schema, concurrency, retry/idempotency/recovery, protocols/cross-repository contracts, deployment/infrastructure, or other core behavior.

## Repeatable validation

Deterministic validation may run as often as useful: unit tests, type checks, lint, contract tests, browser tests, fixture checks, and other targeted CI.

Do not spend Codex reviews on intermediate commits, ordinary review-fix commits, formatting/copy churn, screenshot iteration, or repeated unchanged-scope validation.

The normal target is **one Codex review per substantive PR, against the final merge candidate**.
