
import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-branding',
  standalone: true,
  template: `
    <div class="branding">
      @if(options.theme === 'light') {
      <a href="/assets/Image/omnia-removebg-preview.png">
        <img
          src="./assets/Image/omnia-removebg-preview.png"
          class="align-middle m-2"
          
        />
      </a>
      } @if(options.theme === 'dark') {
      <a href="/assets/image/omnia-removebg-preview.png">
        <img
          src="./assets/images/omnia-removebg-preview.png"
          class="align-middle m-2"
        />
      </a>
      }
    </div>
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();

  constructor(private settings: CoreService) {}
}
