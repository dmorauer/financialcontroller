export function parseFinancialMessage(text: string) {
  const match = text.match(/(?:r\$\s*)?(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|-?\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;

  const normalized = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];
  const value = Number(normalized);
  if (!Number.isFinite(value) || value === 0) return null;

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
    .replace(/\b(gastei|paguei|recebi|ganhei|reais|real|com|de|no|na|em)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount: income ? Math.abs(value) : -Math.abs(value),
    description: description || (income ? "Receita pelo WhatsApp" : "Despesa pelo WhatsApp"),
    category,
  };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(value));
}
