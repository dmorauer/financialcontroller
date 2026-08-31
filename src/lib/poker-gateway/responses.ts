export function gatewayError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 502 });
}

export function unauthorized() {
  return Response.json({ error: "Não autorizado." }, { status: 401 });
}
