// =================================================================
// Archivo: src/mocks/mockApi.ts
// RESPONSABILIDAD: API FALSA para armar y probar el flujo del DUEÑO
// mientras P3 termina el backend.
//
// CÓMO SE ACTIVA (api.ts lo llama solo si VITE_USAR_MOCK=true):
//     npm run dev:mock          -> usa el archivo .env.mock
//
// CÓMO SE APAGA (cuando la API real esté lista):
//     npm run dev               -> habla con FastAPI como siempre
//   No hay nada más que borrar: las páginas y los servicios no cambian.
//
// Los datos se guardan en localStorage para que lo que el dueño cree
// (mascotas, citas, reportes) siga ahí al recargar. Para volver a los
// datos de ejemplo, en la consola del navegador:  vpMockReset()
//
// OJO: las reglas de aquí (nivel de triaje, cupos, etc.) son una
// APROXIMACIÓN para que la pantalla tenga algo que mostrar. La regla
// oficial es la del backend.
// =================================================================
import type { Mascota } from '../services/mascotasService';
import type { Cita, CitaPendiente, Derivacion, Franja, FranjaDisponibilidad, Veterinario } from '../services/citasService';
import type { RegistroHistorial, PesoControl } from '../services/historialService';
import type { Vacuna } from '../services/vacunasService';
import type { ExamenLaboratorio } from '../services/laboratorioService';
import type { EsquemaSanitario } from '../services/esquemaSanitarioService';
import type { SeguimientoPendiente } from '../services/seguimientoService';
import type { InfoNivelTriaje, NivelTriaje } from '../services/triajeService';
import type { PerfilUsuario } from '../services/usersService';

// ---------------------------------------------------------------
// Fechas relativas a "hoy" para que el demo nunca se vea vencido
// ---------------------------------------------------------------
const DIA_MS = 24 * 60 * 60 * 1000;

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** 'AAAA-MM-DD' de hoy + n días (n puede ser negativo). */
function dia(n: number): string {
  return iso(new Date(Date.now() + n * DIA_MS));
}

// ---------------------------------------------------------------
// Catálogos fijos
// ---------------------------------------------------------------
const FRANJAS: Franja[] = [
  { idFranja: 1, nombre: 'Mañana', hora_inicio: '08:00:00', hora_fin: '12:00:00', cupo_maximo: 6 },
  { idFranja: 2, nombre: 'Tarde', hora_inicio: '14:00:00', hora_fin: '18:00:00', cupo_maximo: 6 },
];

const VETERINARIOS: (Veterinario & { especialidad: string })[] = [
  { idVeterinario: 1, nombre: 'Camila', apellido: 'Rojas', especialidad: 'general' },
  { idVeterinario: 2, nombre: 'Andrés', apellido: 'Pérez', especialidad: 'general' },
  { idVeterinario: 3, nombre: 'Marcela', apellido: 'Ortiz', especialidad: 'dermatología' },
];

