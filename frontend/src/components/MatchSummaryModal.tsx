import { X } from 'lucide-react'
import type { MatchState } from '../types'
import { formatClock, formatDuration, formatMoney } from '../lib/format'

interface MatchSummaryModalProps {
  summary: MatchState | null
  onClose: () => void
}

export function MatchSummaryModal({ summary, onClose }: MatchSummaryModalProps) {
  if (!summary) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Resumen de partida">
      <div className="modal-panel summary-panel">
        <div className="modal-heading">
          <h2>Resumen</h2>
          <button type="button" aria-label="Cerrar resumen" onClick={onClose} title="Cerrar">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="summary-grid">
          <span>{summary.player_1_name}</span>
          <strong>{summary.player_1_score}</strong>
          <span>{summary.player_2_name}</span>
          <strong>{summary.player_2_score}</strong>
          <span>Duracion</span>
          <strong>{formatDuration(summary.duration_seconds)}</strong>
          <span>Costo</span>
          <strong>{formatMoney(summary.total_cost)}</strong>
          <span>Inicio</span>
          <strong>{formatClock(summary.started_at)}</strong>
          <span>Final</span>
          <strong>{formatClock(summary.ended_at)}</strong>
        </div>
      </div>
    </div>
  )
}
