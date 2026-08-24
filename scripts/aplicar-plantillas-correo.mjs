// Sube (o comprueba) las plantillas de correo de Supabase Auth.
//
// El panel de Supabase no tiene historial ni revisión: un cambio hecho ahí no
// aparece en ningún diff y no hay forma de saber qué se está enviando de
// verdad. Por eso la fuente de verdad son los ficheros de
// `supabase/plantillas-correo/`, y esto los empuja.
//
//   node --env-file=.env.local scripts/aplicar-plantillas-correo.mjs            (comprueba)
//   node --env-file=.env.local scripts/aplicar-plantillas-correo.mjs --aplicar  (sube)
//
// Por defecto **no escribe nada**: enseña las diferencias y termina. Escribir
// en la configuración de Auth de producción es de las cosas que, si sale mal,
// dejan a todo el mundo sin poder entrar, así que se pide a propósito.
//
// El token es personal y de una sola persona; vive en .env.local, nunca en el
// repositorio ni en el workflow (ver .claude/rules/seguridad.md).
import { PLANTILLAS_AUTH, leerPlantilla } from "../src/lib/correo/plantillas-auth.ts";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const aplicar = process.argv.includes("--aplicar");

for (const [nombre, valor] of [
  ["SUPABASE_ACCESS_TOKEN", token],
  ["SUPABASE_PROJECT_REF", ref],
]) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
}

const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const cabeceras = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Lo que debería haber allí arriba, según el repositorio.
const deseado = {};
for (const plantilla of PLANTILLAS_AUTH) {
  deseado[`mailer_subjects_${plantilla.claveSupabase}`] = plantilla.asunto;
  deseado[`mailer_templates_${plantilla.claveSupabase}_content`] = leerPlantilla(plantilla.id);
}

const respuesta = await fetch(API, { headers: cabeceras });
if (!respuesta.ok) {
  // Sin cuerpo: la respuesta de error puede traer detalles del proyecto.
  console.error(`No se pudo leer la configuración de Auth (HTTP ${respuesta.status}).`);
  process.exit(1);
}
const actual = await respuesta.json();

const distintas = Object.keys(deseado).filter((clave) => actual[clave] !== deseado[clave]);

if (distintas.length === 0) {
  console.log("Las plantillas del proyecto ya coinciden con las del repositorio.");
  process.exit(0);
}

console.log(`Difieren ${distintas.length} campo(s):`);
for (const clave of distintas) {
  const antes = actual[clave] ?? "(vacío)";
  console.log(`\n· ${clave}`);
  console.log(`  allí: ${String(antes).slice(0, 120).replace(/\s+/g, " ")}`);
  console.log(`  aquí: ${String(deseado[clave]).slice(0, 120).replace(/\s+/g, " ")}`);
}

if (!aplicar) {
  console.log("\nNada escrito. Repite con --aplicar para subirlas.");
  process.exit(1);
}

const escritura = await fetch(API, {
  method: "PATCH",
  headers: cabeceras,
  body: JSON.stringify(Object.fromEntries(distintas.map((c) => [c, deseado[c]]))),
});
if (!escritura.ok) {
  console.error(`No se pudieron subir las plantillas (HTTP ${escritura.status}).`);
  process.exit(1);
}
console.log("\nPlantillas subidas.");
