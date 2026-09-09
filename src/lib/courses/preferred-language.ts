// Idioma preferido del visitante, para priorizar sin filtrar (HU-032).
//
// Se lee de la cabecera Accept-Language en vez de la IP: es la señal que el
// propio HTTP define para esto (RFC 9110 §12.5.4), el navegador ya la manda
// sola, y refleja lo que la persona configuró de verdad en vez de adivinarlo
// por dónde está conectada — alguien en España con el navegador en inglés
// probablemente quiere cursos en inglés, no en español porque la IP resuelva
// a Madrid. Tampoco hace falta guardar ni tratar su IP para nada de esto.
//
// Solo se admite un código de dos letras (es, en, fr...): es el formato que
// guarda `courses.language`. Una región o script (es-MX, zh-Hans-CN) se
// recorta a su subetiqueta principal.
export function preferredLanguageFrom(
  acceptLanguage: string | null | undefined
): string | null {
  if (!acceptLanguage) return null;

  const candidatos = acceptLanguage
    .split(",")
    .map((parte) => {
      const [tagCrudo, ...parametros] = parte.trim().split(";");
      const tag = tagCrudo.trim();
      const qParam = parametros.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 1 };
    })
    // q=0 significa "no lo quiero", y "*" no es un idioma.
    .filter((c) => c.q > 0 && c.tag !== "" && c.tag !== "*")
    // Estable: a igual preferencia, se respeta el orden en que vinieron.
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidatos) {
    const principal = tag.split("-")[0]?.toLowerCase() ?? "";
    if (/^[a-z]{2}$/.test(principal)) return principal;
  }

  return null;
}
