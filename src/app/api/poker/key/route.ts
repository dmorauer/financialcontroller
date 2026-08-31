import { createClient } from "@supabase/supabase-js";
import { rotateGatewayToken } from "@/lib/poker-gateway/auth";

const cors = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Origin": "https://financialcontroller.vercel.app",
  Vary: "Origin",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return Response.json({ error: "Não autorizado." }, { status: 401, headers: cors });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "Sessão inválida." }, { status: 401, headers: cors });

  const apiKey = rotateGatewayToken();
  return Response.json({ apiKey }, { headers: { ...cors, "Cache-Control": "no-store" } });
}
