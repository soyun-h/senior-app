import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/tokens';

export function AvatarPlaceholder() {
  return (
    <View style={styles.container} accessible accessibilityLabel="아바타 준비 공간">
      <Text style={styles.text}>아바타가 함께할 공간이에요</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 24, borderRadius: 20, backgroundColor: theme.colors.surface },
  text: { fontSize: 22, color: theme.colors.text, lineHeight: 34 },
});
