import { describe, expect, it } from "vitest";
import {
  aResumen,
  categoriasDestacadas,
  descripcionGuia,
  euros,
  filasGuia,
  horas,
  porcentaje,
  seccionesGuia,
  temasDestacados,
  tituloGuia,
  type ResumenPlataforma,
} from "./guia-plataformas";

// Cifras de la base de desarrollo del 2026-09-15, tal como las devuelve la vista.
const udemy: ResumenPlataforma = aResumen({
  source: "udemy",
  cursos: "11400",
  en_espanol: "3544",
  idiomas: "2",
  con_precio: "11115",
  con_precio_eur: "11115",
  precio_minimo_eur: "14.99",
  precio_maximo_eur: "219.99",
  precio_habitual_eur: "14.99",
  cursos_con_precio_habitual: "10166",
  con_valoracion: "11399",
  valoracion_media: "4.5678612158961312",
  con_duracion: "11398",
  duracion_mediana_minutos: 300,
  con_resenas: "10602",
  con_nivel: "11398",
});

const coursera: ResumenPlataforma = aResumen({
  source: "coursera",
  cursos: "4106",
  en_espanol: "262",
  idiomas: "20",
  con_precio: "0",
  con_precio_eur: "0",
  precio_minimo_eur: null,
  precio_maximo_eur: null,
  precio_habitual_eur: null,
  cursos_con_precio_habitual: "0",
  con_valoracion: "0",
  valoracion_media: null,
  con_duracion: "1860",
  duracion_mediana_minutos: 480,
  con_resenas: "0",
  con_nivel: "0",
});

const OPINION = /mejor|peor|recomend|certificad|suscrip|gratis/i;

describe("formato de cifras", () => {
  it("porcentajes con coma decimal solo si hace falta", () => {
    expect(porcentaje(10166, 11115)).toBe("91,5 %");
    expect(porcentaje(50, 100)).toBe("50 %");
    expect(porcentaje(100, 100)).toBe("100 %");
    expect(porcentaje(1, 0)).toBe("0 %");
  });

  it("no redondea a 100 % lo que no es todo, ni a 0 % lo que no es nada", () => {
    expect(porcentaje(11398, 11400)).toBe("99,9 %");
    expect(porcentaje(1, 11400)).toBe("0,1 %");
    expect(porcentaje(0, 11400)).toBe("0 %");
  });

  it("euros y horas en formato español", () => {
    expect(euros(14.99)).toBe("14,99 €");
    expect(euros(219.99)).toBe("219,99 €");
    expect(horas(300)).toBe("5 h");
    expect(horas(495)).toBe("8,3 h");
  });

  it("convierte las cifras que PostgREST devuelve como texto", () => {
    expect(udemy.cursos).toBe(11400);
    expect(udemy.precioHabitualEur).toBe(14.99);
    expect(coursera.precioMinimoEur).toBeNull();
  });
});

describe("filasGuia", () => {
  const filas = filasGuia(udemy, coursera);
  const fila = (etiqueta: string) => filas.find((f) => f.etiqueta === etiqueta)!;

  it("cuenta cursos, cursos en español e idiomas de cada plataforma", () => {
    expect(fila("Cursos en el catálogo").udemy.texto).toBe("11.400");
    expect(fila("Cursos en el catálogo").coursera.texto).toBe("4.106");
    expect(fila("En español").udemy.texto).toBe("3.544 (31,1 %)");
    expect(fila("En español").coursera.texto).toBe("262 (6,4 %)");
    expect(fila("Idiomas").coursera.texto).toBe("20");
  });

  it("el precio de Udemy dice el habitual, su peso y el rango", () => {
    expect(fila("Precio por curso").udemy.texto).toBe("14,99 € en el 91,5 % de los cursos (de 14,99 € a 219,99 €)");
  });

  it("lo que Coursera no publica se dice, nunca como cero", () => {
    for (const etiqueta of ["Precio por curso", "Valoraciones", "Nivel del curso"]) {
      expect(fila(etiqueta).coursera, etiqueta).toEqual({ texto: "No lo publica", publicado: false });
    }
    expect(filas.map((f) => f.coursera.texto).join(" | ")).not.toMatch(/(^|\s)0(\s|,|$)|0 €/);
  });

  it("la duración dice la mediana y en cuántos cursos la publica, si no es en todos", () => {
    expect(fila("Duración").udemy.texto).toBe("5 h de mediana; la publica en el 99,9 % de los cursos");
    expect(fila("Duración").coursera.texto).toBe("8 h de mediana; la publica en el 45,3 % de los cursos");
    expect(filasGuia({ ...udemy, conDuracion: udemy.cursos }, coursera)[5].udemy.texto).toBe("5 h de mediana");
  });

  it("la valoración media, con dos decimales y en cuántos cursos", () => {
    expect(fila("Valoraciones").udemy.texto).toBe("4,57 de media, en 11.399 cursos");
  });

  it("no opina: ninguna celda dice que una plataforma sea mejor", () => {
    expect(JSON.stringify(filas)).not.toMatch(OPINION);
  });
});

