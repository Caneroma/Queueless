import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

const BRACKET = 36;
const ROUND = 16; // matches the rounded corners of the QR card

// Dims everything except a square window, and draws four corner brackets
// around it. The brackets turn yellow once a code has been read.
export default function ScanFrame({ scanned }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.7, 300);
  const side = (width - size) / 2;
  const line = { borderColor: scanned ? colors.yellow : colors.white };

  return (
    <View style={styles.overlay}>
      <View style={[styles.mask, { height: 120 }]} />
      <View style={{ height: size, flexDirection: 'row' }}>
        <View style={[styles.mask, { width: side }]} />
        <View style={{ width: size }}>
          <View style={[styles.corner, styles.tl, line]} />
          <View style={[styles.corner, styles.tr, line]} />
          <View style={[styles.corner, styles.bl, line]} />
          <View style={[styles.corner, styles.br, line]} />
        </View>
        <View style={[styles.mask, { flex: 1 }]} />
      </View>
      <View style={[styles.mask, { flex: 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  mask: { backgroundColor: colors.mask },
  corner: { position: 'absolute', width: BRACKET, height: BRACKET },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: ROUND },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: ROUND },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: ROUND },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: ROUND },
});
