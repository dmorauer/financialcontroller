import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !publishableKey) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  const webhookEndpoint = process.env.POKER_SUPABASE_WEBHOOK_URL || "https://znutkwcppixmtjhyhgen.supabase.co/functions/v1/evolution-webhook";
  if (!apiUrl || !apiKey || !webhookSecret) {
    return Response.json({ error: "A configuração da Evolution ainda não está completa neste servidor." }, { status: 503 });
  }

  const webhookUrl = new URL(webhookEndpoint);
  webhookUrl.searchParams.set("secret", webhookSecret);

  return Response.json({
    EVOLUTION_API_URL: apiUrl,
    EVOLUTION_API_KEY: apiKey,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE || "presidente-poker",
    EVOLUTION_WEBHOOK_SECRET: webhookSecret,
    EVOLUTION_WEBHOOK_URL: webhookUrl.toString(),
  }, {
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      Pragma: "no-cache",
    },
  });
}
