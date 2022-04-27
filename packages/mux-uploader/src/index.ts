import * as UpChunk from '@mux/upchunk';

const template = document.createElement('template');

template.innerHTML = `
<style>
  :host {
    font-family: Arial;
    border: 1px dashed grey;
    background: #f1f5f9;
  }

  :host([drag-active]) {
    background: #cbd5e1;
  }

  p {
    font-size: 48px;
    color: black;
  }

  input[type="file"] {
    display: none;
  }

  button {
    cursor: pointer;
    font-size: 26px;
    line-height: 33px;
    background: #fff;
    border: 2px solid #222222;
    color: #222222;
    padding: 10px 20px;
    border-radius: 50px;
    -webkit-transition: all 0.2s ease;
    transition: all 0.2s ease;
  }

  button:hover {
    color: #fff;
    background: #222222;
  }

  .bar-type {
    background: #e6e6e6;
    border-radius: 100px;
    position: relative;
    height: 10px;
    width: 100%;
  }

  .radial-type, .bar-type, .error-message {
    display: none;
  }

  :host([type="radial"][upload-in-progress]) .radial-type {
    display: block;
  }

  :host([type="bar"][upload-in-progress]) .bar-type {
    display: block;
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

  svg {
    overflow: visible
  }

  circle {
    stroke: black;
    stroke-width: 6;
    fill: transparent;
  
    transition: 0.35s stroke-dashoffset;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    -webkit-transform-origin: 50% 50%;
    -moz-transform-origin: 50% 50%;
  }
</style>
<input type="file" />
<slot></slot>
<p>Drag a file here to upload or</p>
<button type="button">Browse files</button>
<div class="bar-type">
  <div class="progress-bar" id="progress-bar"/>
</div>
<div class="radial-type">
  <svg
    width="120"
    height="120">
    <circle
      r="58"
      cx="60"
      cy="60"
    />
  <svg>
</div>
<p id="upload-status"></p>
<p id="error-message"></p>
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
  uploadStatus: HTMLElement | null | undefined;
  errorMessage: HTMLElement | null | undefined;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const uploaderHtml = template.content.cloneNode(true);
    shadow.appendChild(uploaderHtml);
  }

  connectedCallback() {
    this.hiddenFileInput = this.shadowRoot?.querySelector('input[type="file"]');
    this.filePickerButton = this.shadowRoot?.querySelector('button[type="button"]');
    this.svgCircle = this.shadowRoot?.querySelector('circle');
    this.progressBar = this.shadowRoot?.getElementById('progress-bar');
    this.uploadStatus = this.shadowRoot?.getElementById('upload-status');
    this.errorMessage = this.shadowRoot?.getElementById('error-message');

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
      const radius = Number(this.svgCircle?.getAttribute('r'));
      const circumference = radius * 2 * Math.PI;

      if (this.svgCircle) {
        this.svgCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        this.svgCircle.style.strokeDashoffset = `${circumference}`;
      }
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
      this.handleUpload(file);
    });
  }

  // to-do: set progress regardless of visual style of progress bar
  setProgress(percent: number) {
    const radius = Number(this.svgCircle?.getAttribute('r'));
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    if (this.svgCircle) {
      this.svgCircle.style.strokeDashoffset = offset.toString();
    }
  }

  handleUpload(file: File) {
    const url = this.getAttribute('url');
    if (!url) {
      if (this.errorMessage) {
        this.errorMessage.innerHTML = 'No url attribute specified -- cannot handleUpload';
      }
      throw Error('No url attribute specified -- cannot handleUpload');
    }

    if (this.errorMessage) {
      this.errorMessage.innerHTML = '';
    }

    this.setAttribute('upload-in-progress', '');
    const upload = UpChunk.createUpload({
      endpoint: url,
      file,
    });

    // subscribe to events
    upload.on('error', (err) => {
      if (this.errorMessage) {
        this.errorMessage.innerHTML = err.detail;
      }
    });

    upload.on('progress', (progress) => {
      if (this.progressBar) {
        this.progressBar.style.width = `${progress.detail}%`;
      }

      if (this.uploadStatus) {
        this.uploadStatus.innerHTML = Math.floor(progress?.detail)?.toString();
      }
      if (this.svgCircle) {
        this.setProgress(progress.detail);
      }
    });

    upload.on('success', () => {
      console.log("Wrap it up, we're almost done here. 👋");
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

// @keyframes load {
//   0% { width: 0; }
//   100% { width: 100%; }
// }
