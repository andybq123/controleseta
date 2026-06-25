import { env } from "./env.js";

export type ProtocoloPayload = {
  numero: string;
  url: string | null;
  status: string | null;
  data_protocolo: string | null;
  relato: string;
  setor?: string | null;
  detalhes: Record<string, string> | null;
};

export async function enviarParaBackend(protocolos: ProtocoloPayload[]): Promise<unknown> {
  const url = `${env.backendUrl}/api/public/ingest-protocolos`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.ingestToken}`,
    },
    body: JSON.stringify({ protocolos, origem: "worker" }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Backend ${res.status}: ${data?.error || data?.erro || res.statusText}`);
  }
  return data;
}