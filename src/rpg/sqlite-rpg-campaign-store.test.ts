import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  SqliteRpgCampaignStore,
  SqliteRpgCampaignStoreError,
  type DurableCampaignBootstrap,
} from "./sqlite-rpg-campaign-store.ts";

const directories: string[] = [];

test.afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "gameframe-rpg-campaign-store-"));
  directories.push(directory);
  return join(directory, "gameframe.sqlite");
}

function bootstrap(
  overrides: Partial<DurableCampaignBootstrap> = {},
): DurableCampaignBootstrap {
  return {
    campaignId: "campaign-one",
    title: "Monster Master reference chapter",
    status: "active",
    state: {
      gameframeCoordinationRevision: 6,
      presentationSequence: 6,
      linkedNarrativeRevision: 0,
    },
    memberships: [
      {
        playerId: "player:ada",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
      },
      {
        playerId: "player:bryn",
        role: "player",
        partyId: "party:keepers",
        joinedPresentationSequence: 0,
        leftPresentationSequence: 3,
      },
      {
        playerId: "player:bryn",
        role: "player",
        partyId: "party:rivals",
        joinedPresentationSequence: 3,
      },
      {
        playerId: "player:observer",
        role: "observer",
        joinedPresentationSequence: 0,
      },
    ],
    events: [
      {
        eventId: "event:public",
        kind: "scene.presented",
        audience: { kind: "public" },
        payload: { text: "The academy gate is sealed." },
        createdAt: "2026-08-04T22:40:01.000Z",
      },
      {
        eventId: "event:keepers-early",
        kind: "campaign.reveal",
        audience: { kind: "party", partyId: "party:keepers" },
        payload: { text: "The keeper crest responds." },
        createdAt: "2026-08-04T22:40:02.000Z",
      },
      {
        eventId: "event:ada-private",
        kind: "campaign.reveal",
        audience: { kind: "player", playerId: "player:ada" },
        payload: { text: "Ada recognizes the old sigil." },
        createdAt: "2026-08-04T22:40:03.000Z",
      },
      {
        eventId: "event:keepers-late",
        kind: "campaign.reveal",
        audience: { kind: "party", partyId: "party:keepers" },
        payload: { text: "The keepers receive a later clue." },
        createdAt: "2026-08-04T22:40:04.000Z",
      },
      {
        eventId: "event:runtime-secret",
        kind: "campaign.reveal",
        audience: { kind: "runtime" },
        payload: { text: "The antagonist placed the seal." },
        createdAt: "2026-08-04T22:40:05.000Z",
      },
      {
        eventId: "event:bryn-private",
        kind: "campaign.reveal",
        audience: { kind: "player", playerId: "player:bryn" },
        payload: { text: "Bryn hears a rival signal." },
        createdAt: "2026-08-04T22:40:06.000Z",
      },
    ],
    initializedAt: "2026-08-04T22:40:00.000Z",
    ...overrides,
  };
}

test("bootstraps campaign metadata, membership intervals, events, and positions atomically", () => {
  const filePath = databasePath();
  const store = new SqliteRpgCampaignStore({ filePath });
  const result = store.bootstrap(bootstrap());
  assert.equal(result.kind, "initialized");
  assert.deepEqual(result.receipt, {
    kind: "gameframe.campaign_bootstrapped",
    campaignId: "campaign-one",
    title: "Monster Master reference chapter",
    status: "active",
    memberCount: 4,
    eventIds: bootstrap().events.map((event) => event.eventId),
    state: bootstrap().state,
    initializedAt: "2026-08-04T22:40:00.000Z",
  });
  store.close();

  const database = new DatabaseSync(filePath);
  const membershipCount = database.prepare(
    "SELECT COUNT(*) AS count FROM rpg_campaign_membership_intervals_v1",
  ).get() as { count: number };
  const eventCount = database.prepare(
    "SELECT COUNT(*) AS count FROM rpg_presentation_events_v1",
  ).get() as { count: number };
  assert.equal(Number(membershipCount.count), 4);
  assert.equal(Number(eventCount.count), 6);
  database.close();
});

test("survives restart and returns exact bootstrap retry", () => {
  const filePath = databasePath();
  let store = new SqliteRpgCampaignStore({ filePath });
  const first = store.bootstrap(bootstrap());
  store.close();

  store = new SqliteRpgCampaignStore({ filePath });
  const retry = store.bootstrap(bootstrap());
  assert.equal(retry.kind, "existing");
  assert.deepEqual(retry.receipt, first.receipt);
  store.close();
});

