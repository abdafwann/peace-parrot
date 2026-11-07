import type { AnchorHTMLAttributes, AudioHTMLAttributes, VideoHTMLAttributes } from 'react'
import { usePrivateMedia } from '../hooks/usePrivateMedia'

export function PrivateAudio({ src, ...props }: AudioHTMLAttributes<HTMLAudioElement>) {
  const resolved = usePrivateMedia(src)
  return <audio {...props} src={resolved} />
}

export function PrivateVideo({ src, ...props }: VideoHTMLAttributes<HTMLVideoElement>) {
  const resolved = usePrivateMedia(src)
  return <video {...props} src={resolved} />
}

export function PrivateLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const resolved = usePrivateMedia(href)
  return <a {...props} href={resolved} />
}
