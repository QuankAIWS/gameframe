import assert from "node:assert/strict";
import test from "node:test";
import {
  DevelopmentHeaderAuthenticator,
  RejectingRequestAuthenticator,
  rejectIdentityClaim,
  requirePrincipalSeat,
} from "./request-authenticator.ts";

test("development authenticator derives identity from the trusted request boundary", async () => {
  const authenticator = new DevelopmentHeaderAuthenticator();
  const principal = await authenticator.authenticate(new Request("https://gameframe.test", {
    headers: { "x-gameframe-player-id": "alice" },
  }));

  assert.deepEqual(principal, {
    playerId: "alice",
    source: "development",
    displayName: "Development player",
  });
});

test("development authenticator rejects anonymous requests", async () => {
  const authenticator = new DevelopmentHeaderAuthenticator();
  await assert.rejects(
    () => authenticator.authenticate(new Request("https://gameframe.test")),
    (error: any) => error.code === "authentication_required",
  );
});

test("authorization rejects match creation and action claims for another identity", () => {
  const principal = { playerId: "alice", source: "development" as const };
  assert.throws(
    () => requirePrincipalSeat(principal, ["bob", "gameframe-bot"]),
    (error: any) => error.code === "forbidden",
  );
  assert.throws(
    () => rejectIdentityClaim(principal, "bob"),
    (error: any) => error.code === "identity_mismatch",
  );
  assert.doesNotThrow(() => rejectIdentityClaim(principal, "alice"));
});

test("production-default authenticator fails closed", async () => {
  const authenticator = new RejectingRequestAuthenticator();
  await assert.rejects(
    () => authenticator.authenticate(new Request("https://gameframe.test")),
    (error: any) => error.code === "authentication_required",
  );
});
