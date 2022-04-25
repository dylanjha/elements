import * as UpChunk from '@mux/upchunk';

const template = document.createElement('template');

template.innerHTML = `
<style>
  :host {
    background: #bae6fd;
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
  :host([upload-in-progress]) button {
    display: none;
  }
</style>
<input type="file" />
<slot></slot>
<button type="button">Pick a video file</button>
<div>
<progress id="progress-bar" value="0" max="100" />
</div>
<p id="upload-status"></p>
`;

class MuxUploaderElement extends HTMLElement {
  hiddenFileInput: HTMLInputElement | null | undefined;
  filePickerButton: HTMLButtonElement | null | undefined;

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
      console.log('debug got a file dropped', file, uploadUrl);
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
