import * as Speech from 'expo-speech';

/** Reads text out loud at a slightly slower pace (rate 0.9), stopping anything already playing. */
export function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { rate: 0.9 });
}
