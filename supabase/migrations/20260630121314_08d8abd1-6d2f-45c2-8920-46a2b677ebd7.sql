
ALTER TABLE public.assuntos
  ADD COLUMN IF NOT EXISTS forcar_triagem boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.force_triagem_para_ouvidoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assunto_norm text;
  v_forcar boolean := false;
  v_saude_triagem text[] := ARRAY[
    'demora em marcar consulta / procedimento',
    'falta de materiais em posto de saude',
    'falta de medicacao',
    'medicos',
    'postos de saude',
    'transporte para tratamento',
    'vacinas'
  ];
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.tipo = 'ouvidoria'
     AND auth.uid() IS NULL
  THEN
    v_assunto_norm := lower(translate(coalesce(NEW.assunto, ''),
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'));

    -- Verifica se há um assunto cadastrado marcado como "forçar triagem"
    SELECT a.forcar_triagem INTO v_forcar
    FROM public.assuntos a
    WHERE lower(translate(a.nome,
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN')) = v_assunto_norm
      AND a.ativo = true
    LIMIT 1;

    IF COALESCE(v_forcar, false)
       OR NEW.secretaria_id IS NULL
       OR v_assunto_norm = ANY(v_saude_triagem)
    THEN
      NEW.triagem_pendente := true;
    ELSE
      NEW.triagem_pendente := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
