-- HU-065. Los niveles de Udemy llegaban en el idioma de cada pasada de la
-- ingesta: «All Levels» y «Todos los niveles», «Beginner» y «Principiante»… La
-- ingesta ya los guarda en español (src/lib/courses/nivel.ts); esto corrige los
-- que estaban guardados. Idempotente: una segunda vez no encuentra nada.
--
-- Mismas equivalencias que `normalizarNivel`. Un test de integración comprueba
-- que coinciden.
update courses
   set level = case lower(regexp_replace(btrim(level), '\s+', ' ', 'g'))
                 when 'all levels' then 'Todos los niveles'
                 when 'beginner' then 'Principiante'
                 when 'beginner level' then 'Principiante'
                 when 'intermediate' then 'Intermedio'
                 when 'intermediate level' then 'Intermedio'
                 when 'expert' then 'Experto'
                 when 'expert level' then 'Experto'
               end
 where lower(regexp_replace(btrim(level), '\s+', ' ', 'g')) in (
         'all levels', 'beginner', 'beginner level', 'intermediate',
         'intermediate level', 'expert', 'expert level'
       );
