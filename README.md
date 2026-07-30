# Nova Era Veículos BM

Sistema web para concessionárias e lojas de seminovos: **site público** + **painel ERP administrativo** + **API Node.js**.

## Estrutura de pastas

```
/
├── index.html              # Site público
├── robots.txt              # SEO
├── assets/
│   ├── css/                # Estilos do site
│   ├── js/
│   │   ├── app.js          # UI do site
│   │   ├── cars.js         # Estoque (sincronizado com API)
│   │   ├── nova-ia.js      # Chat Nova IA
│   │   ├── analytics.js    # Tracking de visitas
│   │   └── inventory-engine.js
│   ├── img/carros/         # Fotos de veículos (WebP)
│   └── img/clientes/       # Fotos de clientes
├── admin/                  # Painel ERP (tema escuro)
│   ├── index.html
│   ├── admin.css
│   └── js/                 # core, pages, erp, app
├── data/                   # Persistência JSON (sensível — gitignore)
│   ├── config.json
│   ├── cars.json
│   └── backups/            # Backups automáticos e manuais
└── server/                 # API Express
    ├── index.js
    ├── routes/             # admin.js, erp.js
    └── lib/                # auth, finance, promissories, etc.
```

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/jgbittencourt/nova-era-veiculos.git
cd nova-era-veiculos

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves

# 3. Gere hash da senha admin
cd server
npm install
node scripts/hash-password.js "SuaSenhaForte123!"
# Copie o ADMIN_PASSWORD_HASH para o .env

# 4. Inicie o servidor
npm start
```

- **Site:** http://localhost:3001/
- **Admin:** http://localhost:3001/admin/

## Configuração de produção

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `ADMIN_PASSWORD_HASH` | Sim | Hash bcrypt da senha admin |
| `ADMIN_USERNAME` | Sim | Usuário admin |
| `SESSION_SECRET` | Sim | Segredo para tokens de sessão |
| `OPENAI_API_KEY` | Para Nova IA | Chave OpenAI |
| `NODE_ENV` | Sim | `production` |
| `ALLOWED_ORIGINS` | Sim | Domínios CORS permitidos |
| `TRUST_PROXY` | Se usar Nginx | `true` |

## Painel administrativo

### Módulos

- **Dashboard** — KPIs, leads, financeiro, visitas
- **Veículos** — CRUD, upload WebP, histórico de preço
- **Clientes** — Cadastro completo com foto
- **Financeiro** — Fluxo de caixa, export CSV
- **Promissórias** — Parcelas, recebimentos, recibos
- **Contratos** — Geração de documentos
- **Agenda** — Vencimentos e compromissos
- **Funcionários** — RBAC (Administrador, Vendedor, Financeiro)
- **Backup** — Manual + automático diário
- **Logs** — Auditoria completa

### Cadastrar veículo

1. Admin → **Veículos** → **+ Novo veículo**
2. Preencha dados e arraste fotos
3. Salvar — sincroniza `data/cars.json` e `assets/js/cars.js`

### Cadastrar cliente

1. Admin → **Clientes** → **+ Novo cliente**
2. Preencha formulário completo
3. Opcional: upload de foto

## Backup e restauração

### Automático

- Executado na inicialização do servidor (se último backup > 24h)
- Repetido a cada 24 horas
- Retém os últimos **30** backups em `data/backups/`

### Manual

1. Admin → **Backup** → **Backup manual**

### Restaurar

1. Admin → **Backup** → **Restaurar** no backup desejado
2. Confirme no modal

### Via API

```bash
# Criar backup (autenticado)
POST /api/admin/backups

# Restaurar
POST /api/admin/backups/restore
{ "name": "backup-2026-07-30T....json" }
```

## Segurança

- Senhas com **bcrypt** (admin + funcionários)
- Tokens HMAC com expiração (12h) e revogação no logout
- Header **X-Nova-Admin** (proteção CSRF preparatória)
- Helmet, rate limit, CORS, CSP sem `unsafe-inline`
- Upload validado (tipo, dimensões, Sharp metadata)
- RBAC por módulo
- Logs de auditoria

## Testes

```bash
cd server
npm run smoke-test   # Testes de módulos
npm audit            # Vulnerabilidades
```

## Deploy

- **Site estático:** GitHub Pages (apenas frontend + `cars.js`)
- **API + Admin:** Servidor Node separado (VPS, Render, etc.)
- Configure proxy reverso com HTTPS

## Atualizar estoque

O painel admin sincroniza automaticamente. Para sync manual:

```bash
cd server
node scripts/sync-cars.js
```

## Licença

Projeto privado — Nova Era Veículos BM.
