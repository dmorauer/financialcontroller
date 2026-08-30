export type GroupCommand = { text: string; kind: "expense" | "income" | "mention" };

export function parseGroupCommand(text: string): GroupCommand | null {
  const trimmed = text.trim();
  const expense = trimmed.match(/^!{1,2}gasto\b[\s:,-]*(.+)$/i);
  if (expense) return { text: `gastei ${expense[1]}`, kind: "expense" };
  const income = trimmed.match(/^!{1,2}receita\b[\s:,-]*(.+)$/i);
  if (income) return { text: `recebi ${income[1]}`, kind: "income" };
  const mention = trimmed.match(/^@(?:saldoai|contaai|boragrana|fluxo)\b[\s:,-]*(.+)$/i);
  if (mention) return { text: mention[1], kind: "mention" };
  return null;
}
