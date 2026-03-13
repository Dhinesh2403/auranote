import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { environment } from 'src/environments/environment';

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
      text: 'Welcome! I\'m Aura — I can draft a note (saved to the Notes tab) or create a reminder (saved to the Reminders tab). Tell me what you\'d like me to add (for example: "Take out the trash at 6pm" or "Draft a meeting note").',
      createdAt: Date.now(),
    },
  ];

  draft = '';
  private storageReady = false;
  isSending = false;

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
    if (this.isSending) return;

    const text = this.draft.trim();
    if (!text) return;

    this.isSending = true;

    try {
      this.messages = [
        ...this.messages,
        { id: crypto.randomUUID(), role: 'user', text, createdAt: Date.now() },
      ];
      this.draft = '';

      const host = environment.serverHost;
      if (!host) {
        this.messages = [
          ...this.messages,
          {
            id: crypto.randomUUID(),
            role: 'agent',
            text: 'Aura is not configured. Set environment.serverHost (build-time) to enable the chat.',
            createdAt: Date.now(),
          },
        ];
        return;
      }

      const agentText = await this.getAuraResponse(text);

      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: agentText,
          createdAt: Date.now(),
        },
      ];

      // Attempt to interpret the agent's reply and create notes/reminders when it
      // explicitly provides them. This supports (in order): embedded JSON objects
      // with an `action` field, simple "Note:" / quoted text, and heuristic
      // detection of reminder language with time/date.
      try {
        await this.processAgentResponse(agentText);
      } catch (err) {
        // ignore parsing/scheduling errors so chat still works
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: 'agent',
          text: msg,
          createdAt: Date.now(),
        },
      ];
    } finally {
      this.isSending = false;
    }
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
    // Notify other tabs immediately so UI refreshes
    try {
      window.dispatchEvent(new CustomEvent('aura:notes-updated'));
    } catch {}
  }

  private async createReminderFromAgent(rem: any) {
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

    // Resolve date/time. If agent didn't provide a time, default to 30 minutes from now.
    let when = this.resolveReminderDate(rem.date, rem.time);
    if (!when) {
      // Fallback: schedule 30 minutes from now
      when = new Date(Date.now() + 30 * 60 * 1000);
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

    // Use the resolved Date when scheduling to avoid extra conversions that can
    // introduce delays. This schedules the notification at the intended local time.
    await LocalNotifications.schedule({
      notifications: [
        {
          id: this.toNotificationId(reminder.id),
          title: reminder.title,
          body: reminder.body || 'Reminder',
          schedule: this.buildSchedule(when, reminder.recurrence),
        },
      ],
    });

    const existing = ((await this.storage.get(REMINDERS_KEY)) as Reminder[] | null) ?? [];
    await this.storage.set(REMINDERS_KEY, [...existing, reminder]);
    // Notify other tabs immediately so UI refreshes
    try {
      window.dispatchEvent(new CustomEvent('aura:reminders-updated'));
    } catch {}
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

  // Updated: helper to call Aura chat completions
  private async getAuraResponse(userMessage: string): Promise<string> {
    // Use the build-time configured server host.
    const host = environment.serverHost ?? '';
    const url = `${host.replace(/\/$/, '')}/api/chat`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // No runtime API key or endpoint are read from window.__ENV. Authorization
    // should be handled by your proxy/server if required.

    // Add a simple timeout to avoid leaving requests hanging.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Request timed out while contacting Aura.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Aura proxy error: ${res.status} ${errBody}`);
    }

    const body = await res.json();
    return body.reply ?? '';
  }

  // Try to interpret an agent reply and create a note or reminder when the
  // agent provides structured or clearly-labeled output.
  private async processAgentResponse(agentText: string) {
    // Precompute common regex matches so they can be reused in multiple branches.
    const quoted = /"([^"]+)"|'([^']+)'/.exec(agentText);

    // 1) Try to find JSON in the agent text and parse it. Expected shapes:
    //    { action: 'note', content: '...' }
    //    { action: 'reminder', task: '...', date: 'today', time: '6:00pm', recurrence: 'once' }
    try {
      const jmatch = agentText.match(/\{[\s\S]*\}/);
      if (jmatch) {
        const obj = JSON.parse(jmatch[0]);
        if (obj?.action === 'note' && obj?.content) {
          await this.saveNoteFromAgent(String(obj.content));
          return;
        }
        if (obj?.action === 'reminder' && obj?.task) {
          await this.createReminderFromAgent(obj);
          return;
        }
      }
    } catch {}

    // 2) Heuristic: if the agent mentions the Notes tab or explicitly formats a
    //    Note: prefix or returns quoted text, treat that as a note to save.
    try {
      const lower = agentText.toLowerCase();
      const noteLabel = /(?:note[:\-\s]*["']?)([^"'\n]+)/i.exec(agentText);
      if (lower.includes('notes tab') || lower.includes('saved to the notes') || noteLabel) {
        const content = (noteLabel?.[1] || quoted?.[1] || quoted?.[2] || agentText).trim();
        await this.saveNoteFromAgent(content);
        return;
      }
    } catch {}

    // 3) Heuristic: detect reminder language and extract task/date/time if possible.
    try {
      if (/remind|reminder|remind me to/i.test(agentText)) {
        const timeMatch = agentText.match(/at\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i);
        const dateMatch = agentText.match(/\b(today|tomorrow|on\s+[^,\.\n]+)/i);
        const taskMatch = agentText.match(/(?:remind me to|reminder[:\-\s]*)([^\n\.]+)/i) || quoted;

        const remObj: any = {
          task: taskMatch ? (taskMatch[1] || taskMatch[0]).trim() : 'Reminder',
          date: dateMatch ? dateMatch[1].replace(/^on\s+/i, '').trim() : undefined,
          time: timeMatch ? timeMatch[1].trim() : undefined,
          recurrence: 'once',
        };
        await this.createReminderFromAgent(remObj);
        return;
      }
    } catch {}
  }
}
