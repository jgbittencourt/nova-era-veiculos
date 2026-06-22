# Nova IA — Assistente Virtual

Assistente com inteligência artificial integrada ao site da Nova Era Veículos.

## Funcionalidades

- Chat flutuante no canto inferior direito (desktop e mobile)
- Respostas via OpenAI (ChatGPT) sobre veículos, financiamento, localização e pagamento
- Sugestão de veículos por orçamento informado
- Captura de leads (nome, telefone, interesse) antes do WhatsApp
- Painel administrativo em `/admin/`
- Contexto de conversa mantido na sessão

## Configuração

### 1. Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite o arquivo e defina:

| Variável | Descrição |
|----------|-----------|
| `OPENAI_API_KEY` | Chave da API OpenAI (obrigatória) |
| `OPENAI_MODEL` | Modelo (padrão: `gpt-4o-mini`) |
| `ADMIN_PASSWORD` | Senha do painel administrativo |
| `PORT` | Porta do servidor (padrão: `3001`) |
| `ALLOWED_ORIGINS` | Domínios permitidos (CORS) |

### 2. Instalar dependências

```bash
cd server
npm install
```

### 3. Sincronizar estoque

```bash
cd server
npm run sync-cars
```

Isso copia `assets/js/cars.js` → `data/cars.json`.

### 4. Iniciar servidor

```bash
cd server
npm start
```

Acesse:
- **Site:** http://localhost:3001/
- **Admin:** http://localhost:3001/admin/

## Painel Administrativo

Acesse `/admin/` e use a senha definida em `ADMIN_PASSWORD`.

Seções disponíveis:
- **Loja** — endereço, horário, WhatsApp, financiamento, pagamento, trocas
- **FAQs** — perguntas frequentes que a IA usa como base
- **Veículos** — editar estoque (sincroniza com `cars.js`)
- **Leads** — contatos capturados pelo chat
- **Chat** — mensagem inicial e fallback

## Deploy em produção

O site estático roda no **GitHub Pages**, mas a API precisa de um servidor Node.js.

### Opção recomendada: Railway ou Render

1. Faça deploy da pasta `server/` (com acesso à raiz do projeto)
2. Configure as variáveis de ambiente no painel do provedor
3. No `index.html`, defina a URL da API:

```html
<script>window.NOVA_IA_API = "https://sua-api.railway.app";</script>
```

4. Adicione o domínio do site em `ALLOWED_ORIGINS`

### GitHub Pages (site) + API separada

- Site: branch `main` no GitHub Pages (como hoje)
- API: deploy separado com Node.js
- `NOVA_IA_API` aponta para a URL da API em produção

## Estrutura de arquivos

```
data/
  config.json    # Configurações da loja e FAQs
  cars.json      # Estoque (sincronizado com cars.js)
  leads.json     # Leads capturados

server/
  index.js       # API Express
  lib/           # Módulos (OpenAI, storage, auth)
  scripts/       # Utilitários

assets/
  css/nova-ia.css
  js/nova-ia.js

admin/
  index.html     # Painel administrativo
  admin.css
  admin.js
```

## API Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/health` | — | Status da API |
| GET | `/api/config/public` | — | Config pública (chat) |
| POST | `/api/chat` | — | Enviar mensagem à IA |
| POST | `/api/leads` | — | Registrar lead |
| GET | `/api/cars` | — | Listar veículos |
| GET | `/api/config` | Admin | Config completa |
| PUT | `/api/config` | Admin | Salvar config |
| PUT | `/api/cars` | Admin | Salvar veículos |
| GET | `/api/leads` | Admin | Listar leads |
