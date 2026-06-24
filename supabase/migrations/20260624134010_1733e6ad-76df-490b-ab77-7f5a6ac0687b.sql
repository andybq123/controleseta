CREATE OR REPLACE FUNCTION public.force_triagem_para_ouvidoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assunto_norm text;
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
    IF NEW.secretaria_id IS NULL OR v_assunto_norm = ANY(v_saude_triagem) THEN
      NEW.triagem_pendente := true;
    ELSE
      NEW.triagem_pendente := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;