import { describe, it, expect } from "vitest";
import {
  parseData,
  parseLinha,
  formatMilhar,
  construirBuscaNumero,
  melhorMatch,
} from "./fuzzy-match";

describe("parseData", () => {
  it("reconhece data ISO", () => {
    expect(parseData("concluído em 2026-06-15")).toBe("2026-06-15");
  });
  it("reconhece data BR dd/mm/aaaa", () => {
    expect(parseData("15/06/2026")).toBe("2026-06-15");
  });
  it("reconhece ano de 2 dígitos", () => {
    expect(parseData("15/06/26")).toBe("2026-06-15");
  });
  it("retorna undefined sem data", () => {
    expect(parseData("sem data aqui")).toBeUndefined();
  });
});

describe("parseLinha", () => {
  it("extrai número, data e url de uma linha completa", () => {
    const r = parseLinha("12345/2025\t15/06/2026\thttps://1doc.com.br/abc123");
    expect(r?.numero).toBe("12345/2025");
    expect(r?.data).toBe("2026-06-15");
    expect(r?.url).toBe("https://1doc.com.br/abc123");
  });

  it("funciona sem url", () => {
    const r = parseLinha("67890/2025 2026-06-16");
    expect(r?.numero).toBe("67890/2025");
    expect(r?.data).toBe("2026-06-16");
    expect(r?.url).toBeUndefined();
  });

  it("retorna null para linha vazia", () => {
    expect(parseLinha("   ")).toBeNull();
  });

  it("remove pontuação final da url", () => {
    const r = parseLinha("123/2025 15/06/2026 (https://1doc.com.br/abc,)");
    expect(r?.url).toBe("https://1doc.com.br/abc");
  });
});

describe("formatMilhar", () => {
  it("não altera números com 3 dígitos ou menos", () => {
    expect(formatMilhar("123")).toBe("123");
  });
  it("insere separador de milhar", () => {
    expect(formatMilhar("12345")).toBe("12.345");
  });
});

describe("construirBuscaNumero", () => {
  it("gera variantes com e sem pontuação, com e sem ano", () => {
    const { orParts, baseDigits, anoRaw, allDigits } = construirBuscaNumero("12.345/2025");
    expect(baseDigits).toBe("12345");
    expect(anoRaw).toBe("2025");
    expect(allDigits).toBe("123452025");
    expect(orParts).toContain("numero.eq.12345/2025");
    expect(orParts).toContain("numero.eq.12.345/2025");
  });
});

describe("melhorMatch / pontuarMatchNumero", () => {
  it("prioriza match exato (todos os dígitos, incluindo ano)", () => {
    const candidatos = [{ numero: "12345/2020" }, { numero: "12345/2025" }];
    const { baseDigits, anoRaw, allDigits } = construirBuscaNumero("12345/2025");
    expect(melhorMatch(candidatos, baseDigits, anoRaw, allDigits)?.numero).toBe("12345/2025");
  });

  it("sem candidatos retorna undefined", () => {
    expect(melhorMatch([], "1", "2025", "12025")).toBeUndefined();
  });
});
