import assert from "node:assert/strict";
import test from "node:test";
import {
  discordChallengeMessage,
  discordChallengeNonce,
  discordRecipientId,
} from "./discord-challenge-message.ts";

test("Discord challenge message targets only canonical Discord players", () => {
  assert.equal(discordRecipientId("discord:123456789"), "123456789");
  assert.equal(discordRecipientId("development:123"), null);
  assert.equal(discordRecipientId("discord:not-a-number"), null);
});

test("Discord challenge message points to Matches without carrying invitation custody", () => {
  const message = discordChallengeMessage({
    invitationId: "invite-123",
    targetPlayerId: "discord:222",
    inviterDisplayName: "Mom\nThe Great",
    gameLabel: "Clockwork Checkers",
    origin: "https://gameframe.cc",
  });

  assert.ok(message);
  assert.equal(message.recipientId, "222");
  assert.match(message.content, /Mom The Great challenged you to Clockwork Checkers/);
  assert.match(message.content, /https:\/\/gameframe\.cc\/matches\.html/);
  assert.doesNotMatch(message.content, /token|invite\.html/i);
  assert.deepEqual(message.allowedMentions, { parse: [] });
  assert.equal(message.nonce, discordChallengeNonce("invite-123"));
  assert.ok(message.nonce.length <= 25);
});

test("Discord challenge nonce is deterministic and bounded", () => {
  const first = discordChallengeNonce("07f021d0-c8f5-4d2b-9a83-780c438aef63");
  const second = discordChallengeNonce("07f021d0-c8f5-4d2b-9a83-780c438aef63");
  const other = discordChallengeNonce("another-invitation");
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^gf-[0-9a-f]{16}$/);
  assert.ok(first.length <= 25);
});
