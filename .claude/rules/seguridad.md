---
paths:
  - "**/api/**"
  - "**/auth/**"
  - "supabase/**"
  - ".env*"
---

# Reglas de seguridad

- Nunca hardcodear claves, tokens o credenciales. Todo por variables de entorno, nunca commiteadas (ver `.gitignore`).
- Autenticación y autorización se delegan en Supabase Auth y en políticas de seguridad a nivel de fila (RLS). No se reimplementa gestión de sesiones o hashing de contraseñas a mano.
- Todo endpoint que reciba datos externos (formularios, query params) valida y sanea la entrada antes de tocar la base de datos — sin excepciones por "es un caso interno".
- Cualquier módulo nuevo bajo estas rutas pasa por `/security-review` antes de considerarse cerrado; los hallazgos críticos o altos bloquean el cierre de la historia.
- Los endpoints de ingesta (llamadas a Udemy/Coursera) guardan sus claves de API solo en variables de entorno del job, nunca expuestas al cliente/frontend.
