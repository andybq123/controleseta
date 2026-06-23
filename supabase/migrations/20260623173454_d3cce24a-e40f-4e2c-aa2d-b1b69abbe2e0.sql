CREATE OR REPLACE FUNCTION public.log_protocolo_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_nome text;
  campos text[] := ARRAY['numero','tipo','categoria','status','assunto','descricao','solicitante','secretaria_id','local_id','data_abertura','data_conclusao','data_prorrogacao','prorrogado'];
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
$function$;