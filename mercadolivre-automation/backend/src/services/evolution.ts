import type { AppSettings } from "../db.js";
import { logger } from "../logger.js";

function baseHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  };
}

function trimBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export interface EvolutionSettings {
  baseUrl: string;
  apiKey: string;
  instance: string;
  groupJid: string;
}

/**
 * Cliente para a Evolution API (https://doc.evolution-api.com), usada para
 * enviar mensagens de texto/imagem para um grupo do WhatsApp a partir de
 * uma instancia conectada.
 */
export async function sendWhatsAppMessage(
  settings: AppSettings,
  text: string,
  imageUrl?: string,
): Promise<void> {
  const { baseUrl, apiKey, instance, groupJid } = settings.evolution;

  if (!baseUrl || !apiKey || !instance || !groupJid) {
    throw new Error(
      "Configuracao da Evolution API incompleta. Preencha URL, API Key, instancia e grupo em Configuracoes.",
    );
  }

  const url = trimBaseUrl(baseUrl);

  if (settings.evolution.sendImage && imageUrl) {
    const response = await fetch(`${url}/message/sendMedia/${instance}`, {
      method: "POST",
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        number: groupJid,
        mediatype: "image",
        media: imageUrl,
        caption: text,
      }),
    });

    if (response.ok) return;

    const body = await response.text();
    logger.warn(
      `Falha ao enviar imagem via Evolution API (HTTP ${response.status}): ${body}. Tentando enviar apenas texto...`,
    );
  }

  const response = await fetch(`${url}/message/sendText/${instance}`, {
    method: "POST",
    headers: baseHeaders(apiKey),
    body: JSON.stringify({
      number: groupJid,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar mensagem via Evolution API (HTTP ${response.status}): ${body}`);
  }
}

export async function checkEvolutionConnection(
  settings: AppSettings,
): Promise<{ ok: boolean; detail: string }> {
  const { baseUrl, apiKey, instance } = settings.evolution;
  if (!baseUrl || !apiKey || !instance) {
    return { ok: false, detail: "Preencha URL, API Key e instancia antes de testar." };
  }

  try {
    const url = trimBaseUrl(baseUrl);
    const response = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: baseHeaders(apiKey),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}: ${JSON.stringify(body)}` };
    }
    return { ok: true, detail: JSON.stringify(body) };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
