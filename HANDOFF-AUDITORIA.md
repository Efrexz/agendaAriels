# Continuidad — auditoría y mejora de Veterinaria Ariel

**Actualizado:** 30 de octubre de 2026. Documento de traspaso para continuar el trabajo en otra sesión de OpenCode. Complementa `AGENTS.md`: leer ambos y verificar siempre el código y el estado real antes de actuar. No contiene valores de credenciales.

## Actualización posterior — fases locales adelantadas

**Nota del 31/10:** el PC del usuario se apagó/reinició varias veces durante esta fase (inestabilidad de Docker Desktop en Windows, se está reparando por fuera). Cualquier servidor QA o de desarrollo queda detenido tras ese corte: relanzarlos con el comando documentado más abajo.

- El usuario pidió aplazar Docker y las pruebas de WhatsApp real para aprovechar el tiempo disponible en cambios locales. No enviar WhatsApp reales, ejecutar purgas, borrar datos ajenos ni desplegar sin consentimiento específico.
- **Aplicado remotamente el 31/10 con autorización:** `20261030000003_staff_membership.sql` (tabla `staff_users`, RLS, política de lectura propia, sin datos) y `20261030000005_status_transactions.sql` (funciones `api_grooming_transition`, `api_lab_transition`, `api_medical_transition`, `api_medical_assign`; solo `service_role`; `search_path=''`; verificadas en `pg_proc`). Tu cuenta `vet_ariel@hotmail.com` quedó como **único** miembro activo de personal (1 activo). Datos intactos tras la aplicación: 9 grooming, 7 citas, 12 órdenes LAB. **`20261030000004_staff_storage_policy.sql` sigue sin aplicar a propósito** (restricción de subida de resultados por personal activo): aplicar cuando se definan todas las cuentas y antes/anexo al despliegue; auditar antes las demás políticas INSERT de `storage.objects` y comparar el esquema histórico.
- Integridad de cambios de estado: las funciones PostgreSQL (estado + historial juntos) ya existen en remoto tras la fase previa (probadas en PGlite aislado: rollback con fallo de historial, un solo cambio ganador, permisos solo service_role). El backend local las usa; **el backend desplegado (producción) todavía no** — siguen funcionando como antes hasta el deploy, que es compatible porque las funciones son aditivas. Creaciones iniciales, purga y avisos externos no quedan cubiertos por estas transacciones.
- Los endpoints de cambio de estado ahora responden 409 en una carrera perdida en lugar de confirmar un éxito inexistente. `recordApptStatus` ya no sobreescribe el estado cuando registra el historial inicial, aunque dicho historial sigue siendo best-effort y puede fallar o llegar desordenado frente a otro cambio.
- LAB privado: `result_access_hash` **sí está en remoto**. El código de la descarga privada **sigue sin desplegar**; producción conserva el acceso por código corto. Orden ficticia QA **LAB-T87WZ** con archivos de prueba en Storage; el usuario confirmó en el panel de prueba: apertura del PDF OK y aviso correcto de reenvío fallido con WhatsApp desactivado. **El 31/10 por la noche se probó la entrega real con Evolution demo local (Docker): el mensaje con el enlace privado llegó al teléfono de prueba del usuario** (la conexión y el teléfono de la orden QA los actualizó él mismo; el número no pasó por el chat). Eso prueba el envío automático real del enlace; el flujo completo de publicación desde subida con Evolution conectado y el enlace resolviendo descarga en el teléfono queda por desplegar/verificar. No borrar la orden ni sus archivos sin acordarlo (12 órdenes: 4 con resultado publicado).
- **Fragilidad de tests E2E corregida (31/10):** los specs de grooming cli cream siempre a la fecha de HOY y fallaban después de las 18:00 porque las franjas vencidas cambian su texto accesible ("Ya no disponible"), con lo que `getByRole(/Turno/)` no encontraba nada (no es regresión del producto; a las 12:59 pasaba). Nuevo helper compartido `elegirFranjaDisponible` en `e2e/fixtures.ts`: avanza al mes siguiente cuando los turnos de hoy vencen. Suite completa: **18/18** también corriendo de noche.
- Autorización de personal: `api/internal/_verify.ts` exige pertenencia activa a `staff_users` (tabla **ya aplicada**, cuenta vet_ariel activa). **Auditoría del 31/10 de `storage.objects`: solo existe NUESTRA política INSERT ("staff upload lab results", authenticated, bucket lab-results) — no hay políticas permisivas adicionales que la anulen**, así que `20261030000004_staff_storage_policy.sql` (subida restringida a personal activo) puede aplicarse junto al despliegue (el personal nuevo requiere darse de alta en `staff_users`; documentarlo en la puesta en marcha). El historial de migraciones remoto no está sincronizado: no aplicar migraciones históricas a ciegas.
- Se agregó refresco visible en Consultas y Laboratorio (`useVisibleRefresh.ts`), pausado durante búsquedas, formularios de creación y peticiones; vista semanal médica cada 60 s, demás cada 30 s. Prueba unitaria con reloj y visibilidad simulados; **pendiente prueba real con dos sesiones** y de flujos de edición abiertos durante el refresco.
- Purga y borrado de resultados: se verifica el error devuelto por Storage y se condiciona la limpieza de la referencia al archivo observado. Pruebas con mocks, **ninguna purga real**. Siguen pendientes casos de fallos parciales/concurrencia entre Storage y BD y limpieza de posibles archivos huérfanos; no afirmar atomicidad completa.
- Zod actualizado de 4.4.3 a 4.6.7: `npm audit --omit=dev` reportó 0 vulnerabilidades de producción en esta verificación. Esto no equivale a auditar dependencias de desarrollo ni garantizar ausencia de vulnerabilidades.
- Últimos checks (31/10 noche, con Zod 4.6.7): **336 unitarias**, lint, typecheck, build y **18/18 E2E** con servicios externos bloqueados (incluida la suite corriendo después de las 18:00 con el helper robusto). Los E2E no comprueban las migraciones reales (sí probadas en remoto/PGlite), sesiones reales ni integración de WhatsApp de producción.

