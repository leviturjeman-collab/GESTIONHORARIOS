**GESTIÓN HORARIOS**  
Plataforma de gestión de cuadrantes y personal para hostelería

**Documento de especificación funcional y de interfaz (UI)**

*Pantallas, herramientas, flujos de trabajo y capacidades de inteligencia artificial*

Versión 1.0 · Borrador para revisión

Fecha: 23 de junio de 2026

Sector: Hostelería y restauración

Idioma de la interfaz: Español

# **Control del documento**

| Versión | Fecha | Autor | Cambios |
| :---- | :---- | :---- | :---- |
| 0.1 | 23/06/2026 | Equipo de producto | Estructura inicial y recogida de requisitos. |
| 1.0 | 23/06/2026 | Equipo de producto | Especificación completa de UI, herramientas, flujos e IA. |

## **Cómo leer este documento**

*Este documento describe QUÉ hace el producto y CÓMO se ve y se usa, no cómo se programa. Está pensado para que cualquier persona (gerencia, diseño, desarrollo o un proveedor externo) entienda el producto completo sin ambigüedades.*

* **Capítulos 1–4:** contexto: visión, alcance, roles y permisos.

* **Capítulo 5:** mapa de navegación y sistema de diseño (la “identidad” visual).

* **Capítulo 6:** cada pantalla de la interfaz descrita en detalle (propósito, elementos, acciones, estados).

* **Capítulos 7–9:** catálogo de herramientas, capacidades de IA y flujos de trabajo de principio a fin.

* **Capítulos 10–14:** modelo de datos, notificaciones, seguridad/RGPD, requisitos y hoja de ruta.

# **Índice**

# **1\. Resumen ejecutivo**

Gestión Horarios es una aplicación web profesional para que negocios de hostelería con una o varias ubicaciones planifiquen turnos, controlen el tiempo de trabajo, gestionen vacaciones, ausencias y bajas, controlen el coste laboral y comuniquen cualquier cambio de forma automática. Se inspira en el estándar de mercado de soluciones como Orquest, Skello, Shiftbase y Combo, y añade un diferenciador claro: un asistente de inteligencia artificial que arranca el sistema a partir de un simple Excel y que ayuda a planificar en lenguaje natural.

El producto resuelve el mayor dolor del sector: rehacer cuadrantes cada semana a mano, descuadrar las horas de contrato, gestionar cambios de turno por mensajería informal y no tener visibilidad del coste real del personal. Con Gestión Horarios, el responsable parte de los datos que ya tiene, la IA los entiende, y a partir de ahí la planificación se vuelve rápida, repetible y trazable.

## **1.1 Propuesta de valor en una frase**

*“Sube el Excel que ya usas, responde unas preguntas y ten tu cuadrante profesional listo; a partir de ahí, planifica, controla horas y comunica cambios sin esfuerzo.”*

## **1.2 Diferenciadores frente a la competencia**

* **Arranque desde Excel con IA:** no hay que cargar a mano cada empleado; la IA lee el cuadrante actual y propone la configuración.

* **Asistente de planificación en lenguaje natural:** “genera la próxima semana respetando las vacaciones de Ana”.

* **Detección automática de problemas:** huecos sin cubrir, exceso de horas, descansos insuficientes, solapamientos.

* **Enfoque hostelería:** turnos partidos, varios roles (sala, cocina, barra), picos de fin de semana y multi-ubicación de serie.

# **2\. Visión del producto y objetivos**

## **2.1 Visión**

Convertir la planificación de personal en hostelería en un proceso asistido por IA, rápido y libre de errores, que dé al responsable control total sobre las horas y el coste, y al empleado claridad y voz sobre su propio horario.

## **2.2 Objetivos del producto**

1. Reducir el tiempo de elaboración de un cuadrante semanal de horas a minutos.

2. Eliminar los descuadres de horas frente a las horas de contrato de cada empleado.

3. Centralizar vacaciones, ausencias, bajas y cambios de turno en un único lugar con trazabilidad.

4. Dar visibilidad inmediata del coste laboral por ubicación, por día y por empleado.

5. Garantizar que ningún empleado se quede sin saber su turno: comunicación automática de cambios.

## **2.3 Indicadores de éxito (KPI)**

| Indicador | Situación habitual | Objetivo |
| :---- | :---- | :---- |
| Tiempo de creación de un cuadrante semanal | 1–3 horas | \< 15 minutos |
| Errores de cobertura por semana (huecos) | Frecuentes | Cerca de 0 (avisados por IA) |
| Desviación horas planificadas vs. contrato | Alta y manual | Controlada y visible |
| Tiempo de respuesta a una solicitud de vacaciones | Días | \< 24 h |
| Cambios de turno sin notificar | Habituales | 0 (notificación automática) |

# **3\. Alcance del producto**

## **3.1 Incluido en el alcance**

* Alta y gestión de ubicaciones por parte del administrador.

* Importación de un Excel con el cuadrante/empleados actuales y análisis automático con IA.

* Gestión de empleados: tiempo completo, tiempo parcial, horas extra, días de descanso y rol.

