export type StatementEntry = {
  description: string;
  amount: number;
  occurredOn: string;
};

function amountOf(value: string) {
  const clean = value.trim().replace(/[^0-9,.-]/g, "");
  const normalized = clean.includes(",") && clean.includes(".")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean.replace(",", ".");
  return Number(normalized);
}

function tag(block: string, name: string) {
  return block.match(new RegExp(`<${name}>([^<\r\n]+)`, "i"))?.[1]?.trim() || "";
}

function ofxDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : new Date().toISOString().slice(0, 10);
}

export function parseOfxStatement(text: string): StatementEntry[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  return blocks.flatMap((block) => {
    const amount = amountOf(tag(block, "TRNAMT"));
    if (!Number.isFinite(amount) || amount === 0) return [];
    const description = tag(block, "MEMO") || tag(block, "NAME") || "Lançamento importado";
    return [{ description: description.slice(0, 240), amount, occurredOn: ofxDate(tag(block, "DTPOSTED")) }];
  });
}

export function parseDelimitedStatement(text: string): StatementEntry[] {
  return text.split(/\r?\n/).filter(Boolean).flatMap((row, index) => {
    const parts = row.split(/[;,\t]/).map((part) => part.trim().replace(/^"|"$/g, ""));
    const amountIndex = parts.findIndex((part) => Number.isFinite(amountOf(part)) && /\d/.test(part));
    if (amountIndex < 0 || (index === 0 && /valor|amount|lançamento/i.test(row))) return [];
    const amount = amountOf(parts[amountIndex]);
    if (!amount) return [];
    const description = parts.find((part, partIndex) => partIndex !== amountIndex && /[a-zà-ú]/i.test(part)) || `Lançamento ${index + 1}`;
    const datePart = parts.find((part) => /^\d{2}[/-]\d{2}[/-]\d{2,4}$/.test(part));
    const date = datePart?.match(/^(\d{2})[/-](\d{2})[/-](\d{2,4})$/);
    const occurredOn = date ? `${date[3].length === 2 ? `20${date[3]}` : date[3]}-${date[2]}-${date[1]}` : new Date().toISOString().slice(0, 10);
    return [{ description: description.slice(0, 240), amount, occurredOn }];
  });
}
