import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar essa ação");
}

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: e1 } = await supabaseAdmin
      .from("allowed_emails")
      .select("*")
      .order("created_at", { ascending: false });
    if (e1) throw new Error(e1.message);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const usersByEmail = new Map<string, any>();
    (list?.users ?? []).forEach(u => {
      if (u.email) usersByEmail.set(u.email.toLowerCase(), u);
    });

    return (allowed ?? []).map(a => {
      const u = usersByEmail.get(a.email.toLowerCase());
      return {
        ...a,
        registered: !!u,
        last_sign_in_at: u?.last_sign_in_at ?? null,
        auth_user_id: u?.id ?? null,
      };
    });
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; nome?: string; role: "admin" | "user"; senha?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: errIns } = await supabaseAdmin
      .from("allowed_emails")
      .insert({ email, nome: data.nome ?? null, role: data.role, created_by: context.userId });
    if (errIns && !errIns.message.includes("duplicate")) throw new Error(errIns.message);

    if (data.senha && data.senha.length >= 6) {
      const { data: created, error: errUser } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.senha,
        email_confirm: true,
        user_metadata: { nome: data.nome ?? "" },
      });
      if (errUser && !String(errUser.message).toLowerCase().includes("already")) {
        throw new Error(errUser.message);
      }
      if (created?.user) {
        await supabaseAdmin.from("user_roles")
          .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });
      }
    }
    return { ok: true };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; nome?: string; role: "admin" | "user"; novaSenha?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allowed, error: e1 } = await supabaseAdmin
      .from("allowed_emails").select("*").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabaseAdmin
      .from("allowed_emails")
      .update({ nome: data.nome ?? null, role: data.role })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const u = (list?.users ?? []).find(x => x.email?.toLowerCase() === allowed.email.toLowerCase());
    if (u) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", u.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: u.id, role: data.role });
      if (data.novaSenha && data.novaSenha.length >= 6) {
        await supabaseAdmin.auth.admin.updateUserById(u.id, { password: data.novaSenha });
      }
    }
    return { ok: true };
  });

export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allowed } = await supabaseAdmin
      .from("allowed_emails").select("email").eq("id", data.id).single();

    await supabaseAdmin.from("allowed_emails").delete().eq("id", data.id);

    if (allowed?.email) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const u = (list?.users ?? []).find(x => x.email?.toLowerCase() === allowed.email.toLowerCase());
      if (u) await supabaseAdmin.auth.admin.deleteUser(u.id);
    }
    return { ok: true };
  });