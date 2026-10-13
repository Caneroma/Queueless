import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, space, type } from '../theme';
import useScreenOn from '../hooks/useScreenOn';
import { queueQr } from '../lib/qr';
import QrCard, { QR_PADDING } from './QrCard';
import Sheet from './Sheet';

// Separate component so the screen only stays awake while the QR is on show.
// The Modal does not render its children while closed.
function QrBody({ code }) {
  useScreenOn();
  const { width, height } = useWindowDimensions();
  // Capped by height too, so the code and hint stay on screen in a short browser window.
  const size = Math.min(width - (space.xl + QR_PADDING + 1) * 2, height * 0.42, 300);
  return (
    <View style={styles.body}>
      <QrCard value={queueQr(code)} size={size} />
      <Text accessibilityLabel={`Code ${code.split('').join(' ')}`} style={[type.code, styles.code]}>
        {code}
      </Text>
      <Text style={[type.caption, styles.hint]}>Scan with Queueless, or enter this code.</Text>
    </View>
  );
}

export default function QrSheet({ visible, onClose, name, code }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={name}>
      <QrBody code={code} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  code: { color: colors.ink, letterSpacing: 6, marginTop: space.lg },
  hint: { color: colors.pencil, marginTop: space.sm },
});
