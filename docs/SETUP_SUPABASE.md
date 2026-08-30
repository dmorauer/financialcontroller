# Configuração do Supabase

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável exibidas em **Connect**.
3. Vincule o projeto com `npx supabase link --project-ref SEU_PROJECT_REF`.
4. Aplique o banco com `npx supabase db push`.
5. Antes de publicar, execute `npx supabase db lint` e `npx supabase test db`.

A chave `service_role` nunca deve ser adicionada a variáveis `NEXT_PUBLIC_*` nem enviada ao navegador.

## Modelo inicial

- `accounts`: contas bancárias, dinheiro, cartões e investimentos.
- `categories`: categorias personalizadas de receita e despesa.
- `imports`: rastreia arquivos, WhatsApp e processamento por OCR.
- `transactions`: lançamentos confirmados ou aguardando revisão.

Todas as tabelas usam Row Level Security. Usuários autenticados só podem acessar registros cujo `user_id` seja o próprio identificador de autenticação.
