export function pngBytesToDataUrl(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i]!)
  }
  return `data:image/png;base64,${btoa(binary)}`
}
