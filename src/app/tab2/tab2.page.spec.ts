import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { Tab2Page } from './tab2.page';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Tab2Page],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule],
      providers: [
        {
          provide: Storage,
          useValue: {
            create: jasmine.createSpy('create').and.resolveTo(),
            get: jasmine.createSpy('get').and.resolveTo(null),
            set: jasmine.createSpy('set').and.resolveTo(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
