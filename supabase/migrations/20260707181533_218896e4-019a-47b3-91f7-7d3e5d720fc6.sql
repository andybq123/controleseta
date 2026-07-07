
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
  v_termo text;
  v_casa_saude boolean := false;
  v_a_nome_norm text;
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.tipo = 'ouvidoria'
     AND auth.uid() IS NULL
  THEN
    v_assunto_norm := lower(translate(coalesce(NEW.assunto, ''),
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'));

    -- Assuntos marcados como forçar triagem no catálogo: usa "contém" para
    -- tolerar prefixos como "Ouvidoria 2.240/2026: <assunto>".
    FOR v_a_nome_norm IN
      SELECT lower(translate(a.nome,
        'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
        'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'))
      FROM public.assuntos a
      WHERE a.ativo = true AND a.forcar_triagem = true
    LOOP
      IF position(v_a_nome_norm in v_assunto_norm) > 0 THEN
        v_forcar := true;
        EXIT;
      END IF;
    END LOOP;

    FOREACH v_termo IN ARRAY v_saude_triagem LOOP
      IF position(v_termo in v_assunto_norm) > 0 THEN
        v_casa_saude := true;
        EXIT;
      END IF;
    END LOOP;

    IF v_forcar
       OR NEW.secretaria_id IS NULL
       OR v_casa_saude
    THEN
      NEW.triagem_pendente := true;
    ELSE
      NEW.triagem_pendente := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: recolocar em triagem protocolos dos últimos 20 dias cujo assunto
-- casa (por "contém") com um assunto marcado como forçar triagem, e que ainda
-- não foram concluídos pelo status final.
WITH forc AS (
  SELECT lower(translate(nome,
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN')) AS n
  FROM public.assuntos WHERE forcar_triagem = true AND ativo = true
),
alvo AS (
  SELECT p.id
  FROM public.protocolos p
  WHERE p.tipo = 'ouvidoria'
    AND p.created_at >= now() - interval '20 days'
    AND p.triagem_pendente = false
    AND p.triagem_concluida_em IS NULL
    AND p.status <> 'concluido'
    AND EXISTS (
      SELECT 1 FROM forc f
      WHERE position(f.n IN lower(translate(p.assunto,
        'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
        'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'))) > 0
    )
)
UPDATE public.protocolos p
SET triagem_pendente = true,
    triagem_lock_por = NULL,
    triagem_lock_em = NULL,
    triagem_concluida_em = NULL,
    triagem_concluida_por = NULL
FROM alvo
WHERE p.id = alvo.id;