## Cómo correr el panel QA de WhatsApp (31/10)

El servidor de prueba vive en `/tmp/opencode/qa-lab/panel-server.mjs` (puede desaparecer con un reinicio; recrearlo a partir de esta descripción). Arranque:

```bash
node /tmp/opencode/qa-lab/panel-server.mjs   # deja /internal en http://127.0.0.1:5173 — ANTES: docker activo no es obligatorio para arrancar
```

Comportamiento: sirve el panel con el código local (incl. `_verify` con membresía `staff_users`), y SOLO expone `GET /api/internal/lab/list`, `GET /api/internal/lab/result` y `POST /api/internal/lab/resend-result`, acotados a la orden QA (otros id → 403; otras rutas → 403). El reenvío hace **preflight** del estado de conexión de la instancia demo (`connectionState`); sin Evolution conectedo responde 503 con instrucciones, sin intentar envíos. Usa EXCLUSIVAMENTE Evolution demo local (`http://127.0.0.1:8080`, instancia `ariels-demo`, key de demo del README) **nunca la configuración de producción** de `.env.local` (que el arranque sobreescribe solo en su proceso). Pasos del usuario: `npm run demo:up` → manager `http://localhost:8080/manager` → instancia `ariels-demo` con QR de su teléfono de prueba → actualizar `owner_phone` de LAB-T87WZ con su número vía SQL de Supabase (su acción, sin compartirlo) → login en el panel → "Reenviar enlace" en LAB-T87WZ → confirmar recepción del mensaje con el enlace. Tras el mensaje: probar el botón/URL del enlace después del despliegue (producción aún sin el código nuevo: el enlace abrirá /estado común sin descarga hasta entonces).

## 1. Objetivo y contexto del usuario

- Producto para una veterinaria local de **tres sedes en Lima, Perú**. El usuario trabaja allí y todavía no ha presentado las nuevas funcionalidades a sus jefes; aún no hay usuarios reales dependiendo de la aplicación.
- Quiere una demostración profesional y, después, poder ofrecer servicios similares a otras clínicas locales. **No es necesario construir ahora un SaaS multiempresa ni arquitectura para escala internacional**. Prefiere seguridad, estabilidad, rapidez, buena experiencia y mantenimiento simple.
- Meta deseada aproximada: **dos semanas**, sin saltarse pruebas ni prometer cero fallos.
- El usuario es desarrollador frontend y necesita que el agente asuma y explique backend, base de datos y despliegue en lenguaje claro. Debe indicarle cuándo necesita realizar alguna acción. Nunca pedir que comparta secretos por el chat.
- Planes actuales de Supabase y Vercel: gratuitos. Evitar costes o infraestructura adicional innecesaria y comprobar límites vigentes antes de asumirlos. Docker/Evolution estaban apagados; el usuario puede activarlos para una futura prueba controlada.
- Se autorizó usar el proyecto Supabase actual para pruebas, pues sus datos son de prueba; también se planea usar ese mismo proyecto en producción. Usar únicamente datos ficticios identificables y **no borrar datos salvo el alcance autorizado y conocido**. Explicar antes cualquier cambio de estructura, sus precauciones y cómo se verificará.
- El usuario quiere trabajar por fases; cualquier cambio visual importante requiere capturas y aprobación. No proponer las funcionalidades expresamente descartadas en `AGENTS.md`.

