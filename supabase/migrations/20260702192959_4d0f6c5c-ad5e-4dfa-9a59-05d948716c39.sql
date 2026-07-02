ALTER TABLE public.protocolos REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'protocolos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.protocolos;
  END IF;
END $$;