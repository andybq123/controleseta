import jsPDF from "jspdf";

export type ProtocoloPdfData = {
  numero: string;
  hash: string;
  categoria?: string | null;
  assunto?: string | null;
  descricao?: string | null;
  solicitante?: string | null;
  sigilo?: string | null;
  contato?: string | null;
  endereco?: string | null;
  secretaria?: string | null;
  local?: string | null;
  data_abertura?: string | null;
  status?: string | null;
  origem?: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

export function gerarProtocoloPdf(p: ProtocoloPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  // Faixa institucional verde/vermelho
  doc.setFillColor(5, 122, 85);
  doc.rect(0, 0, pageW, 8, "F");
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 8, pageW, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 83, 45);
  doc.text("PREFEITURA MUNICIPAL DE BRUSQUE", pageW / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("Ouvidoria Municipal — Comprovante de Manifestação", pageW / 2, y, { align: "center" });
  y += 26;

  // Caixa com número + hash
  doc.setDrawColor(5, 122, 85);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, y, pageW - margin * 2, 70, 6, 6, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("NÚMERO DO PROTOCOLO", margin + 14, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 83, 45);
  doc.text(p.numero, margin + 14, y + 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("CÓDIGO DE CONSULTA", pageW / 2 + 10, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(p.hash, pageW / 2 + 10, y + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Guarde este código. Ele é exigido para consultar a manifestação.", margin + 14, y + 60);
  y += 90;

  // Dados
  const linhas: [string, string][] = [
    ["Data de abertura", fmtDate(p.data_abertura)],
    ["Status", p.status ?? "—"],
    ["Tipo de solicitação", p.categoria ?? "—"],
    ["Sigilo", p.sigilo ?? "—"],
    ["Área / Assunto", p.assunto ?? "—"],
    ["Secretaria", p.secretaria ?? "—"],
    ["Unidade / Local", p.local ?? "—"],
    ["Solicitante", p.solicitante ?? "—"],
    ["Contato", p.contato ?? "—"],
    ["Endereço", p.endereco ?? "—"],
    ["Origem", p.origem ?? "—"],
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 83, 45);
  doc.text("Dados da manifestação", margin, y);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  doc.setFontSize(10);
  for (const [k, v] of linhas) {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    const wrapped = doc.splitTextToSize(String(v || "—"), pageW - margin * 2 - 130);
    doc.text(wrapped, margin + 130, y);
    y += Math.max(14, wrapped.length * 12);
  }

  // Descrição
  y += 8;
  if (y > 720) { doc.addPage(); y = 50; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 83, 45);
  doc.text("Descrição", margin, y);
  y += 6;
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const desc = doc.splitTextToSize(p.descricao || "—", pageW - margin * 2);
  for (const linha of desc) {
    if (y > 780) { doc.addPage(); y = 50; }
    doc.text(linha, margin, y);
    y += 13;
  }

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Prefeitura Municipal de Brusque — SC · Gerado em ${new Date().toLocaleString("pt-BR")} · Página ${i} de ${pages}`,
      pageW / 2,
      820,
      { align: "center" },
    );
  }

  return doc;
}

export function gerarHashConsulta(): string {
  // 10 caracteres alfanuméricos legíveis (sem 0/O/1/I)
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += alfabeto[arr[i] % alfabeto.length];
    if (i === 4) out += "-";
  }
  return out;
}