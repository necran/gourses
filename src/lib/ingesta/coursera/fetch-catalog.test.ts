import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCourseraCatalogPage } from "./fetch-catalog";
import { CourseraShapeError } from "./normalize";

function mockFetchResponse(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: 200,
    statusText: "OK",
    json: async () => body,
  });
}

describe("fetchCourseraCatalogPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve los elementos y el cursor de la siguiente página", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({ elements: [{ id: "1" }], paging: { next: "1", total: 2 } })
    );

    const page = await fetchCourseraCatalogPage("https://api.coursera.org");
    expect(page.elements).toEqual([{ id: "1" }]);
    expect(page.next).toBe("1");
  });

  it("devuelve next=null cuando no hay más páginas", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({ elements: [], paging: { total: 0 } }));

    const page = await fetchCourseraCatalogPage("https://api.coursera.org");
    expect(page.next).toBeNull();
  });

  it("lanza CourseraShapeError si la respuesta ya no trae 'elements' (cambio de contrato de la API)", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({ courses: [] }));

    await expect(fetchCourseraCatalogPage("https://api.coursera.org")).rejects.toThrow(CourseraShapeError);
  });

  it("lanza un error normal (no de forma) si la API responde con un código de error HTTP", async () => {
    vi.stubGlobal("fetch", mockFetchResponse({}, false));

    try {
      await fetchCourseraCatalogPage("https://api.coursera.org");
      expect.unreachable();
    } catch (error) {
      expect(error).not.toBeInstanceOf(CourseraShapeError);
      expect((error as Error).message).toMatch(/200 OK/);
    }
  });
});
