import * as UpChunk from '@mux/upchunk';

const template = document.createElement('template');

template.innerHTML = `
<style>
  :host {
    background: #f1f5f9;
  }
  :host([drag-active]) {
    background: #0369a1;
  }
  p {
    font-size: 48px;
    color: #facc15;
  }
  input[type="file"] {
    display: none;
  }
  button {
    background: #075985;
    color: white;
    padding: 12px 16px;
    border-radius: 24px;
    font-size: 24px;
    border: none;
  }
  .radial-type, .bar-type {
    display: none;
  }
  :host([type="radial"]) .radial-type {
    display: block;
  }
  :host([type="bar"]) .bar-type {
    display: block;
  }
  :host([upload-in-progress]) button {
    display: none;
  }
  .circle svg circle {
    stroke:#dcdcdc;
    stroke-width: 10;
    stroke-linecap:round;
    transform:translate(5px,5px);
    fill: transparent;
  }
</style>
<input type="file" />
<slot></slot>
<button type="button">Pick a video file</button>
<div class="bar-type">
  <progress id="progress-bar" value="0" max="100" />
</div>
<div class="radial-type">
  <div class="circle">
    <svg>
      <circle
        r="58"
        cx="60"
        cy="60"
      />
    <svg>
  </div>
</div>
<p id="upload-status"></p>
`;

const TYPES = {
  BAR: 'bar',
  RADIAL: 'radial',
};

class MuxUploaderElement extends HTMLElement {
  hiddenFileInput: HTMLInputElement | null | undefined;
  filePickerButton: HTMLButtonElement | null | undefined;
  svgCircle: HTMLElement | null | undefined;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const uploaderHtml = template.content.cloneNode(true);
    shadow.appendChild(uploaderHtml);
  }

  connectedCallback() {
    this.hiddenFileInput = this.shadowRoot?.querySelector('input[type="file"]');
    this.filePickerButton = this.shadowRoot?.querySelector('button[type="button"]');
    this.setupFilePickerButton();
    this.setupDragAndDrop();
    this.setDefaultType();
  }

  setDefaultType() {
    const currentType = this.getAttribute('type');
    if (!currentType) {
      this.setAttribute('type', TYPES.BAR);
    }
    if (this.getAttribute('type') === TYPES.RADIAL) {
      this.svgCircle = this.shadowRoot?.querySelector('.circle svg circle');
    }
  }

  setupFilePickerButton() {
    this.filePickerButton?.addEventListener('click', (evt) => {
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
    this.addEventListener('dragenter', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.setAttribute('drag-active', '');
    });
    this.addEventListener('dragleave', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
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
      //@ts-ignore
      const { files } = dataTransfer;
      const file = files[0];
      const uploadUrl = this.getAttribute('url');
      this.handleUpload(file);
    });
  }

  handleUpload(file: File) {
    const url = this.getAttribute('url');
    if (!url) {
      throw Error('No url attribute specified -- cannot handleUpload');
    }
    this.setAttribute('upload-in-progress', '');
    const upload = UpChunk.createUpload({
      endpoint: url,
      file,
    });

    // subscribe to events
    upload.on('error', (err) => {
      console.error('💥 🙀', err.detail);
    });

    upload.on('progress', (progress) => {
      console.log(`So far we've uploaded ${progress.detail}% of this file.`);
      const progressBar = this.shadowRoot?.getElementById('progress-bar');
      const progressStatus = this.shadowRoot?.getElementById('upload-status');
      progressBar?.setAttribute('value', progress.detail);
      if (progressStatus) {
        progressStatus.innerHTML = Math.floor(progress?.detail)?.toString();
      }
      if (this.svgCircle) {
        /* set the svg styles to show the progress */
        this.svgCircle.style.strokeDasharray = '10 20';
      }
    });

    upload.on('success', () => {
      console.log("Wrap it up, we're done here. 👋");
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