describe("seccionesGuia", () => {
  const secciones = seccionesGuia(udemy, coursera);
  const texto = (titulo: string) => secciones.find((s) => s.titulo === titulo)!.parrafos;

  it("cuenta el español y los idiomas de cada plataforma", () => {
    expect(texto("Cursos en español")).toEqual([
      "Udemy tiene 3.544 cursos en español de 11.400, el 31,1 % de su catálogo, que abarca 2 idiomas.",
      "Coursera tiene 262 cursos en español de 4.106, el 6,4 % de su catálogo, que abarca 20 idiomas.",
    ]);
  });

  it("el precio: las cifras de Udemy y que Coursera no lo publica", () => {
    expect(texto("Precio")[0]).toBe(
      "En Udemy, el precio más repetido es 14,99 €: lo tiene el 91,5 % de los cursos con precio. " +
        "El más barato cuesta 14,99 € y el más caro, 219,99 €."
    );
    expect(texto("Precio")[1]).toMatch(/^Coursera no publica el precio/);
  });

  it("valoraciones y duración, con lo que no se publica dicho como tal", () => {
    expect(texto("Valoraciones")[0]).toBe("En Udemy, la valoración media es 4,57 sobre 5, con nota en 11.399 cursos.");
    expect(texto("Valoraciones")[1]).toMatch(/^Coursera no publica valoraciones/);
    expect(texto("Duración")[1]).toBe(
      "En Coursera, la mitad de los cursos dura menos de 8 h y la otra mitad, más. " +
        "La duración viene en el 45,3 % de sus cursos."
    );
  });

  it("una plataforma sin ningún dato de duración lo dice", () => {
    const sinDuracion = { ...coursera, conDuracion: 0, duracionMedianaMinutos: null };
    expect(seccionesGuia(udemy, sinDuracion)[3].parrafos[1]).toBe("Coursera no publica la duración de sus cursos.");
  });

  it("no afirma nada fuera de los datos", () => {
    expect(JSON.stringify(secciones)).not.toMatch(OPINION);
  });
});

describe("dónde tiene más cursos cada plataforma", () => {
  const categorias = [
    { source: "udemy", category: "negocios", cursos: "3530", en_espanol: "900" },
    { source: "udemy", category: "diseno-y-creatividad", cursos: "1932", en_espanol: "600" },
    { source: "udemy", category: "desarrollo-personal", cursos: "2034", en_espanol: "700" },
    { source: "udemy", category: "desarrollo", cursos: "1500", en_espanol: "500" },
    { source: "udemy", category: "no-existe", cursos: "9999", en_espanol: "0" },
    { source: "coursera", category: "negocios", cursos: "1202", en_espanol: "90" },
    { source: "coursera", category: null, cursos: "50", en_espanol: "1" },
  ];

  it("las categorías con más cursos, de más a menos, solo de esa plataforma y de la lista", () => {
    expect(categoriasDestacadas(categorias, "udemy")).toEqual([
      { categoria: "negocios", cursos: 3530 },
      { categoria: "desarrollo-personal", cursos: 2034 },
      { categoria: "diseno-y-creatividad", cursos: 1932 },
    ]);
    expect(categoriasDestacadas(categorias, "coursera")).toEqual([{ categoria: "negocios", cursos: 1202 }]);
  });

  it("los temas con más cursos en español, solo los enlazables y con alguno en español", () => {
    const temas = [
      { source: "udemy", tema: "python", en_espanol: "120" },
      { source: "udemy", tema: "excel", en_espanol: "200" },
      { source: "udemy", tema: "sin-umbral", en_espanol: "500" },
      { source: "coursera", tema: "python", en_espanol: "0" },
    ];
    const enlazables = ["python", "excel"] as never[];
    expect(temasDestacados(temas, "udemy", enlazables)).toEqual([
      { tema: "excel", enEspanol: 200 },
      { tema: "python", enEspanol: 120 },
    ]);
    expect(temasDestacados(temas, "coursera", enlazables)).toEqual([]);
  });
});

describe("metadatos", () => {
  it("título y descripción propios, por debajo de 160 caracteres", () => {
    expect(tituloGuia()).toMatch(/^Udemy o Coursera/);
    const descripcion = descripcionGuia(udemy, coursera);
    expect(descripcion).toContain("11.400 de Udemy y 4.106 de Coursera");
    expect(descripcion.length).toBeLessThanOrEqual(160);
  });
});
