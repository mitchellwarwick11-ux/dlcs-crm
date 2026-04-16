'use client'

export function PrintBar() {
  return (
    <div
      style={{
        background: '#f1f5f9',
        padding: '10px 24px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
      className="no-print"
    >
      <button
        onClick={() => window.print()}
        style={{
          background: '#1e293b', color: 'white', border: 'none',
          padding: '8px 20px', borderRadius: '6px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Print / Save as PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{
          background: 'white', color: '#64748b',
          border: '1px solid #cbd5e1',
          padding: '8px 20px', borderRadius: '6px',
          fontSize: '13px', cursor: 'pointer',
        }}
      >
        Close
      </button>
      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
        To save as PDF: choose &quot;Save as PDF&quot; as the printer destination
      </span>
    </div>
  )
}
