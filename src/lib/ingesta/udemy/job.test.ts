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

  // HU-023: el detalle es una petición por curso y es lo que decide si el job
  // cabe en el tope del workflow. Se pide con concurrencia acotada.
  describe("concurrencia del detalle", () => {
    it("no pide más detalles a la vez que el límite", async () => {
      const items = Array.from({ length: 20 }, (_, i) => course(i + 1));
      stubApi({ pages: [{ items, totalPages: 1, totalItemCount: items.length }] });

      let enCurso = 0;
      let maximo = 0;
      vi.spyOn(api, "fetchCourseDetail").mockImplementation(async () => {
        enCurso += 1;
        maximo = Math.max(maximo, enCurso);
        await new Promise((r) => setTimeout(r, 5));
        enCurso -= 1;
        return { price_detail: { amount: 9.99, currency: "EUR" } };
      });

      const result = await runUdemyIngestJob({ creds, store: makeStore(), concurrenciaDetalle: 4 });

      expect(maximo).toBe(4);
      expect(result.saved).toBe(20);
    });

    // Si la deduplicación ocurriera dentro de las tareas concurrentes, dos
    // obreros podrían pedir el mismo curso a la vez. Los ámbitos se solapan
    // mucho, así que eso convertiría la concurrencia en trabajo repetido.
    it("no pide dos veces el detalle del mismo curso aunque salga en varios ámbitos", async () => {
      stubApi({
        categories: [
          { id: 1, title: "Development" },
          { id: 2, title: "Design" },
        ],
        pages: [
          { items: [course(1), course(2)], totalPages: 1, totalItemCount: 2 },
          { items: [course(2), course(3)], totalPages: 1, totalItemCount: 2 },
        ],
      });
      const detailSpy = vi
        .spyOn(api, "fetchCourseDetail")
        .mockResolvedValue({ price_detail: { amount: 9.99, currency: "EUR" } });

      const result = await runUdemyIngestJob({ creds, store: makeStore(), concurrenciaDetalle: 4 });

      expect(result.processed).toBe(3);
      expect(detailSpy).toHaveBeenCalledTimes(3);
    });

    // Un detalle que no llega no descarta el curso: se guarda sin precio y el
    // fallo queda anotado. Con concurrencia debe seguir siendo así.
    it("un detalle que falla no impide que se guarden los demás", async () => {
      const items = Array.from({ length: 6 }, (_, i) => course(i + 1));
      stubApi({ pages: [{ items, totalPages: 1, totalItemCount: items.length }] });

      vi.spyOn(api, "fetchCourseDetail").mockImplementation(async (_c, id) => {
        if (id === 3) throw new Error("Udemy API respondió 404 Not Found");
        return { price_detail: { amount: 9.99, currency: "EUR" } };
      });

      const result = await runUdemyIngestJob({ creds, store: makeStore(), concurrenciaDetalle: 3 });

      expect(result.saved).toBe(6);
      expect(result.failedCourses).toHaveLength(1);
      expect(result.failedCourses[0]).toMatchObject({ id: 3 });
    });

    // El reintento tiene que envolver la llamada real. Si se pusiera alrededor
    // del envoltorio tolerante, este se tragaría el error y no se reintentaría
    // nunca: el job parecería correcto y perdería precios en silencio.
    it("reintenta un 429 del detalle en vez de perder el precio", async () => {
      stubApi({ pages: [{ items: [course(1)], totalPages: 1, totalItemCount: 1 }] });

      let intentos = 0;
      vi.spyOn(api, "fetchCourseDetail").mockImplementation(async () => {
        intentos += 1;
        if (intentos < 3) throw new Error("Udemy API respondió 429 Too Many Requests");
        return { price_detail: { amount: 12.5, currency: "EUR" } };
      });

      const store = makeStore();
      const result = await runUdemyIngestJob({ creds, store, concurrenciaDetalle: 2 });

      expect(intentos).toBe(3);
      expect(result.failedCourses).toHaveLength(0);
      expect(store.insertCourse).toHaveBeenCalledWith(
        expect.objectContaining({ priceAmount: 12.5 })
      );
    }, 20_000);

    // Un cambio de forma de la propia API sí detiene el job: no se puede seguir
    // guardando sobre un contrato que ya no se cumple.
    it("un cambio de forma de la API detiene el job aunque haya concurrencia", async () => {
      // Un curso mal formado se tolera (ya cubierto arriba). Lo que NO se
      // tolera es que cambie la forma de la propia API: eso ocurre dentro de
      // una tarea concurrente y tiene que salir del job, no quedarse entre los
      // fallos puntuales, para no guardar sobre un contrato que ya no se cumple.
      stubApi({
        pages: [{ items: [course(1), course(2)], totalPages: 1, totalItemCount: 2 }],
      });
      vi.spyOn(api, "fetchCourseDetail").mockRejectedValue(
        new UdemyShapeError("falta 'price_detail'", {})
      );

      await expect(
        runUdemyIngestJob({ creds, store: makeStore(), concurrenciaDetalle: 4 })
      ).rejects.toBeInstanceOf(UdemyShapeError);
    });
  });
});
