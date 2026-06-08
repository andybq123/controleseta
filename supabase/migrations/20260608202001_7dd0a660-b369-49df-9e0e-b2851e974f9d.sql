
-- ENUMS
CREATE TYPE public.protocolo_tipo AS ENUM ('ouvidoria', 'lai');
CREATE TYPE public.protocolo_status AS ENUM ('aberto', 'em_andamento', 'concluido');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados leem perfis" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuario edita seu proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuario insere seu proprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SECRETARIAS
CREATE TABLE public.secretarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sigla TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secretarias TO authenticated;
GRANT ALL ON public.secretarias TO service_role;
ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam secretarias" ON public.secretarias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_secretarias_updated_at BEFORE UPDATE ON public.secretarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RESPONSAVEIS
CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT ALL ON public.responsaveis TO service_role;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam responsaveis" ON public.responsaveis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_responsaveis_updated_at BEFORE UPDATE ON public.responsaveis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROTOCOLOS
CREATE TABLE public.protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  tipo public.protocolo_tipo NOT NULL,
  assunto TEXT NOT NULL,
  descricao TEXT,
  status public.protocolo_status NOT NULL DEFAULT 'aberto',
  secretaria_id UUID REFERENCES public.secretarias(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  solicitante TEXT,
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  prorrogado BOOLEAN NOT NULL DEFAULT false,
  data_prorrogacao DATE,
  data_conclusao DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolos TO authenticated;
GRANT ALL ON public.protocolos TO service_role;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam protocolos" ON public.protocolos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_protocolos_updated_at BEFORE UPDATE ON public.protocolos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_protocolos_status ON public.protocolos(status);
CREATE INDEX idx_protocolos_secretaria ON public.protocolos(secretaria_id);
CREATE INDEX idx_protocolos_tipo ON public.protocolos(tipo);