## 2. Precauciones inmediatas

- **Hay numerosos cambios locales sin commit de las fases anteriores.** Ejecutar `git status --short` y `git diff` al inicio; son trabajo de esta auditoría y/o del usuario. No revertir, resetear ni sobrescribir cambios ajenos.
- **No se ha desplegado el código de las fases realizadas.** La versión publicada puede comportarse de forma distinta. No asumir que las correcciones locales están activas en Vercel.
- La protección de solapamientos médicos **sí se instaló en la base de datos remota** y está activa. El backend actualizado que convierte el conflicto en mensaje 409 amigable sigue local: hasta desplegarlo, el backend publicado anterior puede devolver un error genérico si la restricción interviene.
- La comprobación de `to_regclass('supabase_migrations.schema_migrations')` en el proyecto remoto indicó que no existía una tabla de historial de migraciones de Supabase. La restricción se aplicó mediante la Management API ejecutando una transacción SQL, y se guardó una migración local idempotente. **No inventar ni marcar como aplicadas migraciones históricas sin comparar antes el esquema real y decidir una estrategia segura de sincronización.**
- No ejecutar los scripts existentes de integración a ciegas: algunos crean usuarios, realizan operaciones y borran registros al final, incluso usuarios de pruebas anteriores.
- `.env.local` contiene configuración local sensible y un webhook de desarrollo potencialmente externo. No mostrar valores. Las pruebas E2E usan `e2e/fixtures.ts` para bloquear peticiones externas; además se ejecutaron con variables `VITE_*` de proveedores externos vacías. No enviar mensajes reales por accidente.
- El usuario autorizó pruebas con datos ficticios, pero no se deben hacer purgas reales, envíos de WhatsApp ni despliegues sin explicar el alcance y disponer de condiciones de prueba adecuadas.

## 3. Alcance y hallazgos de la auditoría inicial

La aplicación tiene cuatro entradas frontend: grooming `/`, panel `/internal`, seguimiento `/estado` y citas médicas `/cita-medica` (ver `vercel.json`). React/TypeScript/Vite; API serverless centralizada en `api/index.ts`; Supabase para Postgres/Auth/Storage y Evolution API para WhatsApp. La documentación antigua puede mencionar otra ruta médica o componentes incompletos; verificar implementación actual.

Prioridades encontradas:

1. Código corto de laboratorio como llave para obtener resultados; límite de consultas solo en memoria de cada instancia. **Sigue pendiente proteger la descarga**; retirar el correo del personal del historial público no resuelve este riesgo.
2. Cron de recordatorios y purga quedaban abiertos si faltaba el secreto. Código local corregido; verificar despliegue antes de darlo por activo.
3. Posibles citas médicas solapadas por concurrencia. Restricción de base instalada y probada; backend compatible local pendiente de despliegue.
4. Grooming mostraba el código generado por el navegador aunque la API confirmara otro; colisiones y ciertos errores de notificación podían engañar al cliente. Código local corregido.
5. Autorización interna comprueba usuario válido de Supabase Auth, pero no pertenencia explícita al personal. La configuración real de registro y cuentas no está verificada.
6. Deduplicación/rate limiting en mapas de memoria no es global; recordatorios carecen de idempotencia persistente y procesos secuenciales pueden agotarse. No garantizar entrega única de mensajes externos sin diseñar y probar estados de fallo.
7. Cambio de estado e historial no siempre transaccionales; revisarlo por etapas.
8. Purga/reemplazo de resultados no comprueban siempre el objeto de error de Storage; riesgo de archivos huérfanos o inconsistencias. Aún pendiente.
9. Búsquedas por teléfono revisan solo los 500 registros recientes; algunos listados tienen límites silenciosos. Consultas/Laboratorio no tenían refresco periódico equivalente a grooming. Pendiente.
10. Avisos de privacidad no reflejan con precisión envío a servidor y proveedores; perfil local contiene datos personales. Pendiente revisión técnica y legal.
11. Componentes grandes, modales con accesibilidad incompleta y documentación parcialmente desactualizada; resolver gradualmente sin rediseño injustificado.
12. `npm audit` en la auditoría reportó una vulnerabilidad alta en dependencias de producción (Zod) y otras de herramientas de desarrollo. Volver a verificar datos actuales y evaluar actualización con pruebas; no afirmar explotación probada.

