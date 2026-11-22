import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/js/util/hash.js";

describe("util/hash.js", () => {
  it("sha256Hex do buffer vazio bate com o valor conhecido", async () => {
    expect(await sha256Hex(new Uint8Array([]).buffer)).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("sha256Hex de 'abc' bate com o valor conhecido (NIST)", async () => {
    const buffer = new TextEncoder().encode("abc").buffer;
    expect(await sha256Hex(buffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
