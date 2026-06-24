import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Eye, EyeOff, Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { getColetorInfo } from "@/lib/coletor.functions";

export const Route = createFileRoute("/_authenticated/coletor")({
  component: ColetorPage,
});

function ColetorPage() {
  const fetchInfo = useServerFn(getColetorInfo);
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["coletor-info"],
    queryFn: () => fetchInfo(),
  });
  const [revelarToken, setRevelarToken] = useState(false);

  function copiar(valor: string, label: string) {
    navigator.clipboard.writeText(valor).then(
      () => toast.success(`${label} copiado`),
      () => toast.error(`Não foi possível copiar ${label}`),
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {msg.toLowerCase().includes("forbidden")
              ? "Apenas administradores podem acessar o Coletor 1doc."
              : `Erro ao carregar: ${msg}`}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data) return null;

  const tokenMascarado = data.token ? `${data.token.slice(0, 6)}${"•".repeat(20)}` : "(não configurado)";
  const endpointIngest = `${data.backendUrl}/api/public/ingest-protocolos`;
  const endpointCheck = `${data.backendUrl}/api/public/check-protocolos`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coletor 1doc</h1>
          <p className="text-sm text-muted-foreground">
            Extensão de navegador que coleta protocolos arquivados do 1doc e envia para este painel.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Total coletado</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.totalColetado}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Novos hoje</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{data.novosHoje}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Última execução</CardTitle>
          </CardHeader>
          <CardContent className="text-base">
            {data.ultimaColeta
              ? new Date(data.ultimaColeta).toLocaleString("pt-BR")
              : <span className="text-muted-foreground">Nunca</span>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="URL do backend"
            value={data.backendUrl}
            onCopy={() => copiar(data.backendUrl, "URL")}
          />
          <Field
            label="Token (INGEST_TOKEN)"
            value={revelarToken ? data.token : tokenMascarado}
            onCopy={() => copiar(data.token, "Token")}
            trailing={
              <Button variant="ghost" size="icon" onClick={() => setRevelarToken(v => !v)} title={revelarToken ? "Ocultar" : "Mostrar"}>
                {revelarToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            }
          />
          <Field
            label="Endpoint de envio"
            value={endpointIngest}
            onCopy={() => copiar(endpointIngest, "Endpoint")}
          />
          <Field
            label="Endpoint de verificação"
            value={endpointCheck}
            onCopy={() => copiar(endpointCheck, "Endpoint")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Instalar a extensão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Baixe a pasta <code className="bg-muted px-1.5 py-0.5 rounded">extension/</code> do código deste projeto.</li>
            <li>Abra <code className="bg-muted px-1.5 py-0.5 rounded">chrome://extensions</code> no Google Chrome (ou Edge / Brave).</li>
            <li>Ative o <b>Modo do desenvolvedor</b> (canto superior direito).</li>
            <li>Clique em <b>Carregar sem compactação</b> e selecione a pasta <code className="bg-muted px-1.5 py-0.5 rounded">extension/</code>.</li>
            <li>Fixe o ícone na barra de extensões.</li>
            <li>Abra o popup, expanda <b>Configurações de backend</b> e cole o token acima.</li>
          </ol>
          <p className="text-muted-foreground">
            A URL do backend já vem pré-configurada. Depois é só abrir a aba do 1doc com a lista de
            ouvidorias arquivadas e clicar em <b>Coletar da aba atual</b>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de execuções</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.coletas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma execução registrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Novos</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.coletas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{new Date(c.executado_em).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{c.total}</TableCell>
                    <TableCell className="text-right font-medium">{c.novos}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.duracao_ms != null ? `${(c.duracao_ms / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                    <TableCell>
                      {c.sucesso ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> sucesso
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> falha
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate text-xs text-muted-foreground" title={c.erro ?? ""}>
                      {c.erro ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label, value, onCopy, trailing,
}: { label: string; value: string; onCopy: () => void; trailing?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="font-mono text-xs" />
        {trailing}
        <Button variant="outline" size="icon" onClick={onCopy} title="Copiar">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}