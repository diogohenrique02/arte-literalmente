# Arte Literalmente

Biblioteca digital em React + TypeScript + Vite, com Supabase para catálogo, autenticação, favoritos, progresso de leitura e armazenamento privado. Interface em português brasileiro.

## Requisitos

- Node.js 20.19+ ou 22.12+ e npm.
- Projeto Supabase gratuito ou compatível.
- Arquivos EPUB, PDF ou TXT cuja distribuição esteja autorizada.

## Rodar localmente (Linux/Arch Linux)

No Arch, instale Node.js e npm com `sudo pacman -S nodejs npm`. Confira com `node --version` e `npm --version`.

```bash
cd arte-literalmente
cp .env.example .env.local
npm install
npm run dev
```

Preencha `.env.local` com a URL do projeto Supabase e a chave publicável (`anon` legado também funciona). Sem esses valores, a interface mostra aviso de configuração e o catálogo não será carregado. Não use `service_role` no frontend.

## Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Copie Project URL e publishable/anon key em **Project Settings → API** para `.env.local`.
3. Abra **SQL Editor**, execute `supabase/migrations/202610110001_initial_schema.sql`.
4. Em **Storage**, crie os buckets:
   - `book-covers`: público, para capas.
   - `book-files`: privado, para os arquivos completos.
5. Políticas sugeridas para Storage (SQL Editor; ajuste após verificar a estrutura do seu projeto):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/epub+zip','application/pdf','text/plain','application/octet-stream'])
on conflict (id) do update set public = false;

create policy "public reads covers" on storage.objects for select to anon, authenticated
using (bucket_id = 'book-covers');

create policy "admins upload covers" on storage.objects for insert to authenticated
with check (bucket_id = 'book-covers' and public.is_admin());

create policy "admins update covers" on storage.objects for update to authenticated
using (bucket_id = 'book-covers' and public.is_admin())
with check (bucket_id = 'book-covers' and public.is_admin());

create policy "admins delete covers" on storage.objects for delete to authenticated
using (bucket_id = 'book-covers' and public.is_admin());

create policy "admins upload book files" on storage.objects for insert to authenticated
with check (bucket_id = 'book-files' and public.is_admin());

create policy "admins update book files" on storage.objects for update to authenticated
using (bucket_id = 'book-files' and public.is_admin())
with check (bucket_id = 'book-files' and public.is_admin());

create policy "admins delete book files" on storage.objects for delete to authenticated
using (bucket_id = 'book-files' and public.is_admin());

-- A migração já cria a política de leitura dos arquivos publicados.
```

6. Em **Authentication → URL Configuration**, configure `Site URL` e os redirect URLs de desenvolvimento e produção. Ative/desative confirmação de e-mail conforme a política do seu projeto.
7. Crie sua conta pelo formulário de cadastro. Promova manualmente o primeiro administrador pelo SQL Editor, substituindo o e-mail:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where email = 'admin@seu-dominio.com');
```

Execute isso somente depois de a conta existir. Não há promoção automática de usuários no frontend.

## Desenvolvimento e verificações

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

## Funcionalidades

- Catálogo público, pesquisa por título/autor/descrição, filtro por gênero e formato, ordenação e paginação local sobre até 500 resultados.
- Detalhes, fonte e status de direitos autorais, favoritos autenticados.
- Cadastro, login, logout e recuperação de senha pelo Supabase Auth.
- Leitor de EPUB via epub.js, PDF via pdf.js e TXT com conteúdo tratado como texto simples.
- Controles de fonte, tema, navegação, progresso local e sincronização de progresso autenticado.
- Painel administrativo protegido pelo papel no banco, upload de livros/capas, publicação/rascunho, exclusão com confirmação e importação básica de metadados CSV como rascunho.
- Migração SQL com RLS e índices.

## Notas importantes e limitações atuais

- Nenhum livro fictício é incluído. O catálogo só aparece depois que você cadastrar obras com procedência e direitos verificados.
- A tela administrativa possui cadastro e alternância de publicação; edição completa dos metadados de um registro existente ainda precisa ser acrescentada antes de considerar o painel finalizado para operação editorial diária.
- A importação CSV é simples: espera campos sem vírgulas escapadas/aspas complexas. Sempre pré-visualize e revise os rascunhos; ela não importa arquivos nem capas.
- A consulta inicial carrega no máximo 500 registros e pagina os resultados localmente; para catálogos muito grandes, migre pesquisa/filtros/paginação para consultas SQL paginadas.
- EPUB refluível não possui total global estável de páginas. O progresso usa a posição reportada pelo epub.js. O fluxo do leitor precisa ser validado manualmente com EPUBs de amostra, PDFs de múltiplas páginas e TXT longos no navegador alvo.
- Um leitor web não impede captura ou cópia do conteúdo e não fornece DRM absoluto.
- As operações de storage dependem das políticas e buckets acima. A criação de URLs assinadas usa duração curta.
- O fluxo de redefinição de senha envia o e-mail; a tela de conclusão da troca de senha (`/redefinir-senha`) deve ser configurada se você quiser completar o fluxo de ponta a ponta. Ajuste também os redirects do Supabase.
- A página de privacidade incluída é um modelo inicial e precisa ser revisada com os dados reais do responsável antes da publicação pública.
- Não foi possível verificar acesso a um projeto Supabase real sem credenciais.

## Publicação

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Publique o conteúdo de `dist/` em Netlify, Vercel ou outro host estático. Configure as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no painel do host e habilite fallback de SPA para `index.html`. Configure os URLs de autenticação no Supabase para o domínio final.

## Licenças e direitos

Registre a fonte real e selecione `public_domain_verified`, `open_license` ou `permission_documented` somente depois da verificação. O estado `pending_review` não pode ser publicado pela migração. Considere a jurisdição aplicável; idade da obra, isoladamente, não comprova domínio público.