* Creación de cuadrantes manual y asistida por IA, con plantillas de semana recurrentes.

* Disponibilidad y preferencias declaradas por el empleado.

* Vacaciones, ausencias y bajas con flujo de aprobación/rechazo.

* Intercambio de turnos entre empleados con aprobación configurable por ubicación.

* Fichaje (control horario real de entrada y salida) y comparación planificado vs. real.

* Control de costes laborales por ubicación, día y empleado.

* Gestión documental de nóminas y contratos (almacenamiento y envío).

* Notificaciones automáticas por correo electrónico dirigidas al administrador/gerente.

* Asistente de IA: generación en lenguaje natural, detección de problemas y ayuda al empleado.

## **3.2 Fuera del alcance de la versión 1**

* Cálculo y emisión legal de la nómina (se exporta a la gestoría; no se sustituye al software de nóminas).

* Integración automática con TPV/cajas para previsión de ventas (previsto para una fase posterior).

* Validación automática del convenio colectivo (se incorporará más adelante).

* Aplicaciones nativas para iOS/Android (la versión 1 es web responsive).

* Notificaciones por WhatsApp o push (fase 2).

## **3.3 Supuestos**

* El responsable dispone de un Excel con el cuadrante o el listado de empleados actual.

* Cada empleado tiene un correo electrónico para recibir invitaciones y notificaciones.

* El análisis del Excel se realiza mediante la API de Anthropic (Claude) con una clave proporcionada por la organización.

# **4\. Roles y permisos**

El sistema define tres niveles de usuario. Los roles funcionales de cada empleado (por ejemplo camarero, cocinero, encargado) no son niveles de acceso: se detectan al analizar el Excel y se usan para planificar.

## **4.1 Descripción de los roles**

* **Administrador (gerente/propietario):** ve y gestiona TODAS las ubicaciones, la configuración global, los costes consolidados y los documentos. Recibe las notificaciones por correo.

* **Manager de ubicación:** gestiona el día a día de su(s) ubicación(es) asignada(s): cuadrantes, fichaje, vacaciones y cambios de turno de su equipo.

* **Empleado:** consulta su cuadrante, declara disponibilidad y preferencias, solicita vacaciones/ausencias, propone intercambios de turno, ficha y consulta su perfil.

## **4.2 Matriz de permisos**

| Acción / Capacidad | Administrador | Manager | Empleado |
| :---- | :---- | :---- | :---- |
| Crear y configurar ubicaciones | Sí | No | No |
| Importar Excel y lanzar análisis con IA | Sí | Sí (su ubicación) | No |
| Crear / editar cuadrantes | Sí | Sí (su ubicación) | No |
| Generar cuadrante con IA | Sí | Sí (su ubicación) | No |
| Guardar / aplicar plantillas recurrentes | Sí | Sí | No |
| Aprobar / rechazar vacaciones y ausencias | Sí | Sí (su equipo) | No |
| Solicitar vacaciones / ausencias | Sí | Sí | Sí |
| Aprobar intercambios de turno | Sí | Sí (si está activado) | No |
| Proponer / aceptar intercambio de turno | No | No | Sí |
| Declarar disponibilidad y preferencias | No | No | Sí |
| Fichar entrada / salida | No | No | Sí |
| Ver costes laborales consolidados | Sí | Solo su ubicación | No |
| Gestionar nóminas y contratos | Sí | Ver de su equipo | Ver los suyos |
| Configurar reglas (p. ej. aprobación de cambios) | Sí | Limitado | No |
| Recibir notificaciones por correo | Sí | Opcional | No (en v1) |

# **5\. Arquitectura de la información y sistema de diseño**

## **5.1 Estructura general de la pantalla**

Toda la aplicación comparte una misma estructura para que el usuario nunca se pierda:

* **Barra lateral izquierda (navegación principal):** logotipo, selector de ubicación, y los accesos a cada módulo. Se puede contraer a iconos.

* **Barra superior:** título de la sección actual, buscador global, selector de semana/fecha, campana de notificaciones y menú de usuario (perfil, rol, cerrar sesión).

* **Área de contenido central:** la pantalla activa (dashboard, cuadrante, etc.).

* **Panel lateral derecho contextual:** aparece cuando se selecciona un elemento (un turno, una solicitud, un empleado) para ver el detalle y actuar sin cambiar de pantalla.

## **5.2 Mapa de navegación (menú por rol)**

| Administrador | Manager | Empleado |
| :---- | :---- | :---- |
| Inicio (dashboard global)UbicacionesCuadrantesVacaciones y ausenciasCambios de turnoFichajeCostesEmpleadosNóminas y contratosAsistente IAAjustes | Inicio (su ubicación)CuadrantesVacaciones y ausenciasCambios de turnoFichajeCostes (su ubicación)EmpleadosAsistente IA | Mi cuadranteMi disponibilidadMis vacacionesCambios de turnoFicharMi perfil |

## **5.3 Identidad visual**

* **Estilo:** limpio, profesional y sobrio, tipo software de gestión moderno; mucho espacio en blanco y jerarquía clara.

