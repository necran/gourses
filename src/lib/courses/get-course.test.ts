import { describe, expect, it } from "vitest";
import { isValidCourseId } from "./get-course";

describe("isValidCourseId", () => {
  it("acepta un UUID como los que genera gen_random_uuid()", () => {
    expect(isValidCourseId("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("acepta un UUID en mayúsculas", () => {
    expect(isValidCourseId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rechaza cadenas que no son un UUID", () => {
    for (const id of [
      "",
      "1",
      "no-soy-un-uuid",
      "3f2504e0-4f89-41d3-9a0c",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301-extra",
      "zzzzzzzz-4f89-41d3-9a0c-0305e82c3301",
    ]) {
      expect(isValidCourseId(id)).toBe(false);
    }
  });

  // El id viene de la URL: no debe poder colarse sintaxis de filtro de
  // PostgREST ni de SQL por esta vía.
  it("rechaza intentos de inyección en el identificador", () => {
    for (const id of [
      "' or 1=1 --",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301' or '1'='1",
      "*",
      "id.neq.0",
      "../../etc/passwd",
    ]) {
      expect(isValidCourseId(id)).toBe(false);
    }
  });

  it("rechaza un UUID con espacios alrededor", () => {
    expect(isValidCourseId(" 3f2504e0-4f89-41d3-9a0c-0305e82c3301 ")).toBe(false);
  });
});
