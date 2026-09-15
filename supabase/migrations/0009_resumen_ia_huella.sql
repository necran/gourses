-- HU-052. Huella de la descripción que se resumió.
--
-- Antes, un resumen se daba por caducado si `updated_at` era posterior a su
-- fecha de generación. Pero la ingesta diaria pone `updated_at = now()` a todos
-- los cursos que recorre, cambien o no, así que cada resumen caducaba al día
-- siguiente y el job los rehacía gastando la cuota de Gemini. Con la huella
-- (SHA-256 en hexadecimal del texto resumido) solo se regenera si la
-- descripción cambia de verdad.
alter table courses add column if not exists resumen_ia_descripcion_sha256 text;

-- Los resúmenes que ya existen se dan por buenos con la descripción actual: se
-- generaron desde el 9 de septiembre de 2026 y la ingesta no cambia
-- descripciones sin motivo. Sin esto, los 949 que hay se regenerarían todos.
-- Idempotente: solo toca filas con resumen y sin huella.
update courses
   set resumen_ia_descripcion_sha256 = encode(sha256(convert_to(description, 'UTF8')), 'hex')
 where resumen_ia is not null
   and resumen_ia_descripcion_sha256 is null
   and description is not null;