* **Color principal:** azul corporativo profundo (confianza) con un acento verde-azulado (acciones e indicadores positivos).

* **Colores de estado:** verde \= aprobado/cubierto; ámbar \= pendiente/aviso; rojo \= rechazado/conflicto; gris \= informativo.

* **Tipografía:** una sola familia sin serifa, legible en pantalla; tamaños grandes para cifras clave (horas, coste).

* **Iconografía:** lineal y coherente; cada módulo tiene su icono fijo.

* **Densidad:** alta en las vistas de planificación (mucha información en poco espacio) y aireada en formularios.

## **5.4 Componentes reutilizables**

* Tarjetas de métrica (KPI) con cifra grande, etiqueta y variación.

* Tarjeta de turno (bloque de color con rol, horario y empleado).

* Etiquetas de estado (chips de color) para solicitudes y fichajes.

* Tablas con orden, filtro y acciones por fila.

* Paneles deslizantes (drawers) para el detalle y la edición.

* Avatares de empleado con iniciales y color por rol.

* Ventanas modales de confirmación para acciones sensibles.

* Estados vacíos con explicación y botón de acción principal.

# **6\. Catálogo de pantallas (interfaz detallada)**

*Cada pantalla se describe con su propósito, los elementos visibles de la interfaz, las acciones disponibles, los estados posibles y qué roles la ven.*

## **6.1 Acceso e inicio de sesión**

Propósito. Permitir la entrada segura y dirigir a cada usuario a su espacio según su rol.

**Roles que la ven:** Todos

### **Elementos de la interfaz**

* Logotipo y nombre del producto centrados.

* Campos de correo y contraseña, con opción “recordar sesión”.

* Enlace “¿Has olvidado la contraseña?”.

* Mensaje de error claro cuando las credenciales no son válidas.

* Aviso de acceso por invitación para empleados (acceden tras recibir el correo de alta).

### **Acciones disponibles**

* Iniciar sesión.

* Recuperar contraseña por correo.

* Aceptar invitación y crear contraseña (empleado nuevo).

### **Estados**

* Por defecto (formulario vacío).

* Cargando (validando credenciales).

* Error de credenciales.

* Cuenta bloqueada / invitación caducada.

## **6.2 Onboarding: importar Excel y análisis con IA**

Propósito. Pieza central del producto. A partir del Excel del responsable, la IA entiende los datos, hace las preguntas necesarias y deja preparada la ubicación y su primer cuadrante.

**Roles que la ven:** Administrador y Manager

### **Elementos de la interfaz**

* Asistente por pasos en la parte superior (barra de progreso: Subir → Analizar → Revisar → Preguntas → Confirmar).

* Paso 1 — Subir: zona para arrastrar el archivo .xlsx/.csv y ejemplo descargable de formato recomendado.

* Paso 2 — Analizar: indicador de progreso mientras la IA procesa, con resumen de qué está detectando.

* Paso 3 — Revisar: tabla con cada empleado detectado y las columnas interpretadas (nombre, tipo de contrato, horas semanales, horas extra, días de descanso, rol).

* Indicadores de confianza por celda (verde \= claro; ámbar \= revisar) y celdas editables.

* Paso 4 — Preguntas de la IA: panel tipo conversación con preguntas concretas para completar lo que el Excel no dice.

* Paso 5 — Confirmar: campo para el nombre de la ubicación, dirección, zona horaria y botón de confirmación.

### **Acciones disponibles**

* Subir el archivo y lanzar el análisis.

* Corregir cualquier dato mal interpretado directamente en la tabla.

* Responder a las preguntas de la IA (p. ej. quién puede hacer turnos partidos, cuántas personas por rol y franja).

* Poner nombre a la ubicación y confirmar para crearla.

* Generar automáticamente el primer cuadrante al confirmar (opcional).

### **Estados**

* Sin archivo (estado inicial).

* Analizando.

* Análisis con avisos (datos dudosos a revisar).

* Listo para confirmar.

* Error de formato (archivo no legible) con sugerencia de corrección.

### **Notas de diseño**

* Las preguntas de la IA se adaptan a lo que falte: si el Excel no indica roles, pregunta por roles; si no hay horas de contrato, las pide.

* Nada se guarda hasta que el responsable confirma: el análisis es una propuesta editable.

## **6.3 Inicio / Dashboard**

Propósito. Dar de un vistazo el estado del negocio: cobertura, coste, avisos y tareas pendientes.

**Roles que la ven:** Administrador (global) y Manager (su ubicación)

### **Elementos de la interfaz**

* Fila de tarjetas KPI: coste laboral de la semana, horas planificadas, horas extra, solicitudes pendientes.

* Selector de ubicación (el administrador puede ver “todas” o una concreta).

* Panel de avisos de la IA (huecos sin cubrir, excesos de horas, conflictos).

* Lista de tareas pendientes (vacaciones por aprobar, cambios de turno por validar, fichajes anómalos).

* Mini-resumen del cuadrante de hoy por ubicación.

* Para el administrador: comparativa de coste entre ubicaciones.

