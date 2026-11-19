import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { imageFor } from '../../features/avatar/characterAssets';
import { mouthRegions } from '../../features/avatar/characterMotion';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  label?: string;
  mouthFrame?: ImageSourcePropType;
}

const mouthTransitionMs = 60;

function MouthLayers({ frame, width, height, maskId }: {
  frame?: ImageSourcePropType;
  width: number;
  height: number;
  maskId: string;
}) {
  const current = useRef(frame);
  const [layers, setLayers] = useState<{
    previous?: ImageSourcePropType;
    next?: ImageSourcePropType;
    progress: number;
  }>({ next: frame, progress: 1 });

  useLayoutEffect(() => {
    const previous = current.current;
    if (previous === frame) return;
    current.current = frame;
    const start = performance.now();
    setLayers({ previous, next: frame, progress: 0 });

    // Both SVG renderers receive numeric opacity values on each animation frame.
    function blend() {
      const progress = Math.min(1, (performance.now() - start) / mouthTransitionMs);
      if (progress === 1) {
        setLayers({ next: frame, progress });
        return;
      }
      setLayers({ previous, next: frame, progress });
      request = requestAnimationFrame(blend);
    }

    let request = requestAnimationFrame(blend);
    return () => cancelAnimationFrame(request);
  }, [frame]);

  return (
    <G mask={`url(#${maskId})`}>
      {layers.previous !== undefined && (
        <Image href={layers.previous} width={width} height={height} opacity={1 - layers.progress} />
      )}
      {layers.next !== undefined && (
        <Image href={layers.next} width={width} height={height} opacity={layers.progress} />
      )}
    </G>
  );
}

export function CharacterImage({ characterId, label, mouthFrame }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const fadeId = `${clipId}-fade`;
  const mouthMaskId = `${clipId}-mouth`;
  const outline = outlines[`${characterId}_idle`];
  const mouthRegion = mouthRegions[characterId];

  return (
    <Svg
      accessibilityLabel={label}
      width="100%"
      height="100%"
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Defs>
        <ClipPath id={clipId}>
          <Path d={outline.path} clipRule="evenodd" />
        </ClipPath>
        <RadialGradient id={fadeId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="white" stopOpacity={1} />
          <Stop offset="0.78" stopColor="white" stopOpacity={1} />
          <Stop offset="1" stopColor="white" stopOpacity={0} />
        </RadialGradient>
        <Mask id={mouthMaskId} {...mouthRegion} maskUnits="userSpaceOnUse" maskType="alpha">
          <Rect {...mouthRegion} fill={`url(#${fadeId})`} />
        </Mask>
      </Defs>
      <Image
        href={imageFor(characterId, 'idle')}
        width={outline.width}
        height={outline.height}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />
      <MouthLayers frame={mouthFrame} width={outline.width} height={outline.height} maskId={mouthMaskId} />
    </Svg>
  );
}