const NIVELES: InfoNivelTriaje[] = [
  { codigo: 'rojo', numero: 1, etiqueta: 'Rojo', nombre: 'Emergencia', minutos_objetivo: 0, tiempo_texto: 'Atención inmediata', genera_alerta: true,
    desc_veterinario: 'Riesgo vital inminente: dificultad respiratoria severa, convulsiones, trauma grave o hemorragia activa. Se atiende de inmediato, sin espera.',
    desc_dueno: 'Tu mascota podría estar en peligro. No esperes: llama o ve a la clínica ahora mismo.' },
  { codigo: 'naranja', numero: 2, etiqueta: 'Naranja', nombre: 'Muy urgente', minutos_objetivo: 10, tiempo_texto: 'Máx. 10 minutos', genera_alerta: true,
    desc_veterinario: 'Signos que pueden comprometer la vida si no se atienden pronto: vómito con sangre, decaimiento extremo, dolor intenso.',
    desc_dueno: 'Hay signos que necesitan atención pronto. El veterinario revisará tu reporte con prioridad.' },
  { codigo: 'amarillo', numero: 3, etiqueta: 'Amarillo', nombre: 'Urgente', minutos_objetivo: 60, tiempo_texto: 'Máx. 60 minutos', genera_alerta: true,
    desc_veterinario: 'Condición estable pero que requiere valoración pronta: diarrea persistente, fiebre, poco apetito por varios días.',
    desc_dueno: 'Algo no está del todo bien. El veterinario lo revisará hoy y te contactará si hace falta.' },
  { codigo: 'verde', numero: 4, etiqueta: 'Verde', nombre: 'Estándar', minutos_objetivo: 120, tiempo_texto: 'Máx. 2 horas', genera_alerta: true,
    desc_veterinario: 'Condición leve: cambios menores de comportamiento o apetito, sin otros signos de alarma. Se agenda consulta o seguimiento normal.',
    desc_dueno: 'Cambios leves. Sigue observando a tu mascota; el veterinario lo tendrá en cuenta.' },
  { codigo: 'azul', numero: 5, etiqueta: 'Azul', nombre: 'No urgente', minutos_objetivo: 240, tiempo_texto: 'Consulta de rutina', genera_alerta: false,
    desc_veterinario: 'La mascota reporta estar bien. Corresponde a controles de rutina, vacunación o chequeos programados.',
    desc_dueno: 'Todo está bien. No se genera alerta; sigue con tus controles de rutina.' },
];

// ---------------------------------------------------------------
// Base de datos falsa (con valores de ejemplo)
// ---------------------------------------------------------------
interface ReporteMock {
  idReporte: number;
  fecha: string;
  idMascota: number;
  nivel: NivelTriaje;
}

interface Db {
  usuario: PerfilUsuario;
  mascotas: Mascota[];
  citas: Cita[];
  historial: RegistroHistorial[];
  vacunas: Vacuna[];
  examenes: ExamenLaboratorio[];
  derivaciones: Derivacion[];
  seguimientos: SeguimientoPendiente[];
  reportes: ReporteMock[];
  sig: number; // siguiente id libre
}

const CLAVE = 'vp_mock_db_v2';

