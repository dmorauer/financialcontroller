import { NextResponse } from "next/server";
import { formatBRL, parseFinancialMessage } from "@/lib/finance/message-parser";
import { parseGroupCommand } from "@/lib/finance/group-command";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EvolutionPayload = {
  event?: string;
  instance?: string;
  apikey?: string;
  data?: {
    key?: { id?: string; remoteJid?: string; fromMe?: boolean; participant?: string; participantAlt?: string };
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

async function sendEvolutionText(instance: string, to: string, text: string) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return false;
  const response = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: to, text }),
  });
  return response.ok;
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
  if (!instance || !messageId || !remoteJid) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const text = messageText(payload);
  const isGroup = remoteJid.endsWith("@g.us");
  const command = text && isGroup ? parseGroupCommand(text) : null;
  console.info("[evolution] message received", { instance, messageId, isGroup, fromMe: Boolean(payload.data?.key?.fromMe), hasText: Boolean(text), hasCommand: Boolean(command) });
  if (payload.data?.key?.fromMe && !isGroup) return NextResponse.json({ received: true, ignored: true });
  if (isGroup && !command) {
    console.info("[evolution] ignored", { messageId, reason: "group_message_without_command" });
    return NextResponse.json({ received: true, ignored: true, reason: "group_message_without_command" });
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

  const senderJid = isGroup
    ? payload.data?.key?.participantAlt || payload.data?.key?.participant || "unknown"
    : remoteJid;
  const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");
  if (isGroup && !payload.data?.key?.fromMe) {
    const { data: allowed } = await admin
      .from("whatsapp_allowed_senders")
      .select("id")
      .eq("user_id", connection.user_id)
      .eq("phone", senderPhone)
      .eq("active", true)
      .maybeSingle();
    if (!allowed) {
      console.info("[evolution] ignored", { messageId, reason: "sender_not_allowed" });
      await sendEvolutionText(instance, remoteJid, "🔒 Este número não está autorizado a lançar despesas neste grupo.").catch(() => false);
      return NextResponse.json({ received: true, ignored: true, reason: "sender_not_allowed" });
    }
  }
  const safePayload = { ...payload, apikey: undefined };
  const { error: messageError } = await admin.from("whatsapp_messages").insert({
    user_id: connection.user_id,
    connection_id: connection.id,
    wa_message_id: `evolution:${instance}:${messageId}`,
    from_phone: senderPhone,
    direction: "inbound",
    message_type: payload.data?.messageType || "unknown",
    payload: safePayload,
  });
  if (messageError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (messageError) return NextResponse.json({ error: "Falha ao registrar mensagem." }, { status: 500 });

  if (!text) return NextResponse.json({ received: true, needs_media_processing: true });
  const financialText = command?.text ?? text;
  const parsed = parseFinancialMessage(financialText);
  if (!parsed) {
    if (isGroup) await sendEvolutionText(instance, remoteJid, "Não encontrei um valor. Use, por exemplo: !gasto 50 no mercado").catch(() => false);
    return NextResponse.json({ received: true, needs_value: true });
  }

  const { error: transactionError } = await admin.from("transactions").insert({
    user_id: connection.user_id,
    description: parsed.description,
    amount: parsed.amount,
    occurred_on: new Date().toISOString().slice(0, 10),
    due_on: parsed.dueOn,
    status: "review",
    external_id: messageId,
    fingerprint: `evolution:${instance}:${messageId}`,
    raw_data: {
      category: parsed.category,
      source: "evolution",
      original_text: text,
      sender_name: payload.data?.pushName,
      sender_phone: senderPhone,
      group_id: isGroup ? remoteJid : null,
      group_command: command?.kind ?? null,
    },
  });
  if (transactionError) return NextResponse.json({ error: "Falha ao criar transação." }, { status: 500 });
  console.info("[evolution] transaction created", { messageId, isGroup, category: parsed.category });

  if (isGroup) {
    const sender = payload.data?.pushName ? `${payload.data.pushName}: ` : "";
    const due = parsed.dueOn ? ` · vence em ${new Date(`${parsed.dueOn}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
    await sendEvolutionText(instance, remoteJid, `✅ ${sender}${parsed.description} — ${formatBRL(parsed.amount)}${due}. Lançamento enviado para revisão.`).catch(() => false);
  }

  return NextResponse.json({ received: true, group: isGroup, transaction: { description: parsed.description, amount: formatBRL(parsed.amount) } });
}
