import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { formatBRL, parseFinancialMessage } from "@/lib/finance/message-parser";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type WhatsAppMessage = { id: string; from: string; type: string; text?: { body?: string } };
type WebhookPayload = { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: WhatsAppMessage[] } }> }> };

function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(received) || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

async function sendText(phoneNumberId: string, to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!token || !version) return;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });
  if (!response.ok) throw new Error(`WhatsApp Graph API retornou ${response.status}.`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verificação inválida." }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Conteúdo inválido." }, { status: 400 });
  }
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = value?.metadata?.phone_number_id;
  const message = value?.messages?.[0];
  if (!phoneNumberId || !message) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { data: connection } = await admin.from("whatsapp_connections").select("id, user_id").eq("phone_number_id", phoneNumberId).eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.json({ received: true });
  const { error: messageError } = await admin.from("whatsapp_messages").insert({ user_id: connection.user_id, connection_id: connection.id, wa_message_id: message.id, from_phone: message.from, direction: "inbound", message_type: message.type, payload });
  if (messageError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (messageError) return NextResponse.json({ error: "Falha ao registrar mensagem." }, { status: 500 });

  if (message.type !== "text" || !message.text?.body) {
    await sendText(phoneNumberId, message.from, "Recebi seu arquivo. O processamento de mídia será habilitado na próxima etapa.");
    return NextResponse.json({ received: true });
  }
  const parsed = parseFinancialMessage(message.text.body);
  if (!parsed) {
    await sendText(phoneNumberId, message.from, "Não encontrei um valor. Tente: 'gastei 45,90 no almoço'.");
    return NextResponse.json({ received: true });
  }
  const { error: transactionError } = await admin.from("transactions").insert({ user_id: connection.user_id, description: parsed.description, amount: parsed.amount, occurred_on: new Date().toISOString().slice(0, 10), status: "review", external_id: message.id, fingerprint: `whatsapp:${message.id}`, raw_data: { category: parsed.category, source: "whatsapp", original_text: message.text.body } });
  if (transactionError) return NextResponse.json({ error: "Falha ao criar transação." }, { status: 500 });
  await sendText(phoneNumberId, message.from, `Anotei ${parsed.description}: ${formatBRL(parsed.amount)}. Abra o Conta Aí para revisar e confirmar.`);
  return NextResponse.json({ received: true });
}
