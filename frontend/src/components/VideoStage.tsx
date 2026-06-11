import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaLoadingIndicator,
  MediaMuteButton,
  MediaPipButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from 'media-chrome/react'
import type { VideoState } from '../types'
import { mediaUrl } from '../lib/api'

interface VideoStageProps {
  video: VideoState
}

export function VideoStage({ video }: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const source = mediaUrl(video.url ?? video.live_url)

  useEffect(() => {
    const element = videoRef.current
    if (!element || !source) return

    let hls: Hls | null = null
    if (source.endsWith('.m3u8') && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: video.mode === 'live' })
      hls.loadSource(source)
      hls.attachMedia(element)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void element.play().catch(() => undefined)
      })
    } else {
      element.src = source
      void element.play().catch(() => undefined)
    }

    return () => {
      hls?.destroy()
    }
  }, [source, video.mode])

  return (
    <section className="video-stage">
      <MediaController className="var-media-controller" autohide="2">
        <video
          ref={videoRef}
          slot="media"
          muted
          playsInline
          autoPlay
          preload="auto"
          className="match-video"
        />

        {!source && (
          <div slot="poster" className="video-placeholder">
            <div className="table-lines" />
          </div>
        )}

        <MediaLoadingIndicator slot="centered-chrome" noAutohide />

        <MediaControlBar className="integrated-control-bar">
          <MediaPlayButton />
          <MediaSeekBackwardButton seekOffset={5} />
          <MediaSeekForwardButton seekOffset={5} />
          <MediaMuteButton />
          <MediaVolumeRange />
          <MediaTimeRange />
          <MediaTimeDisplay showDuration />
          <MediaPlaybackRateButton rates={[0.25, 0.5, 1]} />
          <MediaPipButton />
          <MediaFullscreenButton />
        </MediaControlBar>
      </MediaController>
    </section>
  )
}