function semilla(): Db {
  return {
    usuario: { idUsuario: 101, nombre: 'Laura', apellido: 'Gómez', documento: '1020304050', telefono: '3001234567', email: 'laura.gomez@demo.co', rol: 'dueno' },
    mascotas: [
      { idMascota: 1, idUsuario: 101, nombre_mascota: 'Max', especie: 'Canino', raza: 'Labrador', sexo: 'macho', fechaNacimiento: dia(-365 * 4), peso_kg: 28.5, estado: 'activo' },
      { idMascota: 2, idUsuario: 101, nombre_mascota: 'Luna', especie: 'Felino', raza: 'Siamés', sexo: 'hembra', fechaNacimiento: dia(-365 * 2), peso_kg: 4.2, estado: 'activo' },
      { idMascota: 3, idUsuario: 101, nombre_mascota: 'Kiwi', especie: 'Aves', raza: 'Periquito', sexo: 'macho', fechaNacimiento: dia(-400), peso_kg: 0.04, estado: 'activo' },
    ],
    citas: [
      { idCita: 1, idUsuario: 101, idMascota: 1, idVeterinario: 1, idFranja: 1, franja: FRANJAS[0], canal_contacto: 'telefono', motivo: 'Control anual y desparasitación', fechaHora: `${dia(3)}T08:00:00`, estado: 'pendiente' },
      { idCita: 2, idUsuario: 101, idMascota: 2, idVeterinario: 2, idFranja: 2, franja: FRANJAS[1], canal_contacto: 'app', motivo: 'Vacuna triple felina', fechaHora: `${dia(8)}T14:00:00`, estado: 'confirmada' },
      { idCita: 3, idUsuario: 101, idMascota: 1, idVeterinario: 1, idFranja: 1, franja: FRANJAS[0], canal_contacto: 'app', motivo: 'Picazón en la piel', fechaHora: `${dia(-20)}T08:00:00`, estado: 'completada' },
      { idCita: 4, idUsuario: 101, idMascota: 3, idVeterinario: 2, idFranja: 2, franja: FRANJAS[1], canal_contacto: 'correo', motivo: 'Revisión de plumaje', fechaHora: `${dia(-9)}T14:00:00`, estado: 'cancelada' },
    ],
    historial: [
      {
        idHistorial: 1, idMascota: 1, nombre_mascota: 'Max', especie: 'Canino', fechaRegistro: `${dia(-20)}T09:10:00`,
        motivo_consulta: 'Picazón en la piel', diagnostico: 'Dermatitis alérgica leve',
        tratamiento: 'Baño medicado cada 3 días durante 2 semanas.', medicamentos: 'Antihistamínico oral',
        observaciones: 'Evitar el pasto recién cortado. Revisar en 3 semanas.', proxima_cita: dia(3),
        peso_consulta: 28.5, temperatura: 38.6, frecuencia_cardiaca: 96, frecuencia_respiratoria: 24,
        mucosas: 'Rosadas', tllc_seg: 1.5, hidratacion: 'Normal', condicion_corporal: 5, estado: 'activo',
        formulas: [{ idFormula: 1, idHistorial: 1, recomendaciones: 'Dar con comida. Suspender si hay vómito.', estado: 'activa',
          medicamentos: [{ nombre_medicamento: 'Cetirizina', presentacion: 'Tabletas 10 mg', dosis: '1 tableta', via_administracion: 'Oral', frecuencia: 'Cada 24 horas', duracion_dias: 10, cantidad: 10 }] }],
      },
      {
        idHistorial: 2, idMascota: 2, nombre_mascota: 'Luna', especie: 'Felino', fechaRegistro: `${dia(-75)}T15:30:00`,
        motivo_consulta: 'Control de rutina', diagnostico: 'Paciente sana',
        tratamiento: 'Sin tratamiento. Continuar alimentación actual.', observaciones: 'Buen estado general.',
        peso_consulta: 4.1, temperatura: 38.4, frecuencia_cardiaca: 160, frecuencia_respiratoria: 28,
        mucosas: 'Rosadas', hidratacion: 'Normal', condicion_corporal: 5, estado: 'activo', formulas: [],
      },
      {
        idHistorial: 3, idMascota: 1, nombre_mascota: 'Max', especie: 'Canino', fechaRegistro: `${dia(-190)}T10:00:00`,
        motivo_consulta: 'Vacunación y control', diagnostico: 'Paciente sana',
        tratamiento: 'Refuerzo de vacunas.', observaciones: 'Peso adecuado para la raza.',
        peso_consulta: 27.9, temperatura: 38.5, estado: 'activo', formulas: [],
      },
    ],
    vacunas: [
      { idVacuna: 1, idMascota: 1, nombre_mascota: 'Max', nombre_vacuna: 'Parvovirus / Moquillo (DHPP)', fecha_aplicacion: dia(-190), proxima_dosis: dia(175), veterinario: 'Dra. Camila Rojas', lote: 'DH-4471', estado: 'activo' },
      { idVacuna: 2, idMascota: 1, nombre_mascota: 'Max', nombre_vacuna: 'Rabia', fecha_aplicacion: dia(-190), proxima_dosis: dia(-5), veterinario: 'Dra. Camila Rojas', lote: 'RB-2209', estado: 'activo' },
      { idVacuna: 3, idMascota: 2, nombre_mascota: 'Luna', nombre_vacuna: 'Triple felina', fecha_aplicacion: dia(-340), proxima_dosis: dia(8), veterinario: 'Dr. Andrés Pérez', lote: 'TF-9013', estado: 'activo' },
    ],
    examenes: [
      { idExamen: 1, idHistorial: 1, idMascota: 1, nombre_mascota: 'Max', categoria: 'hematologia', tipo_examen: 'Hemograma completo', estado: 'entregado',
        fecha_solicitud: `${dia(-20)}T09:30:00`, fecha_resultado: `${dia(-19)}T15:00:00`, resultado: 'Eosinofilia leve, compatible con proceso alérgico.',
        valores: [{ parametro: 'Hematocrito', valor: '45', unidad: '%', referencia: '37-55' }, { parametro: 'Eosinófilos', valor: '1.9', unidad: 'x10³/µL', referencia: '0.1-1.2' }] },
      { idExamen: 2, idHistorial: 1, idMascota: 1, nombre_mascota: 'Max', categoria: 'coprologia', tipo_examen: 'Coprológico', estado: 'en_proceso', fecha_solicitud: `${dia(-2)}T10:00:00` },
    ],
    derivaciones: [{ idDerivacion: 1, idMascota: 1, especialidadDestino: 'dermatología', estado: 'pendiente' }],
    seguimientos: [
      { idRespuesta: 501, nombre_mascota: 'Max', texto_pregunta: '¿La picazón ha disminuido desde el baño medicado?', fecha_programada: `${dia(0)}T08:00:00`, tipo_respuesta: 'bien_regular_mal', opciones: null },
      { idRespuesta: 502, nombre_mascota: 'Max', texto_pregunta: '¿Se está rascando menos que ayer?', fecha_programada: `${dia(0)}T18:00:00`, tipo_respuesta: 'bien_regular_mal', opciones: null },
    ],
    reportes: [],
    sig: 1000,
  };
}

