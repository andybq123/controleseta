import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, KeyRound, CheckCircle2, AlertCircle, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { getAiConfig, saveAiConfig, testAiConfig } from "@/lib/ai-config.functions";

export const Route = createFileRoute("/_authenticated/ia-config")({
  head: () => ({
    meta: [
      { title: "Configuração de IA" },
      { name: "description", content: "Defina a ordem de prioridade entre Grok, Gemini e Lovable AI." },
    ],
  }),
  component: IAConfigPage,
});

type Prov = "grok" | "gemini" | "lovable";
const LABELS: Record<Prov, string> = { grok: "Grok (xAI)", gemini: "Google Gemini", lovable: "Lovable AI" };

function IAConfigPage() {
  const qc = useQueryClient();
  const getCfg = useServerFn(getAiConfig);
  const saveCfg = useServerFn(saveAiConfig);
  const testCfg = useServerFn(testAiConfig);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => getCfg({}),
  });

  const [priority, setPriority] = useState<Prov[]>(["lovable", "gemini", "grok"]);
  const [grokKey, setGrokKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [grokModel, setGrokModel] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [lovableModel, setLovableModel] = useState("");

  useEffect(() => {
    if (data) {
      setPriority(data.priority as Prov[]);
      setGrokModel(data.grok?.model ?? "");
      setGeminiModel(data.gemini?.model ?? "");
      setLovableModel(data.lovable?.model ?? "");
    }
  }, [data]);

  const mSave = useMutation({
    mutationFn: (opts: { clearGrokKey?: boolean; clearGeminiKey?: boolean }) =>
      saveCfg({
        data: {
          priority,
          grokApiKey: grokKey || undefined,
          clearGrokKey: opts.clearGrokKey,
          grokModel: grokModel || undefined,
          geminiApiKey: geminiKey || undefined,
          clearGeminiKey: opts.clearGeminiKey,
          geminiModel: geminiModel || undefined,
          lovableModel: lovableModel || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      setGrokKey("");
      setGeminiKey("");
      qc.invalidateQueries({ queryKey: ["ai-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const mTest = useMutation({
    mutationFn: () => testCfg({}),
    onSuccess: (r: any) => toast.success(`IA respondeu: ${r?.reply || "OK"}`),
    onError: (e: any) => toast.error(e?.message ?? "Falha no teste"),
  });

  const MODEL_OPTIONS: Record<Prov, { value: string; label: string; hint?: string }[]> = {
    grok: [
      { value: "grok-4-fast", label: "Grok 4 Fast", hint: "Rápido, custo/qualidade" },
      { value: "grok-4", label: "Grok 4" },
      { value: "grok-3-mini", label: "Grok 3 Mini" },
      { value: "grok-2-latest", label: "Grok 2 Latest" },
    ],
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

  const defaults: Record<Prov, string> = {
    grok: "grok-4-fast",
    gemini: "gemini-2.5-flash",
    lovable: "google/gemini-2.5-flash",
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= priority.length) return;
    const next = [...priority];
    [next[i], next[j]] = [next[j], next[i]];
    setPriority(next);
  };

  const renderModelSelect = (p: Prov, value: string, onChange: (v: string) => void) => {
    const options = MODEL_OPTIONS[p];
    const selectValue = value && options.some((o) => o.value === value) ? value : "__default__";
    return (
      <div className="space-y-2">
        <Select value={selectValue} onValueChange={(v) => onChange(v === "__default__" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Padrão ({defaults[p]})</SelectItem>
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
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={defaults[p]} />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> Configuração de IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina a ordem de prioridade entre os provedores. O sistema tenta o primeiro; se falhar,
          faz fallback para o próximo automaticamente.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ordem de prioridade (fallback)</CardTitle>
              <CardDescription>
                Use as setas para reordenar. Ex.: Grok principal → fallback Gemini → fallback Lovable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {priority.map((p, i) => (
                <div key={p} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{LABELS[p]}</span>
                    {i === 0 && <span className="text-xs text-muted-foreground">principal</span>}
                    {i > 0 && <span className="text-xs text-muted-foreground">fallback</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => move(i, 1)} disabled={i === priority.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Grok (xAI)</CardTitle>
              <CardDescription>
                API key em{" "}
                <a className="underline" href="https://console.x.ai/" target="_blank" rel="noreferrer">console.x.ai</a>.
                Armazenada apenas no backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.grok?.hasKey ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Chave configurada</AlertTitle>
                  <AlertDescription>
                    Atual: <code>{data.grok.apiKeyMasked}</code>. Preencha para substituir ou remova.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhuma chave configurada</AlertTitle>
                  <AlertDescription>Cadastre uma API key para usar o Grok.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label>Nova API key</Label>
                <Input type="password" autoComplete="off" value={grokKey} onChange={(e) => setGrokKey(e.target.value)} placeholder="xai-..." />
              </div>
              {data?.grok?.hasKey && (
                <Button variant="outline" size="sm" onClick={() => mSave.mutate({ clearGrokKey: true })} disabled={mSave.isPending}>
                  Remover chave atual
                </Button>
              )}
              <div className="pt-2">
                <Label className="mb-1 block">Modelo Grok</Label>
                {renderModelSelect("grok", grokModel, setGrokModel)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Google Gemini</CardTitle>
              <CardDescription>
                API key em{" "}
                <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/app/apikey
                </a>. Armazenada apenas no backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.gemini?.hasKey ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Chave configurada</AlertTitle>
                  <AlertDescription>
                    Atual: <code>{data.gemini.apiKeyMasked}</code>. Preencha para substituir ou remova.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhuma chave configurada</AlertTitle>
                  <AlertDescription>Cadastre uma API key para usar o Gemini direto.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label>Nova API key</Label>
                <Input type="password" autoComplete="off" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." />
              </div>
              {data?.gemini?.hasKey && (
                <Button variant="outline" size="sm" onClick={() => mSave.mutate({ clearGeminiKey: true })} disabled={mSave.isPending}>
                  Remover chave atual
                </Button>
              )}
              <div className="pt-2">
                <Label className="mb-1 block">Modelo Gemini</Label>
                {renderModelSelect("gemini", geminiModel, setGeminiModel)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lovable AI</CardTitle>
              <CardDescription>Não requer API key; usa os créditos do workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label className="mb-1 block">Modelo Lovable</Label>
              {renderModelSelect("lovable", lovableModel, setLovableModel)}
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