## 4. Fases implementadas y verificadas

### Fase 0 y confirmación grooming — código local

- `src/services/submitBooking.ts`: código de la API, validación de respuesta, código generado con Web Crypto y datos de persistencia; sin confirmar éxito si falta código válido.
- `src/components/steps/ConfirmationStep.tsx`: reintento conserva el mismo payload mientras permanece el componente; muestra cuando la reserva llegó por WhatsApp pero no quedó almacenada, sin ofrecer seguimiento inexistente.
- `api/_booking.ts`: distingue colisiones de reintentos comparando datos, conserva resultados de notificación, informa cuando BD guardó sin WhatsApp configurado, usa aviso completo si falla BD, limita espera de webhooks y no promete seguimiento sin persistencia.
- En integración real se detectó que PostgreSQL redondea coordenadas a seis decimales. Se corrigió la comparación y se añadió regresión.
- **Límite pendiente:** el mecanismo de reintento no garantiza idempotencia persistente en todos los casos, especialmente tras recargar/cerrar la página o ante un fallo incierto de BD. No afirmar que no pueden existir duplicados.
- Reserva de prueba real dejada en Supabase: **`VA-C42S8`**, identificada como QA. Su aviso figura entregado por una simulación: **no se envió WhatsApp real**.

### Citas médicas concurrentes — BD remota y código local

- `supabase/migrations/20261030000001_medical_prevent_overlaps.sql`: `btree_gist`, validación de duración y restricción de exclusión por médico, fecha y rango. Incluye estados que ocupan horarios y excluye los estados liberados; las solicitudes sin asignar permanecen válidas.
- Antes de instalar se consultó el estado real: cinco citas existentes, cero pares solapados y cero citas activas con horario inválido. La SQL se probó primero en una tabla temporal con rollback; luego se aplicó en una transacción real y se verificaron las dos restricciones y extensión.
- `api/medical/errors.ts`, `db.ts`, `_create.ts`, `_assign.ts`, `_status.ts`: traducción de conflicto de exclusión a respuesta 409 y asignación condicionada al estado `pagado`. Las actualizaciones de estado/historial aún necesitan una fase transaccional completa.
- Prueba real: dos inserciones simultáneas al mismo horario → una guardada, una bloqueada; dos asignaciones de la misma solicitud → solo una aplicada y un evento. Sin WhatsApp real. Quedaron citas ficticias **`CM-TVPKV`** y **`CM-WL5FX`** con fechas en 2099, marcadas QA. No se borraron automáticamente.
- `e2e/medical-conflict.spec.ts`: cliente recibe error y elige otra hora sin perder sus datos, con API simulada.

### Protección de cron y privacidad del historial LAB — solo código local

- `api/_cron.ts`: autorización Bearer obligatoria en todos los entornos; comparación sin mostrar el secreto.
- `api/medical/_reminders.ts` y `api/lab/_purge.ts`: bloquean si falta o no coincide `CRON_SECRET`; no ejecutar tareas reales durante pruebas de seguridad.
- `api/lab/_public_status.ts`: proyecta explícitamente solo `status` y `createdAt` en la línea de tiempo pública, sin `createdBy` ni otros campos internos.
- `api/_cron.test.ts`, `api/cron-security.test.ts` y `api/lab/_public_status.test.ts`: pruebas con servicios simulados. `.env.example` documenta la variable vacía.
- **Vercel comprobado el 30 de octubre de 2026:** a través de la sesión local del CLI y API oficial, consultando metadatos sin descifrar ni mostrar valores, `CRON_SECRET` existe para **Production, Preview y Development**. No se comprobó el valor ni que una ejecución programada real haya funcionado. No sustituir/rotar la variable sin necesidad.
- La seguridad nueva de cron/LAB **no estará activa en la aplicación publicada hasta desplegar el código**. Los recordatorios siguen sin idempotencia persistente y el sistema de descarga sigue usando código corto: son tareas separadas pendientes.