function cargarDb(): Db {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) return JSON.parse(crudo) as Db;
  } catch {
    /* sin localStorage: se trabaja en memoria */
  }
  return semilla();
}

let db: Db = cargarDb();

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db));
  } catch {
    /* ignorar */
  }
}

/** Vuelve a los datos de ejemplo. Disponible en la consola como vpMockReset(). */
export function resetearMock() {
  db = semilla();
  guardar();
  // eslint-disable-next-line no-console
  console.info('[mock] Datos de ejemplo restaurados.');
}
if (typeof window !== 'undefined') {
  (window as unknown as { vpMockReset: () => void }).vpMockReset = resetearMock;
}

// ---------------------------------------------------------------
// Utilidades del enrutador
// ---------------------------------------------------------------
type Cuerpo = Record<string, unknown>;
interface Peticion {
  params: string[]; // grupos capturados de la ruta
  query: URLSearchParams;
  body: Cuerpo;
}
type Manejador = (p: Peticion) => unknown;

class ErrorMock extends Error {}

function noEncontrado(que: string): never {
  throw new ErrorMock(`${que} no existe.`);
}

function mascotaDe(id: number): Mascota {
  return db.mascotas.find((m) => m.idMascota === id) ?? noEncontrado('La mascota');
}

function nombreVet(id?: number | null): string | null {
  const v = VETERINARIOS.find((x) => x.idVeterinario === id);
  return v ? `Dr(a). ${v.nombre} ${v.apellido}` : null;
}

/** Aproximación del triaje del reporte diario (la oficial es la del backend). */
function nivelDelReporte(comio: string, activa: string, sintoma: string): NivelTriaje {
  const pComio: Record<string, number> = { 'Sí, normal': 0, Poco: 1, 'No comió': 2 };
  const pActiva: Record<string, number> = { 'Muy activa': 0, Normal: 0, Decaída: 1, 'Sin energía': 2 };
  const pSintoma: Record<string, number> = { Ninguno: 0, Otro: 1, Tos: 1, Diarrea: 2, Vómito: 2 };
  const total = (pComio[comio] ?? 0) + (pActiva[activa] ?? 0) + (pSintoma[sintoma] ?? 0);
  if (total === 0) return 'azul';
  if (total === 1) return 'verde';
  if (total === 2) return 'amarillo';
  if (total <= 4) return 'naranja';
  return 'rojo';
}

