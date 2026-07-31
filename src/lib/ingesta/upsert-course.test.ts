import { describe, expect, it, vi } from "vitest";
import { upsertCourse, type CourseStore } from "./upsert-course";
import type { NormalizedCourse } from "../courses/schema";

function makeCourse(overrides: Partial<NormalizedCourse> = {}): NormalizedCourse {
  return {
    source: "coursera",
    sourceId: "c-1",
    title: "Curso de prueba",
    description: null,
    priceAmount: 19.99,
    priceCurrency: "USD",
    rating: null,
    level: null,
    language: null,
    instructor: null,
    affiliateUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

function makeStore(overrides: Partial<CourseStore> = {}): CourseStore {
  return {
    findBySourceAndSourceId: vi.fn().mockResolvedValue(null),
    insertCourse: vi.fn().mockResolvedValue({ id: "new-id" }),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    insertPriceHistory: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("upsertCourse", () => {
  it("inserta un curso nuevo y registra su precio inicial en el histórico", async () => {
    const store = makeStore();
    const result = await upsertCourse(store, makeCourse());

    expect(store.insertCourse).toHaveBeenCalledTimes(1);
    expect(store.insertPriceHistory).toHaveBeenCalledWith("new-id", 19.99, "USD");
    expect(result).toEqual({ id: "new-id", priceChanged: true });
  });

  it("actualiza un curso existente y añade fila al histórico cuando el precio cambia", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi
        .fn()
        .mockResolvedValue({ id: "existing-id", priceAmount: 19.99, priceCurrency: "USD" }),
    });

    const result = await upsertCourse(store, makeCourse({ priceAmount: 14.99 }));

    expect(store.updateCourse).toHaveBeenCalledWith("existing-id", expect.objectContaining({ priceAmount: 14.99 }));
    expect(store.insertPriceHistory).toHaveBeenCalledWith("existing-id", 14.99, "USD");
    expect(result).toEqual({ id: "existing-id", priceChanged: true });
  });

  it("actualiza un curso existente sin tocar el histórico cuando el precio no cambia", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi
        .fn()
        .mockResolvedValue({ id: "existing-id", priceAmount: 19.99, priceCurrency: "USD" }),
    });

    const result = await upsertCourse(store, makeCourse({ priceAmount: 19.99, priceCurrency: "USD" }));

    expect(store.updateCourse).toHaveBeenCalledTimes(1);
    expect(store.insertPriceHistory).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "existing-id", priceChanged: false });
  });
});
