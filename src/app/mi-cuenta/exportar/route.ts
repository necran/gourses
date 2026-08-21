import { NextResponse } from "next/server";
import { createSupabaseSessionClient } from "../../../lib/supabase/session-client";
import { listarFavoritos } from "../../../lib/favorites/favorites";
import { avisosActivados } from "../../../lib/alertas/preferencias";
import {
  componerExportacion,
  nombreFicheroExportacion,
} from "../../../lib/cuenta/exportacion";

// Descarga de los datos personales (HU-024, RGPD art. 20).
//
// Es una ruta y no una acción de servidor porque lo que devuelve es un fichero,
// no una navegación: el navegador tiene que recibirlo como adjunto.

// La respuesta depende de quién la pide, así que no puede prerrenderizarse ni
// reutilizarse. Sin esto, Next podría intentar tratarla como estática.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const client = await createSupabaseSessionClient();

  // `getUser()` y no `getSession()`: valida el token contra Supabase en vez de
  // fiarse de la cookie, que llega del navegador.
  const {
    data: { user },
  } = await client.auth.getUser();

  // Sin sesión no se responde con un 401 a secas: quien llega aquí sin haber
  // entrado necesita entrar, y eso es lo que se le ofrece.
  // El destino se arma sobre la URL de la petición y no sobre una variable de
  // entorno: así funciona igual en local, en el NAS y en producción, sin que
  // haya un dominio escrito en ningún sitio.
  if (!user) {
    return NextResponse.redirect(new URL("/acceder", request.url));
  }

  // Ninguna de estas dos consultas filtra por usuario: lo hace la RLS a partir
  // del token verificado (ver 0004_favorites.sql y 0006_alertas_precio.sql). Es
  // deliberado — si el filtro viviera aquí, olvidarlo un día sería una fuga; con
  // la RLS, la base de datos no entregaría filas ajenas ni queriendo.
  const [favoritos, avisos] = await Promise.all([
    listarFavoritos(client),
    avisosActivados(client),
  ]);

  const datos = componerExportacion({
    correo: user.email ?? null,
    altaEn: user.created_at ?? null,
    avisosDeBajadaDePrecio: avisos,
    favoritos,
  });

  // Indentado a dos espacios: el fichero lo va a abrir una persona tanto como
  // una máquina, y un JSON en una sola línea no hay quien lo lea.
  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Como adjunto, no como página: un JSON con datos personales no debe
      // renderizarse dentro del sitio.
      "Content-Disposition": `attachment; filename="${nombreFicheroExportacion()}"`,
      // Imprescindible, no una precaución de más. Esto se sirve desde una CDN y
      // lleva datos personales: sin `no-store`, una copia podría quedarse
      // guardada y acabar servida a quien no debe.
      "Cache-Control": "no-store, max-age=0",
      // La respuesta cambia según la cookie de sesión; que ningún intermediario
      // la reutilice entre visitantes distintos.
      Vary: "Cookie",
    },
  });
}
