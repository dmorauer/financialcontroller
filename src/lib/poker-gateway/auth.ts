import { createHmac, timingSafeEqual } from "node:crypto";

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export function gatewayToken() {
  return process.env.SALDO_AI_API_KEY;
}

export function signGatewayPayload(token: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", token).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function authorizeGatewayRequest(request: Request, rawBody = "", now = Date.now()) {
  const token = gatewayToken();
  if (!token) return false;

  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && safeEqual(bearer, token)) return true;

  const timestamp = request.headers.get("x-saldo-ai-timestamp");
  const supplied = request.headers.get("x-saldo-ai-signature")?.replace(/^sha256=/i, "");
  if (!timestamp || !supplied) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60 * 1000) return false;
  return safeEqual(supplied.toLowerCase(), signGatewayPayload(token, timestamp, rawBody));
}
