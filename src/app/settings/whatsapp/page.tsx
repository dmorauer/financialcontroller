"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Connection = { configured: boolean; state: string; instance: string; phone?: string | null; error?: string };

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [qr, setQr] = useState<string>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
  return <main className="settingsPage"><section className="settingsShell"><div className="settingsTop"><Link href="/">← Voltar ao painel</Link><span className="brand"><i className="brandMark">C</i> Conta Aí</span></div><header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>WhatsApp</h1><p>Conecte e controle o bot financeiro.</p></div><button className="secondaryButton" onClick={() => void loadStatus()}>Atualizar status</button></header>
    <div className="settingsGrid"><article className="card connectionCard"><div className="connectionHead"><div className={`statusDot ${connected ? "online" : ""}`}/><div><h2>{connected ? "WhatsApp conectado" : "WhatsApp desconectado"}</h2><p>{connection?.instance || "Consultando instância..."}</p></div></div>{connection?.phone && <p className="connectedPhone">Número: {connection.phone}</p>}{connection && !connection.configured && <div className="setupWarning"><strong>Controle remoto indisponível</strong><p>A Evolution está neste computador, enquanto o site está na Vercel. Para gerar o QR Code pelo site, será necessário publicar a Evolution em um endereço HTTPS seguro.</p></div>}{connection?.error && <p className="errorMessage">{connection.error}</p>}<div className="connectionActions"><button className="primary" disabled={loading || !connection?.configured} onClick={() => void runAction("qr")}>{loading ? "Aguarde..." : connected ? "Gerar novo QR" : "Conectar WhatsApp"}</button><button className="dangerButton" disabled={loading || !connected || !connection?.configured} onClick={() => void runAction("logout")}>Desconectar</button></div>{message && <p className="actionMessage" role="status">{message}</p>}{qr && <div className="qrBox"><Image unoptimized width={260} height={260} src={qr} alt="QR Code para conectar o WhatsApp"/><p>WhatsApp → Aparelhos conectados → Conectar aparelho</p></div>}</article>
      <article className="card commandsCard"><h2>Comandos disponíveis</h2><p>Em conversas privadas, escreva normalmente. Em grupos, use:</p><code>!gasto 50 no mercado</code><code>!!receita 11000 salário</code><code>@contaai gastei 35 no Uber</code><Link className="manageSenders" href="/#allowed-senders">Gerenciar números autorizados →</Link></article></div>
  </section></main>;
}
