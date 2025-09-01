import { Component } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {

  constructor() {
    this.registerListeners();
  }

  // Request notification permissions
  async requestPermission() {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      console.log('Notification permission granted');
    } else {
      console.log('Notification permission denied');
    }
  }

  // Schedule a notification
  async scheduleNotification() {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'Test Notification',
          body: 'This is a test notification!',
          schedule: { at: new Date(new Date().getTime() + 5000) }, // 5 seconds from now
          actionTypeId: '',
          extra: null,
        },
      ],
    });
    console.log('Notification scheduled');
  }

  // Register listeners for notification events
  registerListeners() {
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('Notification received:', notification);
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      console.log('Notification action performed:', notification);
    });
  }

}