### **Acciones disponibles**

* Cambiar de ubicación y de semana.

* Entrar al detalle de cualquier aviso o tarea.

* Acceso rápido a “generar cuadrante” y “revisar solicitudes”.

### **Estados**

* Con datos.

* Sin avisos (todo en orden).

* Primer uso (sin cuadrantes todavía, invita a importar el Excel).

## **6.4 Ubicaciones**

Propósito. Que el administrador dé de alta y configure cada ubicación del negocio.

**Roles que la ven:** Administrador

### **Elementos de la interfaz**

* Listado de ubicaciones en tarjetas: nombre, dirección, nº de empleados, manager asignado y coste de la semana.

* Botón “Nueva ubicación” (lanza el onboarding con Excel).

* Ficha de ubicación: datos generales, horario de apertura, roles necesarios y plantillas recurrentes guardadas.

* Asignación de manager y de empleados a la ubicación.

### **Acciones disponibles**

* Crear, editar o desactivar una ubicación.

* Asignar manager y empleados.

* Definir los roles y la cobertura mínima por franja.

* Configurar reglas locales (p. ej. si los cambios de turno requieren aprobación).

### **Estados**

* Lista con ubicaciones.

* Sin ubicaciones (estado vacío con llamada a crear la primera).

## **6.5 Cuadrante / Planning semanal**

Propósito. El corazón operativo: ver, crear y ajustar los turnos de la semana por ubicación.

**Roles que la ven:** Administrador y Manager

### **Elementos de la interfaz**

* Rejilla semanal: filas \= empleados, columnas \= días; cada turno es un bloque de color por rol con su horario.

* Barra superior de la rejilla con totales por día: nº de personas, horas y coste.

* Indicador de cobertura por franja (verde si se cumple el mínimo, rojo si falta gente).

* Botón “Generar con IA” y botón “Plantillas” (guardar/aplicar semana recurrente).

* Panel lateral de detalle del turno: empleado, rol, hora inicio/fin, descanso, turno partido, notas.

* Marca visual de empleados con vacaciones/ausencia/baja en esos días (no asignables).

* Contador por empleado de horas asignadas frente a horas de contrato.

### **Acciones disponibles**

* Crear un turno (hacer clic en una celda) y editarlo en el panel lateral.

* Mover o copiar turnos entre días/empleados (arrastrar y soltar).

* Marcar un turno como partido (dos tramos en el mismo día).

* Generar el cuadrante completo con IA a partir de las reglas y la disponibilidad.

* Guardar la semana como plantilla y aplicar una plantilla con un botón.

* Publicar el cuadrante (dispara la notificación al administrador y lo hace visible a los empleados).

### **Estados**

* Borrador (no publicado).

* Publicado.

* Con conflictos detectados por la IA (resaltados).

* Semana bloqueada (ya cerrada).

### **Notas de diseño**

* Al pasar el cursor por un empleado se ve su disponibilidad y sus horas restantes de contrato.

* Si se asigna un turno que rompe una regla (p. ej. supera horas), la celda avisa al instante.

## **6.6 Plantillas de cuadrante recurrentes**

Propósito. Evitar rehacer la semana desde cero: guardar semanas tipo y reutilizarlas con un clic.

**Roles que la ven:** Administrador y Manager

### **Elementos de la interfaz**

* Listado de plantillas guardadas con nombre (p. ej. “Semana temporada alta”, “Semana normal”).

* Vista previa de la plantilla antes de aplicarla.

* Botón “Guardar semana actual como plantilla” desde el cuadrante.

### **Acciones disponibles**

* Crear, renombrar y eliminar plantillas.

* Aplicar una plantilla a una semana concreta (la IA ajusta automáticamente vacaciones y ausencias de esa semana).

### **Estados**

* Con plantillas.

* Sin plantillas (sugiere guardar la primera).

## **6.7 Disponibilidad y preferencias del empleado**

Propósito. Que el empleado indique cuándo puede o prefiere no trabajar, para que la planificación lo respete.

**Roles que la ven:** Empleado (declara) · Manager/Administrador (consultan)

### **Elementos de la interfaz**

* Rejilla semanal donde el empleado marca franjas como “disponible”, “prefiero no” o “no disponible”.

* Disponibilidad recurrente (todas las semanas) y excepciones puntuales por fecha.

* Notas libres (p. ej. “los martes salgo antes de las 18 h”).

### **Acciones disponibles**

* Definir y actualizar la disponibilidad semanal.

* Añadir excepciones para fechas concretas.

* Guardar; el cambio queda visible para el responsable y lo usa la IA.

### **Estados**

* Sin definir.

* Definida.

* Con excepciones activas.

### **Notas de diseño**

* La disponibilidad es una preferencia/condición, no una solicitud que haya que aprobar; el responsable la ve al planificar.

## **6.8 Vacaciones, ausencias y bajas**

Propósito. Centralizar las solicitudes y su aprobación, y reflejar el impacto en el cuadrante.

**Roles que la ven:** Todos (el empleado solicita; manager/administrador aprueban)

