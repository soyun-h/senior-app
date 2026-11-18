import { Image, StyleSheet } from 'react-native';
import type { AvatarDefinition } from '../../features/avatar/types';
export const defaultAvatar: AvatarDefinition = { id: 'default', name: '기본 아바타' };
export function AvatarView({ avatar = defaultAvatar }: { avatar?: AvatarDefinition }) {
  return <Image source={avatar.imageUri ? { uri: avatar.imageUri } : require('../../../assets/design/avatar/DefaultAvatar.png')} accessibilityLabel={avatar.name} resizeMode="contain" style={styles.image}/>;
}
const styles = StyleSheet.create({ image: { position: 'absolute', width: 300, height: 400, bottom: 66, alignSelf: 'center' } });
