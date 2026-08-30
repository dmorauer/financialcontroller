const transactions = [
  { name: "Supermercado Pão de Açúcar", category: "Alimentação", date: "Hoje, 10:42", value: "- R$ 187,40", tone: "red" },
  { name: "Salário", category: "Receita", date: "29 ago, 08:15", value: "+ R$ 8.750,00", tone: "green" },
  { name: "Uber", category: "Transporte", date: "28 ago, 19:30", value: "- R$ 32,90", tone: "red" },
  { name: "Conta de energia", category: "Moradia", date: "27 ago, 13:06", value: "- R$ 214,18", tone: "red" },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">f</span><span>fluxo</span></div>
        <nav>
          <a className="active" href="#"><Icon>▦</Icon>Visão geral</a>
          <a href="#transactions"><Icon>⇅</Icon>Transações</a>
          <a href="#imports"><Icon>↑</Icon>Importar</a>
          <a href="#review"><Icon>✓</Icon>Revisão <b>3</b></a>
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
          <button className="primary">+ Nova transação</button>
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
          <div className="transactionList">{transactions.map((item) => <div className="transaction" key={item.name}><div className={`transactionIcon ${item.tone}`}>◇</div><div><strong>{item.name}</strong><p>{item.category} • {item.date}</p></div><b className={item.tone}>{item.value}</b><button aria-label={`Opções de ${item.name}`}>⋮</button></div>)}</div>
        </article>

        <section className="importStrip" id="imports"><div><span>↑</span><div><strong>Importe seu extrato ou uma nota fiscal</strong><p>OFX, CSV, PDF ou imagem. A IA extrai e organiza para você revisar.</p></div></div><button>Selecionar arquivo</button></section>
      </section>
    </main>
  );
}