function disponibilidad(fecha: string, idVet?: number): FranjaDisponibilidad[] {
  const d = new Date(`${fecha}T12:00:00`);
  const esDomingo = d.getDay() === 0;
  const esPasado = fecha < dia(0);
  return FRANJAS.map((f) => {
    const usados = db.citas.filter(
      (c) => c.estado !== 'cancelada' && c.fechaHora.startsWith(fecha) && c.idFranja === f.idFranja &&
        (!idVet || c.idVeterinario === idVet)
    ).length;
    const libres = Math.max(f.cupo_maximo - usados, 0);
    const motivo = esDomingo ? 'La clínica no atiende los domingos.' : esPasado ? 'La fecha ya pasó.' : libres === 0 ? 'Sin cupos.' : null;
    return { ...f, cupos_usados: usados, cupos_disponibles: libres, disponible: !motivo, motivo_no_disponible: motivo };
  });
}

function esquemaDemo(idMascota: number): EsquemaSanitario {
  const m = mascotaDe(idMascota);
  const rabia = db.vacunas.find((v) => v.idMascota === idMascota && /rabia/i.test(v.nombre_vacuna));
  const venc = !!rabia?.proxima_dosis && rabia.proxima_dosis < dia(0);
  return {
    idMascota, nombre_mascota: m.nombre_mascota, especie: m.especie, fechaNacimiento: m.fechaNacimiento ?? null, edad_semanas: null,
    tiene_esquema: true, nota: 'Esquema de referencia general (demo). El veterinario puede ajustarlo.',
    resumen: { al_dia: venc ? 1 : 2, proxima: 0, vencida: venc ? 1 : 0, sin_datos: 0, opcional: 0 },
    items: [
      { clave: 'rabia', tipo: 'vacuna', nombre: 'Antirrábica', opcional: false, detalle: 'Refuerzo anual.', estado: venc ? 'vencida' : 'al_dia',
        dosis_aplicadas: rabia ? 1 : 0, dosis_total: 1, ultima_aplicacion: rabia?.fecha_aplicacion ?? null, fecha_objetivo: rabia?.proxima_dosis ?? null,
        dias_restantes: null, mensaje: venc ? 'Atrasada: correspondía el refuerzo.' : 'Al día.', aplicaciones: [] },
      { clave: 'desparasitacion', tipo: 'desparasitacion', nombre: 'Desparasitación interna', opcional: false, detalle: 'Cada 3 meses en adultos.', estado: 'al_dia',
        dosis_aplicadas: 0, dosis_total: null, ultima_aplicacion: null, fecha_objetivo: dia(40), dias_restantes: 40, mensaje: 'Al día (demo).', aplicaciones: [] },
    ],
  };
}

