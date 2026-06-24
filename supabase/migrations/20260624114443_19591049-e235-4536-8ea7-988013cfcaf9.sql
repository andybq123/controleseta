ALTER TABLE public.protocolos
  DROP CONSTRAINT IF EXISTS protocolos_triagem_lock_por_fkey,
  ADD CONSTRAINT protocolos_triagem_lock_por_fkey
    FOREIGN KEY (triagem_lock_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.protocolos
  DROP CONSTRAINT IF EXISTS protocolos_triagem_concluida_por_fkey,
  ADD CONSTRAINT protocolos_triagem_concluida_por_fkey
    FOREIGN KEY (triagem_concluida_por) REFERENCES public.profiles(id) ON DELETE SET NULL;