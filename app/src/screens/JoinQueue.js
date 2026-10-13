import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';
import { api } from '../lib/api';
import * as haptics from '../lib/haptics';
import { goHome } from '../lib/nav';
import { parseQr } from '../lib/qr';
import { loadTickets, saveTicket } from '../lib/storage';
import { registerPush } from '../lib/tickets';
import JoinSheet from '../components/JoinSheet';
import ScanFrame from '../components/ScanFrame';

const WRONG_CODE = 'No queue has this code. Check the 6 characters and try again.';

export default function JoinQueue({ navigation }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [queue, setQueue] = useState(null); // snapshot of the queue once found
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const lastScan = useRef(0);
  const asked = useRef(false);

  // Ask once on arrival; if refused, the typed code is the way in.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function lookup(value) {
    // Keep only letters and digits: a pasted code may carry spaces, hyphens or a trailing newline.
    const code = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    setBusy(true);
    setError('');
    try {
      if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error(WRONG_CODE);
      // A phone may hold tickets in several queues, but not two in the same one.
      const held = (await loadTickets()).find((t) => t.code === code);
      if (held) throw new Error(`You already have a ticket for ${held.queueName}. Open it or leave it first.`);
      // Say which code was looked up, so a misread character is easy to spot.
      const found = await api(`/queues/${code}`).catch((e) => {
        if (e.status === 404) throw new Error(`No queue has the code ${code}. Check the 6 characters and try again.`);
        throw e;
      });
      if (found.status === 'closed') throw new Error('This queue is closed. Ask the shop for a new code.');
      if (found.status === 'paused') throw new Error('Joining is paused for now. Try again in a few minutes.');
      setQueue(found);
      setText('');
    } catch (e) {
      setError(e.message);
      setScanned(false);
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError('');
    try {
      const res = await api(`/queues/${queue.code}/join`, { method: 'POST', body: { name: text.trim() } });
      const ticket = {
        ticketId: res.ticketId,
        code: queue.code,
        number: res.number,
        queueName: queue.name,
        issuedAt: new Date().toISOString(),
      };
      await saveTicket(ticket);
      haptics.confirm();
      await registerPush(ticket.ticketId);
      navigation.replace('MyTicket', { ticket });
    } catch (e) {
      setError(e.message);
      setBusy(false);
      haptics.error();
    }
  }

  // A ticket the receptionist already issued: link it to this phone instead of taking a new number.
  async function claim(ticketId) {
    setBusy(true);
    setError('');
    try {
      if (!/^[a-f0-9]{24}$/i.test(ticketId)) throw new Error('That ticket code is not valid.');
      const held = await loadTickets();
      const mine = held.find((t) => t.ticketId === ticketId);
      if (mine) {
        navigation.replace('MyTicket', { ticket: mine });
        return;
      }
      const found = await api(`/tickets/${ticketId}`).catch((e) => {
        if (e.status === 404) throw new Error('That ticket no longer exists. Ask the shop for a new one.');
        throw e;
      });
      if (!['waiting', 'serving'].includes(found.status)) throw new Error('That ticket has already finished.');
      const sameQueue = held.find((t) => t.code === found.queueCode);
      if (sameQueue) throw new Error(`You already have a ticket for ${sameQueue.queueName}. Open it or leave it first.`);
      const ticket = {
        ticketId,
        code: found.queueCode,
        number: found.number,
        queueName: found.queueName,
        issuedAt: new Date().toISOString(),
      };
      await saveTicket(ticket);
      haptics.confirm();
      await registerPush(ticketId);
      navigation.replace('MyTicket', { ticket });
    } catch (e) {
      setError(e.message);
      setScanned(false);
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  function onScan({ data }) {
    const now = Date.now();
    // The camera reports the same QR many times a second; look once every 2 seconds.
    if (queue || busy || now - lastScan.current < 2000) return;
    lastScan.current = now;
    const scan = parseQr(data);
    if (!scan) {
      setError('That QR code is not from Queueless.');
      return;
    }
    setScanned(true);
    haptics.tap();
    if (scan.kind === 'ticket') claim(scan.value);
    else lookup(scan.value);
  }

  const cameraOn = permission && permission.granted;
  const iconColor = cameraOn ? colors.white : colors.ink;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={cameraOn ? 'light-content' : 'dark-content'} />
      {cameraOn ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
          <ScanFrame scanned={scanned} />
        </>
      ) : (
        <Text style={[type.body, styles.denied, { marginTop: insets.top + 96 }]}>
          {permission ? 'Camera access is off. Type the code instead.' : ''}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => goHome(navigation)}
        style={[styles.close, { top: insets.top + space.sm }]}
      >
        <Feather name="x" size={24} color={iconColor} />
      </Pressable>

      <KeyboardAvoidingView behavior="padding" style={styles.bottom}>
        <JoinSheet
          queueName={queue ? queue.name : null}
          value={text}
          onChange={(value) => {
            setText(value);
            setError('');
          }}
          error={error}
          busy={busy}
          onSubmit={() => (queue ? join() : lookup(text))}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  denied: { paddingHorizontal: space.xl, color: colors.ink },
  close: { position: 'absolute', left: space.sm, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bottom: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
});
