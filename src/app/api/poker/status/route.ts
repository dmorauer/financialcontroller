import { evolutionRequest } from "@/lib/evolution/server";
import { authorizeGatewayRequest } from "@/lib/poker-gateway/auth";
import { gatewayError, unauthorized } from "@/lib/poker-gateway/responses";

export const runtime = "nodejs";
const INSTANCE = "presidente-poker";

export async function GET(request: Request) {
  if (!authorizeGatewayRequest(request)) return unauthorized();
  try {
    const result = await evolutionRequest<{ instance?: { state?: string; owner?: string }; state?: string }>(`/instance/connectionState/${INSTANCE}`);
    return Response.json({ state: result.instance?.state || result.state || "unknown", number: result.instance?.owner || null, qrCode: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o WhatsApp.";
    if (/not found|não encontr/i.test(message)) return Response.json({ state: "close", number: null, qrCode: null });
    return gatewayError(error, "Falha ao consultar o WhatsApp.");
  }
}
