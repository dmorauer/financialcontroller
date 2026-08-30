import { createClient } from "@/lib/supabase/server";
import { evolutionConfigured, evolutionRequest } from "@/lib/evolution/server";

export const runtime = "nodejs";

async function currentConnection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Não autorizado." }, { status: 401 }) };
  const { data: connection } = await supabase.from("whatsapp_connections").select("id, instance_name, display_phone_number, status").eq("provider", "evolution").eq("user_id", user.id).maybeSingle();
  if (!connection?.instance_name) return { error: Response.json({ error: "Conexão WhatsApp não cadastrada." }, { status: 404 }) };
  return { connection };
}

export async function GET() {
  const result = await currentConnection();
  if (result.error) return result.error;
  const connection = result.connection!;
  if (!evolutionConfigured()) return Response.json({ configured: false, state: connection.status, instance: connection.instance_name, phone: connection.display_phone_number });
  try {
    const remote = await evolutionRequest<{ instance?: { state?: string } }>(`/instance/connectionState/${encodeURIComponent(connection.instance_name)}`);
    return Response.json({ configured: true, state: remote.instance?.state ?? "unknown", instance: connection.instance_name, phone: connection.display_phone_number });
  } catch (error) {
    return Response.json({ configured: true, state: "unreachable", instance: connection.instance_name, phone: connection.display_phone_number, error: error instanceof Error ? error.message : "Evolution indisponível." });
  }
}

export async function POST(request: Request) {
  const result = await currentConnection();
  if (result.error) return result.error;
  if (!evolutionConfigured()) return Response.json({ error: "A Evolution API está rodando localmente e não pode ser controlada pela Vercel ainda." }, { status: 503 });
  const body = await request.json().catch(() => null) as { action?: string } | null;
  const instance = encodeURIComponent(result.connection!.instance_name);
  try {
    if (body?.action === "qr") {
      const qr = await evolutionRequest<{ base64?: string; code?: string; pairingCode?: string }>(`/instance/connect/${instance}`);
      return Response.json({ base64: qr.base64, code: qr.code, pairingCode: qr.pairingCode });
    }
    if (body?.action === "logout") {
      await evolutionRequest(`/instance/logout/${instance}`, { method: "DELETE" });
      return Response.json({ success: true });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao controlar o WhatsApp." }, { status: 502 });
  }
}
