import { useEffect } from 'react';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface DialogueVideoProps {
  source: number;
  label: string;
  onPlaybackState: (state: 'playing' | 'ended' | 'failed') => void;
}

export function DialogueVideo({ source, label, onPlaybackState }: DialogueVideoProps) {
  const player = useVideoPlayer(source);
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) onPlaybackState('playing');
  });
  useEventListener(player, 'playToEnd', () => onPlaybackState('ended'));
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onPlaybackState('failed');
  });

  useEffect(() => {
    if (player.status === 'error') {
      onPlaybackState('failed');
      return;
    }
    player.play();
    return () => player.pause();
  }, [player, onPlaybackState]);

  return (
    <VideoView
      player={player}
      accessibilityLabel={label}
      nativeControls={false}
      contentFit="contain"
      surfaceType="textureView"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
