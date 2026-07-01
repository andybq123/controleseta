-- Todos os usuários do sistema devem ser admin. Força role admin em allowed_emails e user_roles.
CREATE OR REPLACE FUNCTION public.force_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.role := 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_admin_allowed_emails ON public.allowed_emails;
CREATE TRIGGER trg_force_admin_allowed_emails
BEFORE INSERT OR UPDATE ON public.allowed_emails
FOR EACH ROW EXECUTE FUNCTION public.force_admin_role();

CREATE OR REPLACE FUNCTION public.force_admin_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.role := 'admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_admin_user_roles ON public.user_roles;
CREATE TRIGGER trg_force_admin_user_roles
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.force_admin_user_roles();

-- Normaliza qualquer registro existente que porventura não seja admin.
UPDATE public.allowed_emails SET role = 'admin' WHERE role <> 'admin';
UPDATE public.user_roles SET role = 'admin' WHERE role <> 'admin';

-- Garante user_role admin para todo allowed_email que já tenha auth.user.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
JOIN public.allowed_emails ae ON lower(ae.email) = lower(u.email)
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
WHERE ur.user_id IS NULL;

REVOKE EXECUTE ON FUNCTION public.force_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.force_admin_user_roles() FROM PUBLIC, anon, authenticated;