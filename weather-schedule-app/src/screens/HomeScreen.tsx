import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AvatarPlaceholder } from '../components/AvatarPlaceholder';
import { theme } from '../theme/tokens';

export function HomeScreen() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>날씨와 일정</Text>
          <Text style={styles.body}>오늘도 편안한 하루 보내세요.</Text>
          <AvatarPlaceholder />
          <Text style={styles.body}>날씨와 일정 알림 기능을 준비하고 있어요.</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.page, gap: theme.spacing.gap },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text, lineHeight: 44 },
  body: { fontSize: 22, lineHeight: 34, color: theme.colors.secondary },
});
