import { useEffect, useState } from 'react'
import { Save, X } from 'lucide-react'
import type { SettingsState } from '../types'

interface SettingsModalProps {
  open: boolean
  settings: SettingsState
  onClose: () => void
  onSave: (settings: SettingsState) => void
}

export function SettingsModal({ open, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  if (!open) return null

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Configuracion">
      <form
        className="modal-panel settings-panel"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(draft)
        }}
      >
        <div className="modal-heading">
          <h2>Ajustes</h2>
          <button type="button" aria-label="Cerrar ajustes" onClick={onClose} title="Cerrar">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <label>
          Tarifa por hora
          <input
            type="number"
            min="0"
            step="1"
            value={draft.hourly_rate_mxn}
            onChange={(event) => update('hourly_rate_mxn', event.currentTarget.value)}
          />
        </label>

        <label>
          Fuente
          <select
            value={draft.camera_source_type}
            onChange={(event) =>
              update('camera_source_type', event.currentTarget.value as SettingsState['camera_source_type'])
            }
          >
            <option value="usb">USB</option>
            <option value="rtsp">RTSP</option>
            <option value="demo">Demo</option>
          </select>
        </label>

        <label>
          Dispositivo o URL
          <input
            value={draft.camera_device}
            onChange={(event) => update('camera_device', event.currentTarget.value)}
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.demo_mode_enabled === 'true'}
            onChange={(event) =>
              update('demo_mode_enabled', event.currentTarget.checked ? 'true' : 'false')
            }
          />
          Usar demo si la camara no esta configurada
        </label>

        <div className="settings-grid">
          <label>
            Buffer min
            <input
              type="number"
              min="1"
              value={draft.buffer_minutes}
              onChange={(event) => update('buffer_minutes', event.currentTarget.value)}
            />
          </label>
          <label>
            Segmento seg
            <input
              type="number"
              min="1"
              value={draft.segment_seconds}
              onChange={(event) => update('segment_seconds', event.currentTarget.value)}
            />
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.allow_negative_scores === 'true'}
            onChange={(event) =>
              update('allow_negative_scores', event.currentTarget.checked ? 'true' : 'false')
            }
          />
          Permitir puntajes negativos
        </label>

        <button type="submit" className="primary-action">
          <Save aria-hidden="true" size={18} />
          Guardar
        </button>
      </form>
    </div>
  )
}
