
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own or admin sees all" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allowed emails (whitelist)
CREATE TABLE public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  nome TEXT,
  role public.app_role NOT NULL DEFAULT 'user',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage allowed emails" ON public.allowed_emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_allowed_emails_updated_at BEFORE UPDATE ON public.allowed_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: existing users become admins and are whitelisted
INSERT INTO public.allowed_emails (email, nome, role) VALUES
  ('anderdonenator@gmail.com', 'Administrador', 'admin'),
  ('setamonitoramento75@gmail.com', 'Administrador', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email IN ('anderdonenator@gmail.com', 'setamonitoramento75@gmail.com')
ON CONFLICT DO NOTHING;

-- Replace handle_new_user: enforce allowlist + create role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed public.allowed_emails%ROWTYPE;
BEGIN
  SELECT * INTO v_allowed FROM public.allowed_emails WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF v_allowed.id IS NULL THEN
    RAISE EXCEPTION 'Email % nao autorizado a acessar o sistema', NEW.email;
  END IF;
  INSERT INTO public.profiles (id, nome, email) VALUES (
    NEW.id,
    COALESCE(v_allowed.nome, NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_allowed.role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Enable pg_cron + pg_net (for scheduled sync)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
