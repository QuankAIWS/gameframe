# Security Policy

## Supported code

Security review and fixes apply to the current `main` branch and any explicitly identified supported release. Development branches and historical commits may contain incomplete or superseded behavior.

## Reporting a vulnerability

Do not disclose exploitable details, credentials, private data, or proof-of-concept attacks in a public issue, discussion, pull request, workflow log, or artifact.

Use GitHub's private vulnerability reporting process through the repository's **Security** area and **Report a vulnerability** action. If that action is unavailable, open a minimal public issue requesting a private security contact without including technical exploit details.

A useful private report includes:

- Affected component and commit or version
- Reproduction steps
- Security impact
- Required preconditions
- Any known workaround
- Whether credentials or personal data may have been exposed

## Secrets and credential exposure

Treat any credential committed to Git history, printed in a public workflow log, or uploaded in a public artifact as compromised. Revoke or rotate it immediately; deleting the visible file alone is not remediation.

## Scope

Relevant reports include authentication or authorization bypasses, cross-player information leakage, unsafe WebSocket or HTTP mutation paths, session-token weaknesses, deployment-secret exposure, dependency compromise, and remote code execution in development or deployment tooling.
