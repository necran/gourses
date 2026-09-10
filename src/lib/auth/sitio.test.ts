import { afterEach, describe, expect, it } from "vitest";
import { urlSitio } from "./sitio";
import { TITULAR } from "../legal/titular";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("urlSitio", () => {
  it("usa la dirección configurada", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(urlSitio()).toBe("http://localhost:3000");
  });

  it("cae en la canónica del titular si no hay variable", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(urlSitio()).toBe(TITULAR.url);
  });

  it("ignora una variable vacía o en blanco", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    expect(urlSitio()).toBe(TITULAR.url);
  });

  // La barra final duplicaría la del enlace ("...:3000//acceder/callback"), y
  // Supabase compara la dirección de vuelta contra su lista tal cual.
  it("quita la barra final", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";
    expect(urlSitio()).toBe("http://localhost:3000");
  });
});
