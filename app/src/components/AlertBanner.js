import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';
import { alertText } from '../lib/alertText';
import { NATIVE_DRIVER } from '../lib/motion';
import useReducedMotion from '../hooks/useReducedMotion';

const HIDDEN = -300; // far enough off-screen on any phone

// "Yellow means go": slides over whatever screen the person is on when a held number is called or
// is next, or when it is time to set off. `alert` is { kind: 'called' | 'next' | 'leave', ticket } or null.
export default function AlertBanner({ alert, onOpen, onDismiss }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const y = useRef(new Animated.Value(HIDDEN)).current;
  const last = useRef(null);
  if (alert) last.current = alert; // keeps the text while the banner slides back out

  useEffect(() => {
    Animated.timing(y, {
      toValue: alert ? 0 : HIDDEN,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [alert, reduceMotion, y]);

  const shown = last.current;
  if (!shown) return null;
  const { title, body } = alertText(shown.kind, shown.ticket);
  return (
    <Animated.View
      accessibilityLiveRegion="assertive"
      aria-hidden={!alert}
      style={[
        styles.banner,
        { paddingTop: insets.top + space.sm, transform: [{ translateY: y }], pointerEvents: alert ? 'auto' : 'none' },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. Open ticket`}
        onPress={() => onOpen(shown.ticket)}
        style={styles.text}
      >
        <Text style={[type.section, styles.ink]}>{title}</Text>
        <Text style={[type.body, styles.ink]} numberOfLines={3}>
          {body}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={styles.close}>
        <Feather name="x" size={24} color={colors.ink} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: space.md,
    paddingLeft: space.xl,
    paddingRight: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  text: { flex: 1, minHeight: 48, justifyContent: 'center' },
  ink: { color: colors.ink },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
