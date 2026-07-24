
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS grok_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_api_key text,
  ADD COLUMN IF NOT EXISTS grok_model text,
  ADD COLUMN IF NOT EXISTS gemini_model text,
  ADD COLUMN IF NOT EXISTS lovable_model text,
  ADD COLUMN IF NOT EXISTS priority text[] NOT NULL DEFAULT ARRAY['lovable','gemini','grok'];

-- Migrate legacy fields
UPDATE public.ai_config
SET gemini_api_key = COALESCE(gemini_api_key, CASE WHEN provider = 'gemini' THEN api_key END),
    gemini_model   = COALESCE(gemini_model,   CASE WHEN provider = 'gemini' THEN model END),
    lovable_model  = COALESCE(lovable_model,  CASE WHEN provider = 'lovable' THEN model END),
    priority = CASE
      WHEN provider = 'gemini' THEN ARRAY['gemini','lovable','grok']
      ELSE ARRAY['lovable','gemini','grok']
    END
WHERE id = true;
