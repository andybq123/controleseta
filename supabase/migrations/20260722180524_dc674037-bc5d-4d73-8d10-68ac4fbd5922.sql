
CREATE TABLE public.ai_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  provider TEXT NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','gemini')),
  api_key TEXT,
  model TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

INSERT INTO public.ai_config (id, provider) VALUES (true, 'lovable') ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config TO authenticated;
GRANT ALL ON public.ai_config TO service_role;

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_config"
ON public.ai_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
