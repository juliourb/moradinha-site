import { describe, expect, it } from "vitest";
import { formatar, formatarPercentual } from "../../src/js/util/formato.js";

describe("formato.js", () => {
  it("formata milhar com ponto e decimal com vírgula", () => {
    expect(formatar(1234567.891, 1)).toBe("1.234.567,9");
  });

  it("nulo vira travessão", () => {
    expect(formatar(null)).toBe("—");
    expect(formatar(undefined)).toBe("—");
  });

  it("zero não é tratado como nulo", () => {
    expect(formatar(0)).toBe("0");
  });

  it("formata percentual com símbolo", () => {
    expect(formatarPercentual(9.654)).toBe("9,7 %");
  });

  it("percentual nulo vira travessão", () => {
    expect(formatarPercentual(null)).toBe("—");
  });
});
