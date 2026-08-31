# Saldo Aí Gateway para Presidente Poker

O `financialcontroller` expõe uma camada pública entre o Presidente Poker e a Evolution API. A instância usada pelas rotas é fixa: `presidente-poker`. O aplicativo de poker nunca recebe a chave da Evolution.

## Segredos

Configure somente no ambiente do servidor, Supabase Edge Function Secrets ou GitHub Actions Secrets. Nunca use variáveis `NEXT_PUBLIC_` para estas chaves.

No Gateway (`financialcontroller`):

- `EVOLUTION_API_URL`: endereço interno da Evolution API.
- `EVOLUTION_API_KEY`: chave global da Evolution, exclusiva do servidor.
- `SALDO_AI_API_KEY`: token compartilhado com o projeto Presidente Poker.
- `POKER_GATEWAY_PUBLIC_URL`: `https://alieniginamorau.tail01eed7.ts.net`.
- `POKER_SUPABASE_WEBHOOK_URL`: URL pública da Edge Function `evolution-webhook` do Presidente Poker.

No Supabase do Presidente Poker, configure apenas:

```text
SALDO_AI_API_URL=https://alieniginamorau.tail01eed7.ts.net
SALDO_AI_API_KEY=<token compartilhado>
```

## Rotas

- `POST /api/poker/connect`: cria a instância, configura o webhook e retorna o QR Code.
- `GET /api/poker/status`: consulta o estado da conexão.
- `POST /api/poker/send`: envia `{ "number": "...", "text": "..." }`.
- `POST /api/poker/webhook`: recebe eventos autenticados da Evolution, normaliza o nome do evento e encaminha à Edge Function.

Todas as chamadas usam `Authorization: Bearer <SALDO_AI_API_KEY>`. O webhook também aceita uma assinatura interna HMAC-SHA256 nos cabeçalhos `X-Saldo-Ai-Timestamp` e `X-Saldo-Ai-Signature`, calculada sobre `<timestamp>.<corpo bruto>` e válida por cinco minutos.

## Fluxo do webhook

1. `POST /api/poker/connect` configura na Evolution a URL pública `/api/poker/webhook` e o token Bearer.
2. A Evolution entrega o evento ao Gateway.
3. O Gateway rejeita a chamada sem token ou assinatura válida.
4. `messages.upsert` e `MESSAGES_UPSERT` são normalizados para `MESSAGES_UPSERT`.
5. O evento é encaminhado para `POKER_SUPABASE_WEBHOOK_URL` com o token do projeto.
6. A Edge Function existente valida grupo, jogador, administrador, idempotência, limites e logs, executa `!rebuy`, `!saldo` ou `!cashout` e responde por `/api/poker/send`.

O Gateway não implementa regras de rebuy, criação de partida, cashout/checkout ou telas; essas regras continuam no Presidente Poker.

## Publicação no host Tailscale

O domínio já aponta para a Evolution na porta local `8081`. Execute o Next.js em outra porta local (por exemplo, `3000`) com os segredos acima e acrescente no host uma regra Tailscale Serve para encaminhar somente `/api/poker` ao Next.js. Preserve a regra raiz que atende a Evolution.

Depois da publicação, valide sem informar o token no terminal compartilhado:

```text
GET  https://alieniginamorau.tail01eed7.ts.net/api/poker/status
POST https://alieniginamorau.tail01eed7.ts.net/api/poker/connect
POST https://alieniginamorau.tail01eed7.ts.net/api/poker/send
```

Sem autenticação, todas devem retornar HTTP `401`. Com o Bearer válido, status/connect/send devem responder pelo Gateway.

## Verificação local

```bash
npm run test:poker
npm run lint
npm run build
```
