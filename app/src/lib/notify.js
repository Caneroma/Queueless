import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { alertText } from './alertText';

// Notifications raised by the phone itself need no account, token or server, and cover alerts
// while the app is alive (including scheduled leave reminders). registerForPushNotifications is
// the one exception: it hands the server a device token so a called number can also reach a phone
// whose app is closed, through the Expo push service.
//
// Expo Go cannot run any of this on Android (SDK 53+): merely loading expo-notifications there
// throws, because the library registers a push-token listener on import. So in Expo Go the library
// is never loaded and the in-app banner is the only alert. A development or production build
// supports the full thing.
const SUPPORTED = !isRunningInExpoGo();

const CHANNEL = 'called';
const LIVE_CHANNEL = 'queue-live';
let library = null;

// Loaded on first use, and never in Expo Go.
function notifications() {
  if (!library) library = require('expo-notifications');
  return library;
}

// Android needs a high-importance channel for the notification to pop up over other apps.
async function ensureChannel(channel = CHANNEL) {
  if (Platform.OS !== 'android') return;
  const N = notifications();
  await N.setNotificationChannelAsync(channel, {
    name: channel === LIVE_CHANNEL ? 'Queue updates' : 'Your turn',
    importance: channel === LIVE_CHANNEL ? N.AndroidImportance.DEFAULT : N.AndroidImportance.MAX,
    vibrationPattern: channel === LIVE_CHANNEL ? [] : [0, 300, 200, 300],
  });
}

// Asked right after joining, when the reason for the question is obvious. A refusal is fine:
// the in-app banner still works.
export async function askNotificationPermission() {
  if (!SUPPORTED) return;
  try {
    await ensureChannel();
    const N = notifications();
    const { granted, canAskAgain } = await N.getPermissionsAsync();
    if (!granted && canAskAgain) await N.requestPermissionsAsync();
  } catch {
    // notifications are a bonus; never block joining over them
  }
}

// Returns the device token used by the server for background delivery.
// This requires a development or production build; Expo Go intentionally skips it.
export async function registerForPushNotifications() {
  if (!SUPPORTED) return null;
  try {
    const N = notifications();
    await ensureChannel();
    const current = await N.getPermissionsAsync();
    const permissions = current.granted || !current.canAskAgain ? current : await N.requestPermissionsAsync();
    if (!permissions.granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await N.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

function contentFor(kind, ticket) {
  const { title, body } = alertText(kind, ticket);
  return { title, body, data: { ticketId: ticket.ticketId } };
}

// Shows right now: used when a number is called while the app is in the background.
export async function notifyCalled(ticket) {
  if (!SUPPORTED) return;
  try {
    await ensureChannel();
    await notifications().scheduleNotificationAsync({
      content: contentFor('called', ticket),
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null, // null: show now
    });
  } catch {
    // not permitted or unsupported: the banner covers the foreground case
  }
}

const liveId = (ticketId) => `queue-live-${ticketId}`;

function liveBody(ticket, snapshot) {
  if (snapshot.serving === ticket.number) return 'Your turn now. Go to the counter.';
  const ahead = snapshot.waiting.indexOf(ticket.number);
  if (ahead < 0) return 'Queue status is being refreshed.';
  const serving = snapshot.serving ? `Serving #${snapshot.serving}` : 'Queue is waiting to start';
  return `${serving} - ${ahead} ${ahead === 1 ? 'person' : 'people'} ahead`;
}

export async function updateLiveQueue(ticket, snapshot) {
  // Disabled to prevent double notifications. Notifications only fire when called.
}

export async function clearLiveQueue(ticketId) {
  if (!SUPPORTED || Platform.OS !== 'android') return;
  try {
    await notifications().dismissNotificationAsync(liveId(ticketId));
  } catch {
    // The notification may already have been dismissed.
  }
}

// A fixed identifier per ticket, so scheduling again replaces the earlier reminder instead of
// stacking a second one, even after the app has been restarted.
const reminderId = (ticketId) => `leave-${ticketId}`;

// Disabled to ensure only the actual call notification is sent to the user.
export async function scheduleLeaveReminder(ticket, atMs) {
  // In-app banner still handles leave alerts via useLeaveAlerts
}

export async function cancelLeaveReminder(ticketId) {
  if (!SUPPORTED) return;
  try {
    await notifications().cancelScheduledNotificationAsync(reminderId(ticketId));
  } catch {
    // nothing was scheduled
  }
}

// Calls `handler(ticketId)` when the person taps a notification. Returns the unsubscribe function.
export function onNotificationTap(handler) {
  if (!SUPPORTED) return () => {};
  try {
    const sub = notifications().addNotificationResponseReceivedListener((response) =>
      handler(response.notification.request.content.data.ticketId)
    );
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
