import "server-only";

export function evolutionConfigured() {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

export async function evolutionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) throw new Error("Evolution API não está acessível por este servidor.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", apikey: apiKey, ...init?.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((result as { message?: string }).message || "Falha na comunicação com a Evolution API.");
  return result as T;
}
