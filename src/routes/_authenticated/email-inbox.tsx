import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Plus, Copy, Trash2, ExternalLink, AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useServerFn } from "@tanstack/react-start";
import { sincronizarGmail, sincronizarImap } from "@/lib/gmail-sync.functions";

const SYNC_INTERVAL_MIN = 5;

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(n => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function formatDelta(ms: number): string {
  if (ms <= 0) return "a qualquer momento";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  if (m <= 0) return `em ${ss}s`;
  return `em ${m}m ${ss.toString().padStart(2, "0")}s`;
}

export const Route = createFileRoute("/_authenticated/email-inbox")({
  component: EmailInboxPage,
});

function baseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function EmailInboxPage() {
  const qc = useQueryClient();
  const sincronizar = useServerFn(sincronizarGmail);
  const sincronizarImapFn = useServerFn(sincronizarImap);
  const [sincronizando, setSincronizando] = useState(false);
  const [sincronizandoImap, setSincronizandoImap] = useState(false);
  useTick(1000);

  async function rodarSync() {
    setSincronizando(true);
    try {
      const r: any = await sincronizar({});
      toast.success(`Gmail: ${r.novos} novo(s), ${r.erros} erro(s) em ${r.contas} conta(s)`);
      qc.invalidateQueries({ queryKey: ["email-inbox-accounts"] });
      qc.invalidateQueries({ queryKey: ["email-inbox-log"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  async function rodarSyncImap() {
    setSincronizandoImap(true);
    try {
      const r: any = await sincronizarImapFn({});
      toast.success(`IMAP: ${r.novos} novo(s), ${r.erros} erro(s) em ${r.contas} conta(s)`);
      qc.invalidateQueries({ queryKey: ["email-inbox-accounts"] });
      qc.invalidateQueries({ queryKey: ["email-inbox-log"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao sincronizar IMAP");
    } finally {
      setSincronizandoImap(false);
    }
  }

  const { data: accounts = [] } = useQuery({
    queryKey: ["email-inbox-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_inbox_accounts")
        .select("*, secretarias(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["email-inbox-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_inbox_log")
        .select("*, email_inbox_accounts(email), protocolos(id, numero, assunto)")
        .order("recebido_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias"],
    queryFn: async () => (await supabase.from("secretarias").select("*").order("nome")).data ?? [],
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("email_inbox_accounts").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-inbox-accounts"] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_inbox_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-inbox-accounts"] }); toast.success("Conta removida"); },
  });

  function copiar(t: string) {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  }

  const statusBadge = (s: string) => {
    if (s === "processado") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Processado</Badge>;
    if (s === "erro") return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    if (s === "ignorado") return <Badge variant="secondary">Ignorado</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  };

  const syncAccounts = accounts.filter((a: any) => (a.provider === "gmail" || a.provider === "imap") && a.ativo);
  const ultimaSync = syncAccounts
    .map((a: any) => a.ultima_sincronizacao ? new Date(a.ultima_sincronizacao).getTime() : 0)
    .reduce((max, t) => Math.max(max, t), 0);
  const proximaSync = ultimaSync ? ultimaSync + SYNC_INTERVAL_MIN * 60_000 : 0;
  const agora = Date.now();
  const totalNovos = syncAccounts.reduce((s: number, a: any) => s + (a.ultima_sync_novos ?? 0), 0);
  const totalErros = syncAccounts.reduce((s: number, a: any) => s + (a.ultima_sync_erros ?? 0), 0);
  const totalProc = syncAccounts.reduce((s: number, a: any) => s + (a.ultima_sync_processados ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Mail className="h-6 w-6" /> Recepção por E-mail</h1>
          <p className="text-sm text-muted-foreground">Encaminhe e-mails para um endereço único e o sistema cria a ouvidoria automaticamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={rodarSyncImap} disabled={sincronizandoImap}>
            <RefreshCw className={`h-4 w-4 mr-1 ${sincronizandoImap ? "animate-spin" : ""}`} />
            Sincronizar IMAP
          </Button>
          <Button variant="outline" onClick={rodarSync} disabled={sincronizando}>
            <RefreshCw className={`h-4 w-4 mr-1 ${sincronizando ? "animate-spin" : ""}`} />
            Sincronizar Gmail
          </Button>
          <NovaContaDialog secretarias={secretarias} />
        </div>
      </div>

      {syncAccounts.length > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Próxima sincronização</p>
                <p className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3.5 w-3.5" />
                  {proximaSync
                    ? `${formatDelta(proximaSync - agora)} (${format(new Date(proximaSync), "HH:mm:ss")})`
                    : "aguardando 1ª execução"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Intervalo automático: a cada {SYNC_INTERVAL_MIN} min</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última execução</p>
                <p className="text-sm font-semibold mt-0.5">
                  {ultimaSync ? format(new Date(ultimaSync), "dd/MM HH:mm:ss") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">E-mails processados (última)</p>
                <p className="text-sm font-semibold mt-0.5">
                  {totalProc} <span className="text-xs text-muted-foreground">(novos: {totalNovos}, erros: {totalErros})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contas ativas</p>
                <p className="text-sm font-semibold mt-0.5">{syncAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas">Contas ({accounts.length})</TabsTrigger>
          <TabsTrigger value="log">Histórico ({logs.length})</TabsTrigger>
          <TabsTrigger value="como">Como funciona</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="space-y-3">
          {accounts.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada ainda.</CardContent></Card>
          )}
          {accounts.map(a => {
            const url = `${baseUrl()}/api/public/inbound-email/${a.token}`;
            const isGmail = (a as any).provider === "gmail";
            const isImap = (a as any).provider === "imap";
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{a.email}</span>
                        {isGmail && <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30" variant="outline">Gmail</Badge>}
                        {isImap && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">IMAP</Badge>}
                        {!a.ativo && <Badge variant="secondary">Inativa</Badge>}
                      </div>
                      {a.descricao && <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>}
                      {(a as any).secretarias && <p className="text-xs text-muted-foreground mt-0.5">Vinculada à secretaria: <strong>{(a as any).secretarias.nome}</strong></p>}
                      {(isGmail || isImap) && (a as any).ultima_sincronizacao && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Última sincronização: {format(new Date((a as any).ultima_sincronizacao), "dd/MM/yyyy HH:mm:ss")}
                          {" · "}processados: {(a as any).ultima_sync_processados ?? 0}
                          {" · "}novos: {(a as any).ultima_sync_novos ?? 0}
                          {" · "}erros: {(a as any).ultima_sync_erros ?? 0}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span>Ativa</span>
                        <Switch checked={a.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: a.id, ativo: v })} />
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover conta?")) remover.mutate(a.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {isGmail ? (
                    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2 text-xs text-muted-foreground">
                      ✓ Conectado ao Google. O sistema verifica a caixa periodicamente e cria protocolos automaticamente.
                    </div>
                  ) : isImap ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-muted-foreground">
                      ✓ Conectado via IMAP em <code className="font-mono">{(a as any).imap_host}:{(a as any).imap_port}</code>. Clique em <strong>Sincronizar IMAP</strong> para puxar os e-mails agora.
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/40 p-2 flex items-center gap-2">
                      <code className="text-[11px] flex-1 truncate font-mono">{url}</code>
                      <Button size="sm" variant="outline" onClick={() => copiar(url)}><Copy className="h-3 w-3 mr-1" /> Copiar URL do webhook</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="log" className="space-y-2">
          {logs.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum e-mail recebido ainda.</CardContent></Card>
          )}
          {logs.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(l.status)}
                      <span className="text-xs text-muted-foreground">{format(new Date(l.recebido_em), "dd/MM/yyyy HH:mm")}</span>
                      {l.email_inbox_accounts?.email && <span className="text-xs text-muted-foreground">→ {l.email_inbox_accounts.email}</span>}
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{l.assunto || "(sem assunto)"}</p>
                    <p className="text-xs text-muted-foreground truncate">De: {l.remetente || "—"}</p>
                    {l.erro && <p className="text-xs text-destructive mt-1">⚠ {l.erro}</p>}
                    {l.protocolos && (
                      <p className="text-xs mt-1">
                        Protocolo criado: <strong>{l.protocolos.numero}</strong> — {l.protocolos.assunto}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="como">
          <Card>
            <CardHeader>
              <CardTitle>Como configurar o encaminhamento</CardTitle>
              <CardDescription>O sistema não recebe e-mail diretamente — você precisa de um "ponte" que converta e-mails em uma chamada HTTP para a URL do webhook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-1">1. Cadastre a conta</h3>
                <p className="text-muted-foreground">Na aba "Contas", clique em <strong>Nova conta</strong> e informe o e-mail que recebe as ouvidorias (ex.: <code>anderdonenator@gmail.com</code>). O sistema gera uma URL única (webhook).</p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">2. Configure o encaminhamento via Zapier / Make / n8n</h3>
                <p className="text-muted-foreground">A forma mais simples é usar uma das ferramentas abaixo (todas têm plano gratuito):</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><a className="text-primary underline" href="https://zapier.com/apps/gmail/integrations/webhook" target="_blank" rel="noreferrer">Zapier — Gmail → Webhooks <ExternalLink className="inline h-3 w-3" /></a></li>
                  <li><a className="text-primary underline" href="https://www.make.com/en/integrations/gmail" target="_blank" rel="noreferrer">Make.com — Gmail → HTTP <ExternalLink className="inline h-3 w-3" /></a></li>
                  <li><a className="text-primary underline" href="https://n8n.io/integrations/gmail/" target="_blank" rel="noreferrer">n8n — Gmail Trigger → HTTP Request <ExternalLink className="inline h-3 w-3" /></a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">3. Configuração da chamada HTTP</h3>
                <p className="text-muted-foreground">No passo "Webhook" / "HTTP Request" da ferramenta, configure:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
                  <li><strong>Método:</strong> POST</li>
                  <li><strong>URL:</strong> a URL gerada na aba Contas</li>
                  <li><strong>Content-Type:</strong> application/json</li>
                  <li><strong>Body (JSON):</strong></li>
                </ul>
                <pre className="mt-2 bg-muted p-3 rounded-md text-xs overflow-x-auto">{`{
  "from": "{{remetente do e-mail}}",
  "to": "{{destinatário}}",
  "subject": "{{assunto}}",
  "text": "{{corpo em texto plano}}",
  "html": "{{corpo em HTML, opcional}}"
}`}</pre>
              </div>
              <div>
                <h3 className="font-semibold mb-1">4. Teste</h3>
                <p className="text-muted-foreground">Envie um e-mail de teste para a conta cadastrada. Em poucos segundos ele aparece na aba <strong>Histórico</strong> e o protocolo é criado em <strong>Protocolos</strong>.</p>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs"><strong>Dica:</strong> a URL do webhook é secreta — só compartilhe com a ferramenta de encaminhamento. Se vazar, remova e recadastre a conta para gerar uma nova.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NovaContaDialog({ secretarias }: { secretarias: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [descricao, setDescricao] = useState("");
  const [secId, setSecId] = useState<string>("");
  const [provider, setProvider] = useState<"imap" | "gmail" | "webhook">("imap");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState(993);
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapTls, setImapTls] = useState(true);

  const criar = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        email: email.trim().toLowerCase(),
        descricao: descricao || null,
        secretaria_id: secId || null,
        created_by: user?.id,
        provider,
      };
      if (provider === "imap") {
        if (!imapHost || !imapUser || !imapPassword) {
          throw new Error("Preencha host, usuário e senha IMAP");
        }
        payload.imap_host = imapHost.trim();
        payload.imap_port = Number(imapPort) || 993;
        payload.imap_user = imapUser.trim();
        payload.imap_password = imapPassword;
        payload.imap_tls = imapTls;
      }
      const { error } = await supabase.from("email_inbox_accounts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-inbox-accounts"] });
      toast.success("Conta cadastrada");
      setOpen(false);
      setEmail(""); setDescricao(""); setSecId(""); setImapUser(""); setImapPassword("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function onEmailBlur() {
    if (provider === "imap" && !imapUser && email) setImapUser(email.trim().toLowerCase());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Nova conta</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cadastrar e-mail de recepção</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Forma de captura</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="imap">IMAP / Senha de App (recomendado)</SelectItem>
                <SelectItem value="gmail">Gmail conectado (automático)</SelectItem>
                <SelectItem value="webhook">Webhook (Zapier / Make / n8n)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {provider === "imap" && "Você gera uma Senha de App no Google (16 caracteres) e cola aqui. O sistema lê a caixa via IMAP."}
              {provider === "gmail" && "O sistema consulta diretamente a caixa do Gmail conectado pela Lovable."}
              {provider === "webhook" && "Você configura um encaminhamento que faz POST na URL gerada."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={onEmailBlur} placeholder="ouvidoria@exemplo.gov.br" />
          </div>
          {provider === "imap" && (
            <div className="space-y-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Como obter a Senha de App do Gmail:</strong> ative a Verificação em 2 etapas em <a className="text-primary underline" href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">myaccount.google.com/security</a>, depois acesse <a className="text-primary underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a> e gere uma senha de 16 caracteres.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label>Servidor IMAP *</Label>
                  <Input value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.gmail.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Porta</Label>
                  <Input type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Usuário (e-mail) *</Label>
                <Input value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder="setamonitoramento75@gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha de App *</Label>
                <Input type="password" value={imapPassword} onChange={e => setImapPassword(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" autoComplete="new-password" />
                <p className="text-[11px] text-muted-foreground">Pode colar com ou sem espaços.</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={imapTls} onCheckedChange={setImapTls} />
                <Label className="text-xs">Usar TLS/SSL (recomendado)</Label>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Caixa principal da Ouvidoria" />
          </div>
          <div className="space-y-1.5">
            <Label>Vincular à secretaria (opcional)</Label>
            <Select value={secId} onValueChange={setSecId}>
              <SelectTrigger><SelectValue placeholder="Detectar automaticamente" /></SelectTrigger>
              <SelectContent>
                {secretarias.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Se vincular, todos os e-mails dessa conta serão direcionados a essa secretaria.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!email || criar.isPending}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}