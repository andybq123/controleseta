import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getAiConfig, saveAiConfig, testAiConfig } from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/ia-config")({
  head: () => ({
    meta: [
      { title: "Configuração de IA" },
      { name: "description", content: "Escolha entre a IA da Lovable ou uma IA externa como o Gemini." },
    ],
  }),
  component: IAConfigPage,
});

function IAConfigPage() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getAiConfig);
  const saveCfg = useServerFn(saveAiConfig);
  const testCfg = useServerFn(testAiConfig);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => getCfg({}),
  });

  const [provider, setProvider] = useState<"lovable" | "gemini">("lovable");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setModel(data.model ?? "");
    }
  }, [data]);

  const mSave = useMutation({
    mutationFn: (opts: { clearKey?: boolean }) =>
      saveCfg({ data: { provider, apiKey: apiKey || undefined, clearKey: opts.clearKey, model: model || undefined } }),
    onSuccess: () => {
      toast.success("Configuração salva");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["ai-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const mTest = useMutation({
    mutationFn: () => testCfg({}),
    onSuccess: (r: any) => toast.success(`IA respondeu: ${r?.reply || "OK"}`),
    onError: (e: any) => toast.error(e?.message ?? "Falha no teste"),
  });

  const defaultModel = provider === "gemini" ? "gemini-2.5-flash" : "google/gemini-2.5-flash";

  const MODEL_OPTIONS: Record<"lovable" | "gemini", { value: string; label: string; hint?: string }[]> = {
    lovable: [
      { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Mais capaz, raciocínio complexo" },
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Equilíbrio custo/qualidade (padrão)" },
      { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", hint: "Mais rápido e barato" },
      { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", hint: "Próxima geração — raciocínio" },
      { value: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash", hint: "Última geração Flash" },
      { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", hint: "Rápido e eficiente" },
      { value: "openai/gpt-5", label: "GPT-5", hint: "OpenAI — all-rounder" },
      { value: "openai/gpt-5-mini", label: "GPT-5 Mini", hint: "OpenAI — custo menor" },
      { value: "openai/gpt-5-nano", label: "GPT-5 Nano", hint: "OpenAI — mais rápido" },
      { value: "openai/gpt-5.4", label: "GPT-5.4", hint: "OpenAI — geração atual" },
      { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { value: "openai/gpt-5.5", label: "GPT-5.5", hint: "OpenAI — frontier" },
    ],
    gemini: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Mais capaz" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Padrão recomendado" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", hint: "Mais rápido/barato" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
    ],
  };
  const options = MODEL_OPTIONS[provider];
  const selectValue = model && options.some((o) => o.value === model) ? model : "__default__";

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> Configuração de IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha qual provedor de IA o sistema deve usar em toda a aplicação (triagem automática,
          extração de protocolos, geocodificação, sugestões e relatórios).
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Provedor</CardTitle>
              <CardDescription>
                Selecione qual serviço será utilizado. A troca é imediata para todos os fluxos que usam IA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={provider} onValueChange={(v) => setProvider(v as "lovable" | "gemini")}>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="lovable" id="p-lov" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">Lovable AI (recomendado)</div>
                    <p className="text-xs text-muted-foreground">
                      Usa o gateway da Lovable. Não requer API key; o custo é abatido dos créditos do workspace.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="gemini" id="p-gem" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">Google Gemini (API externa)</div>
                    <p className="text-xs text-muted-foreground">
                      Usa diretamente a API do Google Gemini. Requer uma API key obtida em{" "}
                      <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                        aistudio.google.com/app/apikey
                      </a>.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>

          {provider === "gemini" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> API Key do Gemini</CardTitle>
                <CardDescription>
                  A chave é armazenada apenas no backend e nunca é exposta ao navegador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.hasKey ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Chave configurada</AlertTitle>
                    <AlertDescription>
                      Atual: <code>{data.apiKeyMasked}</code>. Preencha abaixo para substituir, ou remova.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Nenhuma chave configurada</AlertTitle>
                    <AlertDescription>Cadastre uma API key para usar o Gemini.</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label>Nova API key</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                  />
                </div>
                {data?.hasKey && (
                  <Button variant="outline" size="sm" onClick={() => mSave.mutate({ clearKey: true })} disabled={mSave.isPending}>
                    Remover chave atual
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Modelo</CardTitle>
              <CardDescription>
                Escolha o modelo usado em todos os fluxos de IA. Selecione "Padrão" para
                usar automaticamente <code>{defaultModel}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={selectValue}
                onValueChange={(v) => setModel(v === "__default__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Padrão ({defaultModel})</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="font-medium">{o.label}</span>
                      {o.hint && <span className="text-muted-foreground"> — {o.hint}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ou informe um ID customizado</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={defaultModel}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={() => mSave.mutate({})} disabled={mSave.isPending}>
              {mSave.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
            <Button variant="outline" onClick={() => mTest.mutate()} disabled={mTest.isPending}>
              {mTest.isPending ? "Testando…" : "Testar conexão"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}