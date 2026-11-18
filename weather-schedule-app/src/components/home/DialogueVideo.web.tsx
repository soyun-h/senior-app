import { useEffect, useRef } from 'react';
import { Asset } from 'expo-asset';
import type { DialogueVideoProps } from './DialogueVideo';

export function DialogueVideo({ source, label, onPlaybackState }: DialogueVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const uri = Asset.fromModule(source).uri;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    const play = () => {
      void video.play().catch(error => {
        if (active && error.name !== 'NotAllowedError' && error.name !== 'AbortError') onPlaybackState('failed');
      });
    };
    const retryAfterInteraction = (event: Event) => {
      if (event.isTrusted && video.paused && video.currentTime === 0) play();
    };

    document.addEventListener('pointerup', retryAfterInteraction, true);
    document.addEventListener('keydown', retryAfterInteraction, true);
    play();
    return () => {
      active = false;
      document.removeEventListener('pointerup', retryAfterInteraction, true);
      document.removeEventListener('keydown', retryAfterInteraction, true);
      video.pause();
    };
  }, [uri, onPlaybackState]);

  return (
    <video
      ref={videoRef}
      src={uri}
      aria-label={label}
      playsInline
      onPlaying={() => onPlaybackState('playing')}
      onEnded={() => onPlaybackState('ended')}
      onError={() => onPlaybackState('failed')}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }}
    />
  );
}
