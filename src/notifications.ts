// Task reminders, scheduled on the person's own phone (not on the web).
// Morning 8:00, afternoon 3:00, evening 7:00, only on the strategy's chosen days.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { REMINDERS } from './constants';
import { activeTasks } from './logic/stats';
import type { Snapshot } from './types';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Replaces all scheduled reminders with the ones the person's strategies ask for. */
export async function syncReminders(snap: Snapshot): Promise<void> {
  if (!native) return;
  const wanted = activeTasks(snap).filter(({ strategy }) => strategy.reminder);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!wanted.length || !(await ensurePermission())) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Task reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  for (const { task, strategy } of wanted) {
    const hour = REMINDERS[strategy.reminder!].hour;
    // Private by default: never show the task on the lock screen unless the person chose to.
    const content = {
      title: 'Stepwise',
      body: snap.person.private_notifications ? 'Time for your task' : `Time for: ${task.title}`,
    };
    if (strategy.freq_days.length) {
      for (const d of strategy.freq_days) {
        await Notifications.scheduleNotificationAsync({
          content,
          // Expo weekdays run 1 = Sunday … 7 = Saturday; ours run 0 = Monday … 6 = Sunday.
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: ((d + 1) % 7) + 1, hour, minute: 0, channelId: 'reminders' },
        });
      }
    } else {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'reminders' },
      });
    }
  }
}
