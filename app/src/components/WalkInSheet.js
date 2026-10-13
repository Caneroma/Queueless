import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { ticketQr } from '../lib/qr';
import BigButton from './BigButton';
import Field from './Field';
import QrCard, { QR_PADDING } from './QrCard';
import RollingNumber from './RollingNumber';
import Sheet from './Sheet';

const KINDS = [
  { value: 'physical', label: 'Paper token', hint: 'They get a slip. Your phone buzzes on their turn.' },
  { value: 'digital', label: 'Their phone', hint: 'They scan a QR to add it to their phone.' },
];

// The receptionist's desk: enter a customer who cannot scan, and either hand over the number on a
// slip or let them link it to their phone. `onAdd(name, kind)` resolves with the server's reply,
// or null when it failed (the error is shown by the parent).
export default function WalkInSheet({ visible, onClose, onAdd, busy, error }) {
  const { width, height } = useWindowDimensions();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('physical');
  const [result, setResult] = useState(null);

  const close = () => {
    setName('');
    setResult(null);
    onClose();
  };
  const another = () => {
    setName('');
    setResult(null);
  };
  async function add() {
    const reply = await onAdd(name.trim(), kind);
    if (reply) setResult(reply);
  }

  const chosen = KINDS.find((k) => k.value === kind);
  const size = Math.min(width - (space.xl + QR_PADDING + 1) * 2, height * 0.3, 240);
  const ahead = result ? result.snapshot.waiting.indexOf(result.number) : 0;

  return (
    <Sheet visible={visible} onClose={close} title={result ? `Token ${result.number}` : 'Add a walk-in'}>
      {result ? (
        <View style={styles.result}>
          {result.kind === 'physical' ? (
            <>
              <RollingNumber value={result.number} style={type.token} color={colors.ink} reduceMotion />
              <Text style={[type.body, styles.centre]}>
                Write {result.number} on a slip and hand it over.{' '}
                {ahead > 0 ? `${ahead} ${ahead === 1 ? 'person is' : 'people are'} ahead of them.` : 'They are first in line.'}
              </Text>
            </>
          ) : (
            <>
              <QrCard value={ticketQr(result.ticketId)} size={size} />
              <Text style={[type.body, styles.centre]}>
                Ask them to open Queueless, tap Join and scan this. It links number {result.number} to their phone.
              </Text>
            </>
          )}
          <BigButton label="Add another" onPress={another} style={styles.full} />
          <BigButton label="Done" variant="text" onPress={close} style={styles.full} />
        </View>
      ) : (
        <View>
          <Field
            label="Customer name (optional)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <View accessibilityRole="radiogroup" style={styles.segments}>
            {KINDS.map((k) => (
              <Pressable
                key={k.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === k.value }}
                onPress={() => setKind(k.value)}
                style={[styles.segment, kind === k.value && styles.selected]}
              >
                <Text style={[type.button, { color: kind === k.value ? colors.white : colors.ink }]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[type.caption, styles.hint]}>{chosen.hint}</Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={[type.caption, styles.error]}>
              {error}
            </Text>
          ) : null}
          <BigButton label="Add to line" busy={busy} onPress={add} style={styles.full} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  segment: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.blue, borderColor: colors.blue },
  hint: { color: colors.pencil, marginTop: space.sm },
  error: { color: colors.red, marginTop: space.sm },
  full: { alignSelf: 'stretch', marginTop: space.lg },
  result: { alignItems: 'center' },
  centre: { color: colors.ink, textAlign: 'center', marginTop: space.lg },
});
