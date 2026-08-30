import { NextResponse } from "next/server";
import { formatBRL, parseFinancialMessage } from "@/lib/finance/message-parser";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  apikey?: string;
  data?: {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
      documentMessage?: { caption?: string; fileName?: string };
    };
  };
};

function authorized(request: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const customHeader = request.headers.get("x-evolution-webhook-secret");
  return authorization === `Bearer ${secret}` || customHeader === secret;
}

function messageText(payload: EvolutionPayload) {
  const message = payload.data?.message;
  return message?.conversation
    || message?.extendedTextMessage?.text
    || message?.imageMessage?.caption
    || message?.documentMessage?.caption
    || null;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let payload: EvolutionPayload;
  try {
    payload = await request.json() as EvolutionPayload;
  } catch {
    return NextResponse.json({ error: "Conteúdo inválido." }, { status: 400 });
  }

  if (payload.event !== "messages.upsert") return NextResponse.json({ received: true });
  const instance = payload.instance;
  const messageId = payload.data?.key?.id;
  const remoteJid = payload.data?.key?.remoteJid;
  if (!instance || !messageId || !remoteJid || payload.data?.key?.fromMe || remoteJid.endsWith("@g.us")) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("id, user_id")
    .eq("provider", "evolution")
    .eq("instance_name", instance)
    .eq("status", "active")
    .maybeSingle();
  if (!connection) return NextResponse.json({ received: true, ignored: true });

  const safePayload = { ...payload, apikey: undefined };
  const { error: messageError } = await admin.from("whatsapp_messages").insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    wa_message_id: `evolution:${instance}:${messageId}`,
    from_phone: remoteJid.split("@")[0],
    direction: "inbound",
    message_type: payload.data?.messageType || "unknown",
    payload: safePayload,
  });
  if (messageError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (messageError) return NextResponse.json({ error: "Falha ao registrar mensagem." }, { status: 500 });

  const text = messageText(payload);
  if (!text) return NextResponse.json({ received: true, needs_media_processing: true });
  const parsed = parseFinancialMessage(text);
  if (!parsed) return NextResponse.json({ received: true, needs_value: true });

  const { error: transactionError } = await admin.from("transactions").insert({
    user_id: connection.user_id,
    description: parsed.description,
    amount: parsed.amount,
    occurred_on: new Date().toISOString().slice(0, 10),
    status: "review",
    external_id: messageId,
    fingerprint: `evolution:${instance}:${messageId}`,
    raw_data: { category: parsed.category, source: "evolution", original_text: text, sender_name: payload.data?.pushName },
  });
  if (transactionError) return NextResponse.json({ error: "Falha ao criar transação." }, { status: 500 });

  return NextResponse.json({ received: true, transaction: { description: parsed.description, amount: formatBRL(parsed.amount) } });
}
