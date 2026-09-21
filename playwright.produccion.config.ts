import { defineConfig } from "@playwright/test";

// Tests que solo tienen sentido con la build de producción (HU-071).
//
// Van aparte porque el prefetch de enlaces de Next **solo existe en producción**:
// el servidor de desarrollo de la suite normal no genera esas peticiones, así que
// no puede detectar que vuelvan. Como en la analítica (HU-051), se compila y se
// arranca en otro puerto, porque no se puede levantar un segundo `next dev` en la
// misma carpeta.
//
//   npm run test:e2e:produccion
const PUERTO = 3300;

export default defineConfig({
  testDir: "./e2e-produccion",
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}` },
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
