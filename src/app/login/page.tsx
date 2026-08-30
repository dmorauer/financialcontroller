"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (result.data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setMessage("Cadastro realizado. Confirme o e-mail para entrar.");
    }
  }

  return <main className="loginPage"><section className="loginIntro"><div className="brand loginBrand"><span className="brandMark">S</span><span>Saldo Aí</span></div><div><p className="eyebrow">CONTROLE FINANCEIRO INTELIGENTE</p><h1>Seu saldo, sempre em dia.</h1><p>Registre pelo WhatsApp, importe extratos e deixe a IA organizar seus documentos.</p></div><small>Seus dados são isolados e protegidos por conta.</small></section><section className="loginPanel"><form className="loginForm" onSubmit={submit}><div><h2>{mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}</h2><p>{mode === "login" ? "Continue de onde parou." : "Comece a organizar sua vida financeira."}</p></div><label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@email.com"/></label><label>Senha<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} placeholder="Mínimo de 8 caracteres"/></label>{message && <p className="authMessage">{message}</p>}<button className="primary" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button><button className="modeButton" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button></form></section></main>;
}
