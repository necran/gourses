// Copia las plantillas de correo al Supabase del NAS.
//
// Es el equivalente de `npm run correo:plantillas` para el entorno de
// desarrollo. Son dos caminos distintos porque los dos Supabase no se
// configuran igual:
//
//   Supabase Cloud → Management API, campos `mailer_templates_*_content`.
//   Self-hosted    → `GOTRUE_MAILER_TEMPLATES_*`, que es **una URL**, no una
//                    ruta de fichero. En el NAS las sirve un busybox httpd
//                    (`supabase-plantillas`) desde esta carpeta; ver
//                    `docker-compose.override.yml` allí.
//
// La fuente de verdad es la misma en los dos casos:
// `supabase/plantillas-correo/*.html`.
//
//   npm run correo:plantillas-nas
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANTILLAS_AUTH } from "../src/lib/correo/plantillas-auth.ts";

// Ni el destino ni la ruta van fijados en el código: son de esta instalación,
// no del proyecto (ver la regla de no hardcodear direcciones en CLAUDE.md).
const destino = process.env.NAS_SSH_DESTINO;
const carpeta = process.env.NAS_SUPABASE_DIR;
const clave = process.env.NAS_SSH_KEY;

if (!destino || !carpeta) {
  console.error(
    "Faltan NAS_SSH_DESTINO (usuario@host) o NAS_SUPABASE_DIR en .env.local.\n" +
      "Ver .env.example."
  );
  process.exit(1);
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const ORIGEN = join(AQUI, "../supabase/plantillas-correo");
const REMOTA = `${carpeta.replace(/\/+$/, "")}/volumes/auth/plantillas`;

const ssh = (comando, entrada) =>
  execFileSync("ssh", [...(clave ? ["-i", clave] : []), "-o", "BatchMode=yes", destino, comando], {
    input: entrada,
    encoding: "utf8",
  });

ssh(`mkdir -p ${REMOTA}`);

for (const plantilla of PLANTILLAS_AUTH) {
  const fichero = `${plantilla.id}.html`;
  // Por `stdin` y no con scp: el NAS tiene el subsistema SFTP restringido y
  // `scp` falla con «No such file or directory» aunque la carpeta exista.
  ssh(`cat > ${REMOTA}/${fichero}`, readFileSync(join(ORIGEN, fichero), "utf8"));
  console.log(`copiada ${fichero}  (asunto: ${plantilla.asunto})`);
}

// El httpd las lee del disco en cada petición, así que no hay que reiniciarlo;
// GoTrue sí las cachea, de ahí el reinicio de Auth.
ssh(`cd ${carpeta} && docker compose restart auth`);
console.log("\nAuth reiniciado. Comprueba el resultado en el buzón de Mailpit.");
