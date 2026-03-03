import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

const NOTES_KEY = 'aura_notes_notes_v1';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  notes: Note[] = [];
  private storageReady = false;

  constructor(
    private alertCtrl: AlertController,
    private storage: Storage,
  ) {}

  async ionViewWillEnter() {
    await this.ensureStorage();
    await this.loadNotes();
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  private async loadNotes() {
    const notes = (await this.storage.get(NOTES_KEY)) as Note[] | null;
    this.notes = (notes ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private async saveNotes() {
    await this.storage.set(NOTES_KEY, this.notes);
  }

  async createNote() {
    const alert = await this.alertCtrl.create({
      header: 'New note',
      inputs: [
        { name: 'title', type: 'text', placeholder: 'Title' },
        { name: 'content', type: 'textarea', placeholder: 'Write your note...' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const title = (data.title ?? '').trim();
            const content = (data.content ?? '').trim();
            if (!title && !content) return;

            const now = Date.now();
            const note: Note = {
              id: crypto.randomUUID(),
              title: title || 'Untitled',
              content,
              createdAt: now,
              updatedAt: now,
            };
            this.notes = [note, ...this.notes];
            await this.saveNotes();
          },
        },
      ],
    });

    await alert.present();
  }

  async editNote(note: Note) {
    const alert = await this.alertCtrl.create({
      header: 'Edit note',
      inputs: [
        { name: 'title', type: 'text', value: note.title },
        { name: 'content', type: 'textarea', value: note.content },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: async (data) => {
            const title = (data.title ?? '').trim();
            const content = (data.content ?? '').trim();
            const now = Date.now();

            note.title = title || 'Untitled';
            note.content = content;
            note.updatedAt = now;

            this.notes = [...this.notes].sort((a, b) => b.updatedAt - a.updatedAt);
            await this.saveNotes();
          },
        },
      ],
    });

    await alert.present();
  }

  async deleteNote(note: Note) {
    const confirm = await this.alertCtrl.create({
      header: 'Delete note?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            this.notes = this.notes.filter((n) => n.id !== note.id);
            await this.saveNotes();
          },
        },
      ],
    });

    await confirm.present();
  }
}
