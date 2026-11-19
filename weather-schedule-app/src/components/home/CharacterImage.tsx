import { useId } from 'react';
import type { ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, Image, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { imageFor } from '../../features/avatar/characterAssets';
import { mouthRegions } from '../../features/avatar/characterMotion';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  label?: string;
  mouthFrame?: ImageSourcePropType;
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
      {mouthFrame !== undefined && (
        <Image href={mouthFrame} width={outline.width} height={outline.height} mask={`url(#${mouthMaskId})`} />
      )}
    </Svg>
  );
}
