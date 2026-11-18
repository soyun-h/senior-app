import { useId } from 'react';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { imageFor, resolvePose } from '../../features/avatar/characterAssets';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId, Pose } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  pose: Pose;
  label?: string;
}

const characterOutlines: Partial<Record<`${CharacterId}_${Pose}`, { width: number; height: number; path: string }>> = outlines;

export function CharacterImage({ characterId, pose, label }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const displayPose = resolvePose(characterId, pose);
  const outline = characterOutlines[`${characterId}_${displayPose}`];
  if (!outline) return null;

  const sidePadding = Math.ceil(outline.width * 0.03);
  return (
    <Svg
      accessibilityLabel={label}
      width="100%"
      height="100%"
      viewBox={`${-sidePadding} 0 ${outline.width + 2 * sidePadding} ${outline.height}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <Defs>
        <ClipPath id={clipId}>
          <Path d={outline.path} clipRule="evenodd" />
        </ClipPath>
      </Defs>
      <Image
        href={imageFor(characterId, displayPose)}
        width={outline.width}
        height={outline.height}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />
    </Svg>
  );
}
