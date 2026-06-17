
-- Add fields for public ouvidoria submissions
ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS sigilo text NOT NULL DEFAULT 'publico',
  ADD COLUMN IF NOT EXISTS contato_solicitante text;

-- Validate sigilo values via trigger (avoid CHECK constraint on time/data dependent rules is unnecessary here, but using trigger keeps consistent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'protocolos_sigilo_check'
  ) THEN
    ALTER TABLE public.protocolos
      ADD CONSTRAINT protocolos_sigilo_check
      CHECK (sigilo IN ('publico','sigiloso','anonimo'));
  END IF;
END $$;

-- Allow anonymous citizens to insert ouvidoria from the public page
CREATE POLICY "Anon pode registrar ouvidoria publica"
  ON public.protocolos
  FOR INSERT
  TO anon
  WITH CHECK (
    tipo = 'ouvidoria'
    AND status = 'aberto'
    AND created_by IS NULL
    AND origem IS NOT NULL
  );

GRANT INSERT ON public.protocolos TO anon;

-- Allow anon to read secretarias and locais for the public form dropdowns (safe public data)
CREATE POLICY "Anon le secretarias publicas"
  ON public.secretarias FOR SELECT TO anon USING (true);

CREATE POLICY "Anon le locais publicos"
  ON public.locais FOR SELECT TO anon USING (true);

GRANT SELECT ON public.secretarias TO anon;
GRANT SELECT ON public.locais TO anon;
