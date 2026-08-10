import { beforeEach, describe, expect, it, vi } from "vitest";
import { runUdemyIngestJob } from "./job";
import type { CourseStore } from "../upsert-course";
import * as api from "./fetch-catalog";
import { UdemyShapeError, type UdemyRawCourse } from "./normalize";

const creds = { baseUrl: "https://www.udemy.com", clientId: "id", clientSecret: "secret" };

function makeStore(): CourseStore {
  return {
    findBySourceAndSourceId: vi.fn().mockResolvedValue(null),
    insertCourse: vi.fn().mockResolvedValue({ id: "id" }),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    insertPriceHistory: vi.fn().mockResolvedValue(undefined),
  };
}

function course(id: number, title = `Curso ${id}`): UdemyRawCourse {
  return { id, title, url: `/course/c${id}/` };
}

interface StubOptions {
  categories?: Array<{ id: number; title: string }>;
  subcategories?: Array<{ id: number; title: string }>;
  pages?: Array<{ items: UdemyRawCourse[]; totalPages: number; totalItemCount: number }>;
  unitUrl?: string | null;
}

function stubApi({
  categories = [{ id: 288, title: "Development" }],
  subcategories = [],
  pages = [{ items: [course(1)], totalPages: 1, totalItemCount: 1 }],
  unitUrl = "/api-2.0/discovery-units/bestseller/?fl=cat",
}: StubOptions = {}) {
  vi.spyOn(api, "fetchCategories").mockResolvedValue(categories);
  vi.spyOn(api, "fetchSubcategories").mockResolvedValue(subcategories);
  vi.spyOn(api, "fetchCourseUnitUrl").mockResolvedValue(unitUrl);
  const unitSpy = vi.spyOn(api, "fetchUnitPage");
  for (const page of pages) unitSpy.mockResolvedValueOnce(page);
  const detailSpy = vi
    .spyOn(api, "fetchCourseDetail")
    .mockResolvedValue({ price_detail: { amount: 17.99, currency: "EUR" } });
  return { unitSpy, detailSpy };
}

describe("runUdemyIngestJob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("guarda los cursos del catálogo con su precio", async () => {
    stubApi({ pages: [{ items: [course(1), course(2)], totalPages: 1, totalItemCount: 2 }] });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(result.processed).toBe(2);
    expect(result.saved).toBe(2);
    expect(result.failedCourses).toHaveLength(0);
    expect(store.insertCourse).toHaveBeenCalledWith(
      expect.objectContaining({ source: "udemy", sourceId: "1", priceAmount: 17.99 })
    );
  });

  it("sigue adelante ante un curso mal formado y lo registra como fallo puntual", async () => {
    stubApi({
      pages: [
        {
          items: [course(1), { id: 2, url: "/course/c2/" }, course(3)],
          totalPages: 1,
          totalItemCount: 3,
        },
      ],
    });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(result.processed).toBe(3);
    expect(result.saved).toBe(2);
    expect(result.failedCourses).toHaveLength(1);
    expect(result.failedCourses[0].id).toBe(2);
  });

  it("guarda el curso sin precio si falla la llamada de detalle, en vez de perderlo", async () => {
    const { detailSpy } = stubApi();
    detailSpy.mockReset();
    detailSpy.mockRejectedValue(new Error("Udemy API respondió 429 Too Many Requests"));
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(result.saved).toBe(1);
    expect(store.insertCourse).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "1", priceAmount: null, priceCurrency: null })
    );
    expect(result.failedCourses[0].error).toMatch(/detalle no disponible/);
  });

  it("detiene el job si la API cambia de forma de manera incompatible", async () => {
    vi.spyOn(api, "fetchCategories").mockRejectedValue(
      new UdemyShapeError("falta 'results'", null)
    );
    const store = makeStore();

    await expect(runUdemyIngestJob({ creds, store })).rejects.toThrow(UdemyShapeError);
    expect(store.insertCourse).not.toHaveBeenCalled();
  });

  it("no guarda nada a medias si el contrato se rompe a mitad del recorrido", async () => {
    const { unitSpy } = stubApi({
      pages: [{ items: [course(1)], totalPages: 2, totalItemCount: 2 }],
    });
    unitSpy.mockRejectedValueOnce(new UdemyShapeError("falta 'unit'", null));
    const store = makeStore();

    await expect(runUdemyIngestJob({ creds, store })).rejects.toThrow(UdemyShapeError);
    // El curso de la primera página sí se guardó; lo que no ocurre es seguir
    // procesando sobre un contrato roto.
    expect(store.insertCourse).toHaveBeenCalledTimes(1);
  });

  it("pagina hasta agotar las páginas del ámbito", async () => {
    const { unitSpy } = stubApi({
      pages: [
        { items: [course(1)], totalPages: 3, totalItemCount: 3 },
        { items: [course(2)], totalPages: 3, totalItemCount: 3 },
        { items: [course(3)], totalPages: 3, totalItemCount: 3 },
      ],
    });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(unitSpy).toHaveBeenCalledTimes(3);
    expect(result.saved).toBe(3);
  });

  it("respeta maxPagesPerScope", async () => {
    const { unitSpy } = stubApi({
      pages: [
        { items: [course(1)], totalPages: 5, totalItemCount: 5 },
        { items: [course(2)], totalPages: 5, totalItemCount: 5 },
      ],
    });
    const store = makeStore();

    await runUdemyIngestJob({ creds, store, maxPagesPerScope: 2 });

    expect(unitSpy).toHaveBeenCalledTimes(2);
  });

  it("no procesa dos veces un curso que aparece en varios ámbitos", async () => {
    const { detailSpy } = stubApi({
      categories: [
        { id: 288, title: "Development" },
        { id: 294, title: "IT & Software" },
      ],
      pages: [
        { items: [course(1)], totalPages: 1, totalItemCount: 1 },
        { items: [course(1)], totalPages: 1, totalItemCount: 1 },
      ],
    });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(result.scopes).toBe(2);
    expect(result.processed).toBe(1);
    expect(detailSpy).toHaveBeenCalledTimes(1);
  });

  it("recorre subcategorías cuando se le pide", async () => {
    stubApi({
      categories: [{ id: 288, title: "Development" }],
      subcategories: [{ id: 8, title: "Web Development" }],
      pages: [
        { items: [course(1)], totalPages: 1, totalItemCount: 1 },
        { items: [course(2)], totalPages: 1, totalItemCount: 1 },
      ],
    });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store, includeSubcategories: true });

    expect(result.scopes).toBe(2);
    expect(result.saved).toBe(2);
  });

  it("ignora sin romper un ámbito que no tiene unidad de cursos", async () => {
    stubApi({ unitUrl: null });
    const store = makeStore();

    const result = await runUdemyIngestJob({ creds, store });

    expect(result.scopes).toBe(0);
    expect(result.saved).toBe(0);
    expect(result.failedCourses).toHaveLength(0);
  });
});