test("filters public, player, party, and runtime audiences at each event sequence", () => {
  const filePath = databasePath();
  const store = new SqliteRpgCampaignStore({ filePath });
  store.bootstrap(bootstrap());

  const ada = store.attach({
    campaignId: "campaign-one",
    authenticatedPlayerId: "player:ada",
  });
  assert.deepEqual(ada.events.map((event) => event.eventId), [
    "event:public",
    "event:keepers-early",
    "event:ada-private",
    "event:keepers-late",
  ]);
  assert.equal(ada.partyId, "party:keepers");
  assert.equal(ada.events.some((event) => "audience" in event), false);

  const bryn = store.attach({
    campaignId: "campaign-one",
    authenticatedPlayerId: "player:bryn",
  });
  assert.deepEqual(bryn.events.map((event) => event.eventId), [
    "event:public",
    "event:keepers-early",
    "event:bryn-private",
  ]);
  assert.equal(bryn.partyId, "party:rivals");

  const observer = store.attach({
    campaignId: "campaign-one",
    authenticatedPlayerId: "player:observer",
  });
  assert.deepEqual(observer.events.map((event) => event.eventId), ["event:public"]);
  assert.equal(observer.role, "observer");
  store.close();
});

test("denies nonmembers and never returns runtime-only presentation", () => {
  const filePath = databasePath();
  const store = new SqliteRpgCampaignStore({ filePath });
  store.bootstrap(bootstrap());
  assert.throws(
    () => store.attach({
      campaignId: "campaign-one",
      authenticatedPlayerId: "player:outsider",
    }),
    (error: unknown) =>
      error instanceof SqliteRpgCampaignStoreError
      && error.code === "campaign-access-denied",
  );
  for (const playerId of ["player:ada", "player:bryn", "player:observer"]) {
    const projection = store.attach({
      campaignId: "campaign-one",
      authenticatedPlayerId: playerId,
    });
    assert.equal(
      projection.events.some((event) => event.eventId === "event:runtime-secret"),
      false,
    );
  }
  store.close();
});

test("rejects changed bootstrap and fails closed on changed backing custody", () => {
  const filePath = databasePath();
  let store = new SqliteRpgCampaignStore({ filePath });
  store.bootstrap(bootstrap());
  assert.throws(
    () => store.bootstrap(bootstrap({ title: "Changed campaign" })),
    (error: unknown) =>
      error instanceof SqliteRpgCampaignStoreError
      && error.code === "campaign-bootstrap-conflict",
  );
  store.close();

  const database = new DatabaseSync(filePath);
  database.prepare(
    "UPDATE rpg_presentation_events_v1 SET event_json = ? WHERE event_id = ?",
  ).run(JSON.stringify({ changed: true }), "event:public");
  database.close();

  store = new SqliteRpgCampaignStore({ filePath });
  assert.throws(
    () => store.bootstrap(bootstrap()),
    (error: unknown) =>
      error instanceof SqliteRpgCampaignStoreError
      && error.code === "corrupt-store",
  );
  store.close();
});

test("rolls back all bootstrap authority on injected failure", () => {
  const filePath = databasePath();
  const store = new SqliteRpgCampaignStore({
    filePath,
    faultInjector(stage) {
      if (stage === "after-membership-insert") throw new Error("injected crash");
    },
  });
  assert.throws(() => store.bootstrap(bootstrap()), /injected crash/);
  store.close();

  const database = new DatabaseSync(filePath);
  for (const table of [
    "rpg_campaign_coordination_v1",
    "rpg_campaign_metadata_v1",
    "rpg_campaign_membership_intervals_v1",
    "rpg_presentation_events_v1",
  ]) {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    };
    assert.equal(Number(row.count), 0, table);
  }
  database.close();
});

test("rejects overlapping membership intervals and unknown private targets", () => {
  const store = new SqliteRpgCampaignStore({ filePath: databasePath() });
  assert.throws(
    () => store.bootstrap(bootstrap({
      memberships: [
        {
          playerId: "player:ada",
          role: "player",
          joinedPresentationSequence: 0,
        },
        {
          playerId: "player:ada",
          role: "player",
          joinedPresentationSequence: 2,
        },
      ],
      events: [],
      state: {
        gameframeCoordinationRevision: 0,
        presentationSequence: 0,
        linkedNarrativeRevision: 0,
      },
    })),
    (error: unknown) =>
      error instanceof SqliteRpgCampaignStoreError
      && error.code === "invalid-input",
  );
  assert.throws(
    () => store.bootstrap(bootstrap({
      events: [
        {
          eventId: "event:unknown-private",
          kind: "campaign.reveal",
          audience: { kind: "player", playerId: "player:unknown" },
          payload: { text: "secret" },
          createdAt: "2026-08-04T22:40:01.000Z",
        },
      ],
      state: {
        gameframeCoordinationRevision: 1,
        presentationSequence: 1,
        linkedNarrativeRevision: 0,
      },
    })),
    (error: unknown) =>
      error instanceof SqliteRpgCampaignStoreError
      && error.code === "invalid-input",
  );
  store.close();
});
