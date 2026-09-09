import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCategories, resolveApiUrl } from "./fetch-catalog";
import { UdemyShapeError } from "./normalize";

const BASE = "https://www.udemy.com";

function mockFetchResponse(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  });
}

// HU-033: la API de Udemy filtra qué catálogo devuelve según Accept-Language.
describe("locale de la petición (HU-033)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sin locale en las credenciales, no manda Accept-Language", async () => {
    const fetchMock = mockFetchResponse({ results: [] });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCategories({ baseUrl: BASE, clientId: "a", clientSecret: "b" });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Accept-Language"]).toBeUndefined();
  });

  it("con locale en las credenciales, lo manda tal cual", async () => {
    const fetchMock = mockFetchResponse({ results: [] });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCategories({ baseUrl: BASE, clientId: "a", clientSecret: "b", locale: "es" });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Accept-Language"]).toBe("es");
  });
});

describe("resolveApiUrl", () => {
  it("resuelve una ruta relativa contra la base", () => {
    expect(resolveApiUrl(BASE, "/api-2.0/course-categories/").toString()).toBe(
      "https://www.udemy.com/api-2.0/course-categories/"
    );
  });

  it("conserva los parámetros internos que la propia API incluye en la url de la unidad", () => {
    const url = resolveApiUrl(BASE, "/api-2.0/discovery-units/bestseller/?fl=cat&sos=pc");
    expect(url.searchParams.get("fl")).toBe("cat");
    expect(url.searchParams.get("sos")).toBe("pc");
  });

  it("acepta una url absoluta del mismo origen", () => {
    expect(resolveApiUrl(BASE, "https://www.udemy.com/api-2.0/courses/1/").toString()).toBe(
      "https://www.udemy.com/api-2.0/courses/1/"
    );
  });

  // La url de paginación viene de una respuesta externa: si la API (o alguien
  // que la suplante) devolviera otro host, seguirla mandaría las credenciales
  // Basic a un tercero. Debe cortarse, no seguirse.
  it("rechaza una url que cambia de host", () => {
    expect(() => resolveApiUrl(BASE, "https://evil.example.com/api-2.0/courses/")).toThrow(
      UdemyShapeError
    );
  });

  it("rechaza una url que cambia de protocolo", () => {
    expect(() => resolveApiUrl(BASE, "http://www.udemy.com/api-2.0/courses/")).toThrow(
      UdemyShapeError
    );
  });

  it("rechaza una url protocol-relative que apunta a otro host", () => {
    expect(() => resolveApiUrl(BASE, "//evil.example.com/api-2.0/courses/")).toThrow(
      UdemyShapeError
    );
  });
});