## 5. Pruebas y comandos seguros

Último resultado antes del traspaso:

- `npm test -- --no-cache --configLoader runner`: **305 pruebas unitarias**, 33 archivos aprobados.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto para frontend y API.
- Build: correcto, generado en una carpeta nueva bajo `/tmp/opencode`, con variables públicas de proveedores externos vacías para evitar incorporar configuración real.
- Playwright: **15 pruebas aprobadas**, con APIs simuladas y bloqueo de tráfico externo. La carga de Google Maps falla intencionadamente en estas pruebas y produce avisos de consola; no es prueba de fallo de producción.
- Para la suite de navegador se usó: `env CI=true VITE_N8N_WEBHOOK_URL= VITE_GOOGLE_MAPS_API_KEY= VITE_CLOUDINARY_CLOUD_NAME= VITE_CLOUDINARY_UPLOAD_PRESET= VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run test:e2e`.
- Ejecutar lint y E2E **en secuencia**, no en paralelo: Playwright recrea `test-results` y ESLint puede fallar al recorrer la carpeta simultáneamente.
- Las pruebas anteriores no equivalen a probar WhatsApp, impresora, configuración completa de RLS, todos los servicios reales, pruebas de carga o recuperación de backups. Verificar lo que falte antes de producción.

## 6. Plan restante, en orden sugerido

### Siguiente fase: acceso seguro a resultados LAB

Diseñar e implementar una solución sencilla para la clínica: conservar el código corto como referencia y seguimiento general, pero que **el archivo no se pueda obtener solo con ese código**. La opción preliminar es un enlace privado largo generado con aleatoriedad criptográfica, enviado por WhatsApp y utilizable sin cuenta; acordar cómo el mostrador lo vuelve a compartir y qué pasa si el cliente lo pierde. Estudiar caducidad/revocación, exposición accidental del enlace y migración segura. No romper el flujo actual ni usar como secreto una clave visible en el cliente. Probar autorización, intentos inválidos, vencimiento, reemplazo, privacidad, mensajes y UX. Antes de cualquier cambio estructural remoto, explicar el plan y probar en aislamiento; el usuario permite datos de prueba.

### Después: operación y fiabilidad

1. Cuentas individuales y autorización real de staff; verificar ajustes reales de Supabase Auth antes de afirmar riesgos activos. Para una clínica, comenzar con permisos simples y sin sobreingeniería.
2. Cron: idempotencia/reintentos seguros y observabilidad, sin repetir avisos ante concurrencia; comprobar errores de Storage antes de limpiar referencias o borrar. No probar con mensajes reales ni purga real sin aislamiento.
3. Actualización automática de Consultas/Laboratorio cuando las pestañas están visibles y pruebas con dos sesiones.
4. Tratar integridad transaccional de estados e historial; asegurar que cambios y auditoría no diverjan.
5. Buscar por teléfonos normalizados en BD, paginar o avisar límites, medir peticiones y rendimiento antes de optimizar.
6. Revisar privacidad, accesibilidad de modales, textos y controles del perfil local. Mantener diseño aprobado y aportar capturas para cambios visuales.
7. Actualizar dependencias con avisos y repetir gates; actualizar README y procedimientos de recuperación.
8. Preparar demostración y puesta en marcha: datos ficticios, cuenta por persona, respaldo/restauración, prueba real de Evolution en Docker con números de prueba, impresora QZ física y contingencia ante internet/WhatsApp caídos.

Para clientes futuros, evaluar inicialmente una instalación/base separada por clínica; es una propuesta, no una decisión irreversible ni garantía de que los planes gratuitos sean suficientes. No crear multiempresa hasta existir una necesidad y evaluar sus riesgos/costes.

## 7. Criterios de entrega

- Avanzar una fase concreta cada vez; comunicar hallazgos y decisiones al usuario en español claro.
- No exponer secretos ni datos personales; no pegar salidas sin filtrar que puedan contenerlos.
- No hacer commit, push, deploy, cambios adicionales remotos o eliminación amplia sin confirmar alcance; antes de un commit aplicar los gates indicados en `AGENTS.md`.
- Si se usa Vercel o Supabase CLI/API, consultar documentación vigente con Context7; si una verificación no puede hacerse, decirlo.
- Terminar cada fase con resumen de cambios, pruebas reales vs simuladas, riesgos pendientes y lo que el usuario necesita hacer.
