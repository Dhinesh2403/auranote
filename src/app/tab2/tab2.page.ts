import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { LocalNotifications } from '@capacitor/local-notifications';

type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

type Reminder = {
  id: string;
  title: string;
  body: string;
  at: string; // ISO date string (local)
  recurrence: Recurrence;
  createdAt: number;
};

const REMINDERS_KEY = 'aura_notes_reminders_v1';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {
  reminders: Reminder[] = [];
  private storageReady = false;
  notificationPermission: 'granted' | 'denied' | 'prompt' | 'unknown' = 'unknown';

  constructor(
    private alertCtrl: AlertController,
    private storage: Storage,
  ) {}

  async ionViewWillEnter() {
    await this.ensureStorage();
    await this.refreshPermission();
    await this.loadReminders();
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  async refreshPermission() {
    const perms = await LocalNotifications.checkPermissions();
    this.notificationPermission = (perms.display as any) ?? 'unknown';
  }

  async requestPermission() {
    const perms = await LocalNotifications.requestPermissions();
    this.notificationPermission = (perms.display as any) ?? 'unknown';
  }

  private async loadReminders() {
    const items = (await this.storage.get(REMINDERS_KEY)) as Reminder[] | null;
    this.reminders = (items ?? []).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  private async saveReminders() {
    await this.storage.set(REMINDERS_KEY, this.reminders);
  }

  private buildSchedule(at: Date, recurrence: Recurrence) {
    if (recurrence === 'daily') {
      return { repeats: true, every: 'day', at } as any;
    }
    if (recurrence === 'weekly') {
      return { repeats: true, every: 'week', at } as any;
    }
    if (recurrence === 'monthly') {
      return { repeats: true, every: 'month', at } as any;
    }
    return { at } as any;
  }

  private async schedule(reminder: Reminder) {
    const at = new Date(reminder.at);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: this.toNotificationId(reminder.id),
          title: reminder.title,
          body: reminder.body,
          schedule: this.buildSchedule(at, reminder.recurrence),
        },
      ],
    });
  }

  private toNotificationId(id: string) {
    // Capacitor requires number IDs.
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  async createReminder() {
    if (this.notificationPermission !== 'granted') {
      await this.requestPermission();
      await this.refreshPermission();
    }

    const displayPerm = this.notificationPermission;
    if (displayPerm !== 'granted') {
      const a = await this.alertCtrl.create({
        header: 'Permission required',
        message: 'Enable notifications to create reminders.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }

    const nowPlus5 = new Date(Date.now() + 5 * 60 * 1000);
    const defaultIsoLocal = new Date(nowPlus5.getTime() - nowPlus5.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    const alert = await this.alertCtrl.create({
      header: 'New reminder',
      inputs: [
        { name: 'title', type: 'text', placeholder: 'Title' },
        { name: 'body', type: 'textarea', placeholder: 'Message' },
        { name: 'at', type: 'datetime-local', value: defaultIsoLocal },
        {
          name: 'recurrence',
          type: 'radio',
          label: 'Once',
          value: 'once',
          checked: true,
        },
        { name: 'recurrence', type: 'radio', label: 'Every day', value: 'daily' },
        { name: 'recurrence', type: 'radio', label: 'Every week', value: 'weekly' },
        { name: 'recurrence', type: 'radio', label: 'Every month', value: 'monthly' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const title = (data.title ?? '').trim();
            const body = (data.body ?? '').trim();
            const at = (data.at ?? '').trim();
            const recurrence = (data.recurrence ?? 'once') as Recurrence;

            if (!title) return;
            const date = new Date(at);
            if (Number.isNaN(date.getTime())) return;

            const reminder: Reminder = {
              id: crypto.randomUUID(),
              title,
              body,
              at: date.toISOString(),
              recurrence,
              createdAt: Date.now(),
            };

            await this.schedule(reminder);

            this.reminders = [...this.reminders, reminder].sort(
              (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
            );
            await this.saveReminders();
          },
        },
      ],
    });

    await alert.present();
  }

  async deleteReminder(reminder: Reminder) {
    const confirm = await this.alertCtrl.create({
      header: 'Delete reminder?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await LocalNotifications.cancel({ notifications: [{ id: this.toNotificationId(reminder.id) }] });
            this.reminders = this.reminders.filter((r) => r.id !== reminder.id);
            await this.saveReminders();
          },
        },
      ],
    });
    await confirm.present();
  }

  formatRecurrence(r: Recurrence) {
    if (r === 'daily') return 'Every day';
    if (r === 'weekly') return 'Every week';
    if (r === 'monthly') return 'Every month';
    return 'Once';
  }

  formatWhen(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString();
  }
}
