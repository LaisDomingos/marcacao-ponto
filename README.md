# Sistema de Marcação de Ponto (multi-empresa)

Sistema **multi-empresa** para registrar o ponto dos funcionários ao longo do dia
(**Entrada → Saída para Almoço → Volta do Almoço → Saída**), com um painel
administrativo por empresa para visualizar e **baixar as folhas de ponto em Excel**.

Cada empresa se cadastra, recebe um **código (slug)** e um link de ponto próprio
(`/ponto/<slug>`). Os dados de uma empresa são isolados das demais.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Banco:** Supabase (Postgres gerenciado), acessado no servidor via service_role key
- **Cadastro:** self-service de empresa + primeiro administrador
- **Login do funcionário:** seleção do nome + PIN de 4 dígitos (na tela da sua empresa).
  O PIN é criado pelo **próprio funcionário no primeiro acesso** — o admin nunca define nem vê o PIN.
- **Login do admin:** e-mail + senha

## Configuração do Supabase

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
   (cria as tabelas `companies`, `employees`, `admins`, `punches`).
3. Em **Project Settings → API**, copie a **Project URL** e a chave **`service_role`**
   (secreta) para o `.env`:

   ```env
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```

   > ⚠️ A `service_role` key ignora o RLS e só deve ser usada no servidor —
   > nunca a exponha no navegador nem a versione.
   >
   > 💡 Se a API REST reclamar de "schema cache" logo após criar as tabelas,
   > rode `notify pgrst, 'reload schema';` no SQL Editor (ou reinicie o projeto).

## Como rodar

```bash
npm install        # instala dependências
cp .env.example .env   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run seed       # (opcional) cria uma empresa de demonstração
npm run dev        # inicia em http://localhost:3000
```

- Início (landing): <http://localhost:3000>
- Cadastrar empresa: <http://localhost:3000/cadastro>
- Painel do admin: <http://localhost:3000/admin/login>
- Tela de ponto de uma empresa: <http://localhost:3000/ponto/SEU-SLUG>

### Fluxo de uso

1. A empresa acessa **/cadastro**, informa nome, e-mail e senha do admin → entra logada.
2. No painel, o admin cadastra os funcionários (**nome + jornada**, sem PIN) e copia o
   **link de ponto** (`/ponto/<slug>`) para divulgar internamente.
3. No **primeiro acesso**, o funcionário escolhe o nome e **cria o próprio PIN** (digitar
   + confirmar). Nas próximas vezes, é só nome + PIN.
4. Se o funcionário esquecer o PIN, o admin clica em **Redefinir PIN** (apenas limpa — o
   funcionário cria um novo no acesso seguinte; o admin nunca escolhe o valor).

### Empresa de demonstração (seed)

O `npm run seed` cria a empresa **Empresa Demo** (slug `demo`):

- **Admin:** `admin@demo.com` / `admin123` (configurável via `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` no `.env`).
- **Funcionários:** Maria Silva (40h), João Souza (32h), Ana Oliveira (20h) —
  cada um define o PIN no primeiro acesso.
- **Tela de ponto:** `/ponto/demo`.

> ⚠️ Troque a senha do admin e o `SESSION_SECRET` no `.env` antes de usar de verdade.

## Rodar na rede interna

```bash
npm run build
npm start -- -H 0.0.0.0
```

Acesse pelo IP da máquina na rede local, ex.: `http://192.168.0.10:3000`.

## Funcionalidades

**Funcionário (tela de ponto `/ponto/<slug>`):**
- No 1º acesso, seleciona o nome e **cria o próprio PIN**; depois é só nome + PIN.
- Vê os horários já marcados no dia e o sistema mostra **apenas o próximo botão
  válido**; ao encerrar a saída, exibe "Expediente encerrado".

**Administrador (`/admin`):** (vê apenas a sua empresa)
- Folha de ponto filtrável por período e por funcionário, com cálculo de horas.
- **Exportar Excel** (`.xlsx`) respeitando os filtros.
- Correção manual de horários (editar o campo e clicar fora; apagar remove a marcação).
- Cadastro de funcionários: criar (nome + jornada), renomear, ajustar jornada,
  ativar/desativar e **redefinir PIN** (limpa, força novo 1º acesso — sem escolher o valor).

## Estrutura

```
app/
  page.tsx              Landing (cadastrar / login admin / abrir ponto por código)
  cadastro/             Cadastro de empresa + primeiro admin
  ponto/[slug]/         Tela de ponto (kiosk) de cada empresa
  admin/                Login e painel do administrador
  api/                  Endpoints REST (companies, employees, punch, admin/*)
lib/                    Cliente Supabase, lógica de ponto, sessão, folha, slug, tipos
scripts/seed.ts         Seed da empresa de demonstração
supabase/schema.sql     DDL das tabelas para rodar no SQL Editor do Supabase
```

## Observações

- **Isolamento por empresa:** toda consulta é escopada por `company_id` (derivado da
  sessão do admin ou do slug do kiosk); uma empresa não acessa dados de outra.
- Fuso horário fixo (padrão `Europe/Lisbon`, configurável via `TZ` no `.env`).
- O sistema assume um turno por dia; turnos que cruzam a meia-noite não são tratados.
- PINs e senhas são armazenados com hash (bcrypt) e nunca retornados pela API.
- Todo o acesso ao banco é feito no servidor (API routes) com a service_role key;
  o navegador nunca fala diretamente com o Supabase.
