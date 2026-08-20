import { describe, it, expect } from "vitest";
import {
  calcularPrazo,
  situacaoProtocolo,
  estavaAtrasadoNaData,
  diasRestantes,
  endOfMonthOrNow,
} from "./prazo";

describe("calcularPrazo", () => {
  it("ouvidoria sem prorrogação: 30 dias", () => {
    const { diasTotais, prazoFinal } = calcularPrazo({
      tipo: "ouvidoria",
      data_abertura: "2026-01-01",
      prorrogado: false,
    });
    expect(diasTotais).toBe(30);
    expect(prazoFinal.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("ouvidoria prorrogada: 30+30 dias", () => {
    const { diasTotais } = calcularPrazo({
      tipo: "ouvidoria",
      data_abertura: "2026-01-01",
      prorrogado: true,
    });
    expect(diasTotais).toBe(60);
  });

  it("lai/esic sem prorrogação: 20 dias", () => {
    expect(
      calcularPrazo({ tipo: "lai", data_abertura: "2026-01-01", prorrogado: false }).diasTotais,
    ).toBe(20);
    expect(
      calcularPrazo({ tipo: "esic", data_abertura: "2026-01-01", prorrogado: false }).diasTotais,
    ).toBe(20);
  });

  it("lai/esic prorrogado: 20+10 dias", () => {
    expect(
      calcularPrazo({ tipo: "lai", data_abertura: "2026-01-01", prorrogado: true }).diasTotais,
    ).toBe(30);
  });
});

describe("situacaoProtocolo", () => {
  const base = { tipo: "ouvidoria" as const, data_abertura: "2026-01-01", prorrogado: false };
  // prazoFinal = 2026-01-31

  it("concluído sempre vence 'concluido', mesmo já vencido", () => {
    const hoje = new Date("2026-03-01T12:00:00");
    expect(situacaoProtocolo({ ...base, status: "concluido" }, hoje).situacao).toBe("concluido");
  });

  it("vencido quando dias restantes < 0", () => {
    const hoje = new Date("2026-02-01T12:00:00");
    expect(situacaoProtocolo({ ...base, status: "aberto" }, hoje).situacao).toBe("vencido");
  });

  it("crítico na borda de 3 dias restantes", () => {
    const hoje = new Date("2026-01-28T00:00:00");
    const r = situacaoProtocolo({ ...base, status: "aberto" }, hoje);
    expect(r.dias).toBe(3);
    expect(r.situacao).toBe("critico");
  });

  it("atenção na borda de 7 dias restantes", () => {
    const hoje = new Date("2026-01-24T00:00:00");
    const r = situacaoProtocolo({ ...base, status: "aberto" }, hoje);
    expect(r.dias).toBe(7);
    expect(r.situacao).toBe("atencao");
  });

  it("no prazo com 8+ dias restantes", () => {
    const hoje = new Date("2026-01-23T00:00:00");
    const r = situacaoProtocolo({ ...base, status: "aberto" }, hoje);
    expect(r.dias).toBe(8);
    expect(r.situacao).toBe("no_prazo");
  });
});

describe("estavaAtrasadoNaData", () => {
  const base = { tipo: "ouvidoria" as const, data_abertura: "2026-01-01", prorrogado: false };
  // prazoFinal = 2026-01-31

  it("não estava atrasado antes do prazo final", () => {
    const r = estavaAtrasadoNaData(
      { ...base, status: "aberto", data_conclusao: null },
      new Date("2026-01-15"),
    );
    expect(r.atrasado).toBe(false);
  });

  it("estava atrasado após o prazo final se ainda aberto", () => {
    const r = estavaAtrasadoNaData(
      { ...base, status: "aberto", data_conclusao: null },
      new Date("2026-02-15"),
    );
    expect(r.atrasado).toBe(true);
  });

  it("não conta como atrasado se foi concluído antes da data de referência", () => {
    const r = estavaAtrasadoNaData(
      { ...base, status: "concluido", data_conclusao: "2026-01-20" },
      new Date("2026-02-15"),
    );
    expect(r.atrasado).toBe(false);
  });

  it("conta como atrasado se só foi concluído depois da data de referência", () => {
    const r = estavaAtrasadoNaData(
      { ...base, status: "concluido", data_conclusao: "2026-03-01" },
      new Date("2026-02-15"),
    );
    expect(r.atrasado).toBe(true);
  });
});

describe("diasRestantes", () => {
  it("calcula diferença em dias corridos", () => {
    expect(diasRestantes(new Date("2026-01-10"), new Date("2026-01-05"))).toBe(5);
    expect(diasRestantes(new Date("2026-01-01"), new Date("2026-01-05"))).toBe(-4);
  });
});

describe("endOfMonthOrNow", () => {
  it("retorna o 'agora' passado quando é o mês corrente", () => {
    const agora = new Date("2026-06-15T10:00:00");
    expect(endOfMonthOrNow("2026-06", agora)).toBe(agora);
  });

  it("retorna o fim do mês para meses passados", () => {
    const agora = new Date("2026-06-15T10:00:00");
    const r = endOfMonthOrNow("2026-02", agora);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(1); // fevereiro
    expect(r.getDate()).toBe(28); // 2026 não é bissexto
  });
});
