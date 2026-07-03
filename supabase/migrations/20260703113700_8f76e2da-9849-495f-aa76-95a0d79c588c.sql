
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_protocolo_changes() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stamp_triagem_conclusao() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.liberar_triagem(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.concluir_triagem(uuid, uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_triagem_para_ouvidoria() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_admin_user_roles() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_admin_role() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reservar_triagem(uuid) FROM anon, PUBLIC;
