
ALTER TABLE public.locais
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

UPDATE public.locais SET latitude=-27.14451, longitude=-48.90327 WHERE id='1a62f36d-de36-4607-9284-753fc493c066';
UPDATE public.locais SET latitude=-27.10651, longitude=-48.91755 WHERE id='c055d715-e14c-4a3e-a3b9-a04ab5e4ec72';
UPDATE public.locais SET latitude=-27.04552, longitude=-48.89299 WHERE id='b104a9ed-0efa-46ad-bc5e-e37184416fb5';
UPDATE public.locais SET latitude=-27.15098, longitude=-48.92665 WHERE id='4df27dbd-6074-4d98-943c-f60837708947';
UPDATE public.locais SET latitude=-27.14659, longitude=-48.96102 WHERE id='8c0c4a81-57ed-4542-89a9-674f54a752fa';
UPDATE public.locais SET latitude=-27.05230, longitude=-48.88049 WHERE id='90eb831a-0b0e-46ce-afd6-e7dc72557871';
UPDATE public.locais SET latitude=-27.10455, longitude=-48.94298 WHERE id='5d2a135c-d512-4bbf-b259-49f442770f3a';
UPDATE public.locais SET latitude=-27.07897, longitude=-48.86158 WHERE id='de88e29e-6974-4c24-94e5-1dca6f0b4b85';
UPDATE public.locais SET latitude=-27.10882, longitude=-48.85265 WHERE id='64b1d7af-14de-4efd-ae7c-718c33913576';
UPDATE public.locais SET latitude=-27.08311, longitude=-48.89206 WHERE id='8f10b703-adb9-4e02-954a-e5dbaf5bcabd';
UPDATE public.locais SET latitude=-27.14067, longitude=-48.92083 WHERE id='90b12e06-4932-4b6b-ab48-2552d0b08869';
UPDATE public.locais SET latitude=-27.04944, longitude=-48.86873 WHERE id='fd366b43-f8a3-454a-a78e-eb2ba842fc92';
UPDATE public.locais SET latitude=-27.12570, longitude=-48.87522 WHERE id='aff58fb8-e6c1-449a-bd4c-aa07d8885268';
UPDATE public.locais SET latitude=-27.14757, longitude=-48.88048 WHERE id='74601c8f-ff14-443f-a84f-57ba7ac7eda1';
UPDATE public.locais SET latitude=-27.12274, longitude=-48.94991 WHERE id='07958fd1-3ff2-47ef-ab9b-c23cd0dcef99';
UPDATE public.locais SET latitude=-27.15999, longitude=-48.89339 WHERE id='614370f7-0fa2-4169-ac15-99467077394e';
UPDATE public.locais SET latitude=-27.07980, longitude=-48.89869 WHERE id='0d5a4b1c-c23a-4b1b-831c-f7e560e19b38';
UPDATE public.locais SET latitude=-27.07553, longitude=-48.88863 WHERE id='ededc5f1-e436-41f3-9ef7-feec88744a4a';
UPDATE public.locais SET latitude=-27.16941, longitude=-48.96027 WHERE id='9574d9b4-9465-4a28-9cc3-3b5a4a69409a';
UPDATE public.locais SET latitude=-27.08087, longitude=-48.91640 WHERE id='0286eb51-6b96-4605-94d1-d31a4e27b8d7';
UPDATE public.locais SET latitude=-27.07288, longitude=-48.93773 WHERE id='b9260996-9e89-494a-83fd-338b8dc0e76f';
UPDATE public.locais SET latitude=-27.10654, longitude=-48.92275 WHERE id='d75ae071-57b3-4860-9958-cd07d62671f9';
UPDATE public.locais SET latitude=-27.07411, longitude=-48.90533 WHERE id='7b9b0749-1f5c-4bc5-bc06-54ab2895f51f';
UPDATE public.locais SET latitude=-27.02247, longitude=-48.88487 WHERE id='cb555077-0fed-48fc-a21a-8ef0c3c88bfb';
UPDATE public.locais SET latitude=-27.16431, longitude=-48.90771 WHERE id='dec313f6-ca4c-452c-bf21-c982f560af38';
