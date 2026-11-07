import type { ImgHTMLAttributes } from 'react'
import { usePrivateMedia } from '../hooks/usePrivateMedia'
import { profileAvatarAppearance } from '../utils/profileAppearance'

export function PrivateImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const gradient = profileAvatarAppearance(src, props.alt)
  const resolved = usePrivateMedia(gradient ? undefined : src)
  if (gradient) {
    return <span role="img" aria-label={props.alt} title={props.title} className={props.className} style={{ ...props.style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradient.background }}>{gradient.initial}</span>
  }
  return <img {...props} src={resolved} />
}
