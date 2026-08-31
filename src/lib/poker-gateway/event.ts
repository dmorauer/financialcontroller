type JsonObject = Record<string, unknown>;

const object = (value: unknown): JsonObject => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

export function normalizePokerWebhookPayload(payload: unknown): JsonObject & { event: string } {
  const root = object(payload);
  const event = String(root.event || "").toUpperCase().replace(/[.-]/g, "_");
  return { ...root, event };
}
