"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Transaction = { id: string; name: string; category: string; date: string; occurredOn: string; amount: number; accountId?: string | null };
type Account = { id: string; name: string; kind: string; institution: string | null; openingBalance: number };

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
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [importing, setImporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [userEmail, setUserEmail] = useState("carregando...");
  const fileInput = useRef<HTMLInputElement>(null);
  const today = mounted ? new Date() : null;
  const monthKey = today?.toISOString().slice(0, 7) ?? "";
  const monthLabel = today?.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) ?? "Mês atual";
  const dateLabel = today?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase() ?? "CARREGANDO DATA";
  const currentMonth = useMemo(() => transactions.filter((item) => item.occurredOn.startsWith(monthKey)), [transactions, monthKey]);
  const income = currentMonth.reduce((total, item) => total + Math.max(item.amount, 0), 0);
  const expenses = currentMonth.reduce((total, item) => total + Math.abs(Math.min(item.amount, 0)), 0);
  const balance = accounts.reduce((total, account) => total + account.openingBalance, 0) + transactions.reduce((total, item) => total + item.amount, 0);
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
      setMounted(true);
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? "Minha conta");
      const [{ data: rows }, { data: accountRows }] = await Promise.all([
        supabase.from("transactions").select("id, description, amount, occurred_on, raw_data, status, account_id").neq("status", "ignored").order("occurred_on", { ascending: false }).limit(100),
        supabase.from("accounts").select("id, name, kind, institution, opening_balance").order("created_at"),
      ]);
      setAccounts((accountRows ?? []).map((account) => ({ id: account.id, name: account.name, kind: account.kind, institution: account.institution, openingBalance: Number(account.opening_balance) })));
      const mapped = (rows ?? []).map((row) => ({
        id: row.id,
        name: row.description,
        category: String((row.raw_data as { category?: string } | null)?.category ?? "Outros"),
        date: new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("pt-BR"),
        amount: Number(row.amount),
        accountId: row.account_id,
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
      occurred_on: String(data.get("date")),
      account_id: data.get("account") || null,
      raw_data: { category: String(data.get("category")) },
    };
    const query = editingTransaction
      ? createClient().from("transactions").update(candidate).eq("id", editingTransaction.id)
      : createClient().from("transactions").insert(candidate);
    const { data: saved, error } = await query.select("id").single();
    if (error) return window.alert(`Não foi possível salvar: ${error.message}`);
    const updated = { id: saved.id, name: candidate.description, category: String(data.get("category")), date: new Date(`${candidate.occurred_on}T12:00:00`).toLocaleDateString("pt-BR"), occurredOn: candidate.occurred_on, amount: candidate.amount, accountId: candidate.account_id ? String(candidate.account_id) : null };
    setTransactions((current) => [updated, ...current.filter((item) => item.id !== saved.id)]);
    setEditingTransaction(null);
    setShowForm(false);
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const data = new FormData(event.currentTarget);
    const candidate = { user_id: userId, name: String(data.get("name")), kind: String(data.get("kind")), institution: String(data.get("institution")) || null, opening_balance: parseAmount(String(data.get("openingBalance"))) || 0 };
    const { data: saved, error } = await createClient().from("accounts").insert(candidate).select("id").single();
    if (error) return window.alert(`Não foi possível criar a conta: ${error.message}`);
    setAccounts((current) => [...current, { id: saved.id, name: candidate.name, kind: candidate.kind, institution: candidate.institution, openingBalance: candidate.opening_balance }]);
    setShowAccountForm(false);
  }

  async function deleteTransaction() {
    if (!editingTransaction || !window.confirm("Excluir esta transação definitivamente?")) return;
    const { error } = await createClient().from("transactions").delete().eq("id", editingTransaction.id);
    if (error) return window.alert(`Não foi possível excluir: ${error.message}`);
    setTransactions((current) => current.filter((item) => item.id !== editingTransaction.id));
    setEditingTransaction(null);
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
          <button className="primary" onClick={() => { setEditingTransaction(null); setShowForm(true); }}>+ Nova transação</button>
        </header>

        <div className="summaryGrid">
          <article className="balanceCard"><div><span>Saldo dos lançamentos</span><small>• Dados reais</small></div><strong>{money.format(balance)}</strong><p>{transactions.length} {transactions.length === 1 ? "lançamento confirmado" : "lançamentos confirmados"}</p></article>
          <article className="metric"><span>Receitas no mês</span><strong>{money.format(income)}</strong><p className="positive">{currentMonth.filter((item) => item.amount > 0).length} entradas</p></article>
          <article className="metric"><span>Despesas no mês</span><strong>{money.format(expenses)}</strong><p className="negative">{currentMonth.filter((item) => item.amount < 0).length} saídas</p></article>
        </div>

        <article className="card accountsCard" id="accounts"><div className="cardTitle"><div><h2>Minhas contas</h2><p>Saldos iniciais e movimentações vinculadas</p></div><button onClick={() => setShowAccountForm(true)}>+ Adicionar conta</button></div><div className="accountList">{accounts.length === 0 ? <div className="emptyState compact"><strong>Nenhuma conta cadastrada</strong><p>Cadastre sua conta bancária, carteira ou cartão.</p></div> : accounts.map((account) => { const accountBalance = account.openingBalance + transactions.filter((item) => item.accountId === account.id).reduce((total, item) => total + item.amount, 0); return <div className="accountItem" key={account.id}><div><strong>{account.name}</strong><p>{account.institution || "Sem instituição"}</p></div><b>{money.format(accountBalance)}</b></div>; })}</div></article>

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
          <div className="transactionList">{transactions.length === 0 ? <div className="emptyState"><strong>Nenhuma transação confirmada</strong><p>Adicione uma transação ou importe um extrato para começar.</p></div> : transactions.map((item) => <div className="transaction" key={item.id}><div className={`transactionIcon ${item.amount >= 0 ? "green" : "red"}`}>◇</div><div><strong>{item.name}</strong><p>{item.category} • {item.date}{item.accountId ? ` • ${accounts.find((account) => account.id === item.accountId)?.name || "Conta"}` : ""}</p></div><b className={item.amount >= 0 ? "green" : "red"}>{item.amount >= 0 ? "+ " : "- "}{money.format(Math.abs(item.amount))}</b><button aria-label={`Editar ${item.name}`} onClick={() => { setEditingTransaction(item); setShowForm(true); }}>⋮</button></div>)}</div>
        </article>

        {review.length > 0 && <article className="card reviewCard" id="review"><div className="cardTitle"><div><h2>Revisar importação</h2><p>Confirme os lançamentos antes de afetarem o saldo</p></div><button onClick={() => setReview([])}>Fechar fila</button></div>{review.map((item) => <div className="reviewRow" key={item.id}><div><strong>{item.name}</strong><p>{item.category} • {money.format(item.amount)}</p></div><button onClick={() => ignoreReview(item)}>Ignorar</button><button className="approve" onClick={() => approve(item)}>Aprovar</button></div>)}</article>}

        <section className="importStrip" id="imports"><div><span>↑</span><div><strong>Importe extratos, notas e comprovantes</strong><p>CSV, PDF, JPG, PNG ou WEBP. Documentos ficam privados e passam por revisão.</p></div></div><input ref={fileInput} type="file" accept=".csv,.txt,.pdf,.jpg,.jpeg,.png,.webp" hidden onChange={(event) => importStatement(event.target.files?.[0])}/><button disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? "Analisando..." : "Selecionar arquivo"}</button></section>
      </section>

      {showForm && <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowForm(false)}><form className="transactionForm" onSubmit={addTransaction} onMouseDown={(event) => event.stopPropagation()}><div className="formHead"><div><h2>{editingTransaction ? "Editar transação" : "Nova transação"}</h2><p>Informe os dados reais do lançamento.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>Descrição<input name="description" required defaultValue={editingTransaction?.name} placeholder="Ex.: Almoço"/></label><div className="formGrid"><label>Valor<input name="amount" required inputMode="decimal" defaultValue={editingTransaction ? Math.abs(editingTransaction.amount).toFixed(2).replace(".", ",") : ""} placeholder="0,00"/></label><label>Tipo<select name="type" defaultValue={editingTransaction?.amount && editingTransaction.amount > 0 ? "income" : "expense"}><option value="expense">Despesa</option><option value="income">Receita</option></select></label></div><div className="formGrid"><label>Data<input name="date" type="date" required defaultValue={editingTransaction?.occurredOn || new Date().toISOString().slice(0, 10)}/></label><label>Conta<select name="account" defaultValue={editingTransaction?.accountId || ""}><option value="">Sem conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div><label>Categoria<select name="category" defaultValue={editingTransaction?.category || "Alimentação"}><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Lazer</option><option>Saúde</option><option>Receita</option><option>Outros</option></select></label><div className="formActions">{editingTransaction && <button className="dangerButton" type="button" onClick={deleteTransaction}>Excluir</button>}<button className="primary formSubmit" type="submit">Salvar transação</button></div></form></div>}
      {showAccountForm && <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowAccountForm(false)}><form className="transactionForm" onSubmit={addAccount} onMouseDown={(event) => event.stopPropagation()}><div className="formHead"><div><h2>Adicionar conta</h2><p>O saldo inicial entra no seu saldo total.</p></div><button type="button" onClick={() => setShowAccountForm(false)}>×</button></div><label>Nome da conta<input name="name" required placeholder="Ex.: Nubank"/></label><label>Instituição<input name="institution" placeholder="Ex.: Nu Pagamentos"/></label><div className="formGrid"><label>Tipo<select name="kind"><option value="checking">Conta-corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option><option value="credit_card">Cartão de crédito</option><option value="investment">Investimento</option></select></label><label>Saldo inicial<input name="openingBalance" inputMode="decimal" defaultValue="0,00"/></label></div><button className="primary formSubmit" type="submit">Criar conta</button></form></div>}
    </main>
  );
}
