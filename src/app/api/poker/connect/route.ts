import { evolutionRequest } from "@/lib/evolution/server";
import { authorizeGatewayRequest, gatewayToken } from "@/lib/poker-gateway/auth";
import { gatewayError, unauthorized } from "@/lib/poker-gateway/responses";

export const runtime = "nodejs";
const INSTANCE = "presidente-poker";

async function configureWebhook() {
  const publicUrl = process.env.POKER_GATEWAY_PUBLIC_URL?.replace(/\/$/, "");
  const token = gatewayToken();
  if (!publicUrl || !token) throw new Error("POKER_GATEWAY_PUBLIC_URL não configurada.");
  await evolutionRequest(`/webhook/set/${INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: `${publicUrl}/api/poker/webhook`,
        webhookByEvents: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        headers: { Authorization: `Bearer ${token}` },
      },
    }),
  });
}

export async function POST(request: Request) {
  if (!authorizeGatewayRequest(request)) return unauthorized();
  try {
    let exists = true;
    try {
      const current = await evolutionRequest<{ instance?: { state?: string; owner?: string } }>(`/instance/connectionState/${INSTANCE}`);
      if (current.instance?.state === "open") return Response.json({ state: "open", number: current.instance.owner || null, qrCode: null });
    } catch {
      exists = false;
    }

    if (!exists) {
      const created = await evolutionRequest<{ qrcode?: { base64?: string } }>("/instance/create", {
        method: "POST",
        body: JSON.stringify({ instanceName: INSTANCE, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      await configureWebhook();
      if (created.qrcode?.base64) return Response.json({ state: "connecting", qrCode: created.qrcode.base64 });
    } else {
      await configureWebhook();
    }

    const connected = await evolutionRequest<{ base64?: string; code?: string; qrcode?: { base64?: string; code?: string } }>(`/instance/connect/${INSTANCE}`);
    return Response.json({
      state: "connecting",
      qrCode: connected.base64 || connected.qrcode?.base64 || null,
      code: connected.code || connected.qrcode?.code || null,
    });
  } catch (error) {
    return gatewayError(error, "Falha ao conectar o WhatsApp.");
  }
}
