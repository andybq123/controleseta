DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE numero = '2.078/2026') THEN
    UPDATE public.protocolos SET numero = '2.078/2026' WHERE numero = '5.602/2026';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.protocolos WHERE numero = '2.084/2026') THEN
    UPDATE public.protocolos SET numero = '2.084/2026' WHERE numero = '6.971/2026';
  END IF;
END $$;