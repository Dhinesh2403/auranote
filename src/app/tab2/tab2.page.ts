import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { LocalNotifications } from '@capacitor/local-notifications';

type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

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
  notificationsAvailable = true;

  // Inline reminder editor state
  showEditor = false;
  editorReminder: { title: string; body: string; at: string; recurrence: Recurrence } = { title: '', body: '', at: '', recurrence: 'once' };
  editorIndex: number | null = null;

  // Handler to refresh reminders when other parts of the app update storage
  private remindersUpdatedHandler = async () => {
    try {
      await this.ensureStorage();
      await this.loadReminders();
    } catch {}
  };

  constructor(
    private alertCtrl: AlertController,
    private storage: Storage,
  ) {}

  async ionViewWillEnter() {
    await this.ensureStorage();

    // LocalNotifications is not available on plain web builds.
    this.notificationsAvailable = this.isNotificationsAvailable();

    if (this.notificationsAvailable) {
      try {
        await this.refreshPermission();
      } catch {
        this.notificationPermission = 'unknown';
      }
    } else {
      this.notificationPermission = 'unknown';
    }

    await this.loadReminders();
  }

  async ionViewDidEnter() {
    // Listen for external updates and refresh immediately
    try {
      window.addEventListener('aura:reminders-updated', this.remindersUpdatedHandler as EventListener);
    } catch {}
  }

  async ionViewDidLeave() {
    try {
      window.removeEventListener('aura:reminders-updated', this.remindersUpdatedHandler as EventListener);
    } catch {}
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  private isNotificationsAvailable() {
    // On web, the plugin may throw when accessing it.
    return typeof window !== 'undefined' && !!(window as any).Capacitor;
  }

  async refreshPermission() {
    if (!this.notificationsAvailable) {
      this.notificationPermission = 'unknown';
      return;
    }
    const perms = await LocalNotifications.checkPermissions();
    this.notificationPermission = (perms.display as any) ?? 'unknown';
  }

  async requestPermission() {
    if (!this.notificationsAvailable) {
      const a = await this.alertCtrl.create({
        header: 'Not available on web',
        message: 'Notifications are not available in the web build. Use the Android app for scheduled reminders.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }
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
    if (recurrence === 'weekly') return { repeats: true, every: 'week', at } as any;
    if (recurrence === 'monthly') return { repeats: true, every: 'month', at } as any;
    if (recurrence === 'yearly') return { repeats: true, every: 'year', at } as any;
    return { at } as any;
  }

  private async schedule(reminder: Reminder) {
    if (!this.notificationsAvailable) return;
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

  // Open the inline editor for a new or existing reminder
  async createReminder(reminder?: Reminder, index?: number) {
    const isEdit = !!reminder && typeof index === 'number';

    // When creating new reminders, block on web builds since scheduling isn't available
    if (!isEdit && !this.notificationsAvailable) {
      const a = await this.alertCtrl.create({
        header: 'Not available on web',
        message: 'Creating scheduled reminders requires the native Android app. You can still view any reminders saved on this device.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }

    // If editing, prefill editor with existing values
    if (isEdit) {
      this.editorIndex = index!;
      this.editorReminder = {
        title: reminder!.title,
        body: reminder!.body,
        at: new Date(new Date(reminder!.at).getTime() - new Date(reminder!.at).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        recurrence: reminder!.recurrence,
      };
    } else {
      // New reminder: use current system time as default
      const now = new Date();
      this.editorIndex = null;
      this.editorReminder = {
        title: '',
        body: '',
        at: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        recurrence: 'once',
      };
    }

    // If notifications available, ensure permission for scheduling new reminders
    if (this.notificationsAvailable && !isEdit) {
      if (this.notificationPermission !== 'granted') {
        await this.requestPermission();
        await this.refreshPermission();
      }

      if (this.notificationPermission !== 'granted') {
        const a = await this.alertCtrl.create({ header: 'Permission required', message: 'Enable notifications to create reminders.', buttons: ['OK'] });
        await a.present();
        return;
      }
    }

    this.showEditor = true;
  }

  // Cancel inline editor
  cancelReminderEditor() {
    this.showEditor = false;
    this.editorIndex = null;
  }

  // Save the reminder from inline editor (create or update)
  async saveReminder() {
    const title = (this.editorReminder.title ?? '').trim();
    const body = (this.editorReminder.body ?? '').trim();
    const at = (this.editorReminder.at ?? '').trim();
    const recurrence = (this.editorReminder.recurrence ?? 'once') as Recurrence;
    if (!title) return;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return;

    const isEdit = this.editorIndex !== null;

    if (isEdit) {
      const old = this.reminders[this.editorIndex!];
      if (this.notificationsAvailable) {
        try {
          await LocalNotifications.cancel({ notifications: [{ id: this.toNotificationId(old.id) }] });
        } catch {}
      }

      const updated: Reminder = {
        ...old,
        title,
        body,
        at: date.toISOString(),
        recurrence,
      };

      if (this.notificationsAvailable && this.notificationPermission === 'granted') {
        await this.schedule(updated);
      }

      this.reminders[this.editorIndex!] = updated;
    } else {
      const newReminder: Reminder = {
        id: crypto.randomUUID(),
        title,
        body,
        at: date.toISOString(),
        recurrence,
        createdAt: Date.now(),
      };

      if (this.notificationsAvailable && this.notificationPermission === 'granted') {
        await this.schedule(newReminder);
      }

      this.reminders = [...this.reminders, newReminder];
    }

    this.reminders = this.reminders.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    await this.saveReminders();
    // Notify other pages/tabs to auto-refresh
    try { window.dispatchEvent(new CustomEvent('aura:reminders-updated')); } catch {}
    this.showEditor = false;
    this.editorIndex = null;
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
            if (this.notificationsAvailable) {
              await LocalNotifications.cancel({ notifications: [{ id: this.toNotificationId(reminder.id) }] });
            }
            this.reminders = this.reminders.filter((r) => r.id !== reminder.id);
            await this.saveReminders();
            // Notify other pages/tabs to auto-refresh
            try { window.dispatchEvent(new CustomEvent('aura:reminders-updated')); } catch {}
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
    if (r === 'yearly') return 'Every year';
    return 'Once';
  }

  formatWhen(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString();
  }
}
