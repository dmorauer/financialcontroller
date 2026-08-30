import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const financialDocumentSchema = {
  type: "object",
  properties: {
    description: { type: "string" },
    merchant: { type: ["string", "null"] },
    amount: { type: "number" },
    occurred_on: { type: ["string", "null"], description: "Data ISO YYYY-MM-DD" },
    category: { type: "string" },
    document_number: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["description", "merchant", "amount", "occurred_on", "category", "document_number", "confidence"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || !userId) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OCR ainda não configurado: adicione OPENAI_API_KEY." }, { status: 503 });
  }

  const body = await request.json() as { path?: string; importId?: string; mimeType?: string; filename?: string };
  if (!body.path?.startsWith(`${userId}/`) || !body.importId) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage.from("financial-documents").download(body.path);
  if (downloadError || !file) return NextResponse.json({ error: "Não foi possível ler o documento." }, { status: 404 });

  await supabase.from("imports").update({ status: "processing" }).eq("id", body.importId);
  const mimeType = body.mimeType || file.type || "application/octet-stream";
  const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
  const dataUrl = `data:${mimeType};base64,${encoded}`;
  const documentInput = mimeType === "application/pdf"
    ? { type: "input_file" as const, filename: body.filename || "documento.pdf", file_data: dataUrl }
    : { type: "input_image" as const, image_url: dataUrl, detail: "high" as const };

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_OCR_MODEL || "gpt-5.6-luna",
      store: false,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Extraia este comprovante ou nota fiscal brasileira. O valor deve ser negativo para despesa e positivo apenas quando o documento comprovar uma receita. Não invente dados ilegíveis." },
        documentInput,
      ] }],
      text: { format: { type: "json_schema", name: "financial_document", strict: true, schema: financialDocumentSchema } },
    });
    const extracted = JSON.parse(response.output_text) as {
      description: string; merchant: string | null; amount: number; occurred_on: string | null;
      category: string; document_number: string | null; confidence: number;
    };
    const { data: transaction, error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      import_id: body.importId,
      description: extracted.description,
      merchant: extracted.merchant,
      amount: extracted.amount,
      occurred_on: extracted.occurred_on || new Date().toISOString().slice(0, 10),
      status: "review",
      document_number: extracted.document_number,
      confidence: extracted.confidence,
      raw_data: { category: extracted.category, ocr_response_id: response.id },
    }).select("id").single();
    if (insertError) throw insertError;
    await supabase.from("imports").update({ status: "review" }).eq("id", body.importId);
    return NextResponse.json({ transaction: { id: transaction.id, ...extracted } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no OCR.";
    await supabase.from("imports").update({ status: "failed", error_message: message.slice(0, 500) }).eq("id", body.importId);
    return NextResponse.json({ error: "Não foi possível analisar o documento." }, { status: 500 });
  }
}
