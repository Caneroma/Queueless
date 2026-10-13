import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, space, type } from '../theme';
import BigButton from './BigButton';
import { ConfirmBody } from './ConfirmSheet';
import Sheet from './Sheet';

// Pause/resume, the no-receptionist setting and, out of accidental reach, close. Closing is a second mode of
// this same sheet, so there is never a modal opening while another is closing.
export default function QueueOptionsSheet({
  mode,
  paused,
  noReceptionist,
  busy,
  error,
  onClose,
  onPause,
  onToggleReceptionist,
  onAskClose,
  onConfirmClose,
}) {
  const closing = mode === 'close';
  const title = closing ? 'Close queue' : 'Queue settings';
  return (
    <Sheet visible={mode !== null} onClose={onClose} title={title}>
      {closing ? (
        <ConfirmBody
          message="Close this queue? Anyone still waiting will be removed."
          confirmLabel="Close queue"
          busy={busy}
          error={error}
          onConfirm={onConfirmClose}
          onCancel={onClose}
        />
      ) : (
        <>
          <Text style={[type.body, styles.message]}>
            {paused
              ? 'New people cannot get a number. Everyone already in line keeps their place.'
              : 'Nobody new can join while paused. Everyone already in line keeps their place.'}
          </Text>
          <BigButton label={paused ? 'Resume joining' : 'Pause joining'} busy={busy} onPress={onPause} />
          <View style={styles.setting}>
            <View style={styles.settingText}>
              <Text style={[type.body, styles.label]}>No receptionist</Text>
              <Text style={[type.caption, styles.help]}>
                Ask people waiting beside a paper token to pass the word on when it is called.
              </Text>
            </View>
            <Switch
              accessibilityLabel="No receptionist"
              value={noReceptionist}
              disabled={busy}
              onValueChange={onToggleReceptionist}
              trackColor={{ false: colors.hairline, true: colors.blue }}
              thumbColor={colors.white}
            />
          </View>
          <BigButton label="Close queue" variant="text" color={colors.red} onPress={onAskClose} style={styles.close} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: { color: colors.ink, marginBottom: space.xl },
  close: { marginTop: space.md },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  settingText: { flex: 1 },
  label: { color: colors.ink },
  help: { color: colors.pencil },
});
