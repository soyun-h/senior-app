import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { hasImage, imageFor } from '../../features/avatar/characterAssets';
import type { CharacterConfig, CharacterDef, Pose } from '../../features/avatar/characterTypes';
import config from '../../features/avatar/characters.json';
import { defaultAvatar, defaultAvatarImage } from './AvatarView';
import { HomeText } from './HomeText';

const { characters } = config as CharacterConfig;
const poses: { id: Pose; label: string }[] = [
  { id: 'idle', label: '기본 모습' },
  { id: 'mouth_a', label: '입 모양 ㅏ' },
  { id: 'mouth_o', label: '입 모양 ㅗ' },
  { id: 'mouth_i', label: '입 모양 ㅣ' },
  { id: 'encourage', label: '격려' },
  { id: 'wave', label: '인사' },
  { id: 'ok', label: '좋아요' },
];

interface CharacterPickerProps {
  selected: CharacterDef | null;
  onApply: (character: CharacterDef | null) => void;
  onClose: () => void;
}

export function CharacterPicker({ selected, onApply, onClose }: CharacterPickerProps) {
  const [character, setCharacter] = useState(selected);
  const [pose, setPose] = useState<Pose>('idle');

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.panel}>
          <View style={styles.header}>
            <HomeText accessibilityRole="header" style={styles.title}>캐릭터 선택</HomeText>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
              <HomeText>닫기</HomeText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.characters}>
              {[null, ...characters].map(option => {
                const active = option?.id === character?.id;
                return (
                  <Pressable
                    key={option?.id ?? defaultAvatar.id}
                    accessibilityRole="button"
                    accessibilityLabel={option?.name ?? defaultAvatar.name}
                    accessibilityState={{ selected: active }}
                    onPress={() => { setCharacter(option); setPose('idle'); }}
                    style={[styles.character, active && styles.active]}
                  >
                    <Image source={option ? imageFor(option.id, 'profile') : defaultAvatarImage} style={styles.thumbnail} />
                    <HomeText style={styles.characterName}>{option?.name ?? '기본'}</HomeText>
                  </Pressable>
                );
              })}
            </View>
            <Image
              accessibilityLabel={character ? `${character.name} ${poses.find(option => option.id === pose)?.label}` : defaultAvatar.name}
              source={character ? imageFor(character.id, pose) : defaultAvatarImage}
              resizeMode="contain"
              style={styles.preview}
            />
            {character && (
              <View style={styles.poses}>
                {poses.filter(option => hasImage(character.id, option.id)).map(option => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: pose === option.id }}
                    onPress={() => setPose(option.id)}
                    style={[styles.pose, pose === option.id && styles.active]}
                  >
                    <HomeText>{option.label}</HomeText>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => onApply(character)} style={styles.apply}>
            <HomeText style={styles.applyText}>홈에 적용</HomeText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 14, backgroundColor: 'rgba(17,38,32,0.55)' },
  panel: { width: '100%', maxWidth: 420, maxHeight: '100%', padding: 16, borderRadius: 24, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  content: { gap: 12 },
  characters: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  character: { minWidth: 46, padding: 3, gap: 3, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#d9e4dc' },
  thumbnail: { width: 38, height: 38, borderRadius: 6, backgroundColor: '#eaf2ed' },
  characterName: { fontSize: 13, fontWeight: '600' },
  active: { backgroundColor: '#def2e4', borderColor: '#32805a' },
  preview: { width: '100%', height: 210, borderRadius: 14, backgroundColor: '#edf4ef' },
  poses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pose: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#d9e4dc' },
  apply: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 14, backgroundColor: '#246445' },
  applyText: { color: '#fff', fontWeight: '700' },
});
