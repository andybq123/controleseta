ALTER TABLE public.coletas
  ADD COLUMN IF NOT EXISTS atualizados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ja_concluidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sem_correspondencia integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ignorados_detalhes jsonb NOT NULL DEFAULT '[]'::jsonb;