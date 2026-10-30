---
schema_version: 1
doc_id: gameframe-cascade-offline-telemetry-2026-10-24
title: Cascade offline telemetry custody and retry policy
status: active
authority: implementation-evidence
created_at: 2026-10-24
updated_at: 2026-10-24
tags: [gameframe, cascade, offline, telemetry, reliability]
---

# Cascade offline telemetry custody

## Scope and source of truth

This is **best-effort observational** event delivery. Gameplay, local level saves,
cross-device progression reconciliation, lives, and hammers never depend on
successful telemetry. The server's `cascade/telemetry` endpoint only accepts
observations; it is not a gameplay authority.

The client retains the most recent **500 raw analytics events** in
`scribbles-gameframe.cascade-analytics:v1`, a finite `localStorage` array.
Writers truncate before saving; the uploader independently reads at most the
last 500 even if preexisting storage is malformed/oversized. If an offline run
creates more than 500 events before successful delivery, **the oldest records
are irreversibly dropped**. The uploader cannot promise recovery for events no
longer present. There is no false reconstruction, infinite queue, or
secretly created server-side progression event.

## Replay and idempotency

Every newly emitted normal, v2, bonus-mode and tutorial event carries a
`telemetryId` created once at recording time. The uploader derives the
stable client event identity `cascade-raw:<uuid>` from that value. Removing
older entries from the 500-item queue therefore cannot renumber the identity
of still-retained events. Pre-upgrade raw history retains its previous
fingerprint/occurrence fallback until naturally evicted; this fallback can
change when old identical records disappear. Server-side duplicate suppression
is bounded to its recent event-ID window; **neither permanent exactly-once
delivery nor infinite offline retention is claimed**.

The last accepted event ID is stored as a cursor after a successful server
response. An in-memory cursor also suppresses immediate resend within the
active page if persistent cursor storage raises a quota error. If an old
cursor has been evicted, the uploader begins from the oldest remaining
retained event. This is an explicit replay policy for the finite storage
window; server idempotency, not a timestamp guess, handles any replay.
When a second tab changes the shared cursor during an in-flight POST, the
uploader preserves that peer's cursor even when it no longer appears in the
first tab's pre-POST event snapshot. Otherwise a concurrent eviction could
cause one tab to overwrite a newer acknowledgement with an obsolete one and
replay accepted events.

## Network and session behavior

Each upload contains at most **five events**. One flush runs at most **32
batches**; the normal check interval is two seconds. No network request is
attempted when `navigator.onLine === false`. On HTTP failure, thrown fetch,
or failed persistent cursor write, retries back off from **15 seconds**, doubling
up to **five minutes**. A genuine offline-to-online transition can advance the
next attempt, but not sooner than 15 seconds after the previous attempt, so
rapid connectivity flaps cannot force an upload storm, including after a
successful upload when newly queued events exist. Success resets backoff.
Session checkpoint storage failures are also isolated from all game input and
progression event handlers.

Session start/end/heartbeat observations remain best-effort direct requests
rather than durable queue members. Hidden or idle pages do not send periodic
heartbeats. All telemetry errors are isolated from the Cascade loop. API/auth
responses are not service-worker cached.

## Verified tests and known gaps

- `node --test src/games/cascade/cascade-telemetry-sync.test.mjs`: stable
  identifiers across eviction, old-format compatibility, 500-item input cap,
  failed-request backoff, offline gating, quota-error cursor and producer
  contract checks.
- `npx playwright test test/browser/cascade-telemetry-offline.spec.mjs
  --config playwright.config.mjs`: actual Chromium offline transition,
  retained seven-event upload in 5+2 requests after reconnect, unique IDs,
  persistent final cursor, repeated disconnect/reconnect without duplicate
  batches or page errors.
- Existing PWA/offline gameplay and platform server tests remain independent
  controls; a complete physical-device offline-reopen and multi-device
  investigation is not implied by these synthetic telemetry test fixtures.

Known future acceptance gaps: permanent server-side event ID history outside
its bounded recent index, durable summaries for evicted long-offline events,
and physical offline page reopen with real authenticated progression. These
would need separate design/validation instead of assuming a 500-event ring
guarantees losslessness.
