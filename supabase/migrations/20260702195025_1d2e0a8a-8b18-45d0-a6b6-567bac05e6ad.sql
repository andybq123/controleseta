ALTER TABLE public.protocolos ALTER COLUMN status SET DEFAULT 'em_andamento'::protocolo_status;
UPDATE public.protocolos SET status = 'em_andamento' WHERE status = 'aberto';