// ---------------------------------------------------------------
// Rutas (método + ruta). Las más específicas van primero.
// ---------------------------------------------------------------
const rutas: { metodo: string; patron: RegExp; fn: Manejador }[] = [
  // ---- Sesión y perfil ----
  { metodo: 'POST', patron: /^\/users\/login$/, fn: ({ body }) => ({
      idUsuario: db.usuario.idUsuario, nombre: db.usuario.nombre, apellido: db.usuario.apellido,
      rol: 'dueno', email: (body.email as string) || db.usuario.email, access_token: 'mock-token',
  }) },
  { metodo: 'POST', patron: /^\/users\/register$/, fn: ({ body }) => ({
      idUsuario: db.sig++, nombre: body.nombre, apellido: body.apellido, email: body.email, rol: 'dueno',
  }) },
  { metodo: 'POST', patron: /^\/auth\/(recuperar|restablecer)-contrasena$/, fn: () => undefined },
  { metodo: 'GET', patron: /^\/users\/me$/, fn: () => db.usuario },
  { metodo: 'PUT', patron: /^\/users\/me$/, fn: ({ body }) => {
      const resto = { ...body };
      delete resto.contrasena; // la contraseña no se guarda en el demo
      db.usuario = { ...db.usuario, ...(resto as Partial<PerfilUsuario>) };
      guardar();
      return db.usuario;
  } },

  // ---- Mascotas ----
  { metodo: 'GET', patron: /^\/mascotas\/mias$/, fn: () => db.mascotas },
  { metodo: 'GET', patron: /^\/mascotas\/(\d+)$/, fn: ({ params }) => mascotaDe(Number(params[0])) },
  { metodo: 'POST', patron: /^\/mascotas\/$/, fn: ({ body }) => {
      const nueva = { ...(body as unknown as Mascota), idMascota: db.sig++, idUsuario: db.usuario.idUsuario, estado: 'activo' as const };
      db.mascotas.push(nueva);
      guardar();
      return nueva;
  } },
  { metodo: 'PUT', patron: /^\/mascotas\/(\d+)$/, fn: ({ params, body }) => {
      const m = mascotaDe(Number(params[0]));
      Object.assign(m, body);
      guardar();
      return m;
  } },
  { metodo: 'DELETE', patron: /^\/mascotas\/(\d+)$/, fn: ({ params }) => {
      mascotaDe(Number(params[0])).estado = 'inactivo';
      guardar();
  } },

  // ---- Citas ----
  { metodo: 'GET', patron: /^\/citas\/franjas\/disponibilidad$/, fn: ({ query }) =>
      disponibilidad(query.get('fecha') || dia(1), query.get('idVeterinario') ? Number(query.get('idVeterinario')) : undefined) },
  { metodo: 'GET', patron: /^\/citas\/franjas$/, fn: () => FRANJAS },
  { metodo: 'GET', patron: /^\/citas\/mias\/pendientes$/, fn: () =>
      db.citas.filter((c) => c.estado === 'pendiente').map((c): CitaPendiente => ({
        idCita: c.idCita, fechaHora: c.fechaHora, motivo: c.motivo, estado: c.estado, idMascota: c.idMascota,
        nombre_mascota: mascotaDe(c.idMascota).nombre_mascota, idVeterinario: c.idVeterinario,
        nombre_veterinario: nombreVet(c.idVeterinario), franja: c.franja, canal_contacto: c.canal_contacto,
        mensaje: 'Tu cita está pendiente de confirmación por la clínica.',
      })) },
  { metodo: 'GET', patron: /^\/citas\/mias$/, fn: () => db.citas },
  { metodo: 'POST', patron: /^\/citas\/$/, fn: ({ body }) => {
      const franja = FRANJAS.find((f) => f.idFranja === Number(body.idFranja));
      if (!franja || !body.fecha) throw new ErrorMock('Elige un día y una franja.');
      const libre = disponibilidad(String(body.fecha), body.idVeterinario ? Number(body.idVeterinario) : undefined)
        .find((f) => f.idFranja === franja.idFranja);
      if (!libre?.disponible) throw new ErrorMock(libre?.motivo_no_disponible || 'Esa franja no está disponible.');
      const nueva: Cita = {
        idCita: db.sig++, idUsuario: db.usuario.idUsuario, idMascota: Number(body.idMascota),
        idVeterinario: body.idVeterinario ? Number(body.idVeterinario) : undefined,
        idFranja: franja.idFranja, franja, canal_contacto: (body.canal_contacto as Cita['canal_contacto']) ?? 'app',
        motivo: (body.motivo as string) || undefined, fechaHora: `${body.fecha}T${franja.hora_inicio}`, estado: 'pendiente',
      };
      db.citas.push(nueva);
      guardar();
      return nueva;
  } },
  { metodo: 'PUT', patron: /^\/citas\/(\d+)$/, fn: ({ params, body }) => {
      const c = db.citas.find((x) => x.idCita === Number(params[0])) ?? noEncontrado('La cita');
      Object.assign(c, body);
      guardar();
      return c;
  } },
  { metodo: 'DELETE', patron: /^\/citas\/(\d+)$/, fn: ({ params }) => {
      (db.citas.find((x) => x.idCita === Number(params[0])) ?? noEncontrado('La cita')).estado = 'cancelada';
      guardar();
  } },
  { metodo: 'GET', patron: /^\/veterinarios\/$/, fn: ({ query }) => {
      const esp = (query.get('especialidad') || 'general').toLowerCase();
      return VETERINARIOS.filter((v) => v.especialidad === esp);
  } },
  { metodo: 'GET', patron: /^\/derivaciones\/mias$/, fn: () => db.derivaciones },

  // ---- Historial y vacunas ----
  { metodo: 'GET', patron: /^\/historial\/mias$/, fn: () => db.historial },
  { metodo: 'GET', patron: /^\/historial\/mascota\/(\d+)\/pesos$/, fn: ({ params }) =>
      db.historial.filter((h) => h.idMascota === Number(params[0]) && h.peso_consulta != null)
        .map((h): PesoControl => ({ idHistorial: h.idHistorial, fecha: h.fechaRegistro, peso_kg: h.peso_consulta as number }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)) },
  { metodo: 'GET', patron: /^\/historial\/mascota\/(\d+)$/, fn: ({ params }) => db.historial.filter((h) => h.idMascota === Number(params[0])) },
  { metodo: 'GET', patron: /^\/vacunas\/mascota\/(\d+)$/, fn: ({ params }) => db.vacunas.filter((v) => v.idMascota === Number(params[0])) },

  // ---- Laboratorio y esquema sanitario (solo lectura para el dueño) ----
  { metodo: 'GET', patron: /^\/laboratorio\/historial\/(\d+)$/, fn: ({ params }) =>
      db.examenes.filter((e) => e.idHistorial === Number(params[0]))
        .map((e) => (e.estado === 'entregado' ? e : { ...e, resultado: null, valores: null, archivo_url: null })) },
  { metodo: 'GET', patron: /^\/laboratorio\/mias$/, fn: () => db.examenes },
  { metodo: 'GET', patron: /^\/esquema-sanitario\/mascota\/(\d+)$/, fn: ({ params }) => esquemaDemo(Number(params[0])) },

  // ---- Reporte diario y seguimiento ----
  { metodo: 'POST', patron: /^\/reportes-salud\/$/, fn: ({ body }) => {
      mascotaDe(Number(body.idMascota));
      const nivel = nivelDelReporte(String(body.alimentacion), String(body.actividad), String(body.sintomas));
      const reporte = { idReporte: db.sig++, fecha: new Date().toISOString(), idMascota: Number(body.idMascota), nivel };
      db.reportes.push(reporte);
      guardar();
      return { idReporte: reporte.idReporte, nivel };
  } },
  { metodo: 'GET', patron: /^\/seguimientos\/mias\/pendientes$/, fn: () => db.seguimientos },
  { metodo: 'POST', patron: /^\/seguimientos\/respuestas\/(\d+)$/, fn: ({ params }) => {
      db.seguimientos = db.seguimientos.filter((s) => s.idRespuesta !== Number(params[0]));
      guardar();
  } },

  // ---- Triaje ----
  { metodo: 'GET', patron: /^\/triaje\/niveles$/, fn: () => NIVELES },
];

// ---------------------------------------------------------------
// Punto de entrada: lo llama apiFetch() cuando el modo demo está activo
// ---------------------------------------------------------------
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockFetch<T>(path: string, options: { method?: string; body?: BodyInit | null } = {}): Promise<T> {
  const metodo = (options.method || 'GET').toUpperCase();
  const [ruta, qs = ''] = path.split('?');
  const query = new URLSearchParams(qs);
  let body: Cuerpo = {};
  try {
    body = options.body ? (JSON.parse(String(options.body)) as Cuerpo) : {};
  } catch {
    /* cuerpo no JSON */
  }

  await pausa(200 + Math.random() * 250); // que se vean los estados de "cargando"

  for (const r of rutas) {
    if (r.metodo !== metodo) continue;
    const m = ruta.match(r.patron);
    if (!m) continue;
    return JSON.parse(JSON.stringify(r.fn({ params: m.slice(1), query, body }) ?? null)) as T;
  }
  // Una ruta que aún no tiene dato falso: se avisa claro en vez de fallar callado.
  throw new Error(`[modo demo] Esta pantalla todavía no tiene datos de ejemplo: ${metodo} ${ruta}`);
}
