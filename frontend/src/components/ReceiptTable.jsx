import { useState } from 'react'

const STATUS_STYLES = {
  matched: {
    row: '#f0fdf4',
    badge: { background: '#dcfce7', color: '#166534' },
    label: 'Matched',
  },
  ambiguous: {
    row: '#fefce8',
    badge: { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
    label: 'Ambiguous',
  },
  unmatched: {
    row: '#fff1f2',
    badge: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    label: 'Unmatched',
  },
  pending: {
    row: '#f8fafc',
    badge: { background: '#f1f5f9', color: '#475569' },
    label: 'Pending',
  },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 12, fontWeight: 600, ...s.badge,
    }}>
      {s.label}
    </span>
  )
}

function formatCurrency(amount, currency) {
  if (amount == null) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return `${currency || ''} ${Number(amount).toFixed(2)}`
  }
}

function formatDate(date, time) {
  if (!date) return '—'
  const parts = [date]
  if (time) parts.push(time)
  return parts.join(' ')
}

export default function ReceiptTable({ receipts, onDelete, onRefresh, bufferHours, setBufferHours }) {
  const [expandedId, setExpandedId] = useState(null)
  const [rematching, setRematching] = useState(false)
  const [imageModal, setImageModal] = useState(null)

  const handleRematch = async () => {
    setRematching(true)
    await fetch(`/api/rematch?buffer_hours=${bufferHours}`, { method: 'POST' })
    await onRefresh()
    setRematching(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this receipt?')) return
    await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const stats = receipts.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  if (receipts.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
        <p style={{ fontWeight: 600, color: '#64748b' }}>No receipts yet</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>Upload receipt images above to get started</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* Table header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
            Receipts <span style={{ color: '#64748b', fontWeight: 400 }}>({receipts.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {stats.matched > 0 && <Chip color="#166534" bg="#dcfce7">{stats.matched} matched</Chip>}
            {stats.ambiguous > 0 && <Chip color="#854d0e" bg="#fef9c3">{stats.ambiguous} ambiguous</Chip>}
            {stats.unmatched > 0 && <Chip color="#991b1b" bg="#fee2e2">{stats.unmatched} unmatched</Chip>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            Buffer:
            <select
              value={bufferHours}
              onChange={e => setBufferHours(Number(e.target.value))}
              style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 6px', fontSize: 13 }}
            >
              {[0, 1, 2, 4, 6, 12, 24].map(h => (
                <option key={h} value={h}>{h}h</option>
              ))}
            </select>
          </label>
          <Btn onClick={handleRematch} disabled={rematching} secondary>
            {rematching ? 'Matching…' : 'Re-match'}
          </Btn>
          <Btn as="a" href="/api/export/excel" download="receipts.xlsx">
            Export Excel
          </Btn>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 20, fontSize: 12, color: '#64748b' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#bbf7d0', marginRight: 4 }} />Matched to one event</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fef08a', marginRight: 4 }} />Multiple possible events</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fecaca', marginRight: 4 }} />No matching event found</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['', 'Company', 'Date & Time', 'Amount', 'Matched Event', 'Calendar', 'Status', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 16px', textAlign: i === 3 ? 'right' : 'left',
                  fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase',
                  letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receipts.map(receipt => {
              const style = STATUS_STYLES[receipt.status] || STATUS_STYLES.pending
              const isExpanded = expandedId === receipt.id
              const events = receipt.matched_events || []

              return [
                <tr
                  key={receipt.id}
                  style={{ background: style.row, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                >
                  {/* Thumbnail */}
                  <td style={{ padding: '10px 12px 10px 16px', width: 48 }}>
                    <img
                      src={`/api/receipts/${receipt.id}/image`}
                      alt=""
                      style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                      onClick={(e) => { e.stopPropagation(); setImageModal(receipt) }}
                    />
                  </td>

                  {/* Company */}
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: '#1e293b' }}>
                    {receipt.company || <span style={{ color: '#94a3b8' }}>Unknown</span>}
                  </td>

                  {/* Date & Time */}
                  <td style={{ padding: '10px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                    {formatDate(receipt.date, receipt.time)}
                  </td>

                  {/* Amount */}
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                    {formatCurrency(receipt.amount, receipt.currency)}
                  </td>

                  {/* Matched Event */}
                  <td style={{ padding: '10px 16px', color: '#475569', maxWidth: 200 }}>
                    {events.length === 0
                      ? <span style={{ color: '#94a3b8' }}>—</span>
                      : events.length === 1
                        ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>{events[0].summary}</span>
                        : <span style={{ color: '#b45309' }}>{events.length} possible events</span>
                    }
                  </td>

                  {/* Calendar */}
                  <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 13 }}>
                    {events.length > 0
                      ? [...new Set(events.map(e => e.calendar_name))].join(', ')
                      : <span style={{ color: '#94a3b8' }}>—</span>
                    }
                  </td>

                  {/* Status */}
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={receipt.status} />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '10px 16px 10px 8px', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(receipt.id) }}
                      style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                      title="Delete"
                    >×</button>
                  </td>
                </tr>,

                // Expanded detail row
                isExpanded && (
                  <tr key={`${receipt.id}-detail`} style={{ background: style.row }}>
                    <td colSpan={8} style={{ padding: '0 16px 16px 68px', borderBottom: '1px solid #e2e8f0' }}>
                      {receipt.raw_text && (
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: events.length ? 10 : 0 }}>
                          <strong>Notes:</strong> {receipt.raw_text}
                        </p>
                      )}
                      {events.length > 1 && (
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                            Possible matching events:
                          </p>
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {events.map(ev => (
                              <li key={ev.id} style={{ fontSize: 13, color: '#475569', paddingLeft: 12, borderLeft: '3px solid #fde047' }}>
                                <strong>{ev.summary}</strong>
                                {ev.start_dt && <span style={{ color: '#94a3b8', marginLeft: 8 }}>{ev.start_dt.slice(0, 16).replace('T', ' ')}</span>}
                                {ev.location && <span style={{ color: '#94a3b8', marginLeft: 8 }}>📍 {ev.location}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {events.length === 1 && (
                        <p style={{ fontSize: 13, color: '#475569' }}>
                          <strong>Event:</strong> {events[0].summary}
                          {events[0].start_dt && <span style={{ color: '#94a3b8', marginLeft: 8 }}>{events[0].start_dt.slice(0, 16).replace('T', ' ')} – {events[0].end_dt?.slice(0, 16).replace('T', ' ')}</span>}
                          {events[0].location && <span style={{ color: '#94a3b8', marginLeft: 8 }}>📍 {events[0].location}</span>}
                        </p>
                      )}
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Image modal */}
      {imageModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => setImageModal(null)}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>{imageModal.company || imageModal.filename}</strong>
              <button onClick={() => setImageModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#64748b', lineHeight: 1 }}>×</button>
            </div>
            <img
              src={`/api/receipts/${imageModal.id}/image`}
              alt="Receipt"
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ children, bg, color }) {
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  )
}

function Btn({ children, onClick, disabled, secondary, as: Tag = 'button', ...props }) {
  const base = {
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: 'none', textDecoration: 'none', display: 'inline-block',
    opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto',
    transition: 'background 0.15s',
  }
  const styles = secondary
    ? { ...base, background: '#f1f5f9', color: '#475569' }
    : { ...base, background: '#2563eb', color: '#fff' }
  return <Tag style={styles} onClick={onClick} disabled={disabled} {...props}>{children}</Tag>
}