### **Elementos de la interfaz**

* Calendario de equipo con las ausencias por tipo y color (vacaciones, ausencia justificada, baja médica).

* Bandeja de solicitudes pendientes con empleado, tipo, fechas, días consumidos y saldo restante.

* Ficha de cada empleado con su saldo de vacaciones del año.

* Formulario de solicitud (tipo, fechas, motivo y adjunto para bajas).

### **Acciones disponibles**

* Solicitar vacaciones/ausencia (empleado).

* Registrar una baja con su justificante.

* Aprobar o rechazar con un comentario (manager/administrador).

* Ver cómo afecta a la cobertura del cuadrante antes de aprobar.

### **Estados**

* Pendiente.

* Aprobada.

* Rechazada.

* En curso (días activos).

* Finalizada.

### **Notas de diseño**

* Al aprobar, los días quedan bloqueados en el cuadrante y la IA los tiene en cuenta al generar o aplicar plantillas.

* Se notifica al administrador por correo cada nueva solicitud y cada resolución.

## **6.9 Intercambio de turnos**

Propósito. Permitir que dos empleados intercambien turnos de forma ordenada y trazable.

**Roles que la ven:** Empleado (propone/acepta) · Manager/Administrador (aprueban si está activado)

### **Elementos de la interfaz**

* Lista de turnos propios ofrecibles y “tablón” de turnos disponibles de compañeros.

* Estado de cada propuesta de intercambio (propuesto, aceptado, pendiente de aprobación, confirmado, rechazado).

* Interruptor de configuración (en Ajustes/Ubicación): “los cambios requieren aprobación del responsable” (sí/no).

### **Acciones disponibles**

* Ofrecer un turno o pedir cambiarlo con un compañero.

* Aceptar o rechazar una propuesta (compañero).

* Aprobar o rechazar el cambio (responsable, solo si la aprobación está activada).

* Confirmar: el cuadrante se actualiza y se notifica al administrador.

### **Estados**

* Propuesto.

* Aceptado por el compañero.

* Pendiente de aprobación del responsable.

* Confirmado (aplicado al cuadrante).

* Rechazado / caducado.

### **Notas de diseño**

* El comportamiento (con o sin aprobación) es configurable por ubicación, tal como se solicitó.

## **6.10 Fichaje / control horario**

Propósito. Registrar la entrada y salida real de cada empleado y compararla con lo planificado.

**Roles que la ven:** Empleado (ficha) · Manager/Administrador (supervisan)

### **Elementos de la interfaz**

* Botón grande “Fichar entrada / Fichar salida” con la hora actual (vista de empleado).

* Modo tablet del local: acceso con PIN por empleado para fichar desde un dispositivo compartido.

* Vista de supervisión: tabla del día con planificado vs. real, retrasos y horas acumuladas.

* Marcas de incidencia (entrada tarde, salida temprana, sin fichar).

### **Acciones disponibles**

* Fichar entrada y salida (con sello de hora).

* Registrar el inicio/fin de un descanso.

* Corregir un fichaje con justificación (responsable), quedando registrado el cambio.

* Exportar el registro de jornada de un periodo.

### **Estados**

* Sin fichar.

* Trabajando (fichado).

* En descanso.

* Jornada cerrada.

* Con incidencia.

### **Notas de diseño**

* Cada fichaje queda sellado y trazable; las correcciones no borran el dato original, lo registran como ajuste.

## **6.11 Costes laborales**

Propósito. Dar visibilidad del gasto de personal y ayudar a mantenerlo bajo control.

**Roles que la ven:** Administrador (consolidado) · Manager (su ubicación)

### **Elementos de la interfaz**

* Tarjetas con coste de la semana, coste por día y coste de horas extra.

* Gráfico de coste por día y por ubicación.

* Desglose por empleado: horas, horas extra y coste estimado.

* Comparativa entre semanas y entre ubicaciones (administrador).

* Campo opcional para introducir la venta estimada y ver el ratio coste de personal / ventas.

### **Acciones disponibles**

* Filtrar por ubicación, semana y rol.

* Introducir o importar la venta para calcular el ratio.

* Exportar el desglose de costes (Excel/PDF).

### **Estados**

* Con datos.

* Sin coste configurado (pide tarifa/hora por empleado o rol).

### **Notas de diseño**

* El coste se calcula a partir de las horas y el coste/hora de cada empleado o rol; las horas extra se valoran aparte.

## **6.12 Empleados**

Propósito. Mantener la ficha de cada persona del equipo.

**Roles que la ven:** Administrador y Manager

### **Elementos de la interfaz**

* Listado con nombre, rol, tipo de contrato, ubicación, horas de contrato y estado.

* Ficha del empleado: datos personales, contrato, horas, coste/hora, disponibilidad, documentos y saldo de vacaciones.

* Origen del dato (importado del Excel o creado a mano).

### **Acciones disponibles**

* Crear, editar o desactivar empleados.

* Invitar al empleado por correo para que acceda a la app.

* Asignar rol, contrato, horas y ubicación.

### **Estados**

* Activo.

