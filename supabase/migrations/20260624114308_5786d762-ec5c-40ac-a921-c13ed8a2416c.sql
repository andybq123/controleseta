-- Lock columns
ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS triagem_lock_por uuid,
  ADD COLUMN IF NOT EXISTS triagem_lock_em timestamptz;

-- ============ Reservar triagem ============
CREATE OR REPLACE FUNCTION public.reservar_triagem(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lock_expira interval := interval '10 minutes';
  v_updated record;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'unauth');
  END IF;

  UPDATE public.protocolos
  SET triagem_lock_por = v_uid,
      triagem_lock_em  = now()
  WHERE id = p_id
    AND triagem_pendente = true
    AND ( triagem_lock_por IS NULL
       OR triagem_lock_por = v_uid
       OR triagem_lock_em < now() - v_lock_expira )
  RETURNING id, triagem_lock_em INTO v_updated;

  IF v_updated.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'lock_em', v_updated.triagem_lock_em);
  END IF;

  SELECT p.triagem_pendente, p.triagem_lock_por, p.triagem_lock_em,
         p.triagem_concluida_por, p.triagem_concluida_em,
         COALESCE(pl.nome, 'outro usuário')  AS lock_nome,
         COALESCE(pc.nome, 'outro usuário')  AS concluida_nome
    INTO v_row
  FROM public.protocolos p
  LEFT JOIN public.profiles pl ON pl.id = p.triagem_lock_por
  LEFT JOIN public.profiles pc ON pc.id = p.triagem_concluida_por
  WHERE p.id = p_id;

  IF v_row.triagem_pendente = false THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'concluida',
      'por', v_row.concluida_nome, 'em', v_row.triagem_concluida_em);
  END IF;
  RETURN jsonb_build_object('ok', false, 'motivo', 'reservada',
    'por', v_row.lock_nome, 'em', v_row.triagem_lock_em);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reservar_triagem(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reservar_triagem(uuid) FROM anon, public;

-- ============ Liberar triagem ============
CREATE OR REPLACE FUNCTION public.liberar_triagem(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.protocolos
  SET triagem_lock_por = NULL, triagem_lock_em = NULL
  WHERE id = p_id
    AND (triagem_lock_por = auth.uid()
      OR public.has_role(auth.uid(), 'admin'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.liberar_triagem(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.liberar_triagem(uuid) FROM anon, public;

-- ============ Concluir triagem (atômico) ============
CREATE OR REPLACE FUNCTION public.concluir_triagem(
  p_id uuid,
  p_secretaria uuid,
  p_local uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lock_expira interval := interval '10 minutes';
  v_updated record;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'unauth');
  END IF;
  IF p_secretaria IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_secretaria');
  END IF;

  UPDATE public.protocolos
  SET secretaria_id     = p_secretaria,
      local_id          = p_local,
      triagem_pendente  = false,
      triagem_lock_por  = NULL,
      triagem_lock_em   = NULL
  WHERE id = p_id
    AND triagem_pendente = true
    AND ( triagem_lock_por IS NULL
       OR triagem_lock_por = v_uid
       OR triagem_lock_em < now() - v_lock_expira )
  RETURNING id INTO v_updated;

  IF v_updated.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT p.triagem_pendente, p.triagem_lock_em, p.triagem_concluida_em,
         COALESCE(pl.nome, 'outro usuário') AS lock_nome,
         COALESCE(pc.nome, 'outro usuário') AS concluida_nome
    INTO v_row
  FROM public.protocolos p
  LEFT JOIN public.profiles pl ON pl.id = p.triagem_lock_por
  LEFT JOIN public.profiles pc ON pc.id = p.triagem_concluida_por
  WHERE p.id = p_id;

  IF NOT v_row.triagem_pendente THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'concluida',
      'por', v_row.concluida_nome, 'em', v_row.triagem_concluida_em);
  END IF;
  RETURN jsonb_build_object('ok', false, 'motivo', 'reservada',
    'por', v_row.lock_nome, 'em', v_row.triagem_lock_em);
END;
$$;

GRANT EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) FROM anon, public;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.protocolos;