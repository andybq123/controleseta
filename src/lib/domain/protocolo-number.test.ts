import { describe, it, expect } from "vitest";
import {
  gerarNumeroProtocolo,
  parseNumeroProtocolo,
  compararNumeroProtocolo,
} from "./protocolo-number";

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

describe("parseNumeroProtocolo", () => {
  it("extrai [ano, sequência]", () => {
    expect(parseNumeroProtocolo("1.234/2026")).toEqual([2026, 1234]);
  });
  it("retorna [0,0] para valores vazios", () => {
    expect(parseNumeroProtocolo(null)).toEqual([0, 0]);
    expect(parseNumeroProtocolo(undefined)).toEqual([0, 0]);
  });
});

describe("compararNumeroProtocolo", () => {
  it("ordena por ano decrescente, depois sequência decrescente", () => {
    const lista = [{ numero: "1/2024" }, { numero: "5/2026" }, { numero: "2/2026" }];
    expect(lista.sort(compararNumeroProtocolo).map((x) => x.numero)).toEqual([
      "5/2026",
      "2/2026",
      "1/2024",
    ]);
  });
});
