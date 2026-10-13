import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, space, type } from '../theme';
import { api } from '../lib/api';
import * as haptics from '../lib/haptics';
import { goHome } from '../lib/nav';
import { loadTickets } from '../lib/storage';
import { leaveTicket } from '../lib/tickets';
import BigButton from '../components/BigButton';
import ConfirmSheet from '../components/ConfirmSheet';
import DockButton from '../components/DockButton';
import Screen from '../components/Screen';
import TopBar from '../components/TopBar';

const LABEL = { waiting: 'Waiting', serving: 'Your turn', done: 'Done', skipped: 'Skipped', left: 'Closed' };
const ENDED = ['done', 'skipped', 'left'];

// A called ticket is yellow, the same colour the ticket screen turns, so it is hard to miss in a list.
function StatusTag({ status }) {
  const called = status === 'serving';
  return (
    <View style={[styles.tag, { backgroundColor: called ? colors.yellow : colors.fog }]}>
      <Text style={[type.caption, styles.tagText, called && styles.tagCalled]}>{LABEL[status]}</Text>
    </View>
  );
}

// Every ticket this phone holds, one per queue. Open one, remove one, or join another queue.
export default function Tickets({ navigation }) {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState({}); // ticketId -> server status, filled in as replies arrive
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadTickets().then((list) => {
        setTickets([...list].reverse()); // newest first
        list.forEach((t) => {
          const set = (value) => setStatus((s) => ({ ...s, [t.ticketId]: value }));
          // 404: the server forgot it, which reads the same as a closed queue.
          api(`/tickets/${t.ticketId}`).then((r) => set(r.status), (e) => e.status === 404 && set('left'));
        });
      });
    }, [])
  );

  async function remove() {
    setBusy(true);
    try {
      const remaining = await leaveTicket(removing);
      haptics.warn();
      setTickets((list) => list.filter((t) => t.ticketId !== removing.ticketId));
      setRemoving(null);
      if (!remaining.length) goHome(navigation);
    } catch (e) {
      setError(e.message);
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  const over = removing && ENDED.includes(status[removing.ticketId]);

  return (
    <Screen>
      <TopBar navigation={navigation} />
      <Text accessibilityRole="header" style={[type.title, styles.title]}>
        My tickets
      </Text>
      <ScrollView contentContainerStyle={styles.list}>
        {tickets.map((t) => (
          <View key={t.ticketId} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ticket ${t.number} at ${t.queueName}`}
              onPressIn={haptics.tap}
              onPress={() => navigation.navigate('MyTicket', { ticket: t })}
              style={styles.open}
            >
              <Text style={[type.rowNumber, styles.number]}>{t.number}</Text>
              <View style={styles.flex}>
                <Text style={[type.body, styles.ink]} numberOfLines={1}>
                  {t.queueName}
                </Text>
                <View style={styles.meta}>
                  <Text style={[type.caption, styles.pencil]}>Code {t.code}</Text>
                  {status[t.ticketId] ? <StatusTag status={status[t.ticketId]} /> : null}
                </View>
              </View>
            </Pressable>
            <BigButton
              label={ENDED.includes(status[t.ticketId]) ? 'Remove' : 'Leave'}
              variant="text"
              height={48}
              onPress={() => {
                setError('');
                setRemoving(t);
              }}
            />
          </View>
        ))}
      </ScrollView>
      <DockButton label="Join another queue" onPress={() => navigation.navigate('JoinQueue')} />
      <ConfirmSheet
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={over ? 'Remove ticket' : 'Leave queue'}
        message={
          over
            ? 'Remove this ticket from your phone?'
            : `Leave the queue? You will lose number ${removing ? removing.number : ''}.`
        }
        confirmLabel={over ? 'Remove' : 'Leave queue'}
        busy={busy}
        error={error}
        onConfirm={remove}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ink: { color: colors.ink },
  pencil: { color: colors.pencil },
  number: { width: 64, color: colors.ink },
  title: { paddingHorizontal: space.xl, paddingBottom: space.md, color: colors.ink },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  open: { flex: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: 2 },
  tag: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  tagText: { color: colors.ink },
  tagCalled: { fontFamily: 'Archivo_600SemiBold' },
});
