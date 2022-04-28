import * as UpChunk from '@mux/upchunk';

const styles = `
p {
  color: black;
}

input[type="file"] {
  display: none;
}

button {
  cursor: pointer;
  line-height: 16px;
  background: #fff;
  border: 1px solid #000000;
  color: #000000;
  padding: 16px 24px;
  border-radius: 4px;
  -webkit-transition: all 0.2s ease;
  transition: all 0.2s ease;
}

button:hover {
  color: #fff;
  background: #404040;
}

button:active {
  color: #fff;
  background: #000000;
}

.bar-type {
  background: #e6e6e6;
  border-radius: 100px;
  position: relative;
  height: 10px;
  width: 100%;
}

.radial-type, .bar-type {
  display: none;
}

#upload-instruction {
  display: none;
}

:host([draggable]) #upload-instruction{
  display: block;
}

:host([drag-active]) {
  background: #cbd5e1;
}

#upload-status {
  opacity: 0;
}

/* Regardless if the user wants to visually show the upload percentage
   this number needs to be available to a screen reader.
   Using opacity does not remove this element from the a11y tree. */

:host([showPercentage][upload-in-progress]) #upload-status {
  opacity: 1; 
}


:host([type="radial"][upload-in-progress]) .radial-type {
  display: block;
}

:host([type="bar"][upload-in-progress]) .bar-type {
  display: block;
}

:host([type="bar"][upload-error]) .progress-bar {
  background: #e22c3e;
}

.progress-bar {
  box-shadow: 0 10px 40px -10px #fff;
  border-radius: 100px;
  background: #000000;
  height: 10px;
  width: 0%;
}

:host([upload-in-progress]) button {
  display: none;
}

:host([upload-in-progress]) #upload-instruction {
  display: none;
}

circle {
  stroke: black;
  stroke-width: 6;  /* Thickness of the circle */
  fill: transparent; /* Make inside of the circle see-through */

  /* Animation */ 
  transition: 0.35s;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  -webkit-transform-origin: 50% 50%;
  -moz-transform-origin: 50% 50%;
}
`;

const template = document.createElement('template');

template.innerHTML = `
<style>
  ${styles}
</style>

<p id="upload-instruction">Drop file to upload</p>

<input type="file" />
<slot name="custom-button"><button type="button">Upload video</button></slot>

<p id="upload-percentage"></p>

<div class="bar-type">
  <div class="progress-bar" id="progress-bar"></div>
</div>
<div class="radial-type">
  <svg
    width="120"
    height="120">
    <!-- To prevent overflow of the SVG wrapper, radius must be  (svgWidth / 2) - (circleStrokeWidth * 2)
      or use overflow: visible on the svg.-->
    <circle
      r="52"
      cx="60"
      cy="60"
    />
  <svg>
</div>

<p id="status-message"></p>
`;

const TYPES = {
  BAR: 'bar',
  RADIAL: 'radial',
};

class MuxUploaderElement extends HTMLElement {
  hiddenFileInput: HTMLInputElement | null | undefined;
  filePickerButton: HTMLButtonElement | null | undefined;
  svgCircle: SVGCircleElement | null | undefined;
  progressBar: HTMLElement | null | undefined;
  uploadPercentage: HTMLElement | null | undefined;
  statusMessage: HTMLElement | null | undefined;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    const uploaderHtml = template.content.cloneNode(true);
    shadow.appendChild(uploaderHtml);

