import { Component } from '@angular/core';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  createdAt: number;
};

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
      text: 'Hi, I am Aura Agent. Ask me to draft a note or suggest a reminder.',
      createdAt: Date.now(),
    },
  ];

  draft = '';

  send() {
    const text = this.draft.trim();
    if (!text) return;

    this.messages = [
      ...this.messages,
      { id: crypto.randomUUID(), role: 'user', text, createdAt: Date.now() },
    ];
    this.draft = '';

    const reply = this.simpleReply(text);
    this.messages = [
      ...this.messages,
      { id: crypto.randomUUID(), role: 'agent', text: reply, createdAt: Date.now() },
    ];
  }

  private simpleReply(text: string) {
    const t = text.toLowerCase();
    if (t.includes('note')) {
      return 'Tip: keep notes short with a clear title. You can create one in the Notes tab.';
    }
    if (t.includes('remind') || t.includes('reminder')) {
      return 'You can create reminders in the Reminders tab and pick recurrence: once, every day, every week, or every month.';
    }
    if (t.includes('hello') || t.includes('hi')) {
      return 'Hello. What would you like to do: create a note or set a reminder?';
    }
    return 'I can help you plan notes/reminders. Try: "Create a reminder every day at 9".';
  }
}
