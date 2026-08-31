import assert from "node:assert/strict";
import test from "node:test";
import { normalizePokerWebhookPayload } from "./event.ts";

test("normalizes both Evolution event name variants", () => {
  assert.equal(normalizePokerWebhookPayload({ event: "messages.upsert" }).event, "MESSAGES_UPSERT");
  assert.equal(normalizePokerWebhookPayload({ event: "MESSAGES_UPSERT" }).event, "MESSAGES_UPSERT");
});

test("preserves message data while removing an accidental scalar payload", () => {
  const data = { key: { id: "1", remoteJid: "group@g.us" } };
  assert.deepEqual(normalizePokerWebhookPayload({ event: "messages.upsert", data }).data, data);
  assert.deepEqual(normalizePokerWebhookPayload("invalid"), { event: "" });
});
