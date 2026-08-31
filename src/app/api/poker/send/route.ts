import { z } from "zod";
import { evolutionRequest } from "@/lib/evolution/server";
import { authorizeGatewayRequest } from "@/lib/poker-gateway/auth";
import { gatewayError, unauthorized } from "@/lib/poker-gateway/responses";

export const runtime = "nodejs";
const INSTANCE = "presidente-poker";
const sendSchema = z.object({ number: z.string().min(5).max(100), text: z.string().min(1).max(4096) });

export async function POST(request: Request) {
  if (!authorizeGatewayRequest(request)) return unauthorized();
  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Destino ou mensagem inválidos." }, { status: 400 });
  try {
    const result = await evolutionRequest(`/message/sendText/${INSTANCE}`, { method: "POST", body: JSON.stringify(parsed.data) });
    return Response.json({ sent: true, result });
  } catch (error) {
    return gatewayError(error, "Falha ao enviar a mensagem.");
  }
}
