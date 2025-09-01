import { Component } from '@angular/core';
// import { Vibration } from '@awesome-cordova-plugins/vibration/ngx';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  constructor(
    // private vibration: Vibration
  ) {}

  vibrate() {
    (window as any).navigator.vibrate(1000);
  }


}
