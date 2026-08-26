# Automação de Ofertas Mercado Livre → WhatsApp

Sistema completo e configurável que:

1. **Coleta promoções** do Mercado Livre (por palavra-chave/categoria e desconto mínimo), usando a API pública de busca do Mercado Livre;
2. **Gera o link de afiliado** de cada produto (parâmetros `matt_word`/`matt_tool` da Central de Afiliados);
3. **Dispara automaticamente** as ofertas para um grupo do WhatsApp via **Evolution API**;
4. É **100% configurável por um painel web** (sem precisar mexer em código ou variáveis de ambiente no dia a dia);
5. Roda como um único container Docker, pronto para instalar em qualquer **VPS Linux**.

Não depende de Supabase, Lovable Cloud ou qualquer serviço de terceiros — tudo roda localmente na sua VPS com um banco SQLite embutido.

## Arquitetura

```
mercadolivre-automation/
├── backend/    # API + coletor + scheduler + banco SQLite (Node.js/TypeScript)
├── frontend/   # Painel web (React + Vite + Tailwind)
├── Dockerfile  # build multi-stage: gera 1 único container servindo painel + API
└── docker-compose.yml
```

O `backend` serve tanto a API (`/api/*`) quanto os arquivos estáticos do painel já compilado — ou seja, em produção existe **um único processo, uma única porta**.

## Pré-requisitos

