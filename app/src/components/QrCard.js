import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius, space } from '../theme';

// A QR on a rounded white card. The white margin is also the quiet zone a scanner needs.
export const QR_PADDING = space.lg;

export default function QrCard({ value, size }) {
  return (
    <View style={styles.card}>
      <QRCode value={value} size={size} color={colors.ink} backgroundColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: QR_PADDING,
    borderRadius: radius.ticket,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.white,
  },
});
