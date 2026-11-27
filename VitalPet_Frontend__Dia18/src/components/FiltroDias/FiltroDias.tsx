interface Props {
  dias: string;                    // '' = Ver todo
  onChange: (dias: string) => void;
}

const OPCIONES: [string, string][] = [
  ['7', '7 días'], ['15', '15 días'], ['30', '30 días'], ['90', '90 días'], ['', 'Ver todo'],
];

export default function FiltroDias({ dias, onChange }: Props) {
  return (
    <div role="group" aria-label="Filtrar por días" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 12px' }}>
      {OPCIONES.map(([valor, etiqueta]) => (
        <button
          key={valor || 'todo'}
          type="button"
          aria-pressed={dias === valor}
          onClick={() => onChange(valor)}
          style={{
            padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 14,
            border: '1px solid var(--color-primario-fuerte, #1b6b7d)',
            background: dias === valor ? 'var(--color-primario-fuerte, #1b6b7d)' : 'transparent',
            color: dias === valor ? '#fff' : 'var(--color-primario-fuerte, #1b6b7d)',
          }}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}