// =================================================================
// Archivo: src/pages/DuenoAgregarMascotaPage/DuenoAgregarMascotaPage.tsx
// RESPONSABILIDAD: Formulario para registrar una nueva mascota.
// Migrado de dueno-agregar-mascota.html + agregarMascota() de dueno.js.
// =================================================================
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { mascotasService } from '../../services/mascotasService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast/ToastContext';
import { ESPECIES, SEXOS } from '../../constants/mascotas';
import '../../assets/css/dueno.css';

export default function DuenoAgregarMascotaPage() {
  const [nombre, setNombre] = useState('');
  const [especie, setEspecie] = useState('');
  const [raza, setRaza] = useState('');
  const [sexo, setSexo] = useState('');
  const [peso, setPeso] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { usuario } = useAuth();
  const { mostrarToast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!nombre.trim() || !especie || !sexo || !peso) {
      mostrarToast('Completa los campos obligatorios.', 'error');
      return;
    }
    const pesoNum = Number(peso.replace(',', '.'));
    if (!Number.isFinite(pesoNum) || pesoNum <= 0 || pesoNum > 999) {
      mostrarToast('Ingresa un peso válido en kilogramos (mayor a 0).', 'error');
      return;
    }

    setGuardando(true);
    try {
      await mascotasService.crear({
        nombre_mascota: nombre.trim(),
        especie,
        raza: raza.trim() || null,
        sexo,
        peso_kg: pesoNum,
        fechaNacimiento: fechaNac || null,
        idUsuario: usuario!.idUsuario,
      });
      mostrarToast('Mascota registrada correctamente.', 'ok');
      setTimeout(() => navigate('/dueno/mascotas'), 1200);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al guardar.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="section active">
      <div className="section-header">
        <div>
          <div className="page-title">Agregar mascota</div>
          <div className="page-sub">Registra una nueva mascota. Los campos marcados con * son obligatorios.</div>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-row-2">
          <div>
            <label className="form-label">Nombre de la mascota *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Luna, Max, Pelusa..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Especie *</label>
            <select className="form-input" value={especie} onChange={(e) => setEspecie(e.target.value)}>
              <option value="">Seleccionar...</option>
              {ESPECIES.map((esp) => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label className="form-label">Sexo *</label>
            <select className="form-input" value={sexo} onChange={(e) => setSexo(e.target.value)}>
              <option value="">Seleccionar...</option>
              {SEXOS.map((x) => (
                <option key={x.valor} value={x.valor}>{x.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Peso (kg) *</label>
            <input
              type="number"
              inputMode="decimal"
              className="form-input"
              placeholder="Ej: 4.5"
              min="0.01"
              max="999"
              step="0.01"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row-2">
          <div>
            <label className="form-label">Raza (opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Labrador, Persa..."
              value={raza}
              onChange={(e) => setRaza(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Fecha de nacimiento (opcional)</label>
            <input
              type="date"
              className="form-input"
              value={fechaNac}
              onChange={(e) => setFechaNac(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn-guardar" disabled={guardando}>
          <i className="ti ti-device-floppy" style={{ fontSize: 16 }} />{' '}
          {guardando ? 'Guardando...' : 'Guardar mascota'}
        </button>

        <p className="form-nota">
          Una vez registrada, la mascota quedará vinculada a tu cuenta.
          <br />
          Podrás agendar citas y ver su historial clínico desde el panel.
        </p>
      </form>
    </section>
  );
}
