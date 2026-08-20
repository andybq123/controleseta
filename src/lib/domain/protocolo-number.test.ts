import { describe, it, expect } from "vitest";
import { gerarNumeroProtocolo } from "./protocolo-number";

describe("gerarNumeroProtocolo", () => {
  it("formata como sequência com separador de milhar + ano", () => {
    expect(gerarNumeroProtocolo("ouvidoria", 2026, () => 0)).toBe("1.000/2026");
    expect(gerarNumeroProtocolo("ouvidoria", 2026, () => 0.9999)).toBe("9.999/2026");
  });

  it("usa o ano corrente por padrão", () => {
    const anoAtual = new Date().getFullYear();
    expect(gerarNumeroProtocolo("lai")).toMatch(new RegExp(`/${anoAtual}$`));
  });
});
