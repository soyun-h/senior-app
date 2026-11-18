import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Image, Path } from 'react-native-svg';
import { imageFor, resolvePose } from '../../features/avatar/characterAssets';
import outlines from '../../features/avatar/characterOutlines.json';
import type { CharacterId, Pose } from '../../features/avatar/characterTypes';

interface CharacterImageProps {
  characterId: CharacterId;
  pose: Pose;
  label?: string;
  style: StyleProp<ViewStyle>;
}

const characterOutlines: Partial<Record<`${CharacterId}_${Pose}`, { width: number; height: number; path: string }>> = outlines;

export function CharacterImage({ characterId, pose, label, style }: CharacterImageProps) {
  const clipId = `character-${useId()}`;
  const displayPose = resolvePose(characterId, pose);
  const outline = characterOutlines[`${characterId}_${displayPose}`];
  if (!outline) return null;

  return (
    <Svg accessibilityLabel={label} style={style} viewBox={`0 0 ${outline.width} ${outline.height}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={outline.path} clipRule="evenodd" />
        </ClipPath>
      </Defs>
      <Image
        href={imageFor(characterId, displayPose)}
        width={outline.width}
        height={outline.height}
        clipPath={`url(#${clipId})`}
      />
    </Svg>
  );
}
