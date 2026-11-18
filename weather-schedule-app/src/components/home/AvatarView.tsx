import { Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import type { AvatarDefinition } from '../../features/avatar/types';
export const defaultAvatar: AvatarDefinition = { id: 'default', name: '기본 아바타' };
export const defaultAvatarImage: ImageSourcePropType = require('../../../assets/design/avatar/DefaultAvatar.png');

export function AvatarView({ avatar = defaultAvatar, source }: { avatar?: AvatarDefinition; source?: ImageSourcePropType }) {
  return <Image source={source ?? (avatar.imageUri ? { uri: avatar.imageUri } : defaultAvatarImage)} accessibilityLabel={avatar.name} resizeMode="contain" style={styles.image}/>;
}
const styles = StyleSheet.create({ image: { position: 'absolute', width: 300, height: 400, bottom: 66, alignSelf: 'center' } });
