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
    category: null,
    numReviews: null,
    numSubscribers: null,
    whatYouWillLearn: null,
    requirements: null,
    durationMinMinutes: null,
    durationMaxMinutes: null,
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

// HU-023. El fallo que motiva esto se vio en una ingesta real contra el NAS:
// los cursos sin precio subieron de 994 a 1.123 en una pasada que no añadía
// cursos nuevos. Es decir, estaba **borrando precios que ya teníamos** cada vez
// que la llamada de detalle se comía un 429.
//
// La raíz es que `null` significaba dos cosas a la vez: "este curso no tiene
// precio" y "no he podido averiguar el precio". `priceUnknown` las separa.
describe("upsertCourse — precio que no se ha podido averiguar", () => {
  it("no borra el precio guardado cuando el detalle falló", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi
        .fn()
        .mockResolvedValue({ id: "existing-id", priceAmount: 19.99, priceCurrency: "USD" }),
    });

    const result = await upsertCourse(
      store,
      makeCourse({ priceAmount: null, priceCurrency: null, priceUnknown: true })
    );

    // Se actualizan los metadatos, pero el precio que se escribe es el que ya
    // había, no el null que trae el curso normalizado.
    expect(store.updateCourse).toHaveBeenCalledWith(
      "existing-id",
      expect.objectContaining({ priceAmount: 19.99, priceCurrency: "USD" })
    );
    expect(result.priceChanged).toBe(false);
  });

  // Si además se apuntara en el histórico, la bajada fantasma a "sin precio"
  // dispararía los avisos de HU-021: correos a gente diciendo que su curso ha
  // bajado porque un 429 nos dejó sin dato.
  it("no apunta nada en el histórico cuando el precio es desconocido", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi
        .fn()
        .mockResolvedValue({ id: "existing-id", priceAmount: 19.99, priceCurrency: "USD" }),
    });

    await upsertCourse(store, makeCourse({ priceAmount: null, priceUnknown: true }));

    expect(store.insertPriceHistory).not.toHaveBeenCalled();
  });

  // HU-029: descripción, reseñas, alumnos y las dos listas vienen de la misma
  // llamada que el precio, así que un detalle fallido las deja igual de
  // desconocidas — y "desconocido" no puede borrar lo que ya se sabía.
  it("no borra la descripción ni las estadísticas cuando el detalle falló", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi.fn().mockResolvedValue({
        id: "existing-id",
        priceAmount: 19.99,
        priceCurrency: "USD",
        description: "Descripción real ya guardada",
        numReviews: 1200,
        numSubscribers: 5000,
        whatYouWillLearn: ["Aprender X"],
        requirements: ["Saber Y"],
      }),
    });

    await upsertCourse(
      store,
      makeCourse({
        priceAmount: null,
        priceCurrency: null,
        priceUnknown: true,
        description: null,
        numReviews: null,
        numSubscribers: null,
        whatYouWillLearn: null,
        requirements: null,
      })
    );

    expect(store.updateCourse).toHaveBeenCalledWith(
      "existing-id",
      expect.objectContaining({
        description: "Descripción real ya guardada",
        numReviews: 1200,
        numSubscribers: 5000,
        whatYouWillLearn: ["Aprender X"],
        requirements: ["Saber Y"],
      })
    );
  });

  // El detalle SÍ respondió, solo que sin precio: eso no es "desconocido", es
  // el dato real, así que no debe conservar nada del curso anterior.
  it("cuando el detalle respondió de verdad, no conserva nada del curso anterior", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi.fn().mockResolvedValue({
        id: "existing-id",
        priceAmount: 19.99,
        priceCurrency: "USD",
        description: "Descripción vieja",
        numReviews: 10,
        numSubscribers: 20,
        whatYouWillLearn: null,
        requirements: null,
      }),
    });

    await upsertCourse(
      store,
      makeCourse({
        priceAmount: 24.99,
        priceCurrency: "USD",
        priceUnknown: false,
        description: "Descripción nueva",
        numReviews: 30,
      })
    );

    expect(store.updateCourse).toHaveBeenCalledWith(
      "existing-id",
      expect.objectContaining({ description: "Descripción nueva", numReviews: 30 })
    );
  });

  // Un curso nuevo sí se guarda —vale más tenerlo en el catálogo sin precio que
  // no tenerlo—, pero no se inventa un histórico que diría que vale nada.
  it("inserta el curso nuevo pero sin fila de histórico", async () => {
    const store = makeStore();

    const result = await upsertCourse(store, makeCourse({ priceAmount: null, priceUnknown: true }));

    expect(store.insertCourse).toHaveBeenCalledTimes(1);
    expect(store.insertPriceHistory).not.toHaveBeenCalled();
    expect(result.priceChanged).toBe(false);
  });

  // El caso contrario, que no hay que confundir: el detalle respondió y dijo
  // que no hay precio. Eso sí es un dato, y sí se guarda.
  it("un precio ausente de verdad sí se guarda y se apunta", async () => {
    const store = makeStore({
      findBySourceAndSourceId: vi
        .fn()
        .mockResolvedValue({ id: "existing-id", priceAmount: 19.99, priceCurrency: "USD" }),
    });

    const result = await upsertCourse(store, makeCourse({ priceAmount: null, priceCurrency: null }));

    expect(store.updateCourse).toHaveBeenCalledWith(
      "existing-id",
      expect.objectContaining({ priceAmount: null })
    );
    expect(store.insertPriceHistory).toHaveBeenCalledWith("existing-id", null, null);
    expect(result.priceChanged).toBe(true);
  });
});
