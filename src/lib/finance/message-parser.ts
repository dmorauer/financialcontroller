export function parseFinancialMessage(text: string) {
  const match = text.match(/(?:r\$\s*)?(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|-?\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;

  const normalized = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];
  const value = Number(normalized);
  if (!Number.isFinite(value) || value === 0) return null;

  const dueMatch = text.match(/\b(?:vencimento|vence|venc\.?|dia)\s*(?:em|no|:|-)?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i);
  let dueOn: string | null = null;
  if (dueMatch) {
    const now = new Date();
    const day = Number(dueMatch[1]);
    const month = Number(dueMatch[2]);
    let year = dueMatch[3] ? Number(dueMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const candidate = new Date(year, month - 1, day, 12);
    const valid = candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
    if (valid) {
      if (!dueMatch[3] && candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0)) candidate.setFullYear(year + 1);
      dueOn = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
    }
  }

  const income = /recebi|ganhei|sal[aá]rio|entrada/i.test(text);
  const category = /mercado|almo[cç]o|jantar|lanche|comida/i.test(text)
    ? "Alimentação"
    : /uber|99|combust[ií]vel|gasolina|transporte/i.test(text)
      ? "Transporte"
      : /aluguel|condom[ií]nio|energia|luz|[aá]gua/i.test(text)
        ? "Moradia"
        : income
          ? "Receita"
          : "Outros";
  const description = text
    .replace(match[0], "")
    .replace(/[-–—]?\s*\b(?:vencimento|vence|venc\.?|dia)\s*(?:em|no|:|-)?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, " ")
    .replace(/\b(gastei|paguei|recebi|ganhei|reais|real|com|de|no|na|em)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount: income ? Math.abs(value) : -Math.abs(value),
    description: description || (income ? "Receita pelo WhatsApp" : "Despesa pelo WhatsApp"),
    category,
    dueOn,
  };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(value));
}
