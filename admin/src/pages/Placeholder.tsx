export function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04060B' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div
          style={{
            width: 46,
            height: 46,
            margin: '0 auto 18px',
            border: '1px solid #1E2A3D',
            borderRadius: 2,
            background: '#0B1220',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 16, height: 16, border: '2px solid #2A3A52', borderRadius: '50%' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#E8EDF4', marginBottom: 8 }}>{title}</div>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#5A6B84' }}>
          SCREEN NOT YET WIRED · COMING SOON
        </div>
      </div>
    </div>
  )
}
