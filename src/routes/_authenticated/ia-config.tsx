import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
                Opcional. Deixe em branco para usar o padrão (<code>{defaultModel}</code>).
                {provider === "gemini"
                  ? " Exemplos: gemini-2.5-flash, gemini-2.5-pro."
                  : " Exemplos: google/gemini-2.5-flash, google/gemini-2.5-pro, openai/gpt-5-mini."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={defaultModel} />
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