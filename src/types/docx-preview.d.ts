declare module 'docx-preview/dist/docx-preview.css'

declare module 'docx-preview' {
  export interface DocxPreviewOptions {
    className?: string
    inWrapper?: boolean
    ignoreWidth?: boolean
    ignoreHeight?: boolean
    ignoreFonts?: boolean
    breakPages?: boolean
    renderHeaders?: boolean
    renderFooters?: boolean
    renderFootnotes?: boolean
    renderEndnotes?: boolean
  }

  export function renderAsync(
    document: ArrayBuffer | Blob | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: DocxPreviewOptions,
  ): Promise<unknown>
}
