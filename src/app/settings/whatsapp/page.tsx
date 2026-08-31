"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Connection = { configured: boolean; state: string; instance: string; phone?: string | null; error?: string };
type PokerEvolutionConfig = {
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  EVOLUTION_INSTANCE: string;
  EVOLUTION_WEBHOOK_SECRET: string;
  EVOLUTION_WEBHOOK_URL: string;
};

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [qr, setQr] = useState<string>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pokerConfig, setPokerConfig] = useState<PokerEvolutionConfig | null>(null);
  const [keyMessage, setKeyMessage] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);

  async function revealPokerConfig() {
    setKeyLoading(true); setKeyMessage(""); setPokerConfig(null);
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setKeyLoading(false); return router.push("/login"); }
    const response = await fetch("/api/settings/evolution-key", { method: "POST", headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    setKeyLoading(false);
    if (!response.ok) return setKeyMessage(result.error || "Não foi possível abrir a configuração.");
    setPokerConfig(result);
    setKeyMessage("Copie tudo agora. A configuração será ocultada após a cópia.");
  }

  async function copyPokerConfig() {
    if (!pokerConfig) return;
    const text = Object.entries(pokerConfig).map(([name, value]) => `${name}=${value}`).join("\n");
    await navigator.clipboard.writeText(text);
    setPokerConfig(null);
    setKeyMessage("Configuração copiada e ocultada. Cadastre os cinco itens nos Secrets do Supabase do Poker.");
  }

  async function loadStatus() {
    const response = await fetch("/api/whatsapp/connection", { cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) return router.push("/login");
    if (!response.ok) return setMessage(result.error || "Não foi possível consultar a conexão.");
    setConnection(result);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/whatsapp/connection", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!active) return;
      if (response.status === 401) return router.push("/login");
      if (!response.ok) return setMessage(result.error || "Não foi possível consultar a conexão.");
      setConnection(result);
    });
    return () => { active = false; };
  }, [router]);

  async function runAction(action: "qr" | "logout") {
    setLoading(true); setMessage("");
    const response = await fetch("/api/whatsapp/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(result.error || "Não foi possível concluir.");
    if (action === "qr") {
      setQr(result.base64?.startsWith("data:") ? result.base64 : result.base64 ? `data:image/png;base64,${result.base64}` : undefined);
      setMessage(result.base64 ? "Escaneie o QR Code pelo WhatsApp." : "A conexão já pode estar ativa. Atualize o status.");
    } else {
      setQr(undefined); setMessage("WhatsApp desconectado."); await loadStatus();
    }
  }

  const connected = connection?.state === "open" || connection?.state === "active";
  return <main className="settingsPage"><section className="settingsShell"><div className="settingsTop"><Link href="/">← Voltar ao painel</Link><span className="brand"><i className="brandMark">S</i> Saldo Aí</span></div><header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>WhatsApp</h1><p>Conecte e controle o bot financeiro.</p></div><button className="secondaryButton" onClick={() => void loadStatus()}>Atualizar status</button></header>
    <div className="settingsGrid"><article className="card connectionCard"><div className="connectionHead"><div className={`statusDot ${connected ? "online" : ""}`}/><div><h2>{connected ? "WhatsApp conectado" : "WhatsApp desconectado"}</h2><p>{connection?.instance || "Consultando instância..."}</p></div></div>{connection?.phone && <p className="connectedPhone">Número: {connection.phone}</p>}{connection && !connection.configured && <div className="setupWarning"><strong>Controle remoto indisponível</strong><p>A Evolution está neste computador, enquanto o site está na Vercel. Para gerar o QR Code pelo site, será necessário publicar a Evolution em um endereço HTTPS seguro.</p></div>}{connection?.error && <p className="errorMessage">{connection.error}</p>}<div className="connectionActions"><button className="primary" disabled={loading || !connection?.configured} onClick={() => void runAction("qr")}>{loading ? "Aguarde..." : connected ? "Gerar novo QR" : "Conectar WhatsApp"}</button><button className="dangerButton" disabled={loading || !connected || !connection?.configured} onClick={() => void runAction("logout")}>Desconectar</button></div>{message && <p className="actionMessage" role="status">{message}</p>}{qr && <div className="qrBox"><Image unoptimized width={260} height={260} src={qr} alt="QR Code para conectar o WhatsApp"/><p>WhatsApp → Aparelhos conectados → Conectar aparelho</p></div>}</article>
      <article className="card commandsCard"><h2>Comandos disponíveis</h2><p>Em conversas privadas, escreva normalmente. Em grupos, use:</p><code>!gasto 50 no mercado</code><code>!!receita 11000 salário</code><code>@saldoai gastei 35 no Uber</code><Link className="manageSenders" href="/#allowed-senders">Gerenciar números autorizados →</Link></article></div>
    <article className="card commandsCard gatewayKeyCard"><h2>Configuração nativa do Poker</h2><p>Abra os cinco valores para cadastrar nos Secrets do Supabase do Poker. Eles não ficam salvos nesta tela.</p><div className="connectionActions"><button className="primary" disabled={keyLoading} onClick={() => void revealPokerConfig()}>{keyLoading ? "Abrindo..." : "Mostrar valores para copiar"}</button>{pokerConfig && <button className="secondaryButton" onClick={() => void copyPokerConfig()}>Copiar tudo e ocultar</button>}</div>{pokerConfig && <div className="gatewayKeyValue">{Object.entries(pokerConfig).map(([name, value]) => <p key={name}><strong>{name}</strong><code>{value}</code></p>)}</div>}{keyMessage && <p className="actionMessage" role="status">{keyMessage}</p>}</article>
  </section></main>;
}