* Invitado (pendiente de aceptar).

* Inactivo.

## **6.13 Nóminas y contratos**

Propósito. Centralizar la documentación laboral y su envío.

**Roles que la ven:** Administrador (gestiona) · Empleado (consulta los suyos)

### **Elementos de la interfaz**

* Carpeta por empleado con contratos y nóminas (PDF).

* Resumen de horas del periodo listo para enviar a la gestoría (cálculo de horas, no de importes).

* Historial de documentos enviados y su fecha.

### **Acciones disponibles**

* Subir y organizar contratos y nóminas.

* Generar el resumen de horas del mes y exportarlo.

* Enviar un documento por correo al destinatario.

### **Estados**

* Al día.

* Pendiente de enviar.

* Sin documentos.

### **Notas de diseño**

* En la versión 1 la app NO calcula importes de nómina: prepara y entrega la información a la gestoría y custodia los documentos.

## **6.14 Asistente de IA**

Propósito. Concentrar las capacidades de inteligencia artificial en un punto conversacional.

**Roles que la ven:** Administrador y Manager (planificación) · Empleado (consultas sobre su horario)

### **Elementos de la interfaz**

* Conversación en lenguaje natural con sugerencias de ejemplo.

* Panel de “detecciones” con los problemas encontrados en el cuadrante actual.

* Vista previa de los cambios que propone la IA antes de aplicarlos.

### **Acciones disponibles**

* Pedir que genere o ajuste un cuadrante (“genera la semana respetando las vacaciones de Ana y dale el finde libre a Marcos”).

* Pedir que revise el cuadrante y liste los problemas.

* Aplicar o descartar la propuesta de la IA.

* Consultar (empleado): “¿cuándo trabajo esta semana?”.

### **Estados**

* En espera.

* Generando.

* Propuesta lista para revisar.

* Aplicado.

### **Notas de diseño**

* La IA nunca aplica cambios sin que el responsable los confirme; siempre muestra antes una vista previa.

## **6.15 Mi perfil (empleado)**

Propósito. Que el empleado vea su información y el estado de su cuenta.

**Roles que la ven:** Empleado

### **Elementos de la interfaz**

* Datos personales y de contrato (horas, tipo, rol, ubicación).

* Saldo de vacaciones y horas acumuladas/extra.

* Sus documentos (contrato y nóminas).

* Estado de la cuenta y preferencias de la app.

### **Acciones disponibles**

* Actualizar datos de contacto.

* Cambiar contraseña.

* Descargar sus documentos.

### **Estados**

* Completo.

* Datos pendientes de completar.

## **6.16 Ajustes / configuración**

Propósito. Configurar el comportamiento del sistema y la organización.

**Roles que la ven:** Administrador (global) · Manager (limitado a su ubicación)

### **Elementos de la interfaz**

* Datos de la organización y de facturación.

* Gestión de usuarios y roles.

* Configuración de la clave de la API de IA.

* Reglas por ubicación (aprobación de cambios de turno, roles y cobertura mínima).

* Preferencias de notificaciones por correo.

### **Acciones disponibles**

* Activar/desactivar la aprobación de cambios de turno por ubicación.

* Configurar qué eventos se notifican y a quién.

* Gestionar la clave de la API de IA.

### **Estados**

* Configurado.

* Configuración incompleta (avisos).

# **7\. Catálogo de herramientas**

*Resumen de cada herramienta del producto, qué problema resuelve y quién la usa.*

| Herramienta | Qué hace | Usuario principal |
| :---- | :---- | :---- |
| Importador con IA | Lee el Excel actual y propone empleados, roles, horas y descansos; pregunta lo que falta. | Administrador / Manager |
| Editor de cuadrantes | Crear y ajustar turnos en una rejilla semanal con control de horas y cobertura. | Administrador / Manager |
| Generador de cuadrantes con IA | Crea la semana completa respetando disponibilidad, vacaciones y reglas. | Administrador / Manager |
| Plantillas recurrentes | Guardar y reaplicar semanas tipo con un botón. | Administrador / Manager |
| Detector de problemas | Avisa de huecos, exceso de horas, descansos insuficientes y solapes. | Administrador / Manager |
| Disponibilidad | El empleado declara cuándo puede o prefiere no trabajar. | Empleado |
| Vacaciones y ausencias | Solicitar, aprobar/rechazar y ver saldo; impacto en el cuadrante. | Todos |
| Intercambio de turnos | Cambiar turnos entre empleados con aprobación configurable. | Empleado / Responsable |
| Fichaje | Registro real de entrada/salida y comparación con lo planificado. | Empleado / Responsable |
| Costes laborales | Coste por día, ubicación y empleado; ratio coste/ventas opcional. | Administrador / Manager |
| Gestión documental | Custodia y envío de contratos y nóminas; resumen de horas para la gestoría. | Administrador / Empleado |
| Asistente IA | Planificación en lenguaje natural y consultas sobre el horario. | Todos |
| Notificaciones por correo | Avisos automáticos de cambios y solicitudes al administrador. | Administrador |

