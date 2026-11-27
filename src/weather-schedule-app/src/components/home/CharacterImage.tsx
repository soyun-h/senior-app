import { useId } from 'react';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { imageFor, resolvePose } from '../../features/avatar/characterAssets';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId, Pose } from '../../features/avatar/characterTypes';

interface Outline { width: number; height: number; path: string }
const characterOutlines: Record<string, Outline | undefined> = outlines;

interface CharacterImageProps {
  characterId: CharacterId;
  pose?: Pose;
  label?: string;
}

/** 캐릭터 자세 이미지를 윤곽선대로 잘라 배경 없이 그린다. */
export function CharacterImage({ characterId, pose = 'idle', label }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const resolved = resolvePose(characterId, pose);
  const outline = characterOutlines[`${characterId}_${resolved}`] ?? characterOutlines[`${characterId}_idle`]!;

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
        href={imageFor(characterId, resolved)}
        width={outline.width}
        height={outline.height}
        preserveAspectRatio="xMidYMid meet"
        clipPath={`url(#${clipId})`}
      />
    </Svg>
  );
}
