const template = document.createElement('template');

template.innerHTML = `
<style>
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
</style>
<input type="file" />
<slot></slot>
<button type="button">Pick a file</button>
`;

class MuxUploaderElement extends HTMLElement {
  constructor() {
    super();
    console.log('debug MuxUploaderElement');
    const shadow = this.attachShadow({ mode: 'open' });
    const uploaderHtml = template.content.cloneNode(true);
    shadow.appendChild(uploaderHtml);
  }

  connectedCallback() {
    this.hiddenFileInput = this.shadow.querySelector('input[type="file"]');
    console.log('debug connectedCallback', this.hiddenFileInput);
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
