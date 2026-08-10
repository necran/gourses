// Una fila del histórico de precios (course_price_history, HU-004). Solo se
// añade una fila cuando el precio cambia, ver src/lib/ingesta/upsert-course.ts.
export interface PriceHistoryEntry {
  priceAmount: number | null;
  priceCurrency: string | null;
  capturedAt: string;
}

export interface PriceDisplay {
  amount: number | null;
  currency: string | null;
  /** Precio anterior a mostrar tachado. Solo se rellena si hubo una bajada real. */
  previousAmount: number | null;
}

// Decide qué precio enseñar en la ficha (HU-008). Solo se muestra el precio
// anterior tachado cuando hubo una **bajada** real: si el precio subió, o no
// cambió, no se enseña nada tachado, porque tachar un precio más bajo que el
// actual daría a entender una oferta que no existe.
//
// Tampoco se comparan importes de monedas distintas: 20 USD frente a 20 EUR no
// es una bajada, es otra moneda.
export function resolvePriceDisplay(
  currentAmount: number | null,
  currentCurrency: string | null,
  history: PriceHistoryEntry[]
): PriceDisplay {
  const display: PriceDisplay = {
    amount: currentAmount,
    currency: currentCurrency,
    previousAmount: null,
  };

  if (currentAmount === null) return display;

  const anteriores = [...history]
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .filter((entry) => entry.priceAmount !== null && entry.priceAmount !== currentAmount);

  const previo = anteriores[0];
  if (!previo || previo.priceAmount === null) return display;
  if (previo.priceCurrency !== currentCurrency) return display;
  if (previo.priceAmount <= currentAmount) return display;

  display.previousAmount = previo.priceAmount;
  return display;
}