# **8\. Capacidades de inteligencia artificial**

La IA se apoya en la API de Anthropic (Claude) con una clave proporcionada por la organización. Se usa en cuatro funciones concretas y siempre bajo la supervisión del responsable: ninguna acción se aplica sin confirmación.

## **8.1 Análisis del Excel**

* Identifica, para cada empleado, su nombre, el tipo de empleado (completo, parcial), las horas que trabaja, las horas extra y los días de descanso.

* Detecta el rol cuando aparece en el archivo y, si no, lo pregunta.

* Marca con un nivel de confianza los datos dudosos para que el responsable los revise.

* Devuelve una propuesta editable: el responsable corrige, nombra la ubicación y confirma.

## **8.2 Preguntas guiadas (entrevista de configuración)**

Cuando el Excel no contiene toda la información necesaria, la IA hace las preguntas más adecuadas para poder planificar, por ejemplo:

* ¿Qué empleados pueden hacer turnos partidos?

* ¿Cuántas personas necesitas de cada rol en cada franja horaria?

* ¿Cuál es el horario de apertura y los días de más trabajo?

* ¿Hay empleados que no pueden cubrir ciertos turnos?

## **8.3 Generación de cuadrantes en lenguaje natural**

* Crea la semana completa respetando disponibilidad, vacaciones/ausencias, horas de contrato y la cobertura mínima por rol.

* Entiende instrucciones en lenguaje natural: “genera la próxima semana, da el finde libre a Marcos y no pongas a Ana en turno de noche”.

* Muestra siempre una vista previa de los cambios antes de aplicarlos.

## **8.4 Detección de problemas**

* Franjas sin cubrir o por debajo del mínimo definido.

* Empleados por encima de sus horas de contrato o con demasiadas horas extra.

* Descansos insuficientes entre jornadas y turnos solapados.

* Conflictos con vacaciones, ausencias o disponibilidad declarada.

## **8.5 Asistente para el empleado**

* Responde a preguntas como “¿cuándo trabajo esta semana?” o “¿cuántas horas llevo este mes?”.

* Ayuda a iniciar una solicitud de vacaciones o una propuesta de cambio de turno.

## **8.6 Principios de uso de la IA**

* **Supervisión humana:** la IA propone; el responsable decide y confirma.

* **Transparencia:** siempre se muestra qué va a cambiar antes de aplicarlo.

* **Privacidad:** se envía a la IA solo la información necesaria para la tarea.

* **Reversibilidad:** cualquier cambio aplicado se puede deshacer.

# **9\. Flujos de trabajo de principio a fin**

## **9.1 Puesta en marcha de una ubicación**

6. El administrador crea una ubicación e inicia el importador.

7. Sube el Excel del cuadrante/empleados actual.

8. La IA analiza y muestra la tabla de empleados detectados.

9. El administrador corrige lo que haga falta y responde a las preguntas de la IA.

10. Pone nombre a la ubicación y confirma.

11. Opcionalmente, genera el primer cuadrante con IA.

## **9.2 Planificación semanal**

12. El responsable abre el cuadrante de la semana.

13. Aplica una plantilla recurrente o pulsa “Generar con IA”.

14. Revisa los avisos del detector de problemas y ajusta.

15. Publica el cuadrante.

16. El sistema notifica al administrador por correo y los empleados ven su horario.

## **9.3 Vacaciones y su impacto**

17. El empleado solicita vacaciones indicando fechas.

18. El administrador recibe el aviso por correo.

19. El responsable ve el impacto en la cobertura y aprueba o rechaza.

20. Si se aprueba, los días se bloquean y la IA los respeta al planificar.

## **9.4 Cambio de turno**

21. El empleado propone intercambiar un turno con un compañero.

22. El compañero acepta.

23. Si la ubicación exige aprobación, el responsable la confirma; si no, se aplica directamente.

24. El cuadrante se actualiza y se notifica al administrador.

# **10\. Modelo de datos (entidades principales)**

Descripción funcional de la información que maneja el sistema; no es un diseño técnico de base de datos.

| Entidad | Descripción | Relaciones clave |
| :---- | :---- | :---- |
| Organización | El negocio que usa la app. | Tiene ubicaciones y usuarios. |
| Ubicación | Un local o centro de trabajo. | Pertenece a una organización; tiene empleados y cuadrantes. |
| Usuario | Persona con acceso (administrador, manager o empleado). | Pertenece a la organización; tiene un rol. |
| Empleado | Ficha laboral de una persona. | Asignado a ubicación(es); tiene contrato, turnos y documentos. |
| Contrato | Tipo, horas y coste/hora. | Pertenece a un empleado. |
| Turno | Asignación de trabajo (día, horas, rol, partido). | Pertenece a cuadrante y empleado. |
| Cuadrante | Conjunto de turnos de una semana en una ubicación. | Tiene turnos; puede venir de una plantilla. |
| Plantilla | Semana tipo reutilizable. | Genera cuadrantes. |
| Disponibilidad | Franjas y preferencias del empleado. | Pertenece a un empleado. |
| Ausencia | Vacaciones, ausencia o baja con fechas y estado. | Pertenece a un empleado; afecta a cuadrantes. |
| Cambio de turno | Propuesta de intercambio y su estado. | Relaciona dos turnos/empleados. |
| Fichaje | Registro real de entrada/salida. | Pertenece a un empleado y a un turno. |
| Documento | Contrato o nómina en PDF. | Pertenece a un empleado. |
| Notificación | Aviso por correo de un evento. | Asociada a un evento y un destinatario. |

