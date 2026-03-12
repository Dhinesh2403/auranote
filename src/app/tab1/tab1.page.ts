import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { environment } from 'src/environments/environment.prod';

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  starred?: boolean;
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

  // Inline editor state
  showEditor = false;
  editorNote: { title: string; content: string; starred: boolean } = { title: '', content: '', starred: false };
  editorIndex: number | null = null;

  // Handler to refresh notes when other parts of the app update storage
  private notesUpdatedHandler = async () => {
    try {
      await this.ensureStorage();
      await this.loadNotes();
    } catch {}
  };

  get notesCount() {
    return this.notes.length;
  }

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private storage: Storage,
  ) {}

  async ionViewWillEnter() {
    await this.ensureStorage();
    await this.loadNotes();
  }

  async ionViewDidEnter() {
    await this.ensureStorage();
    await this.loadNotes();
    // Listen for external updates and refresh immediately
    try {
      window.addEventListener('aura:notes-updated', this.notesUpdatedHandler as EventListener);
    } catch {}
  }

  async ionViewDidLeave() {
    try {
      window.removeEventListener('aura:notes-updated', this.notesUpdatedHandler as EventListener);
    } catch {}
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  private async loadNotes() {
    const notes = (await this.storage.get(NOTES_KEY)) as Note[] | null;
    this.notes = (notes ?? []).sort((a, b) => {
      const aStar = a.starred ? 1 : 0;
      const bStar = b.starred ? 1 : 0;
      if (aStar !== bStar) return bStar - aStar;
      return b.updatedAt - a.updatedAt;
    });

    
    console.log(environment);
  }

  private async saveNotes() {
    await this.storage.set(NOTES_KEY, this.notes);
  }

  // Open inline editor for new note
  async createNote() {
    this.editorNote = { title: '', content: '', starred: false };
    this.editorIndex = null;
    this.showEditor = true;
  }

  // Open inline editor to edit
  async editNote(note: Note, idx?: number) {
    this.editorNote = { title: note.title, content: note.content, starred: !!note.starred };
    this.editorIndex = typeof idx === 'number' ? idx : this.notes.findIndex((n) => n.id === note.id);
    this.showEditor = true;
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
            await this.presentToast('Note deleted', 'trash-outline', 'medium');
            // Notify other pages/tabs
            try { window.dispatchEvent(new CustomEvent('aura:notes-updated')); } catch {}
          },
        },
      ],
    });

    await confirm.present();
  }

  // Save editor content (create or update)
  async saveEditor() {
    const title = (this.editorNote.title ?? '').trim();
    const content = (this.editorNote.content ?? '').trim();
    if (!title && !content) return;
    const now = Date.now();
    if (this.editorIndex === null) {
      const note: Note = {
        id: crypto.randomUUID(),
        title: title || 'Untitled',
        content,
        createdAt: now,
        updatedAt: now,
        starred: !!this.editorNote.starred,
      };
      this.notes = [note, ...this.notes];
      await this.saveNotes();
      await this.presentToast('Note added', 'checkmark-circle-outline', 'success');
      // Notify other pages/tabs
      try { window.dispatchEvent(new CustomEvent('aura:notes-updated')); } catch {}
    } else {
      const n = this.notes[this.editorIndex];
      n.title = title || 'Untitled';
      n.content = content;
      n.updatedAt = now;
      n.starred = !!this.editorNote.starred;
      this.notes = [...this.notes];
      await this.saveNotes();
      await this.presentToast('Note updated', 'checkmark-circle-outline', 'success');
      // Notify other pages/tabs
      try { window.dispatchEvent(new CustomEvent('aura:notes-updated')); } catch {}
    }
    this.showEditor = false;
    this.editorIndex = null;
  }

  cancelEditor() {
    this.showEditor = false;
    this.editorIndex = null;
  }

  async toggleStar(note: Note) {
    note.starred = !note.starred;
    note.updatedAt = Date.now();
    this.notes = [...this.notes].sort((a, b) => {
      const aStar = a.starred ? 1 : 0;
      const bStar = b.starred ? 1 : 0;
      if (aStar !== bStar) return bStar - aStar;
      return b.updatedAt - a.updatedAt;
    });
    await this.saveNotes();
    // Notify other pages/tabs
    try { window.dispatchEvent(new CustomEvent('aura:notes-updated')); } catch {}
  }

  formatWhen(epoch: number) {
    const d = new Date(epoch);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private async presentToast(message: string, icon: string, color: string) {
    const t = await this.toastCtrl.create({
      message,
      duration: 1600,
      position: 'top',
      color: color as any,
      icon,
    });
    await t.present();
  }
}
