"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Transaction = { id: string; name: string; category: string; date: string; occurredOn: string; amount: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseAmount(raw: string) {
  const cleaned = raw.replace(/R\$|\s/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  return Number(normalized.replace(/[^0-9.-]/g, ""));
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [review, setReview] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [userEmail, setUserEmail] = useState("carregando...");
  const fileInput = useRef<HTMLInputElement>(null);
  const today = new Date();
  const monthKey = today.toISOString().slice(0, 7);
  const monthLabel = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const dateLabel = today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase();
  const currentMonth = useMemo(() => transactions.filter((item) => item.occurredOn.startsWith(monthKey)), [transactions, monthKey]);
  const income = currentMonth.reduce((total, item) => total + Math.max(item.amount, 0), 0);
  const expenses = currentMonth.reduce((total, item) => total + Math.abs(Math.min(item.amount, 0)), 0);
  const balance = transactions.reduce((total, item) => total + item.amount, 0);
  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    currentMonth.filter((item) => item.amount < 0).forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + Math.abs(item.amount)));
    return [...totals.entries()].map(([name, value]) => ({ name, value, percent: expenses ? Math.round(value / expenses * 100) : 0 })).sort((a, b) => b.value - a.value);
  }, [currentMonth, expenses]);
  const chartColors = ["#245f47", "#65a980", "#9bc5a9", "#d1b47a", "#d8ded9"];
  const donutBackground = categories.length ? `conic-gradient(${categories.slice(0, 5).map((item, index) => {
    const start = categories.slice(0, index).reduce((sum, category) => sum + category.percent, 0);
    return `${chartColors[index]} ${start}% ${start + item.percent}%`;
  }).join(",")})` : "#e8edea";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? "Minha conta");
      const { data: rows } = await supabase.from("transactions").select("id, description, amount, occurred_on, raw_data, status").neq("status", "ignored").order("occurred_on", { ascending: false }).limit(100);
      const mapped = (rows ?? []).map((row) => ({
        id: row.id,
        name: row.description,
        category: String((row.raw_data as { category?: string } | null)?.category ?? "Outros"),
        date: new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("pt-BR"),
        amount: Number(row.amount),
        occurredOn: row.occurred_on,
        status: row.status,
      }));
      setTransactions(mapped.filter((row) => row.status === "confirmed"));
      setReview(mapped.filter((row) => row.status === "review"));
    });
  }, [router]);

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const data = new FormData(event.currentTarget);
    const type = data.get("type");
    const entered = parseAmount(String(data.get("amount")));
    if (!entered) return;
    const candidate = {
      user_id: userId,
      description: String(data.get("description")),
      amount: type === "expense" ? -Math.abs(entered) : Math.abs(entered),
      occurred_on: new Date().toISOString().slice(0, 10),
      raw_data: { category: String(data.get("category")) },
    };
    const { data: saved, error } = await createClient().from("transactions").insert(candidate).select("id").single();
    if (error) return window.alert(`Não foi possível salvar: ${error.message}`);
    setTransactions((current) => [{ id: saved.id, name: candidate.description, category: String(data.get("category")), date: "Agora", occurredOn: candidate.occurred_on, amount: candidate.amount }, ...current]);
    setShowForm(false);
  }

  async function importStatement(file?: File) {
    if (!file || !userId) return;
    if (file.size > 10 * 1024 * 1024) return window.alert("O arquivo deve ter no máximo 10 MB.");

    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      setImporting(true);
      const supabase = createClient();
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("financial-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { setImporting(false); return window.alert(`Falha no envio: ${uploadError.message}`); }
      const { data: imported, error: importError } = await supabase.from("imports").insert({ user_id: userId, source: file.type === "application/pdf" ? "pdf" : "image", filename: file.name, storage_path: path, status: "pending" }).select("id").single();
      if (importError) { setImporting(false); return window.alert(`Falha no registro: ${importError.message}`); }
      const response = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, importId: imported.id, mimeType: file.type, filename: file.name }) });
      const result = await response.json();
      setImporting(false);
      if (!response.ok) return window.alert(result.error || "Falha ao analisar o documento.");
      const extracted = result.transaction;
      setReview((current) => [{ id: extracted.id, name: extracted.description, category: extracted.category, date: extracted.occurred_on || "Importado", occurredOn: extracted.occurred_on || new Date().toISOString().slice(0, 10), amount: Number(extracted.amount) }, ...current]);
      return;
    }

    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean).slice(0, 100);
    const candidates = rows.flatMap((row, index) => {
      const parts = row.split(/[;,\t]/).map((part) => part.trim().replace(/^"|"$/g, ""));
      const amountIndex = parts.findIndex((part) => Number.isFinite(parseAmount(part)) && /\d/.test(part));
      if (amountIndex < 0 || index === 0 && /valor|amount/i.test(row)) return [];
      const amount = parseAmount(parts[amountIndex]);
      if (!amount) return [];
      const description = parts.find((part, partIndex) => partIndex !== amountIndex && /[a-zà-ú]/i.test(part)) || `Lançamento ${index + 1}`;
      return [{ id: crypto.randomUUID(), name: description, category: "A classificar", date: "Importado", occurredOn: new Date().toISOString().slice(0, 10), amount }];
    });
    setReview(candidates);
  }

  async function approve(item: Transaction) {
    if (!userId) return;
    const duplicate = transactions.some((transaction) => transaction.name === item.name && transaction.amount === item.amount);
    if (!duplicate) {
      const supabase = createClient();
      const { data: existing } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", item.id).select("id").maybeSingle();
      if (existing) {
        setTransactions((current) => [{ ...item, id: existing.id }, ...current.filter((transaction) => transaction.id !== existing.id)]);
      } else {
        const { data: saved, error } = await supabase.from("transactions").insert({ user_id: userId, description: item.name, amount: item.amount, occurred_on: new Date().toISOString().slice(0, 10), raw_data: { category: item.category, imported: true } }).select("id").single();
        if (error) return window.alert(`Não foi possível aprovar: ${error.message}`);
        setTransactions((current) => [{ ...item, id: saved.id }, ...current]);
      }
    }
    setReview((current) => current.filter((candidate) => candidate.id !== item.id));
  }

  async function ignoreReview(item: Transaction) {
    await createClient().from("transactions").update({ status: "ignored" }).eq("id", item.id);
    setReview((current) => current.filter((candidate) => candidate.id !== item.id));
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">f</span><span>fluxo</span></div>
        <nav>
          <a className="active" href="#"><Icon>▦</Icon>Visão geral</a>
          <a href="#transactions"><Icon>⇅</Icon>Transações</a>
          <a href="#imports"><Icon>↑</Icon>Importar</a>
          <a href="#review"><Icon>✓</Icon>Revisão {review.length > 0 && <b>{review.length}</b>}</a>
          <a href="#"><Icon>◎</Icon>Orçamentos</a>
          <a href="#"><Icon>▤</Icon>Relatórios</a>
        </nav>
        <div className="sideBottom">
          <div className="whatsapp pending"><span>●</span><div><strong>WhatsApp não configurado</strong><small>Integração pendente</small></div></div>
          <a href="#"><Icon>⚙</Icon>Configurações</a>
          <button className="profile profileButton" onClick={signOut}><div className="avatar">FC</div><div><strong>Minha conta</strong><small>{userEmail}</small></div><span>Sair</span></button>
        </div>
      </aside>

      <section className="content">
        <header>
          <div><p className="eyebrow">{dateLabel}</p><h1>Suas finanças</h1><p>Resumo calculado somente com seus lançamentos confirmados.</p></div>
          <button className="primary" onClick={() => setShowForm(true)}>+ Nova transação</button>
        </header>

        <div className="summaryGrid">
          <article className="balanceCard"><div><span>Saldo dos lançamentos</span><small>• Dados reais</small></div><strong>{money.format(balance)}</strong><p>{transactions.length} {transactions.length === 1 ? "lançamento confirmado" : "lançamentos confirmados"}</p></article>
          <article className="metric"><span>Receitas no mês</span><strong>{money.format(income)}</strong><p className="positive">{currentMonth.filter((item) => item.amount > 0).length} entradas</p></article>
          <article className="metric"><span>Despesas no mês</span><strong>{money.format(expenses)}</strong><p className="negative">{currentMonth.filter((item) => item.amount < 0).length} saídas</p></article>
        </div>

        <div className="mainGrid">
          <article className="card spending">
            <div className="cardTitle"><div><h2>Despesas por categoria</h2><p className="capitalize">{monthLabel}</p></div><button>Este mês</button></div>
            <div className="donutWrap"><div className="donut" style={{ background: donutBackground }}><div><small>Total</small><strong>{money.format(expenses)}</strong></div></div>
              <div className="legend">
                {categories.length === 0 ? <p className="emptyInline">Nenhuma despesa confirmada neste mês.</p> : categories.slice(0, 5).map((item, index) => <p key={item.name}><i style={{background: chartColors[index]}}/><span>{item.name}</span><b>{money.format(item.value)}</b><small>{item.percent}%</small></p>)}
              </div>
            </div>
          </article>

          <article className="card assistantCard">
            <div className="aiHead"><span>✦</span><div><h2>Assistente financeiro</h2><p>Análise inteligente</p></div></div>
            <div className="insight"><span>💡</span><div><strong>{transactions.length ? "Seus dados estão prontos para análise" : "Adicione transações para receber análises"}</strong><p>{transactions.length ? "Os próximos insights serão gerados apenas a partir dos seus dados reais." : "Nenhuma recomendação foi gerada porque ainda não há histórico confirmado."}</p></div></div>
            <div className="quickAsk disabled"><span>✦</span><input disabled aria-label="Pergunte ao assistente" placeholder="Assistente em breve"/><button disabled>↑</button></div>
          </article>
        </div>

        <article className="card transactions" id="transactions">
          <div className="cardTitle"><div><h2>Transações recentes</h2><p>Seus últimos lançamentos</p></div><a href="#">Ver todas →</a></div>
          <div className="transactionList">{transactions.length === 0 ? <div className="emptyState"><strong>Nenhuma transação confirmada</strong><p>Adicione uma transação ou importe um extrato para começar.</p></div> : transactions.map((item) => <div className="transaction" key={item.id}><div className={`transactionIcon ${item.amount >= 0 ? "green" : "red"}`}>◇</div><div><strong>{item.name}</strong><p>{item.category} • {item.date}</p></div><b className={item.amount >= 0 ? "green" : "red"}>{item.amount >= 0 ? "+ " : "- "}{money.format(Math.abs(item.amount))}</b><button aria-label={`Opções de ${item.name}`}>⋮</button></div>)}</div>
        </article>

        {review.length > 0 && <article className="card reviewCard" id="review"><div className="cardTitle"><div><h2>Revisar importação</h2><p>Confirme os lançamentos antes de afetarem o saldo</p></div><button onClick={() => setReview([])}>Fechar fila</button></div>{review.map((item) => <div className="reviewRow" key={item.id}><div><strong>{item.name}</strong><p>{item.category} • {money.format(item.amount)}</p></div><button onClick={() => ignoreReview(item)}>Ignorar</button><button className="approve" onClick={() => approve(item)}>Aprovar</button></div>)}</article>}

        <section className="importStrip" id="imports"><div><span>↑</span><div><strong>Importe extratos, notas e comprovantes</strong><p>CSV, PDF, JPG, PNG ou WEBP. Documentos ficam privados e passam por revisão.</p></div></div><input ref={fileInput} type="file" accept=".csv,.txt,.pdf,.jpg,.jpeg,.png,.webp" hidden onChange={(event) => importStatement(event.target.files?.[0])}/><button disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? "Analisando..." : "Selecionar arquivo"}</button></section>
      </section>

      {showForm && <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowForm(false)}><form className="transactionForm" onSubmit={addTransaction} onMouseDown={(event) => event.stopPropagation()}><div className="formHead"><div><h2>Nova transação</h2><p>Adicione uma receita ou despesa.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>Descrição<input name="description" required placeholder="Ex.: Almoço"/></label><div className="formGrid"><label>Valor<input name="amount" required inputMode="decimal" placeholder="0,00"/></label><label>Tipo<select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label></div><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Lazer</option><option>Saúde</option><option>Receita</option><option>Outros</option></select></label><button className="primary formSubmit" type="submit">Salvar transação</button></form></div>}
    </main>
  );
}
