import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { environment } from '../../environments/environment';
import { aiAgentParseToJson, type AuraAgentResult } from '../ai-agent';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  createdAt: number;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';

type Reminder = {
  id: string;
  title: string;
  body: string;
  at: string;
  recurrence: Recurrence;
  createdAt: number;
};

const NOTES_KEY = 'aura_notes_notes_v1';
const REMINDERS_KEY = 'aura_notes_reminders_v1';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'agent',
      text: 'Hi, I am Aura Agent. Ask me to draft a note or create a reminder (e.g., "Remind me to call Mom at 5pm").',
      createdAt: Date.now(),
    },
  ];

  draft = '';
  private storageReady = false;

  constructor(
    private alertCtrl: AlertController,
    private storage: Storage,
  ) {}

  async ionViewWillEnter() {
    await this.ensureStorage();
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  async send() {
    const text = this.draft.trim();
    if (!text) return;

    this.messages = [
      ...this.messages,
      { id: crypto.randomUUID(), role: 'user', text, createdAt: Date.now() },
    ];
    this.draft = '';

    if (!environment.geminiApiKey) {
      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: 'Gemini API key is not configured. Set environment.geminiApiKey to enable AI parsing.',
          createdAt: Date.now(),
        },
      ];
      return;
    }

    try {
      const parsed = await aiAgentParseToJson(text, { apiKey: environment.geminiApiKey });
      await this.applyAgentResult(parsed);

      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: `Understood: ${JSON.stringify(parsed)}`,
          createdAt: Date.now(),
        },
      ];
    } catch (e: any) {
      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: `Sorry, I couldn't parse that. ${String(e?.message ?? e)}`,
          createdAt: Date.now(),
        },
      ];
    }
  }

  private async applyAgentResult(result: AuraAgentResult) {
    if (result.type === 'note') {
      await this.saveNoteFromAgent(result.content);
      return;
    }

    await this.createReminderFromAgent(result);
  }

  private async saveNoteFromAgent(content: string) {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: 'Agent note',
      content,
      createdAt: now,
      updatedAt: now,
    };

    const existing = ((await this.storage.get(NOTES_KEY)) as Note[] | null) ?? [];
    await this.storage.set(NOTES_KEY, [note, ...existing]);
  }

  private async createReminderFromAgent(rem: Extract<AuraAgentResult, { type: 'reminder' }>) {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    const after = await LocalNotifications.checkPermissions();
    if (after.display !== 'granted') {
      const a = await this.alertCtrl.create({
        header: 'Permission required',
        message: 'Enable notifications to create reminders.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }

    // Resolve date/time
    const when = this.resolveReminderDate(rem.date, rem.time);
    if (!when) {
      const a = await this.alertCtrl.create({
        header: 'Missing time',
        message: 'Please include a time (e.g., 5pm) for reminders.',
        buttons: ['OK'],
      });
      await a.present();
      return;
    }

    const recurrence = (rem.recurrence ?? 'once') as Recurrence;

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      title: rem.task,
      body: '',
      at: when.toISOString(),
      recurrence,
      createdAt: Date.now(),
    };

    await LocalNotifications.schedule({
      notifications: [
        {
          id: this.toNotificationId(reminder.id),
          title: reminder.title,
          body: reminder.body || 'Reminder',
          schedule: this.buildSchedule(new Date(reminder.at), reminder.recurrence),
        },
      ],
    });

    const existing = ((await this.storage.get(REMINDERS_KEY)) as Reminder[] | null) ?? [];
    await this.storage.set(REMINDERS_KEY, [...existing, reminder]);
  }

  private resolveReminderDate(dateStr?: string, timeStr?: string) {
    if (!timeStr) return null;

    const time = this.parseHHmm(timeStr);
    if (!time) return null;

    const now = new Date();
    const base = new Date(now);

    if (dateStr) {
      const d = dateStr.toLowerCase();
      if (d === 'today') {
        // base already today
      } else if (d === 'tomorrow') {
        base.setDate(base.getDate() + 1);
      } else {
        const iso = new Date(dateStr);
        if (!Number.isNaN(iso.getTime())) {
          base.setFullYear(iso.getFullYear(), iso.getMonth(), iso.getDate());
        }
      }
    }

    base.setHours(time.hh, time.mm, 0, 0);

    // If it ended up in the past, bump to tomorrow for safety.
    if (base.getTime() < now.getTime()) {
      base.setDate(base.getDate() + 1);
    }

    return base;
  }

  private parseHHmm(input: string): { hh: number; mm: number } | null {
    const s = input.trim();
    // Accept HH:mm
    const m1 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
    if (m1) return { hh: Number(m1[1]), mm: Number(m1[2]) };

    // Accept things like 5pm / 5 pm / 5:30am
    const m2 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(s);
    if (!m2) return null;

    let hh = Number(m2[1]);
    const mm = Number(m2[2] ?? '0');
    const ap = m2[3].toLowerCase();
    if (hh === 12) hh = 0;
    if (ap === 'pm') hh += 12;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }

  private buildSchedule(at: Date, recurrence: Recurrence) {
    if (recurrence === 'daily') return { repeats: true, every: 'day', at } as any;
    if (recurrence === 'weekly') return { repeats: true, every: 'week', at } as any;
    if (recurrence === 'monthly') return { repeats: true, every: 'month', at } as any;
    return { at } as any;
  }

  private toNotificationId(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }
}
