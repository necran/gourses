import { describe, expect, it } from "vitest";
import { resolvePriceDisplay, type PriceHistoryEntry } from "./price-display";

function entry(
  priceAmount: number | null,
  capturedAt: string,
  priceCurrency: string | null = "EUR"
): PriceHistoryEntry {
  return { priceAmount, priceCurrency, capturedAt };
}

describe("resolvePriceDisplay", () => {
  it("muestra el precio anterior tachado cuando ha bajado", () => {
    const history = [entry(29.99, "2026-08-01T10:00:00Z"), entry(19.99, "2026-08-09T10:00:00Z")];

    expect(resolvePriceDisplay(19.99, "EUR", history)).toEqual({
      amount: 19.99,
      currency: "EUR",
      previousAmount: 29.99,
    });
  });

  it("no tacha nada cuando el precio ha subido", () => {
    const history = [entry(19.99, "2026-08-01T10:00:00Z"), entry(29.99, "2026-08-09T10:00:00Z")];

    expect(resolvePriceDisplay(29.99, "EUR", history).previousAmount).toBeNull();
  });

  it("no tacha nada cuando solo hay un precio registrado", () => {
    expect(
      resolvePriceDisplay(19.99, "EUR", [entry(19.99, "2026-08-09T10:00:00Z")]).previousAmount
    ).toBeNull();
  });

  it("no tacha nada cuando no hay histórico", () => {
    expect(resolvePriceDisplay(19.99, "EUR", []).previousAmount).toBeNull();
  });

  it("toma el precio distinto más reciente, no el más antiguo", () => {
    const history = [
      entry(49.99, "2026-08-01T10:00:00Z"),
      entry(29.99, "2026-08-05T10:00:00Z"),
      entry(19.99, "2026-08-09T10:00:00Z"),
    ];

    expect(resolvePriceDisplay(19.99, "EUR", history).previousAmount).toBe(29.99);
  });

  it("ignora una bajada entre monedas distintas", () => {
    const history = [
      entry(29.99, "2026-08-01T10:00:00Z", "USD"),
      entry(19.99, "2026-08-09T10:00:00Z", "EUR"),
    ];

    expect(resolvePriceDisplay(19.99, "EUR", history).previousAmount).toBeNull();
  });

  it("no rompe con cursos sin precio, como los de Coursera", () => {
    expect(resolvePriceDisplay(null, null, [])).toEqual({
      amount: null,
      currency: null,
      previousAmount: null,
    });
  });

  it("ignora filas de histórico sin importe", () => {
    const history = [entry(null, "2026-08-01T10:00:00Z"), entry(29.99, "2026-08-05T10:00:00Z")];

    expect(resolvePriceDisplay(19.99, "EUR", history).previousAmount).toBe(29.99);
  });

  it("no se deja engañar por el orden en que llegan las filas", () => {
    const history = [entry(19.99, "2026-08-09T10:00:00Z"), entry(29.99, "2026-08-01T10:00:00Z")];

    expect(resolvePriceDisplay(19.99, "EUR", history).previousAmount).toBe(29.99);
  });

  it("no tacha un precio anterior idéntico al actual", () => {
    const history = [entry(19.99, "2026-08-01T10:00:00Z"), entry(19.99, "2026-08-09T10:00:00Z")];

    expect(resolvePriceDisplay(19.99, "EUR", history).previousAmount).toBeNull();
  });
});
