import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';
import * as haptics from '../lib/haptics';
import { goHome } from '../lib/nav';
import { clearOwner } from '../lib/storage';
import useLiveQueue from '../hooks/useLiveQueue';
import useOwnerBuzzer from '../hooks/useOwnerBuzzer';
import useOwnerQueue from '../hooks/useOwnerQueue';
import useReducedMotion from '../hooks/useReducedMotion';
import ActionDock from '../components/ActionDock';
import BigButton from '../components/BigButton';
import ConfirmSheet from '../components/ConfirmSheet';
import DisplayLink from '../components/DisplayLink';
import QrSheet from '../components/QrSheet';
import QueueOptionsSheet from '../components/QueueOptionsSheet';
import Screen from '../components/Screen';
import ServingStrip from '../components/ServingStrip';
import SkippedSheet from '../components/SkippedSheet';
import TopBar from '../components/TopBar';
import WaitingList from '../components/WaitingList';
import WalkInSheet from '../components/WalkInSheet';

// `sheet` is which sheet is open: null, 'qr', 'skip', 'skipped', 'walkin', 'options' or 'close'.
export default function OwnerDashboard({ navigation, route }) {
  const owner = route.params.owner;
  const reduceMotion = useReducedMotion();
  const { snapshot, online } = useLiveQueue(owner.code);
  const forget = useCallback(() => clearOwner().then(() => goHome(navigation)), [navigation]);
  const { lists, loaded, busy, message, run } = useOwnerQueue(owner, snapshot, reduceMotion, forget);
  useOwnerBuzzer(lists, loaded);
  const [sheet, setSheet] = useState(null);
  const closing = useRef(false);

  const serving = snapshot ? snapshot.serving : null;
  const waitingCount = snapshot ? snapshot.waiting.length : 0;
  const paused = !!snapshot && snapshot.status === 'paused';
  const noReceptionist = !!snapshot && !!snapshot.noReceptionist;
  const servingRow = lists.serving && lists.serving.number === serving ? lists.serving : null;

  // Reopened on a queue that was already closed (app killed on the summary): start over.
  useEffect(() => {
    if (snapshot && snapshot.status === 'closed' && !closing.current) {
      forget();
    }
  }, [snapshot, forget]);

  const next = () =>
    run('next', { done: (s) => (s.serving === null ? `Finished ${serving}` : `Called ${s.serving}`) });

  async function skip() {
    setSheet(null);
    await run('skip', { done: () => `Skipped ${serving}`, haptic: haptics.warn });
  }

  async function closeQueue() {
    closing.current = true; // the closed snapshot arrives before the reply; do not treat it as a stale queue
    const reply = await run('close', { haptic: haptics.warn });
    if (reply) navigation.replace('DaySummary', { summary: reply.summary, name: owner.name });
    else closing.current = false;
  }

  async function togglePause() {
    await run('pause', { body: { paused: !paused }, done: () => (paused ? 'Joining resumed' : 'Joining paused') });
    setSheet(null);
  }

  const recall = (t) => run(`recall/${t.id}`, { done: () => `Put ${t.number} back` });

  const addWalkIn = (name, kind) => run('walkin', { body: { name, kind } });

  const toggleReceptionist = (value) =>
    run('settings', {
      body: { noReceptionist: value },
      done: () => (value ? 'Neighbours will be asked to help' : 'Receptionist back at the counter'),
    });

  const pauseButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Joining options"
      onPress={() => setSheet('options')}
      style={styles.pause}
    >
      <Feather name={paused ? 'play' : 'pause'} size={20} color={colors.ink} />
      <Text style={[type.body, styles.ink]}>{paused ? 'Resume' : 'Pause'}</Text>
    </Pressable>
  );

  return (
    <Screen offline={!online}>
      <TopBar navigation={navigation} right={pauseButton} />
      <View style={styles.header}>
        {/* Long-press is the hidden way to close; the visible way is inside the Pause sheet. */}
        <Pressable accessibilityHint="Long press to close the queue" onLongPress={() => setSheet('close')}>
          <Text accessibilityRole="header" style={[type.title, styles.ink]}>
            {owner.name}
          </Text>
        </Pressable>
        <Text style={[type.caption, styles.subtitle]}>Your queue is live. Share the code to let people in.</Text>
        <View style={styles.codeRow}>
          <View style={styles.codeBadge}>
            <Text style={[type.caption, styles.codeLabel]}>QUEUE CODE</Text>
            <Text style={[type.code, styles.code]}>{owner.code}</Text>
          </View>
          <BigButton label="Show QR" variant="outline" height={48} onPress={() => setSheet('qr')} />
        </View>
        <DisplayLink code={owner.code} />
      </View>

      <ServingStrip
        number={serving}
        name={servingRow ? servingRow.name : ''}
        paper={!!servingRow && servingRow.kind === 'physical'}
        reduceMotion={reduceMotion}
      />
      <View style={styles.messageRow}>
        {message && (
          <Text
            accessibilityLiveRegion="polite"
            style={[type.body, { color: message.error ? colors.red : colors.green }]}
          >
            {message.text}
          </Text>
        )}
      </View>

      <ScrollView>
        <WaitingList
          waiting={lists.waiting}
          skipped={lists.skipped}
          onReview={() => setSheet('skipped')}
          onAddWalkIn={() => setSheet('walkin')}
        />
      </ScrollView>
      <ActionDock
        nextLabel={serving === null ? 'Call first person' : 'Next'}
        canNext={serving !== null || waitingCount > 0}
        canSkip={serving !== null}
        busy={busy}
        onNext={next}
        onSkip={() => setSheet('skip')}
      />

      <WalkInSheet
        visible={sheet === 'walkin'}
        onClose={() => setSheet(null)}
        onAdd={addWalkIn}
        busy={busy}
        error={message && message.error ? message.text : ''}
      />
      <QrSheet visible={sheet === 'qr'} onClose={() => setSheet(null)} name={owner.name} code={owner.code} />
      <ConfirmSheet
        visible={sheet === 'skip'}
        onClose={() => setSheet(null)}
        title={`Skip ${serving}`}
        message={`Skip ${serving}? They will move to the skipped list and you can put them back.`}
        confirmLabel="Skip"
        onConfirm={skip}
      />
      <SkippedSheet
        visible={sheet === 'skipped'}
        onClose={() => setSheet(null)}
        skipped={lists.skipped}
        busy={busy}
        onRecall={recall}
      />
      <QueueOptionsSheet
        mode={sheet === 'options' || sheet === 'close' ? sheet : null}
        paused={paused}
        noReceptionist={noReceptionist}
        busy={busy}
        error={message && message.error ? message.text : ''}
        onClose={() => setSheet(null)}
        onPause={togglePause}
        onToggleReceptionist={toggleReceptionist}
        onAskClose={() => setSheet('close')}
        onConfirmClose={closeQueue}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ink: { color: colors.ink },
  pause: { minHeight: 48, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  header: { paddingHorizontal: space.xl, paddingBottom: space.md },
  subtitle: { color: colors.pencil, marginTop: space.sm, marginBottom: space.lg },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  codeBadge: { flex: 1, paddingVertical: space.sm, paddingHorizontal: space.md, backgroundColor: colors.white, borderRadius: radius.sm },
  codeLabel: { color: colors.pencil, letterSpacing: 1 },
  code: { color: colors.ink, fontSize: 26, lineHeight: 30, letterSpacing: 3 },
  messageRow: { minHeight: 40, paddingHorizontal: space.xl, justifyContent: 'center' },
});