- Uma VPS Linux (Ubuntu 22.04+ ou similar) com Docker e Docker Compose instalados.
- Uma instância da [Evolution API](https://doc.evolution-api.com/) já rodando e **conectada ao WhatsApp** (própria ou de terceiros), com a URL base e a API Key em mãos.
- Uma conta no [Programa de Afiliados do Mercado Livre](https://www.mercadolivre.com.br/afiliados) (opcional, mas recomendado — sem ela os links enviados serão os links normais do produto, sem comissão).

## Instalação na VPS (Docker — recomendado)

```bash
# 1. Instale o Docker, se ainda não tiver
curl -fsSL https://get.docker.com | sh

# 2. Clone o repositório na VPS
git clone <url-do-seu-repositorio>
cd controleseta/mercadolivre-automation

# 3. Configure as variáveis de ambiente
cp .env.example .env
nano .env   # defina JWT_SECRET (openssl rand -hex 32) e ADMIN_PASSWORD

# 4. Suba o container
docker compose up -d --build

# 5. Acompanhe os logs (opcional)
docker compose logs -f
```

Pronto — o painel estará disponível em `http://SEU_IP:4000` (ou na porta que você definir em `APP_PORT`). Entre com o `ADMIN_USER`/`ADMIN_PASSWORD` definidos no `.env`.

> Recomendado: coloque um proxy reverso (Nginx, Caddy ou Traefik) na frente do container para servir com HTTPS em um domínio próprio.

### Atualizando

```bash
git pull
docker compose up -d --build
```

Os dados (configurações, histórico, palavras-chave) ficam no volume Docker `ml-automation-data` e **não são perdidos** ao atualizar.

## Instalação manual (sem Docker)

```bash
# Backend
cd backend
cp .env.example .env   # edite conforme necessário
npm install
npm run build
npm start               # roda em produção (usa dist/ e serve o painel se buildado)

# Frontend (em outro terminal, apenas para gerar o build servido pelo backend)
cd ../frontend
npm install
npm run build
cp -r dist ../backend/public
```

Para manter o processo rodando após fechar o terminal, use `pm2` ou um serviço `systemd`:

```bash
npm install -g pm2
cd backend
pm2 start dist/index.js --name ml-automation
pm2 save
pm2 startup
```

## Configuração pelo painel

Tudo é configurado em **Configurações**, sem precisar editar arquivos:

### Mercado Livre
- **Site**: código do país no Mercado Livre (`MLB` = Brasil, `MLA` = Argentina, etc.).
- **Desconto mínimo (%)**: só envia produtos com desconto igual ou maior.
- **Preço mínimo/máximo**: filtro opcional de faixa de preço.
- **matt_word / matt_tool**: parâmetros de rastreio do seu link de afiliado, encontrados na Central de Afiliados do Mercado Livre. Se deixados em branco, o link enviado é o link normal do produto (sem comissão).

### Palavras-chave / categorias
Cadastre quantos termos quiser (ex.: `notebook`, `air fryer`, `fone bluetooth`). A cada execução, o sistema busca ofertas para cada termo ativo. Você pode pausar um termo sem apagá-lo.

### Agendamento
- **Ativar/pausar** a automação com um clique.
- **Expressão cron** para definir a frequência (ex.: `*/30 * * * *` = a cada 30 minutos).
- **Máx. produtos por execução**: evita spam no grupo, limitando quantas ofertas são enviadas por rodada.
- **Horário de silêncio**: intervalo (ex.: 22:00–07:00) em que nada é enviado, mesmo com a automação ativa.

### Evolution API (WhatsApp)
- **URL base** e **API Key** da sua instância Evolution API.
- **Nome da instância** conectada ao WhatsApp.
- **ID do grupo (JID)**: identificador do grupo de destino, no formato `120363000000000000@g.us`. Você consegue esse valor listando os grupos pela própria Evolution API (`GET /group/fetchAllGroups/{instance}`) ou por integrações que exibem o JID do grupo.
- Botão **"Enviar mensagem de teste"** para validar a conexão antes de ativar o agendamento.
- Opção de enviar a **imagem do produto** junto com a mensagem.

### Modelo de mensagem
Mensagem 100% customizável, com placeholders:

| Placeholder | Descrição |
|---|---|
| `{titulo}` | Título do produto |
| `{preco}` | Preço com desconto |
| `{preco_original}` | Preço antes do desconto |
| `{desconto}` | Percentual de desconto |
| `{link}` | Link de afiliado (ou link normal, se afiliado não configurado) |
| `{imagem}` | URL da imagem do produto |

### Histórico e Logs
- **Histórico**: todas as ofertas já enviadas (com link, preço, desconto e status), usado também para evitar reenvio do mesmo produto.
- **Logs**: registro de cada execução (manual ou agendada), com quantos produtos foram encontrados/enviados e eventuais erros.

## Segurança

- O painel exige login (usuário/senha com JWT). Troque a senha padrão em **Configurações > Conta** assim que possível.
- Coloque o painel atrás de HTTPS (proxy reverso) se for acessá-lo pela internet.
- A API Key da Evolution API e a senha do admin ficam apenas no banco local (SQLite) — nunca são expostas no frontend após salvas.

## Variáveis de ambiente (Docker)

Definidas em `.env` (raiz do projeto), usadas pelo `docker-compose.yml`:

| Variável | Descrição |
|---|---|
| `APP_PORT` | Porta exposta na VPS (padrão `4000`) |
| `JWT_SECRET` | Segredo para assinar os tokens de sessão do painel |
| `ADMIN_USER` | Usuário administrador criado no primeiro start |
| `ADMIN_PASSWORD` | Senha do administrador criada no primeiro start |

## Limitações e observações

- A coleta usa a **API pública de busca** do Mercado Livre (`api.mercadolibre.com/sites/{site}/search`), que não exige autenticação para consultas básicas de catálogo. Buscas muito agressivas (intervalo muito curto + muitas palavras-chave) podem ser limitadas pelo próprio Mercado Livre; ajuste a frequência do agendamento conforme necessário.
- Os parâmetros de afiliado (`matt_word`/`matt_tool`) seguem o padrão usado pelos links do Programa de Afiliados do Mercado Livre. Confirme os valores exatos no seu painel de afiliados, já que o programa pode alterar seu funcionamento com o tempo.
- A Evolution API precisa estar com a instância **conectada e autenticada no WhatsApp** antes de qualquer envio funcionar.
