
CREATE TABLE public.protocolo_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  acao text NOT NULL DEFAULT 'update',
  autor_id uuid,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.protocolo_historico TO authenticated;
GRANT ALL ON public.protocolo_historico TO service_role;

ALTER TABLE public.protocolo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem historico" ON public.protocolo_historico
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados inserem historico" ON public.protocolo_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_protocolo_historico_protocolo ON public.protocolo_historico(protocolo_id, created_at DESC);

-- Trigger para registrar mudanças automaticamente
CREATE OR REPLACE FUNCTION public.log_protocolo_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_nome text;
  campos text[] := ARRAY['numero','tipo','categoria','status','assunto','descricao','solicitante','secretaria_id','responsavel_id','local_id','data_abertura','data_conclusao','data_prorrogacao','prorrogado'];
  campo text;
  v_old text;
  v_new text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    SELECT nome INTO v_nome FROM public.profiles WHERE id = v_uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.protocolo_historico(protocolo_id, campo, valor_anterior, valor_novo, acao, autor_id, autor_nome)
    VALUES (NEW.id, '_criacao', NULL, NEW.numero, 'create', v_uid, v_nome);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH campo IN ARRAY campos LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', campo, campo)
        INTO v_old, v_new USING OLD, NEW;
      IF v_old IS DISTINCT FROM v_new THEN
        INSERT INTO public.protocolo_historico(protocolo_id, campo, valor_anterior, valor_novo, acao, autor_id, autor_nome)
        VALUES (NEW.id, campo, v_old, v_new, 'update', v_uid, v_nome);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_protocolo_changes
AFTER INSERT OR UPDATE ON public.protocolos
FOR EACH ROW EXECUTE FUNCTION public.log_protocolo_changes();
