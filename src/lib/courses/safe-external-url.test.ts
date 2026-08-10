import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./safe-external-url";

describe("safeExternalUrl", () => {
  it("deja pasar los enlaces reales de las dos fuentes", () => {
    expect(safeExternalUrl("https://www.udemy.com/course/complete-python-bootcamp/")).toBe(
      "https://www.udemy.com/course/complete-python-bootcamp/"
    );
    expect(safeExternalUrl("https://www.coursera.org/learn/machine-learning")).toBe(
      "https://www.coursera.org/learn/machine-learning"
    );
  });

  it("acepta http además de https", () => {
    expect(safeExternalUrl("http://example.com/curso")).toBe("http://example.com/curso");
  });

  it("descarta un enlace javascript:, que ejecutaría código al pulsarlo", () => {
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
  });

  it("descarta otros protocolos peligrosos o inútiles", () => {
    for (const url of [
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(safeExternalUrl(url)).toBeNull();
    }
  });

  it("descarta valores vacíos, nulos o malformados", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("no soy una url")).toBeNull();
    expect(safeExternalUrl("/curso/relativo")).toBeNull();
  });
});
