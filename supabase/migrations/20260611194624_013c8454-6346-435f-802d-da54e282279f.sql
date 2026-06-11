CREATE OR REPLACE FUNCTION public.apply_protocolo_descricoes(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer := 0;
BEGIN
  WITH src AS (
    SELECT (elem->>'numero')::text AS numero, (elem->>'descricao')::text AS descricao
    FROM jsonb_array_elements(payload) AS elem
  ), upd AS (
    UPDATE public.protocolos p
    SET descricao = s.descricao
    FROM src s
    WHERE p.numero = s.numero
    RETURNING 1
  )
  SELECT count(*) INTO cnt FROM upd;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_protocolo_descricoes(jsonb) TO sandbox_exec, service_role;