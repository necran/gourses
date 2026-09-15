import { defineConfig } from "@playwright/test";

// Tests de la analítica con consentimiento (HU-051).
//
// Van aparte porque necesitan un servidor arrancado **con** identificador de
// Google Analytics, y el de la suite normal va sin él a propósito. No se puede
// levantar un segundo `next dev` en la misma carpeta (Next lo impide), así que
// se compila y se arranca en otro puerto con un identificador de prueba.
//
// Las peticiones a Google se interceptan en los propios tests: nunca sale
// tráfico hacia la propiedad real.
//
//   npm run test:e2e:analitica
const PUERTO = 3200;

export default defineConfig({
  testDir: "./e2e-analitica",
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}` },
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_PUBLIC_GA_ID: "G-PRUEBA0000" },
  },
});