# **11\. Notificaciones por correo electrónico**

En la versión 1, las notificaciones se envían por correo y van dirigidas al administrador/gerente. Cada aviso incluye el contexto (ubicación, empleado, fechas) y un enlace para actuar.

| Evento | Contenido del aviso | Destinatario |
| :---- | :---- | :---- |
| Nueva solicitud de vacaciones/ausencia | Empleado, tipo, fechas y saldo. | Administrador |
| Resolución de una solicitud | Aprobada o rechazada y comentario. | Administrador |
| Nueva baja registrada | Empleado, fechas y justificante. | Administrador |
| Propuesta / confirmación de cambio de turno | Empleados implicados y turnos. | Administrador |
| Cuadrante publicado | Ubicación y semana. | Administrador |
| Incidencia de fichaje | Empleado, tipo de incidencia y día. | Administrador |
| Aviso de la IA (conflicto grave) | Resumen del problema detectado. | Administrador |

*La ampliación a notificaciones por WhatsApp y avisos directos al empleado está prevista para una fase posterior.*

# **12\. Seguridad, privacidad y RGPD**

La aplicación trata datos personales de empleados y, en el caso de las bajas, datos de salud (categoría especialmente protegida). El diseño contempla la protección de datos desde el origen.

* **Acceso por roles:** cada usuario solo ve lo que le corresponde según su rol y ubicación.

* **Cifrado:** los datos se transmiten y almacenan cifrados.

* **Minimización:** a la IA solo se envía la información necesaria para cada tarea.

* **Trazabilidad:** las acciones sensibles (correcciones de fichaje, cambios de cuadrante) quedan registradas.

* **Datos de salud:** los justificantes de baja se tratan con acceso restringido.

* **Derechos del interesado:** soporte para acceso, rectificación y supresión de datos del empleado.

* **Conservación:** los registros de jornada y documentos se conservan el tiempo que exige la normativa.

# **13\. Requisitos no funcionales**

* **Rendimiento:** el cuadrante semanal de una ubicación debe cargar en menos de 2 segundos.

* **Disponibilidad:** objetivo de disponibilidad alto; el fichaje no debe fallar en horas punta.

* **Responsive:** uso cómodo en ordenador, tablet (modo fichaje del local) y móvil (empleado).

* **Accesibilidad:** contraste suficiente, navegación por teclado y textos legibles.

* **Idioma:** interfaz en español; arquitectura preparada para más idiomas.

* **Usabilidad:** un responsable sin formación técnica debe poder publicar un cuadrante el primer día.

* **Escalabilidad:** soportar varias ubicaciones y decenas de empleados por ubicación sin degradarse.

# **14\. Hoja de ruta por fases**

## **Fase 1 — MVP (núcleo del producto)**

* Roles y acceso; alta de ubicaciones.

* Importador con IA y análisis del Excel.

* Editor de cuadrantes, generación con IA, plantillas recurrentes y detección de problemas.

* Disponibilidad, vacaciones/ausencias/bajas e intercambio de turnos configurable.

* Fichaje y control horario.

* Costes laborales y gestión documental básica.

* Notificaciones por correo al administrador.

## **Fase 2 — Profesionalización**

* Notificaciones por WhatsApp y avisos directos al empleado.

* Integración con software de nóminas/gestoría (exportaciones a A3, Sage).

* Ratio coste/ventas con importación de ventas y previsión de demanda.

* Validación de convenio colectivo y reglas legales avanzadas.

* Multi-idioma.

## **Fase 3 — Avanzado**

* Integración con TPV para dimensionar plantilla por venta.

* Aplicaciones móviles nativas.

* Analítica avanzada (absentismo, rotación, previsión de costes).

# **15\. Glosario**

| Término | Significado |
| :---- | :---- |
| Cuadrante | Planificación de los turnos de trabajo de un equipo en un periodo (normalmente una semana). |
| Turno | Periodo de trabajo asignado a un empleado un día concreto. |
| Turno partido | Jornada dividida en dos tramos el mismo día, habitual en hostelería. |
| Franja | Tramo horario dentro de un día (p. ej. comidas, cenas). |
| Cobertura | Número de personas necesarias por rol y franja. |
| Plantilla recurrente | Semana tipo guardada para reutilizarse. |
| Disponibilidad | Franjas en las que el empleado puede o prefiere no trabajar. |
| Fichaje | Registro real de la hora de entrada y salida. |
| Ratio coste/ventas | Porcentaje del gasto de personal sobre las ventas. |

*Fin del documento — Gestión Horarios · Especificación funcional y de interfaz v1.0*