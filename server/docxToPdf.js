/**
 * DOCX → PDF через LibreOffice headless (soffice).
 * Возвращает null, если конвертер недоступен.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  'soffice',
].filter(Boolean)

/**
 * @param {Buffer} docxBuffer
 * @returns {Promise<Buffer | null>}
 */
export async function convertDocxToPdf(docxBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'worksheet-docx-'))
  const inputPath = path.join(tmpDir, 'input.docx')
  const outputPath = path.join(tmpDir, 'input.pdf')

  try {
    await fs.writeFile(inputPath, docxBuffer)

    for (const soffice of SOFFICE_CANDIDATES) {
      try {
        await execFileAsync(
          soffice,
          ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, inputPath],
          { timeout: 120_000 },
        )
        const pdf = await fs.readFile(outputPath)
        return pdf
      } catch {
        /* try next candidate */
      }
    }
    return null
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
