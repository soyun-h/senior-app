import { useId } from 'react';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { imageFor, resolvePose } from '../../features/avatar/characterAssets';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId, Pose } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  pose: Pose;
  label?: string;
  mouthFrame?: number;
}

const characterOutlines: Partial<Record<`${CharacterId}_${Pose}`, { width: number; height: number; path: string }>> = outlines;

export function CharacterImage({ characterId, pose, label, mouthFrame }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const displayPose = mouthFrame === undefined ? resolvePose(characterId, pose) : 'idle';
  const outline = characterOutlines[`${characterId}_${displayPose}`];
  if (!outline) return null;

  return (
    <Svg
      accessibilityLabel={label}
      width="100%"
      height="100%"
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {mouthFrame === undefined && (
        <Defs>
          <ClipPath id={clipId}>
            <Path d={outline.path} clipRule="evenodd" />
          </ClipPath>
        </Defs>
      )}
      <Image
        href={mouthFrame ?? imageFor(characterId, displayPose)}
        width={outline.width}
        height={outline.height}
        preserveAspectRatio="xMidYMid meet"
        clipPath={mouthFrame === undefined ? `url(#${clipId})` : undefined}
      />
    </Svg>
  );
}
