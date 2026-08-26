import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { AppSettings } from "../lib/types";
import { Button, Card, Field, Input, Toggle } from "../components/ui";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    api<AppSettings>("/settings").then(setSettings);
  }, []);

  if (!settings) return <p className="text-slate-400">Carregando...</p>;

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api<AppSettings>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setMessage("Configurações salvas com sucesso.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setChangingPassword(true);
    setAccountMessage(null);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setAccountMessage("Senha alterada com sucesso.");
    } catch (err) {
      setAccountMessage(err instanceof ApiError ? err.message : "Erro ao trocar senha.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function testWhatsApp() {
    setTesting(true);
    setMessage(null);
    try {
      await api("/settings/test-whatsapp", { method: "POST" });
      setMessage("Mensagem de teste enviada! Confira o grupo do WhatsApp.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Erro ao enviar teste.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Configurações</h2>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      {message && <Card className="border-brand-500/40 bg-brand-500/10 text-sm text-brand-400">{message}</Card>}

      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-200">Mercado Livre</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Site (país)">
            <Input
              value={settings.ml.site}
              onChange={(e) => setSettings({ ...settings, ml: { ...settings.ml, site: e.target.value } })}
              placeholder="MLB (Brasil)"
            />
          </Field>
          <Field label="Desconto mínimo (%)">
            <Input
              type="number"
              value={settings.ml.minDiscountPercent}
              onChange={(e) =>
                setSettings({ ...settings, ml: { ...settings.ml, minDiscountPercent: Number(e.target.value) } })
              }
            />
          </Field>
          <Field label="Preço mínimo (R$, opcional)">
            <Input
              type="number"
              value={settings.ml.minPrice ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ml: { ...settings.ml, minPrice: e.target.value === "" ? null : Number(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Preço máximo (R$, opcional)">
            <Input
              type="number"
              value={settings.ml.maxPrice ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ml: { ...settings.ml, maxPrice: e.target.value === "" ? null : Number(e.target.value) },
                })
              }
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold text-slate-200">Link de afiliado</h3>
        <p className="mb-4 text-sm text-slate-500">
          Obtenha esses valores na Central de Afiliados do Mercado Livre. Se deixados em branco, o link do produto
          é enviado sem parâmetros de afiliado.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="matt_word">
            <Input
              value={settings.ml.affiliateMattWord}
              onChange={(e) => setSettings({ ...settings, ml: { ...settings.ml, affiliateMattWord: e.target.value } })}
            />
          </Field>
          <Field label="matt_tool">
            <Input
              value={settings.ml.affiliateMattTool}
              onChange={(e) => setSettings({ ...settings, ml: { ...settings.ml, affiliateMattTool: e.target.value } })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-200">Agendamento</h3>
        <div className="mb-4 flex items-center gap-3">
          <Toggle
            checked={settings.schedule.enabled}
            onChange={(value) => setSettings({ ...settings, schedule: { ...settings.schedule, enabled: value } })}
          />
          <span className="text-sm text-slate-300">Automação ativa</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expressão cron">
            <Input
              value={settings.schedule.cron}
              onChange={(e) => setSettings({ ...settings, schedule: { ...settings.schedule, cron: e.target.value } })}
              placeholder="*/30 * * * *"
            />
          </Field>
          <Field label="Máx. produtos por execução">
            <Input
              type="number"
              value={settings.schedule.maxProductsPerRun}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  schedule: { ...settings.schedule, maxProductsPerRun: Number(e.target.value) },
                })
              }
            />
          </Field>
          <Field label="Início do silêncio (HH:MM, opcional)">
            <Input
              value={settings.schedule.quietStart ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  schedule: { ...settings.schedule, quietStart: e.target.value || null },
                })
              }
              placeholder="22:00"
            />
          </Field>
          <Field label="Fim do silêncio (HH:MM, opcional)">
            <Input
              value={settings.schedule.quietEnd ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  schedule: { ...settings.schedule, quietEnd: e.target.value || null },
                })
              }
              placeholder="07:00"
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Exemplos de expressão cron: <code>*/30 * * * *</code> (a cada 30 min), <code>0 * * * *</code> (a cada
          hora), <code>0 9-22/2 * * *</code> (a cada 2h, das 9h às 22h).
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-200">Evolution API (WhatsApp)</h3>
          <Button variant="secondary" onClick={testWhatsApp} disabled={testing}>
            {testing ? "Enviando..." : "Enviar mensagem de teste"}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="URL base da Evolution API">
            <Input
              value={settings.evolution.baseUrl}
              onChange={(e) =>
                setSettings({ ...settings, evolution: { ...settings.evolution, baseUrl: e.target.value } })
              }
              placeholder="https://sua-evolution-api.com"
            />
          </Field>
          <Field label="API Key">
            <Input
              type="password"
              value={settings.evolution.apiKey}
              onChange={(e) =>
                setSettings({ ...settings, evolution: { ...settings.evolution, apiKey: e.target.value } })
              }
            />
          </Field>
          <Field label="Nome da instância">
            <Input
              value={settings.evolution.instance}
              onChange={(e) =>
                setSettings({ ...settings, evolution: { ...settings.evolution, instance: e.target.value } })
              }
            />
          </Field>
          <Field label="ID do grupo (JID)">
            <Input
              value={settings.evolution.groupJid}
              onChange={(e) =>
                setSettings({ ...settings, evolution: { ...settings.evolution, groupJid: e.target.value } })
              }
              placeholder="120363000000000000@g.us"
            />
          </Field>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Toggle
            checked={settings.evolution.sendImage}
            onChange={(value) =>
              setSettings({ ...settings, evolution: { ...settings.evolution, sendImage: value } })
            }
          />
          <span className="text-sm text-slate-300">Enviar imagem do produto junto com a mensagem</span>
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-semibold text-slate-200">Modelo de mensagem</h3>
        <p className="mb-4 text-sm text-slate-500">
          Placeholders disponíveis: <code>{"{titulo}"}</code> <code>{"{preco}"}</code>{" "}
          <code>{"{preco_original}"}</code> <code>{"{desconto}"}</code> <code>{"{link}"}</code>{" "}
          <code>{"{imagem}"}</code>
        </p>
        <textarea
          className="h-40 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-brand-500"
          value={settings.message.template}
          onChange={(e) => setSettings({ ...settings, message: { template: e.target.value } })}
        />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-200">Conta</h3>
        {accountMessage && <p className="mb-3 text-sm text-brand-400">{accountMessage}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Senha atual">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="Nova senha">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="secondary"
          onClick={changePassword}
          disabled={changingPassword || !currentPassword || newPassword.length < 6}
        >
          {changingPassword ? "Salvando..." : "Trocar senha"}
        </Button>
      </Card>
    </div>
  );
}
