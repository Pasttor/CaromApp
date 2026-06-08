import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { VideoState } from '../types'
import { mediaUrl } from '../lib/api'
import { formatDuration } from '../lib/format'

interface SeekCommand {
  id: number
  seconds: number
}

interface VideoStageProps {
  video: VideoState
  isPlaying: boolean
  playbackRate: number
  zoom: number
  seekCommand: SeekCommand | null
  onPanReset: () => void
}

export function VideoStage({
  video,
  isPlaying,
  playbackRate,
  zoom,
  seekCommand,
  onPanReset,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const source = mediaUrl(video.url ?? video.live_url)
  const isReplay = video.mode === 'replay'

  useEffect(() => {
    const element = videoRef.current
    if (!element || !source) return

    let hls: Hls | null = null
    if (source.endsWith('.m3u8') && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: video.mode === 'live' })
      hls.loadSource(source)
      hls.attachMedia(element)
    } else {
      element.src = source
    }

    return () => {
      hls?.destroy()
    }
  }, [source, video.mode])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    if (isPlaying) {
      void element.play().catch(() => undefined)
    } else {
      element.pause()
    }
  }, [isPlaying, source])

  useEffect(() => {
    if (!seekCommand || !videoRef.current) return
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + seekCommand.seconds)
  }, [seekCommand])

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 })
  }, [zoom])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    setPan({
      x: dragStart.current.panX + event.clientX - dragStart.current.x,
      y: dragStart.current.panY + event.clientY - dragStart.current.y,
    })
  }

  function handlePointerUp() {
    dragStart.current = null
  }

  function resetPan() {
    setPan({ x: 0, y: 0 })
    onPanReset()
  }

  return (
    <section className="video-stage">
      <div className="video-topline">
        <span className={`video-dot ${video.status}`} />
        <strong>{isReplay ? 'REPLAY' : 'LIVE'}</strong>
        <span>{formatDuration(video.available_seconds)} disponibles</span>
      </div>

      <div
        className={`video-frame ${source ? '' : 'no-source'} ${zoom > 1 ? 'is-zoomed' : ''}`}
        onDoubleClick={resetPan}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {source ? (
          <video
            ref={videoRef}
            muted
            playsInline
            controls={false}
            className="match-video"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          />
        ) : (
          <div
            className="video-placeholder"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div className="table-lines" />
          </div>
        )}
        <div className="video-message">
          <span>{video.message}</span>
        </div>
      </div>
    </section>
  )
}

