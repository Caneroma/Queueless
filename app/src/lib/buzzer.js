import { Platform, Vibration } from 'react-native';
import { createAudioPlayer } from 'expo-audio';

// The buzzer: a short sound and a vibration, so a number being called is hard to miss without
// watching the screen. 'turn' is the urgent one, 'next' a calmer double beep. It follows the
// phone's own volume and silent switch: a silenced phone still vibrates.
const SOUNDS = {
  turn: require('../../assets/buzz-turn.wav'),
  next: require('../../assets/buzz-next.wav'),
};
const VIBRATION = {
  turn: [0, 250, 120, 250, 120, 250, 120, 250],
  next: [0, 200, 150, 200],
};

const players = {};

// Browsers refuse sound until the page is tapped, and the web admin has no customer alerts anyway.
export async function buzz(kind) {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(VIBRATION[kind]);
    if (!players[kind]) players[kind] = createAudioPlayer(SOUNDS[kind]);
    await players[kind].seekTo(0);
    players[kind].play();
  } catch {
    // no audio output (or a browser that has not been tapped yet): the vibration and banner remain
  }
}
