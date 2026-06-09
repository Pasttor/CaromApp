import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Save, X } from 'lucide-react'
import { api } from '../lib/api'
import type { SettingsState, VideoDevice } from '../types'

interface SettingsModalProps {
  open: boolean
  settings: SettingsState
  onClose: () => void
  onSave: (settings: SettingsState) => void
}

export function SettingsModal({ open, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)
  const [devices, setDevices] = useState<VideoDevice[]>([])
  const [deviceMessage, setDeviceMessage] = useState('')
  const [loadingDevices, setLoadingDevices] = useState(false)
  const wasOpen = useRef(false)

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const response = await api.videoDevices()
      setDevices(response.devices)
      setDeviceMessage(response.message)
      if (response.devices.length > 0) {
        setDraft((current) => {
          const currentDeviceExists = response.devices.some(
            (device) => device.id === current.camera_device,
          )
          if (current.camera_device !== 'default' && currentDeviceExists) return current
          return { ...current, camera_device: response.devices[0].id }
        })
      }
    } catch {
      setDeviceMessage('No se pudieron consultar las camaras.')
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(settings)
    }
    wasOpen.current = open
  }, [open, settings])

  useEffect(() => {
    if (open) void loadDevices()
  }, [loadDevices, open])

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

        {draft.camera_source_type === 'usb' ? (
          <div className="device-field">
            <label>
              Camara
              <select
                value={draft.camera_device}
                onChange={(event) => update('camera_device', event.currentTarget.value)}
              >
                {devices.length === 0 && (
                  <option value={draft.camera_device}>
                    {loadingDevices ? 'Buscando camaras...' : draft.camera_device || 'Sin camaras'}
                  </option>
                )}
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="Actualizar camaras"
              title="Actualizar camaras"
              onClick={() => void loadDevices()}
              disabled={loadingDevices}
            >
              <RefreshCw aria-hidden="true" size={19} />
            </button>
            <span>{deviceMessage}</span>
          </div>
        ) : draft.camera_source_type === 'rtsp' ? (
          <label>
            URL RTSP
            <input
              value={draft.camera_device}
              onChange={(event) => update('camera_device', event.currentTarget.value)}
            />
          </label>
        ) : null}

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
            Buffer (minutos)
            <input
              type="number"
              min="1"
              value={draft.buffer_minutes}
              onChange={(event) => update('buffer_minutes', event.currentTarget.value)}
            />
          </label>
          <label>
            Segmento (segundos)
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
