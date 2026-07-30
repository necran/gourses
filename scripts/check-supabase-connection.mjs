// Verifica que el Supabase self-hosted del NAS es alcanzable y responde
// con las claves configuradas. Ejecutar con:
//   node --env-file=.env.local scripts/check-supabase-connection.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

if (!url || !anonKey) {
  fail(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local. Revisa docs/nas-supabase-setup.md."
  );
  process.exit(1);
}

async function check(label, path) {
  const target = new URL(path, url).toString();
  try {
    const res = await fetch(target, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (res.status >= 500) {
      fail(`${label}: el servidor respondió con error ${res.status} (${target})`);
      return false;
    }
    console.log(`✓ ${label}: responde (status ${res.status})`);
    return true;
  } catch (err) {
    fail(`${label}: no se pudo conectar a ${target} — ${err.message}`);
    return false;
  }
}

const authOk = await check("Auth (GoTrue)", "/auth/v1/health");
const restOk = await check("REST (PostgREST)", "/rest/v1/");

if (authOk && restOk) {
  console.log("\nConexión a Supabase en el NAS verificada correctamente.");
} else {
  console.log(
    "\nRevisa: red local compartida con el NAS, firewall del puerto de Kong, y que las claves coincidan con las generadas en el paso 3 de docs/nas-supabase-setup.md."
  );
}
