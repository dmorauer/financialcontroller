import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseFinancialMessage } from "@/lib/finance/message-parser";

export const runtime = "nodejs";

const categorySchema = z.enum(["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Receita", "Outros"]);
const transactionSchema = z.object({
  description: z.string().min(1).max(120).describe("Descrição curta do lançamento, sem o valor"),
  amount: z.number().positive().max(999999999).describe("Valor positivo em reais"),
  type: z.enum(["expense", "income"]),
  category: categorySchema,
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data no formato YYYY-MM-DD"),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Data de vencimento citada ou null"),
});

function fallbackTransaction(text: string, today: string) {
  const parsed = parseFinancialMessage(text);
  if (!parsed) return null;
  return {
    description: parsed.description,
    amount: Math.abs(parsed.amount),
    type: parsed.amount > 0 ? "income" as const : "expense" as const,
    category: categorySchema.parse(parsed.category),
    occurredOn: today,
    dueOn: parsed.dueOn,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Faça login para usar o assistente." }, { status: 401 });

  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) {
    return Response.json({ error: "Digite um lançamento com até 500 caracteres." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let extracted = fallbackTransaction(text, today);
  let interpretedBy: "ai" | "local" = "local";

  try {
    const result = await generateText({
      model: "openai/gpt-5.6-luna",
      output: Output.object({ schema: transactionSchema }),
      prompt: `Extraia um único lançamento financeiro desta mensagem em português do Brasil.
Hoje é ${today}. "Gastei", "paguei" e compras são despesas. "Recebi", "ganhei" e salário são receitas.
Escolha somente uma das categorias permitidas. Não invente valor, descrição ou data.
Mensagem: ${JSON.stringify(text)}`,
    });
    extracted = result.output;
    interpretedBy = "ai";
  } catch (error) {
    console.warn("Assistente usando interpretação local:", error instanceof Error ? error.message : "erro desconhecido");
  }

  if (!extracted) {
    return Response.json({ error: "Não encontrei um valor. Tente: “gastei 50 no mercado”." }, { status: 422 });
  }

  const amount = extracted.type === "expense" ? -Math.abs(extracted.amount) : Math.abs(extracted.amount);
  const { data, error } = await supabase.from("transactions").insert({
    user_id: user.id,
    description: extracted.description,
    amount,
    occurred_on: extracted.occurredOn,
    due_on: extracted.dueOn,
    status: "confirmed",
    raw_data: { category: extracted.category, source: "assistant", original_text: text },
  }).select("id, description, amount, occurred_on, due_on, account_id").single();

  if (error) return Response.json({ error: `Não foi possível salvar: ${error.message}` }, { status: 500 });

  return Response.json({
    transaction: {
      id: data.id,
      name: data.description,
      category: extracted.category,
      date: new Date(`${data.occurred_on}T12:00:00`).toLocaleDateString("pt-BR"),
      occurredOn: data.occurred_on,
      dueOn: data.due_on,
      amount: Number(data.amount),
      accountId: data.account_id,
    },
    interpretedBy,
  });
}
