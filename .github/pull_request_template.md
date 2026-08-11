<!--
CODEX USAGE POLICY
- Open development PRs as DRAFTS.
- Keep the PR draft while implementation, fixes, and ordinary CI iteration continue.
- Do not comment `@codex review` during routine iteration.
- Mark Ready for review only when this exact head is the intended merge candidate and required deterministic CI is green.
- The Ready transition is the normal single Codex review trigger.
- After Codex findings, fix them and rerun deterministic CI. Request another Codex review only if remediation materially changes a high-risk surface.
See `.github/CODEX_REVIEW_POLICY.md`.
-->

## Scope

Describe the completed feature or milestone and the boundaries intentionally left unchanged.

## Local validation

- Final locally validated SHA:
- Execution environment:
- Commands executed:
- Result:
- [ ] The pushed branch head is the exact locally validated commit.

## Canonical validation

- [ ] The feature is complete and the branch is frozen.
- [ ] `Canonical Validation` was deliberately started by manual dispatch or the `canonical-validation` label against the final branch head.
- Canonical run/result:
- [ ] The `validate` job passed.
- [ ] No commits were added after the canonical pass.

## Codex review gate

- [ ] This PR remained draft during implementation and ordinary CI iteration.
- [ ] No routine `@codex review` requests were made during iteration.
- [ ] This exact head is the intended merge candidate before marking Ready for review.
- [ ] Any second Codex review is justified by a materially changed high-risk surface, not ordinary remediation.

## External proof

List any Discord, deployed Cloudflare, or Scribbles Runtime canaries performed. State `not applicable` when the change does not require live-environment proof.
