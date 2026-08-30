"use client";

import { FormEvent, useRef, useState } from "react";

type Transaction = { id: string; name: string; category: string; date: string; amount: number };

const initialTransactions: Transaction[] = [
  { id: "1", name: "Supermercado Pão de Açúcar", category: "Alimentação", date: "Hoje, 10:42", amount: -187.4 },
  { id: "2", name: "Salário", category: "Receita", date: "29 ago, 08:15", amount: 8750 },
  { id: "3", name: "Uber", category: "Transporte", date: "28 ago, 19:30", amount: -32.9 },
  { id: "4", name: "Conta de energia", category: "Moradia", date: "27 ago, 13:06", amount: -214.18 },
];

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
  const [transactions, setTransactions] = useState(initialTransactions);
  const [review, setReview] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const type = data.get("type");
    const entered = parseAmount(String(data.get("amount")));
    if (!entered) return;
    setTransactions((current) => [{
      id: crypto.randomUUID(),
      name: String(data.get("description")),
      category: String(data.get("category")),
      date: "Agora",
      amount: type === "expense" ? -Math.abs(entered) : Math.abs(entered),
    }, ...current]);
    setShowForm(false);
  }

  async function importStatement(file?: File) {
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean).slice(0, 100);
    const candidates = rows.flatMap((row, index) => {
      const parts = row.split(/[;,\t]/).map((part) => part.trim().replace(/^"|"$/g, ""));
      const amountIndex = parts.findIndex((part) => Number.isFinite(parseAmount(part)) && /\d/.test(part));
      if (amountIndex < 0 || index === 0 && /valor|amount/i.test(row)) return [];
      const amount = parseAmount(parts[amountIndex]);
      if (!amount) return [];
      const description = parts.find((part, partIndex) => partIndex !== amountIndex && /[a-zà-ú]/i.test(part)) || `Lançamento ${index + 1}`;
      return [{ id: crypto.randomUUID(), name: description, category: "A classificar", date: "Importado", amount }];
    });
    setReview(candidates);
  }

  function approve(item: Transaction) {
    const duplicate = transactions.some((transaction) => transaction.name === item.name && transaction.amount === item.amount);
    if (!duplicate) setTransactions((current) => [item, ...current]);
    setReview((current) => current.filter((candidate) => candidate.id !== item.id));
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
          <div className="whatsapp"><span>●</span><div><strong>WhatsApp conectado</strong><small>Pronto para receber</small></div></div>
          <a href="#"><Icon>⚙</Icon>Configurações</a>
          <div className="profile"><div className="avatar">MR</div><div><strong>Marcos Ribeiro</strong><small>marcos@email.com</small></div><span>⋮</span></div>
        </div>
      </aside>

      <section className="content">
        <header>
          <div><p className="eyebrow">DOMINGO, 30 DE AGOSTO</p><h1>Boa tarde, Marcos</h1><p>Aqui está o resumo das suas finanças.</p></div>
          <button className="primary" onClick={() => setShowForm(true)}>+ Nova transação</button>
        </header>

        <div className="summaryGrid">
          <article className="balanceCard"><div><span>Saldo total</span><small>• Atualizado agora</small></div><strong>R$ 12.486,32</strong><p><em>↑ 8,4%</em> em relação ao mês passado</p><div className="spark"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
          <article className="metric"><span>Receitas no mês</span><strong>R$ 10.250,00</strong><p className="positive">↑ R$ 750,00 este mês</p></article>
          <article className="metric"><span>Despesas no mês</span><strong>R$ 5.763,68</strong><p className="negative">↑ 12% acima da média</p></article>
        </div>

        <div className="mainGrid">
          <article className="card spending">
            <div className="cardTitle"><div><h2>Despesas por categoria</h2><p>Agosto de 2026</p></div><button>Este mês ⌄</button></div>
            <div className="donutWrap"><div className="donut"><div><small>Total</small><strong>R$ 5.763</strong></div></div>
              <div className="legend">
                <p><i className="c1"/><span>Moradia</span><b>R$ 2.140</b><small>37%</small></p>
                <p><i className="c2"/><span>Alimentação</span><b>R$ 1.326</b><small>23%</small></p>
                <p><i className="c3"/><span>Transporte</span><b>R$ 864</b><small>15%</small></p>
                <p><i className="c4"/><span>Lazer</span><b>R$ 634</b><small>11%</small></p>
                <p><i className="c5"/><span>Outros</span><b>R$ 799</b><small>14%</small></p>
              </div>
            </div>
          </article>

          <article className="card assistantCard">
            <div className="aiHead"><span>✦</span><div><h2>Assistente financeiro</h2><p>Análise inteligente</p></div></div>
            <div className="insight"><span>💡</span><div><strong>Você gastou 18% a mais com alimentação</strong><p>Se mantiver o ritmo, fechará o mês R$ 240 acima da sua média.</p><a href="#">Ver detalhes →</a></div></div>
            <div className="quickAsk"><span>✦</span><input aria-label="Pergunte ao assistente" placeholder="Pergunte sobre suas finanças..."/><button>↑</button></div>
          </article>
        </div>

        <article className="card transactions" id="transactions">
          <div className="cardTitle"><div><h2>Transações recentes</h2><p>Seus últimos lançamentos</p></div><a href="#">Ver todas →</a></div>
          <div className="transactionList">{transactions.map((item) => <div className="transaction" key={item.id}><div className={`transactionIcon ${item.amount >= 0 ? "green" : "red"}`}>◇</div><div><strong>{item.name}</strong><p>{item.category} • {item.date}</p></div><b className={item.amount >= 0 ? "green" : "red"}>{item.amount >= 0 ? "+ " : "- "}{money.format(Math.abs(item.amount))}</b><button aria-label={`Opções de ${item.name}`}>⋮</button></div>)}</div>
        </article>

        {review.length > 0 && <article className="card reviewCard" id="review"><div className="cardTitle"><div><h2>Revisar importação</h2><p>Confirme os lançamentos antes de afetarem o saldo</p></div><button onClick={() => setReview([])}>Descartar todos</button></div>{review.map((item) => <div className="reviewRow" key={item.id}><div><strong>{item.name}</strong><p>{item.category} • {money.format(item.amount)}</p></div><button onClick={() => setReview((current) => current.filter((candidate) => candidate.id !== item.id))}>Ignorar</button><button className="approve" onClick={() => approve(item)}>Aprovar</button></div>)}</article>}

        <section className="importStrip" id="imports"><div><span>↑</span><div><strong>Importe seu extrato bancário</strong><p>CSV funciona agora. OFX, PDF e imagens entram na próxima integração.</p></div></div><input ref={fileInput} type="file" accept=".csv,.txt" hidden onChange={(event) => importStatement(event.target.files?.[0])}/><button onClick={() => fileInput.current?.click()}>Selecionar arquivo</button></section>
      </section>

      {showForm && <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowForm(false)}><form className="transactionForm" onSubmit={addTransaction} onMouseDown={(event) => event.stopPropagation()}><div className="formHead"><div><h2>Nova transação</h2><p>Adicione uma receita ou despesa.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>Descrição<input name="description" required placeholder="Ex.: Almoço"/></label><div className="formGrid"><label>Valor<input name="amount" required inputMode="decimal" placeholder="0,00"/></label><label>Tipo<select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label></div><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Lazer</option><option>Saúde</option><option>Receita</option><option>Outros</option></select></label><button className="primary formSubmit" type="submit">Salvar transação</button></form></div>}
    </main>
  );
}
