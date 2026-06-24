-- Garantia em nível de banco: toda ouvidoria criada por processo automático
-- (cron de e-mail, service_role, sem auth.uid()) entra na fila de triagem.
-- Isso evita que uma versão publicada antiga do worker, ou um bypass
-- acidental do código, faça uma ouvidoria pular a triagem.

CREATE OR REPLACE FUNCTION public.force_triagem_para_ouvidoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando o INSERT vem de processo automático (sem usuário autenticado)
  -- e o tipo é ouvidoria, força triagem_pendente = true.
  -- Inserts feitos pela UI (NovoProtocolo) têm auth.uid() != NULL e
  -- preservam o valor escolhido pelo usuário.
  IF TG_OP = 'INSERT'
     AND NEW.tipo = 'ouvidoria'
     AND auth.uid() IS NULL
  THEN
    NEW.triagem_pendente := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_triagem_ouvidoria ON public.protocolos;
CREATE TRIGGER trg_force_triagem_ouvidoria
BEFORE INSERT ON public.protocolos
FOR EACH ROW EXECUTE FUNCTION public.force_triagem_para_ouvidoria();