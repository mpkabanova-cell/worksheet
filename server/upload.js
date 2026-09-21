/**
 * Парсинг multipart/form-data для загрузки файла контекста.
 */

import Busboy from 'busboy'

/**
 * @param {import('http').IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<{ buffer: Buffer, filename: string, mimeType: string }>}
 */
export function parseSingleFileUpload(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type']
    if (!contentType?.includes('multipart/form-data')) {
      reject(new UploadError('BAD_REQUEST', 'Ожидается multipart/form-data', 400))
      return
    }

    /** @type {Buffer[]} */
    const chunks = []
    let filename = 'upload'
    let mimeType = 'application/octet-stream'
    let total = 0
    let fileReceived = false

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: maxBytes, files: 1 },
    })

    busboy.on('file', (_field, file, info) => {
      fileReceived = true
      filename = info.filename || filename
      mimeType = info.mimeType || mimeType

      file.on('data', (data) => {
        total += data.length
        if (total > maxBytes) {
          file.destroy()
          reject(new UploadError('PAYLOAD_TOO_LARGE', 'Файл не должен весить больше 10 Мб', 413))
          return
        }
        chunks.push(data)
      })

      file.on('limit', () => {
        reject(new UploadError('PAYLOAD_TOO_LARGE', 'Файл не должен весить больше 10 Мб', 413))
      })
    })

    busboy.on('finish', () => {
      if (!fileReceived) {
        reject(new UploadError('BAD_REQUEST', 'Нужен файл в поле file', 400))
        return
      }
      resolve({
        buffer: Buffer.concat(chunks),
        filename,
        mimeType,
      })
    })

    busboy.on('error', (err) => {
      reject(err)
    })

    req.pipe(busboy)
  })
}

export class UploadError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message)
    this.name = 'UploadError'
    this.code = code
    this.status = status
  }
}
