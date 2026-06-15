import { describe, it, expect } from "vitest";
import { extractHouseNumber, extractQueryNumber, parseSuggestion, type NominatimResult } from "./address-parse";

function base(overrides: Partial<NominatimResult> = {}): NominatimResult {
  return {
    lat: "-27.0975",
    lon: "-48.9176",
    display_name: "",
    address: {},
    ...overrides,
  };
}

describe("extractQueryNumber", () => {
  it("returns last number when street name contains a number", () => {
    expect(extractQueryNumber("Rua 7 de Setembro, 174")).toBe("174");
  });
  it("returns the number when present alone", () => {
    expect(extractQueryNumber("Rua das Flores 145")).toBe("145");
  });
  it("returns null when no number present", () => {
    expect(extractQueryNumber("Rua das Flores")).toBeNull();
  });
  it("ignores numbers > 6 digits", () => {
    expect(extractQueryNumber("CEP 88350000 alguma coisa")).toBeNull();
  });
});

describe("extractHouseNumber", () => {
  it("uses address.house_number when present", () => {
    const n = extractHouseNumber(base({
      address: { house_number: "174", road: "Rua das Flores" },
      display_name: "Rua das Flores, 174, Centro, Brusque",
    }));
    expect(n).toBe("174");
  });

  it("extracts number from display_name when house_number missing", () => {
    const n = extractHouseNumber(base({
      address: { road: "Rua 7 de Setembro" },
      display_name: "Rua 7 de Setembro, 174, Centro, Brusque, Santa Catarina, 88350-000, Brasil",
    }));
    expect(n).toBe("174");
  });

  it("handles street names with special regex chars", () => {
    const n = extractHouseNumber(base({
      address: { road: "Av. Pres. Costa e Silva (Trecho 2)" },
      display_name: "Av. Pres. Costa e Silva (Trecho 2), 145, Bairro, Brusque",
    }));
    expect(n).toBe("145");
  });

  it("falls back to provided number when display_name has no number", () => {
    const n = extractHouseNumber(base({
      address: { road: "Rua das Flores" },
      display_name: "Rua das Flores, Centro, Brusque",
    }), "200");
    expect(n).toBe("200");
  });

  it("returns undefined when nothing available", () => {
    const n = extractHouseNumber(base({
      address: { road: "Rua das Flores" },
      display_name: "Rua das Flores, Centro, Brusque",
    }));
    expect(n).toBeUndefined();
  });

  it("does not match unrelated numbers earlier in display_name", () => {
    const n = extractHouseNumber(base({
      address: { road: "Rua das Flores" },
      // 88 is a CEP fragment, not after street; should not match because it isn't right after road
      display_name: "88, Rua das Flores, Centro, Brusque",
    }));
    expect(n).toBeUndefined();
  });

  it("works with pedestrian / footway fallbacks", () => {
    const n = extractHouseNumber(base({
      address: { pedestrian: "Calçadão XV" },
      display_name: "Calçadão XV, 50, Centro, Brusque",
    }));
    expect(n).toBe("50");
  });
});

describe("parseSuggestion", () => {
  it("builds short label with road + number + neighbourhood + city", () => {
    const s = parseSuggestion(base({
      lat: "-27.1", lon: "-48.9",
      address: { road: "Rua das Flores", house_number: "174", suburb: "Centro", city: "Brusque" },
      display_name: "Rua das Flores, 174, Centro, Brusque",
    }));
    expect(s.label).toBe("Rua das Flores, 174 - Centro - Brusque");
    expect(s.houseNumber).toBe("174");
    expect(s.lat).toBeCloseTo(-27.1);
    expect(s.lng).toBeCloseTo(-48.9);
  });

  it("includes number parsed from display_name in the label", () => {
    const s = parseSuggestion(base({
      address: { road: "Rua 7 de Setembro", suburb: "Centro" },
      display_name: "Rua 7 de Setembro, 174, Centro, Brusque, Santa Catarina",
    }));
    expect(s.label).toBe("Rua 7 de Setembro, 174 - Centro - Brusque");
    expect(s.houseNumber).toBe("174");
  });

  it("uses fallback number when Nominatim omits it", () => {
    const s = parseSuggestion(base({
      address: { road: "Rua das Flores", suburb: "Centro" },
      display_name: "Rua das Flores, Centro, Brusque",
    }), "200");
    expect(s.label).toBe("Rua das Flores, 200 - Centro - Brusque");
    expect(s.houseNumber).toBe("200");
  });

  it("omits number when none available", () => {
    const s = parseSuggestion(base({
      address: { road: "Rua das Flores", suburb: "Centro" },
      display_name: "Rua das Flores, Centro, Brusque",
    }));
    expect(s.label).toBe("Rua das Flores - Centro - Brusque");
    expect(s.houseNumber).toBeUndefined();
  });

  it("falls back to display_name when no road present", () => {
    const s = parseSuggestion(base({
      address: {},
      display_name: "Praça da Bandeira, Brusque",
    }));
    expect(s.label).toBe("Praça da Bandeira, Brusque");
  });
});