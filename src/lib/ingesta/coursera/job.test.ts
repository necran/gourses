import { describe, expect, it, vi } from "vitest";
import { runCourseraIngestJob } from "./job";
import type { CourseStore } from "../upsert-course";
import * as fetchCatalog from "./fetch-catalog";

function makeStore(): CourseStore {
  return {
    findBySourceAndSourceId: vi.fn().mockResolvedValue(null),
    insertCourse: vi.fn().mockResolvedValue({ id: "id" }),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    insertPriceHistory: vi.fn().mockResolvedValue(undefined),
  };
}

describe("runCourseraIngestJob", () => {
  it("guarda los cursos válidos y sigue adelante ante uno mal formado", async () => {
    vi.spyOn(fetchCatalog, "fetchCourseraCatalogPage").mockResolvedValueOnce({
      elements: [
        { id: "1", slug: "a", name: "Curso A" },
        { id: "2", slug: "b" }, // sin "name": fallo puntual, no de forma
        { id: "3", slug: "c", name: "Curso C" },
      ],
      next: null,
    });

    const store = makeStore();
    const result = await runCourseraIngestJob({ baseUrl: "https://api.coursera.org", store });

    expect(result.processed).toBe(3);
    expect(result.saved).toBe(2);
    expect(result.failedCourses).toHaveLength(1);
    expect(result.failedCourses[0].id).toBe("2");

    vi.restoreAllMocks();
  });

  it("detiene el job si la API cambia de forma de manera incompatible", async () => {
    vi.spyOn(fetchCatalog, "fetchCourseraCatalogPage").mockRejectedValueOnce(
      Object.assign(new Error("Cambio de forma en la respuesta de Coursera Catalog API: falta 'elements'"), {
        name: "CourseraShapeError",
      })
    );

    const store = makeStore();
    await expect(runCourseraIngestJob({ baseUrl: "https://api.coursera.org", store })).rejects.toThrow(
      /Cambio de forma/
    );

    vi.restoreAllMocks();
  });

  it("pagina hasta que no hay más páginas o se alcanza maxPages", async () => {
    const spy = vi
      .spyOn(fetchCatalog, "fetchCourseraCatalogPage")
      .mockResolvedValueOnce({ elements: [{ id: "1", slug: "a", name: "Curso A" }], next: "2" })
      .mockResolvedValueOnce({ elements: [{ id: "2", slug: "b", name: "Curso B" }], next: null });

    const store = makeStore();
    const result = await runCourseraIngestJob({ baseUrl: "https://api.coursera.org", store });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.saved).toBe(2);

    vi.restoreAllMocks();
  });
});