    this.hiddenFileInput = this.shadowRoot?.querySelector('input[type="file"]');
    this.filePickerButton = this.shadowRoot?.querySelector('button');
    this.svgCircle = this.shadowRoot?.querySelector('circle');
    this.progressBar = this.shadowRoot?.getElementById('progress-bar');
    this.uploadPercentage = this.shadowRoot?.getElementById('upload-percentage');
    this.statusMessage = this.shadowRoot?.getElementById('status-message');
  }

  connectedCallback() {
    this.setDefaultType();
    this.handleSlots();

    if (this.getAttribute('draggable') === '') {
      this.setupDragAndDrop();
    }
  }

  // Might need a better way to map events to slotted elements especially in the case of multiple
  handleSlots() {
    if (this.filePickerButton) this.setupFilePickerButton(this.filePickerButton);

    this.shadowRoot?.addEventListener('slotchange', () => {
      this.filePickerButton = this.shadowRoot?.querySelector('slot[name=custom-button]');
      if (this.filePickerButton) this.setupFilePickerButton(this.filePickerButton);
    });
  }

  setDefaultType() {
    const currentType = this.getAttribute('type');

    if (!currentType) {
      this.setAttribute('type', TYPES.BAR);
    }

    if (this.getAttribute('type') === TYPES.RADIAL) {
      const radius = Number(this.svgCircle?.getAttribute('r'));
      const circumference = (radius * 2 * Math.PI) / 2;

      if (this.svgCircle) {
        /* strokeDasharray is the size of dashes used to draw the circle with the size of gaps in between.
           If the dash number is the same as the gap number, no gap is visible: a full circle.
           strokeDashoffset defines where along our circle the dashes (in our case, a dash as long as the 
           circumference of our circle) begins. The larger the offset, the farther into the circle you're
           starting the "dash". In the beginning, offset is the same as the circumference. Meaning, the visible 
           dash starts at the end so we don't see the full circle. Instead we see a gap the size of the circle. 
           When the percentage is 100%, offset is 0 meaning the dash starts at the beginning so we can see the circle.
        */
        this.svgCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        this.svgCircle.style.strokeDashoffset = `${circumference}`;
      }
    }
  }

  setupFilePickerButton(button: Element) {
    button.addEventListener('click', () => {
      this.hiddenFileInput?.click();
    });

    this.hiddenFileInput?.addEventListener('change', (evt) => {
      const file = this.hiddenFileInput?.files && this.hiddenFileInput?.files[0];
      if (file) {
        this.handleUpload(file);
      }
    });
  }

  setupDragAndDrop() {
    /* Most areas on a web page are not valid areas to drop data.
       Prevent default behaviour for dragenter and dragleave to allow custom drop zone.
       As for the drop event, default behaviour is to download files dragged into the browser.
       Prevent default behaviour to allow custom download functionality.
    */

    this.addEventListener('dragenter', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.setAttribute('drag-active', '');
    });

    this.addEventListener('dragleave', (evt) => {
      this.removeAttribute('drag-active');
    });

    this.addEventListener('dragover', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
    });

    this.addEventListener('drop', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const { dataTransfer } = evt;
      // @ts-ignore
      const { files } = dataTransfer;
      const file = files[0];
      this.handleUpload(file);
    });
  }

  setProgress(percent: number) {
    switch (this.getAttribute('type')) {
      case TYPES.BAR: {
        if (this.progressBar) this.progressBar.style.width = `${percent}%`;
      }
      case TYPES.RADIAL:
        {
          if (this.svgCircle) {
            const radius = Number(this.svgCircle?.getAttribute('r'));
            const circumference = radius * 2 * Math.PI;
            /* The closer the upload percentage gets to 100%, the closer offset gets to 0.
             The closer offset gets to 0, the more we can see the circumference of our circle.
          */
            const offset = circumference - (percent / 100) * circumference;

            this.svgCircle.style.strokeDashoffset = offset.toString();
          }
        }

        if (this.uploadPercentage) this.uploadPercentage.innerHTML = `${Math.floor(percent)?.toString()}%`;
    }
  }

  handleUpload(file: File) {
    const url = this.getAttribute('url');

    if (!url) {
      if (this.statusMessage) {
        this.statusMessage.innerHTML = 'No url attribute specified -- cannot handleUpload';
      }
      throw Error('No url attribute specified -- cannot handleUpload');
    }

    // Clear previous error message if an upload is reattempted
    if (this.statusMessage) {
      this.statusMessage.innerHTML = '';
    }

    this.setAttribute('upload-in-progress', '');

    const upload = UpChunk.createUpload({
      endpoint: url,
      file,
    });

    // Subscribe to upload events
    upload.on('error', (err) => {
      this.setAttribute('upload-error', '');

      if (this.statusMessage) {
        this.statusMessage.innerHTML = err.detail;
      }
    });

    upload.on('progress', (progress) => {
      this.setProgress(progress.detail);
    });

    upload.on('success', () => {
      if (this.statusMessage) {
        this.statusMessage.innerHTML = 'Upload complete!';
      }
    });
  }
}

type MuxUploaderElementType = typeof MuxUploaderElement;
declare global {
  var MuxUploaderElement: MuxUploaderElementType;
}

/** @TODO Refactor once using `globalThis` polyfills */
if (!globalThis.customElements.get('mux-uploader')) {
  globalThis.customElements.define('mux-uploader', MuxUploaderElement);
  /** @TODO consider externalizing this (breaks standard modularity) */
  globalThis.MuxUploaderElement = MuxUploaderElement;
}

export default MuxUploaderElement;
