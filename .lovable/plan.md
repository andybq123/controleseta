## Situação

Confirmei no banco: os 4 usuários cadastrados (`dclaudiovinicius`, `anderdonenator`, `camilapetermann`, `setamonitoramento75`) têm role `admin`. Como as policies endurecidas no último ajuste liberam tudo para admins, **na prática nenhuma funcionalidade quebra hoje**.

Ainda assim, vale blindar o sistema para evitar quebra futura caso um usuário comum (`user`) seja criado — hoje ele entraria e ficaria sem ver protocolos, triagem, etc.

## Plano de validação e proteção

### 1. Validação rápida (sem mudanças)
- Rodar checagem nas policies/funções para garantir que toda leitura/escrita crítica passa por `has_role(auth.uid(), 'admin')` ou pelo próprio usuário.
- Conferir áreas sensíveis em produção via Playwright logado:
  - `/tarefas` (triagem: reservar, concluir, liberar)
  - `/protocolos` (listar, abrir, editar local/secretaria)
  - `/dashboard` e `/relatorios` (agregações)
  - Realtime na triagem (lock entre usuários)
- Verificar `profiles`: como passou a ser "dono ou admin", todos enxergam tudo (admins veem todos os profiles), então telas que mostram "quem concluiu a triagem" seguem funcionando.

### 2. Proteção contra criação acidental de usuário não-admin
Hoje a tela `/users` permite escolher role `admin` ou `user`. Para evitar que alguém crie um `user` comum e fique órfão de permissões, faríamos uma destas opções (a escolher):

- **A. Forçar admin no cadastro:** ocultar o select de role na UI `/users` e gravar sempre `admin` no `allowed_emails`/`user_roles`. Simples e alinhado ao uso atual.
- **B. Manter o select, mas alertar:** deixar a UI como está e apenas adicionar um aviso visual ("usuários comuns têm acesso limitado").
- **C. Ampliar policies para `user`:** reverter parte da restrição e permitir que role `user` também leia/edite protocolos não-públicos. **Não recomendado**, pois enfraquece o ganho de segurança recém-aplicado.

### 3. Detalhes técnicos
- A função `has_role` já é `SECURITY DEFINER` e estável — segura para uso nas policies.
- A RPC `concluir_triagem` / `reservar_triagem` exige `auth.uid()` (qualquer autenticado), não admin — segue funcionando para todos os 4 usuários.
- O `protocolo_historico` exibe `autor_nome` via `profiles`; como todo mundo é admin, a policy "owner OR admin" devolve todos os nomes corretamente.

## O que preciso de você

1. Confirma a **opção A, B ou C** para o cadastro de usuários?
2. Posso rodar o teste de fumaça com Playwright logado como `setamonitoramento75` (ou outro) para validar as telas em produção?