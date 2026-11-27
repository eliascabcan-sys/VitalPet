// =================================================================
// Archivo: src/pages/DuenoAutorizacionesPage/DuenoAutorizacionesPage.tsx
// RESPONSABILIDAD: Autorizaciones para adultos mayores (60+). El dueño
// registra su acudiente y firma el consentimiento. Sin las dos cosas no
// puede agendar citas (lo valida el backend al crear la cita).
// Pantalla en un solo flujo: 1) estado, 2) acudientes, 3) consentimiento.
// =================================================================
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { autorizacionesService } from '../../services/autorizacionesService';
import type { EstadoAutorizacion } from '../../services/autorizacionesService';
import { useToast } from '../../components/Toast/ToastContext';
import '../../assets/css/dueno.css';
import './DuenoAutorizacionesPage.css';

const PARENTESCOS = ['Hijo/a', 'Cónyuge', 'Hermano/a', 'Nieto/a', 'Otro familiar', 'Cuidador/a'];

const FORM_VACIO = { nombre: '', apellido: '', documento: '', telefono: '', email: '', parentesco: '' };

export default function DuenoAutorizacionesPage() {
  const { mostrarToast } = useToast();
  const [estado, setEstado] = useState<EstadoAutorizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [idAcudienteSel, setIdAcudienteSel] = useState('');
  const [acepta, setAcepta] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEstado(await autorizacionesService.mias());
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudieron cargar las autorizaciones.', 'error');
    } finally {
      setCargando(false);
    }
  }, [mostrarToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function set<K extends keyof typeof FORM_VACIO>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function guardarAcudiente(e: FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2 || form.apellido.trim().length < 2 || form.telefono.trim().length < 7) {
      mostrarToast('Escribe nombre, apellido y un teléfono válido.', 'error');
      return;
    }
    setGuardando(true);
    try {
      await autorizacionesService.crearAcudiente({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        documento: form.documento.trim() || null,
        telefono: form.telefono.trim(),
        email: form.email.trim() || null,
        parentesco: form.parentesco || null,
      });
      mostrarToast('Acudiente registrado.', 'ok');
      setForm(FORM_VACIO);
      setMostrarForm(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo guardar el acudiente.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function quitarAcudiente(id: number) {
    if (!window.confirm('¿Quitar este acudiente? Si tu consentimiento depende de él, se revocará.')) return;
    try {
      await autorizacionesService.quitarAcudiente(id);
      mostrarToast('Acudiente eliminado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
    }
  }

  async function firmar() {
    if (!idAcudienteSel || !acepta) {
      mostrarToast('Elige un acudiente y marca la casilla de aceptación.', 'error');
      return;
    }
    try {
      await autorizacionesService.firmarConsentimiento(Number(idAcudienteSel));
      mostrarToast('Consentimiento registrado.', 'ok');
      setAcepta(false);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo registrar el consentimiento.', 'error');
    }
  }

  async function revocar() {
    if (!window.confirm('¿Revocar el consentimiento? No podrás agendar citas hasta firmarlo de nuevo.')) return;
    try {
      await autorizacionesService.revocarConsentimiento();
      mostrarToast('Consentimiento revocado.', 'ok');
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'No se pudo revocar.', 'error');
    }
  }

  if (cargando) {
    return (
      <section className="section active">
        <div className="vacio">Cargando...</div>
      </section>
    );
  }
  if (!estado) return null;

  // ---- Mensaje del bloque de estado ----
  let tono: 'ok' | 'pendiente' | 'neutro' = 'neutro';
  let icono = 'ti-info-circle';
  let titulo = 'No es obligatorio para ti';
  let mensaje = 'Esta autorización solo se exige a personas de 60 años o más. Aun así, puedes dejar un acudiente registrado.';

  if (estado.es_adulto_mayor && estado.completa) {
    tono = 'ok';
    icono = 'ti-shield-check';
    titulo = 'Autorizaciones completas';
    mensaje = 'Tu acudiente y tu consentimiento están al día. Ya puedes agendar citas.';
  } else if (estado.es_adulto_mayor) {
    tono = 'pendiente';
    icono = 'ti-alert-circle';
    titulo = 'Faltan autorizaciones';
    mensaje = 'Para agendar citas necesitas completar los pasos que siguen.';
  } else if (!estado.fecha_nacimiento_registrada) {
    mensaje =
      'Solo se exige a personas de 60 años o más. Si es tu caso, agrega tu fecha de nacimiento en "Mi perfil" (abajo a la izquierda).';
  }

  const vigente = estado.consentimiento;
  const acudienteDelConsentimiento = estado.acudientes.find((a) => a.idAcudiente === vigente?.idAcudiente);

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Autorizaciones</div>
          <div className="page-sub">Acudiente y consentimiento para adultos mayores.</div>
        </div>
      </div>

      <div className="aut-columna">
        {/* 1) Estado */}
        <div className="aut-bloque">
          <div className={`aut-estado ${tono}`}>
            <div className="aut-estado-icono">
              <i className={`ti ${icono}`} />
            </div>
            <div>
              <div className="aut-estado-titulo">{titulo}</div>
              <p className="aut-texto">{mensaje}</p>
              {estado.es_adulto_mayor && estado.pendientes.length > 0 && (
                <ul className="aut-pendientes">
                  {estado.pendientes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 2) Acudientes */}
        <div className="aut-bloque">
          <div className="aut-bloque-titulo">
            <span>
              <i className="ti ti-users" />
              Mis acudientes
            </span>
            {!mostrarForm && (
              <button type="button" className="btn-nuevo" onClick={() => setMostrarForm(true)}>
                <i className="ti ti-plus" /> Agregar
              </button>
            )}
          </div>

          {estado.acudientes.length === 0 ? (
            <div className="aut-vacio">Todavía no tienes acudientes registrados.</div>
          ) : (
            <div className="aut-lista">
              {estado.acudientes.map((a) => (
                <div className="aut-item" key={a.idAcudiente}>
                  <div>
                    <div className="aut-item-nombre">
                      {a.nombre} {a.apellido}
                    </div>
                    <div className="aut-item-detalle">
                      {a.parentesco ? `${a.parentesco} · ` : ''}
                      {a.telefono}
                      {a.email ? ` · ${a.email}` : ''}
                    </div>
                  </div>
                  <button type="button" className="aut-btn-texto" onClick={() => quitarAcudiente(a.idAcudiente)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {mostrarForm && (
            <form className="aut-form" onSubmit={guardarAcudiente}>
              <div className="form-row-2">
                <div>
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Apellido *</label>
                  <input className="form-input" value={form.apellido} onChange={(e) => set('apellido', e.target.value)} />
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label className="form-label">Teléfono *</label>
                  <input
                    className="form-input"
                    inputMode="tel"
                    placeholder="Ej: 3001234567"
                    maxLength={20}
                    value={form.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Parentesco</label>
                  <select className="form-input" value={form.parentesco} onChange={(e) => set('parentesco', e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {PARENTESCOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label className="form-label">Documento (opcional)</label>
                  <input
                    className="form-input"
                    maxLength={20}
                    value={form.documento}
                    onChange={(e) => set('documento', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Correo (opcional)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                </div>
              </div>
              <div className="aut-form-botones">
                <button type="submit" className="btn-guardar" disabled={guardando}>
                  <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : 'Guardar acudiente'}
                </button>
                <button
                  type="button"
                  className="aut-btn-secundario"
                  onClick={() => {
                    setMostrarForm(false);
                    setForm(FORM_VACIO);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 3) Consentimiento */}
        <div className="aut-bloque">
          <div className="aut-bloque-titulo">
            <span>
              <i className="ti ti-file-certificate" />
              Consentimiento
            </span>
            {vigente ? (
              <span className="aut-etiqueta ok">Vigente</span>
            ) : (
              <span className="aut-etiqueta pendiente">Sin firmar</span>
            )}
          </div>

          <div className="aut-consentimiento-texto">{estado.texto_consentimiento}</div>

          {vigente ? (
            <>
              <p className="aut-texto">
                Firmado el {new Date(vigente.fechaAceptacion).toLocaleDateString('es-CO')}
                {acudienteDelConsentimiento
                  ? ` con ${acudienteDelConsentimiento.nombre} ${acudienteDelConsentimiento.apellido} como acudiente.`
                  : '.'}
              </p>
              <div className="aut-form-botones" style={{ marginTop: 12 }}>
                <button type="button" className="aut-btn-secundario" onClick={revocar}>
                  Revocar consentimiento
                </button>
              </div>
            </>
          ) : estado.acudientes.length === 0 ? (
            <p className="aut-texto">Primero registra un acudiente para poder firmar.</p>
          ) : (
            <>
              <label className="form-label">Acudiente responsable</label>
              <select className="form-input" value={idAcudienteSel} onChange={(e) => setIdAcudienteSel(e.target.value)}>
                <option value="">Seleccionar...</option>
                {estado.acudientes.map((a) => (
                  <option key={a.idAcudiente} value={a.idAcudiente}>
                    {a.nombre} {a.apellido}
                  </option>
                ))}
              </select>
              <label className="aut-check">
                <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                <span>He leído y acepto el consentimiento.</span>
              </label>
              <button type="button" className="btn-guardar" onClick={firmar}>
                <i className="ti ti-signature" /> Firmar consentimiento
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}