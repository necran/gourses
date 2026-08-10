import { defineConfig } from "@playwright/test";

// Algunos tests e2e necesitan sembrar datos concretos en la base (p. ej. una
// bajada de precio, que no existe de forma natural en el catálogo ingerido).
// El servidor de dev ya lee .env.local por su cuenta; esto es para el proceso
// de tests.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local, esos tests se saltan solos.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
