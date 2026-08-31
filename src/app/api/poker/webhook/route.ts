import { authorizeGatewayRequest, gatewayToken } from "@/lib/poker-gateway/auth";
import { normalizePokerWebhookPayload } from "@/lib/poker-gateway/event";
import { gatewayError, unauthorized } from "@/lib/poker-gateway/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!authorizeGatewayRequest(request, rawBody)) return unauthorized();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Conteúdo inválido." }, { status: 400 });
  }

  const target = process.env.POKER_SUPABASE_WEBHOOK_URL;
  const token = gatewayToken();
  if (!target || !token) return Response.json({ error: "Destino do webhook do Poker não configurado." }, { status: 503 });
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(normalizePokerWebhookPayload(payload)),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Poker webhook respondeu HTTP ${response.status}.`);
    return Response.json({ received: true });
  } catch (error) {
    return gatewayError(error, "Falha ao encaminhar o webhook.");
  }
}
