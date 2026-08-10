import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./fetch-catalog";
import { UdemyShapeError } from "./normalize";

const BASE = "https://www.udemy.com";

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
