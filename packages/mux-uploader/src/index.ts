import * as UpChunk from '@mux/upchunk';

const template = document.createElement('template');

template.innerHTML = `
<style>
  :host([draggable]) #upload-instruction{
    display: block;
  }

  :host([drag-active]) {
    background: #cbd5e1;
  }

  p {
    font-size: 32px;
    color: black;
  }

  input[type="file"] {
    display: none;
  }

  button {
    cursor: pointer;
    font-size: 16px;
    line-height: 33px;
    background: #fff;
    border: 1px solid #000000;
    color: #000000;
    padding: 10px 20px;
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

  .radial-type, .bar-type, #upload-instruction {
    display: none;
  }

  #upload-status {
    opacity: 0;
  }

  :host([showPercentage][upload-in-progress]) #upload-status {
    opacity: 1; 
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
<p id="upload-instruction">Drop file to upload</p>
<button type="button">Upload video</button>
<div class="bar-type">
  <div class="progress-bar" id="progress-bar"></div>
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
    this.setDefaultType();

    if (this.getAttribute('draggable') === '') {
      this.setupDragAndDrop();
    }
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

  setProgress(percent: number) {
    if (this.getAttribute('type') === TYPES.BAR && this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }

    if (this.getAttribute('type') === TYPES.RADIAL && this.svgCircle) {
      const radius = Number(this.svgCircle?.getAttribute('r'));
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - (percent / 100) * circumference;

      this.svgCircle.style.strokeDashoffset = offset.toString();
    }

    if (this.uploadStatus) {
      this.uploadStatus.innerHTML = Math.floor(percent)?.toString();
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
      this.setProgress(progress.detail);
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
