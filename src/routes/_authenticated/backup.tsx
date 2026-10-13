import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { DatabaseBackup, Download } from "lucide-react";
import { toast } from "sonner";
import { exportarPaginaBackup, exportarContasUsuarios } from "@/lib/backup.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup do sistema — Ouvidoria de Brusque" },
      { name: "description", content: "Gere backups dos protocolos, usuários, secretarias e configurações." },
    ],
  }),
  component: BackupPage,
});

type Grupo = { id: string; label: string; desc: string; tabelas: string[]; usuarios?: boolean; padrao: boolean };

const GRUPOS: Grupo[] = [
  { id: "protocolos", label: "Protocolos (inclui triagem)", desc: "Todas as ouvidorias, LAI e e-SIC, inclusive as pendentes de triagem.", tabelas: ["protocolos"], padrao: true },
  { id: "historico", label: "Histórico / auditoria", desc: "Todas as alterações feitas nos protocolos.", tabelas: ["protocolo_historico"], padrao: true },
  { id: "antigos", label: "Protocolos antigos", desc: "Conclusões dos protocolos legados.", tabelas: ["protocolos_antigos_conclusoes"], padrao: true },
  { id: "usuarios", label: "Usuários", desc: "Contas, perfis e permissões. Senhas não saem do sistema (ficam criptografadas).", tabelas: ["profiles", "user_roles", "allowed_emails"], usuarios: true, padrao: true },
  { id: "secretarias", label: "Secretarias e responsáveis", desc: "Secretarias, responsáveis e unidades/locais.", tabelas: ["secretarias", "secretaria_responsaveis", "locais"], padrao: true },
  { id: "assuntos", label: "Assuntos", desc: "Catálogo de assuntos e regras de triagem.", tabelas: ["assuntos"], padrao: true },
  { id: "config", label: "Configurações", desc: "Contas de e-mail e IA (sem chaves ou senhas).", tabelas: ["email_inbox_accounts", "ai_config"], padrao: true },
  { id: "coletas", label: "Coletas 1Doc", desc: "Histórico de execuções do coletor.", tabelas: ["coletas"], padrao: false },
  { id: "emails", label: "Log de e-mails", desc: "Registro de todos os e-mails recebidos (arquivo grande).", tabelas: ["email_inbox_log"], padrao: false },
];

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

function BackupPage() {
  const isAdmin = useIsAdmin();
  const pagina = useServerFn(exportarPaginaBackup);
  const contas = useServerFn(exportarContasUsuarios);
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(GRUPOS.map(g => [g.id, g.padrao])));
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState(0);
  const [etapa, setEtapa] = useState("");

  async function gerar() {
    const grupos = GRUPOS.filter(g => sel[g.id]);
    if (!grupos.length) return toast.error("Selecione ao menos um item");
    setRodando(true); setProg(0);
    try {
      const files: Record<string, Uint8Array> = {};
      const resumo: Record<string, number> = {};
      const tabelas = grupos.flatMap(g => g.tabelas);
      const total = tabelas.length + (grupos.some(g => g.usuarios) ? 1 : 0);
      let feito = 0;
      for (const t of tabelas) {
        setEtapa(`Exportando ${t}...`);
        const all: any[] = [];
        for (let from = 0; ; from += 1000) {
          const rows = await pagina({ data: { tabela: t, from, to: from + 999 } });
          all.push(...rows);
          if (rows.length < 1000) break;
          setEtapa(`Exportando ${t}... (${all.length.toLocaleString("pt-BR")})`);
        }
        files[`csv/${t}.csv`] = strToU8(toCsv(all));
        files[`json/${t}.json`] = strToU8(JSON.stringify(all, null, 2));
        resumo[t] = all.length;
        setProg(Math.round((++feito / total) * 100));
      }
      if (grupos.some(g => g.usuarios)) {
        setEtapa("Exportando contas de usuários...");
        const u = await contas();
        files["csv/contas_usuarios.csv"] = strToU8(toCsv(u));
        files["json/contas_usuarios.json"] = strToU8(JSON.stringify(u, null, 2));
        resumo.contas_usuarios = u.length;
        setProg(Math.round((++feito / total) * 100));
      }
      const data = new Date().toISOString().slice(0, 10);
      files["LEIAME.json"] = strToU8(JSON.stringify({ gerado_em: new Date().toISOString(), registros: resumo,
        observacao: "Senhas de usuários e chaves de API não são exportadas; permanecem criptografadas no sistema." }, null, 2));
      setEtapa("Compactando...");
      const zip = zipSync(files, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url; a.download = `backup_seta_${data}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup gerado com sucesso");
      setEtapa("Concluído");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar backup");
      setEtapa("");
    } finally {
      setRodando(false);
    }
  }

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Apenas administradores podem acessar o backup.</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Backup do sistema</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>O que incluir</CardTitle>
          <CardDescription>Selecione os itens. O arquivo .zip traz cada item em CSV (Excel) e JSON.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {GRUPOS.map(g => (
            <label key={g.id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40">
              <Checkbox checked={!!sel[g.id]} disabled={rodando}
                onCheckedChange={v => setSel(s => ({ ...s, [g.id]: !!v }))} className="mt-0.5" />
              <div>
                <div className="font-medium text-sm">{g.label}</div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={rodando} onClick={() => setSel(Object.fromEntries(GRUPOS.map(g => [g.id, true])))}>Marcar todos</Button>
            <Button variant="outline" size="sm" disabled={rodando} onClick={() => setSel({})}>Desmarcar</Button>
            <Button className="ml-auto" onClick={gerar} disabled={rodando}>
              <Download className="h-4 w-4 mr-1" /> {rodando ? "Gerando..." : "Gerar backup"}
            </Button>
          </div>
          {(rodando || etapa) && (
            <div className="space-y-1 pt-2">
              <Progress value={prog} />
              <div className="text-xs text-muted-foreground">{etapa}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
