# Deploy em VPS Linux

O build (`bun run build`) usa o preset Nitro `node-server`: gera um app Node
autocontido em `.output/` (código + dependências já resolvidas), sem depender
de nenhuma infraestrutura de hospedagem específica. Roda com um único comando:

```
node .output/server/index.mjs
```

O banco (Postgres/Auth/Realtime) continua no Supabase Cloud — a VPS só
precisa rodar o processo Node e falar com a URL do projeto Supabase por HTTPS.

## Variáveis de ambiente

Ver `.env.example`. Em produção, defina-as no ambiente real do processo
(Docker `-e`/`env_file`, ou `Environment=` no systemd) — não em um `.env`
commitado. `SUPABASE_SERVICE_ROLE_KEY` é obrigatória no servidor (bypassa RLS
para as server functions) e nunca deve ir para o client.

## Opção A — Docker

```
docker build -t controleseta .
docker run -d --name controleseta \
  --env-file .env.production \
  -p 3000:3000 \
  --restart unless-stopped \
  controleseta
```

Coloque um reverse proxy (Nginx/Caddy) na frente para TLS e domínio.

## Opção B — systemd direto (sem Docker)

```
# na VPS, como usuário de deploy:
git clone <repo> /opt/controleseta
cd /opt/controleseta
bun install --frozen-lockfile
bun run build
```

`/etc/systemd/system/controleseta.service`:

```ini
[Unit]
Description=controleseta
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/controleseta
EnvironmentFile=/opt/controleseta/.env.production
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
User=controleseta

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl enable --now controleseta
```

Nginx como reverse proxy (TLS via certbot):

```nginx
server {
    server_name seu-dominio.gov.br;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Deploy de uma atualização

```
git pull
bun install --frozen-lockfile
bun run build
sudo systemctl restart controleseta   # ou: docker compose up -d --build
```

## Notas

- Migrations do Supabase (`supabase/migrations/`) são aplicadas contra o
  projeto Supabase Cloud via `supabase db push` (Supabase CLI), não fazem
  parte do build do app.
- O job de sincronização de e-mail (Fase 6 do plano de reescrita) usa
  `pg_cron`/`pg_net` dentro do próprio Postgres do Supabase — independe de
  cron na VPS.
