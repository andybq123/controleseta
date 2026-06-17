CREATE POLICY "Anyone can submit ouvidoria from public form"
ON public.protocolos FOR INSERT
TO anon, authenticated
WITH CHECK (
  tipo = 'ouvidoria'
  AND origem = 'Site - Ouvidoria Pública'
  AND created_by IS NULL
);

GRANT INSERT ON public.protocolos TO anon;