import { ScheduleText as Text } from './ScheduleText';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScheduleAsset } from './ScheduleAsset';
import { type Schedule } from '../../features/schedules/model';

export function ScheduleDeleteDialog({ schedule, busy, error, onCancel, onDelete }: {
  schedule: Schedule | null; busy: boolean; error?: string; onCancel: () => void; onDelete: () => void;
}) {
  return <Modal visible={!!schedule} transparent animationType="none" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={styles.backdrop}>
      <View testID="schedule-delete-dialog" accessibilityViewIsModal style={styles.popup}>
        <View style={styles.icon}><ScheduleAsset name="trash"/></View>
        <Text style={styles.name}>{schedule?.title} {(schedule?.hour ?? 0) % 12 || 12}:{String(schedule?.minute ?? 0).padStart(2, '0')}</Text>
        <Text style={styles.prompt}>일정을 삭제할까요?</Text>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" accessibilityLabel="취소" disabled={busy} onPress={onCancel} style={styles.button}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}><ScheduleAsset name="cancel-button" width="100%" height="100%"/></View><Text style={styles.cancelText}>취소</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="삭제" disabled={busy} onPress={onDelete} style={styles.button}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}><ScheduleAsset name="delete-button" width="100%" height="100%"/></View><Text style={styles.deleteText}>삭제</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  popup: { width: '100%', maxWidth: 304, transform:[{translateY:25}], minHeight: 240, borderRadius: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 23, paddingBottom: 17, alignItems: 'center', boxShadow: '0px 6px 7px #00000033' },
  icon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3FAF2', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, lineHeight: 27, fontWeight: '600', color: '#003C40', marginTop: 21, textAlign: 'center' },
  prompt: { fontSize: 18, lineHeight: 27, fontWeight: '500', color: '#858585', marginTop: 2 },
  buttons: { flexDirection: 'row', gap: 13, width: '100%', marginTop: 32 }, button: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 16, color: '#858585' }, deleteText: { fontSize: 16, color: '#FFF' }, error: { color: '#A32727', fontSize: 14, marginTop: 8 },
});
