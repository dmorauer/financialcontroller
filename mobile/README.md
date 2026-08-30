# Saldo Aí para celular

Aplicativo Expo/React Native conectado ao mesmo Supabase do painel web.

## Recursos

- login compartilhado com o site;
- saldo, receitas e despesas reais;
- lançamento por texto natural, incluindo vencimento;
- fila de revisão dos lançamentos recebidos pelo WhatsApp;
- acompanhamento dos orçamentos mensais;
- versão Android configurada para gerar APK de teste.

## Rodar no Expo Go

1. Instale o Expo Go no celular.
2. Execute `npm start` nesta pasta.
3. Leia o QR Code usando um aparelho na mesma rede do computador.

## Gerar APK

Após autenticar uma conta Expo com `npx eas-cli login`, execute:

`npx eas-cli build --platform android --profile preview`
