import { Component } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

const NOTES_KEY = 'aura_notes_notes_v1';
const REMINDERS_KEY = 'aura_notes_reminders_v1';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  notesCount = 0;
  remindersCount = 0;
  private storageReady = false;

  private notesUpdatedHandler = async () => {
    try {
      await this.ensureStorage();
      await this.loadCounts();
    } catch {}
  };

  private remindersUpdatedHandler = async () => {
    try {
      await this.ensureStorage();
      await this.loadCounts();
    } catch {}
  };

  constructor(private storage: Storage) {}

  async ionViewWillEnter() {
    await this.ensureStorage();
    await this.loadCounts();
  }

  async ionViewDidEnter() {
    try {
      window.addEventListener('aura:notes-updated', this.notesUpdatedHandler as EventListener);
      window.addEventListener('aura:reminders-updated', this.remindersUpdatedHandler as EventListener);
    } catch {}
  }

  async ionViewDidLeave() {
    try {
      window.removeEventListener('aura:notes-updated', this.notesUpdatedHandler as EventListener);
      window.removeEventListener('aura:reminders-updated', this.remindersUpdatedHandler as EventListener);
    } catch {}
  }

  private async ensureStorage() {
    if (this.storageReady) return;
    await this.storage.create();
    this.storageReady = true;
  }

  private async loadCounts() {
    const notes = (await this.storage.get(NOTES_KEY)) as any[] | null;
    const reminders = (await this.storage.get(REMINDERS_KEY)) as any[] | null;
    this.notesCount = (notes ?? []).length;
    this.remindersCount = (reminders ?? []).length;
  }
}
