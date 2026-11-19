import { useId } from 'react';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { imageFor } from '../../features/avatar/characterAssets';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  label?: string;
}

export function CharacterImage({ characterId, label }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const outline = outlines[`${characterId}_idle`];

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
      </Defs>
      <Image
        href={imageFor(characterId, 'idle')}
        width={outline.width}
        height={outline.height}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />
    </Svg>
  );
}
