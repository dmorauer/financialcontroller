import assert from "node:assert/strict";
import test from "node:test";
import { authorizeGatewayRequest, signGatewayPayload } from "./auth.ts";

test("accepts the project bearer token and rejects invalid tokens", () => {
  process.env.SALDO_AI_API_KEY = "secret";
  assert.equal(authorizeGatewayRequest(new Request("https://gateway.test", { headers: { Authorization: "Bearer secret" } })), true);
  assert.equal(authorizeGatewayRequest(new Request("https://gateway.test", { headers: { Authorization: "Bearer wrong" } })), false);
});

test("accepts fresh HMAC and rejects tampered or stale requests", () => {
  process.env.SALDO_AI_API_KEY = "secret";
  const timestamp = "1788170400";
  const now = Number(timestamp) * 1000;
  const signature = signGatewayPayload("secret", timestamp, "body");
  const request = new Request("https://gateway.test", { headers: { "X-Saldo-Ai-Timestamp": timestamp, "X-Saldo-Ai-Signature": `sha256=${signature}` } });
  assert.equal(authorizeGatewayRequest(request, "body", now), true);
  assert.equal(authorizeGatewayRequest(request, "changed", now), false);
  assert.equal(authorizeGatewayRequest(request, "body", now + 6 * 60 * 1000), false);
});
