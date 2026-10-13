import { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, type } from '../theme';
import { api } from '../lib/api';
import { waitMinutes } from '../lib/eta';
import { animateLayout } from '../lib/motion';
import { goHome } from '../lib/nav';
import { removeTicket } from '../lib/storage';
import { leaveTicket } from '../lib/tickets';
import { paperNeighbours } from '../lib/walkins';
import { barStyle, LOOK, positionLine, textColor, ticketState } from '../lib/ticketState';
import useLiveQueue from '../hooks/useLiveQueue';
import useReducedMotion from '../hooks/useReducedMotion';
import useTicketFeel from '../hooks/useTicketFeel';
import useTravel from '../hooks/useTravel';
import BigButton from '../components/BigButton';
import ConfirmSheet from '../components/ConfirmSheet';
import LineDots from '../components/LineDots';
import Screen from '../components/Screen';
import TicketFace from '../components/TicketFace';
import TopBar from '../components/TopBar';
import TravelPicker from '../components/TravelPicker';

const ENDED = ['done', 'skipped', 'closed'];

export default function MyTicket({ navigation, route }) {
  const record = route.params.ticket;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { snapshot, receivedAt, online } = useLiveQueue(record.code, () => animateLayout(reduceMotion));
  const travel = useTravel(record, snapshot, receivedAt);
  const [endStatus, setEndStatus] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { kind, ahead } = ticketState(snapshot, record.number, endStatus);
  const { bg, pulse } = useTicketFeel(kind, snapshot ? snapshot.serving : null, reduceMotion);
  const color = textColor(kind);
  const placed = kind === 'turn' || ahead !== null;

  // Once the ticket is out of the snapshot, ask the server how it ended.
  useEffect(() => {
    if (placed) {
      setEndStatus(null);
      return;
    }
    api(`/tickets/${record.ticketId}`)
      .then((t) => setEndStatus(t.status))
      // 404: the server has no such ticket (database reset). Treat it as ended so the person can leave.
      // Anything else is offline: the banner says so, and the next snapshot retries.
      .catch((e) => e.status === 404 && setEndStatus('left'));
  }, [placed, snapshot, record.ticketId]);

  async function leave() {
    setBusy(true);
    try {
      await leaveTicket(record);
      goHome(navigation);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function finish(next) {
    await removeTicket(record.ticketId); // this ticket is over; any others on the phone stay
    if (next === 'join') {
      navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'JoinQueue' }] });
    } else {
      goHome(navigation);
    }
  }

  const minutes = ahead === null || !snapshot
    ? null
    : Math.max(1, waitMinutes(ahead, snapshot.avgServiceMin, snapshot.serving !== null));
  const live = !ENDED.includes(kind);
  const relay = live && kind !== 'turn' ? paperNeighbours(snapshot, record.number) : [];

  return (
    <Screen bg={bg} bar={barStyle(kind)} offline={!online}>
      <TopBar navigation={navigation} color={color} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityLiveRegion="polite" style={[type.title, { color }]}>
          {LOOK[kind].line}
        </Text>
        {ahead !== null && kind !== 'turn' && (
          <Text style={[type.body, { color }]}>{positionLine(ahead)}</Text>
        )}

        {live && (
          <Animated.View style={[styles.ticket, { transform: [{ scale: pulse }] }]}>
            <TicketFace
              bg={bg}
              record={record}
              serving={snapshot ? snapshot.serving : null}
              ahead={ahead}
              minutes={minutes}
              isTurn={kind === 'turn'}
              reduceMotion={reduceMotion}
            />
          </Animated.View>
        )}
        {live && ahead !== null && kind !== 'turn' && <LineDots ahead={ahead} />}
        {relay.map((n) => (
          <View key={n.side} style={styles.relay}>
            <Text style={[type.section, styles.relayText]}>Paper token {n.number} is right {n.side === 'ahead' ? 'ahead of' : 'behind'} you</Text>
            <Text style={[type.body, styles.relayText]}>
              They have no phone and there is no receptionist. Please tell them when they are called.
            </Text>
          </View>
        ))}
        {live && ahead !== null && kind !== 'turn' && (
          <TravelPicker
            value={travel.travelMin}
            onChange={travel.choose}
            leaveIn={travel.leaveIn}
            wait={minutes}
            color={color}
          />
        )}
        {live && snapshot && snapshot.status === 'paused' && (
          <Text style={[type.body, { color }]}>Joining is paused. Your place is safe.</Text>
        )}
        {kind === 'skipped' && <BigButton label="Join again" onPress={() => finish('join')} style={styles.action} />}
        {(kind === 'done' || kind === 'closed') && (
          <BigButton label="Back to home" onPress={() => finish('home')} style={styles.action} />
        )}
      </ScrollView>

      {live && kind !== 'turn' && (
        <View style={{ paddingBottom: insets.bottom + space.sm }}>
          <BigButton label="Leave queue" variant="text" color={color} onPress={() => {
              setError('');
              setLeaving(true);
            }} />
        </View>
      )}
      <ConfirmSheet
        visible={leaving}
        onClose={() => setLeaving(false)}
        title="Leave queue"
        message={`Leave the queue? You will lose number ${record.number}.`}
        confirmLabel="Leave queue"
        busy={busy}
        error={error}
        onConfirm={leave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg, gap: space.lg },
  ticket: { marginVertical: space.sm },
  action: { marginTop: space.lg },
  relay: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.white, gap: space.xs },
  relayText: { color: colors.ink },
});
