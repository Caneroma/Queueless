import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, space, type } from '../theme';
import { api } from '../lib/api';
import { queueQr } from '../lib/qr';
import useLiveQueue from '../hooks/useLiveQueue';
import useReducedMotion from '../hooks/useReducedMotion';
import OfflineBanner from '../components/OfflineBanner';
import QrCard from '../components/QrCard';
import RollingNumber from '../components/RollingNumber';

const UPCOMING = 5;

// The shop's wall or TV screen: the number being served, as large as the window allows, the next
// few numbers, and the QR to join. Public and read-only, and numbers only, never names.
export default function Display({ route }) {
  const { code } = route.params;
  const reduceMotion = useReducedMotion();
  const { snapshot, online } = useLiveQueue(code);
  const { width, height } = useWindowDimensions();
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    api(`/queues/${code}`).catch((e) => e.status === 404 && setUnknown(true));
  }, [code]);

  const wide = width >= 900;
  const scale = Math.min(2, Math.max(1, width / 1280)); // a TV gets proportionally bigger text
  const big = Math.round(Math.min(height * (wide ? 0.55 : 0.3), width * (wide ? 0.3 : 0.5)));
  const closed = snapshot && snapshot.status === 'closed';
  const serving = snapshot ? snapshot.serving : null;
  const waiting = snapshot ? snapshot.waiting : [];

  if (unknown || closed) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={[type.title, styles.ink, { fontSize: 40 * scale, lineHeight: 48 * scale }]}>
          {unknown ? 'No queue has this code.' : 'This queue is closed.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { flexDirection: wide ? 'row' : 'column' }]}>
      {/* Stacked, the strip takes the height of its content: "flex: 0" would collapse it on web. */}
      <View style={[styles.strip, wide ? styles.stripWide : styles.stripStacked]}>
        <Text style={[type.section, styles.ink, { fontSize: 28 * scale, lineHeight: 36 * scale }]}>Now serving</Text>
        {serving === null ? (
          <Text style={[type.serving, styles.ink, { fontSize: big, lineHeight: big }]}>{'–'}</Text>
        ) : (
          <RollingNumber
            value={serving}
            style={{ ...type.serving, fontSize: big, lineHeight: big }}
            color={colors.ink}
            reduceMotion={reduceMotion}
          />
        )}
        <Text style={[type.body, styles.ink, { fontSize: 20 * scale, lineHeight: 28 * scale }]}>
          {serving === null ? 'Waiting for the first call' : 'Please go to the counter'}
        </Text>
      </View>

      <ScrollView style={{ flex: wide ? 2 : 1 }} contentContainerStyle={styles.side}>
        <Text accessibilityRole="header" style={[type.title, styles.ink, { fontSize: 32 * scale, lineHeight: 38 * scale }]}>
          {snapshot ? snapshot.name : ''}
        </Text>
        {snapshot && snapshot.status === 'paused' && (
          <Text style={[type.section, styles.ink]}>Joining is paused for now.</Text>
        )}

        <Text style={[type.section, styles.ink, { marginTop: space.lg }]}>Next</Text>
        {waiting.length === 0 ? (
          <Text style={[type.body, styles.pencil]}>Nobody is waiting.</Text>
        ) : (
          <View>
            {waiting.slice(0, UPCOMING).map((n) => (
              <Text key={n} style={[type.rowNumber, styles.row, { fontSize: 36 * scale, lineHeight: 44 * scale }]}>
                {n}
              </Text>
            ))}
            {waiting.length > UPCOMING && (
              <Text style={[type.body, styles.pencil]}>and {waiting.length - UPCOMING} more</Text>
            )}
          </View>
        )}

        <View style={styles.join}>
          <QrCard value={queueQr(code)} size={Math.round(140 * scale)} />
          <View style={styles.flex}>
            <Text style={[type.code, styles.ink, { letterSpacing: 4 }]}>{code}</Text>
            <Text style={[type.body, styles.pencil]}>Scan with Queueless, or enter this code.</Text>
          </View>
        </View>
      </ScrollView>
      <OfflineBanner visible={!online} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  flex: { flex: 1 },
  ink: { color: colors.ink },
  pencil: { color: colors.pencil },
  strip: { padding: space.xxl, backgroundColor: colors.yellow, justifyContent: 'center' },
  stripWide: { flex: 3 },
  stripStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  side: { padding: space.xxl, gap: space.sm },
  row: { color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.hairline, paddingVertical: space.sm },
  join: { marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.lg },
});
