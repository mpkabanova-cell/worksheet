import { useState } from 'react'
import type { MediaKind, WorksheetBlock } from '@/data/worksheet'
import { qrCodeUrl } from '@/data/blockUtils'
import { Input } from '@/components/ui'

interface MediaBlockProps {
  block: WorksheetBlock
  editable: boolean
  selected: boolean
  onChange?: (block: WorksheetBlock) => void
}

function detectMediaKind(url: string, fileName?: string): MediaKind {
  const lower = (fileName ?? url).toLowerCase()
  if (/\.(mp3|wav|ogg|m4a)/.test(lower)) return 'audio'
  if (/\.(mp4|webm|mov)/.test(lower)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|svg)/.test(lower)) return 'image'
  return 'link'
}

function MediaQrSlot({ url }: { url?: string }) {
  return (
    <div className="media-qr-slot">
      {url ? (
        <img src={qrCodeUrl(url)} alt="QR-код" className="media-qr" width={160} height={160} />
      ) : (
        <div className="media-qr-placeholder" aria-hidden />
      )}
    </div>
  )
}

export function MediaBlockView({ block, editable, selected, onChange }: MediaBlockProps) {
  const [linkDraft, setLinkDraft] = useState(block.mediaUrl ?? '')
  const [playerOpen, setPlayerOpen] = useState(false)
  const url = block.mediaUrl ?? ''
  const kind = block.mediaKind ?? (url ? detectMediaKind(url, block.mediaFileName) : 'link')

  const commitLink = () => {
    const trimmed = linkDraft.trim()
    if (!trimmed) return
    onChange?.({
      ...block,
      mediaUrl: trimmed,
      mediaFileData: undefined,
      mediaFileName: undefined,
      mediaKind: detectMediaKind(trimmed),
    })
  }

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onChange?.({
        ...block,
        mediaUrl: undefined,
        mediaFileData: String(reader.result),
        mediaFileName: file.name,
        mediaKind: detectMediaKind(file.name, file.name),
      })
    }
    reader.readAsDataURL(file)
  }

  const displayUrl = block.mediaFileData ?? url
  const isEditing = editable && selected && !!onChange

  if (isEditing) {
    return (
      <div className="media-block media-block--sheet">
        <p className="media-block-title">Открой QR–код и …</p>
        <div className="media-block-row">
          <div className="media-block-controls">
            <Input
              className="media-link-input"
              value={linkDraft}
              placeholder="Введите ссылку для QR–кода"
              onChange={(e) => setLinkDraft(e.target.value)}
              onBlur={commitLink}
            />
            <span className="media-or">или</span>
            <label className="media-upload-btn">
              Загрузите файл
              <input
                type="file"
                accept="audio/*,video/*,image/*"
                hidden
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {block.mediaFileName ? (
              <div className="media-file-name">
                <span>{block.mediaFileName}</span>
                <button
                  type="button"
                  className="media-file-remove"
                  onClick={() =>
                    onChange?.({
                      ...block,
                      mediaFileData: undefined,
                      mediaFileName: undefined,
                      mediaKind: undefined,
                    })
                  }
                >
                  Удалить
                </button>
              </div>
            ) : null}
          </div>
          <MediaQrSlot url={url || undefined} />
        </div>
      </div>
    )
  }

  if (!displayUrl && !url) {
    return (
      <div className="media-block media-block--sheet empty">
        <p className="media-block-title">Открой QR–код и …</p>
        <div className="media-block-row">
          <p className="media-block-hint">Введите ссылку или загрузите файл для QR–кода</p>
          <MediaQrSlot />
        </div>
      </div>
    )
  }

  return (
    <div className="media-block media-block--sheet">
      <p className="media-block-title">Открой QR–код и …</p>
      <div className="media-block-row">
        <div className="media-block-preview-label">
          {block.mediaFileName ? block.mediaFileName : url}
        </div>
        {url ? (
          <button type="button" className="media-qr-btn" onClick={() => setPlayerOpen(true)}>
            <MediaQrSlot url={url} />
          </button>
        ) : block.mediaFileData ? (
          <button type="button" className="media-file-btn" onClick={() => setPlayerOpen(true)}>
            {block.mediaFileName ?? 'Медиафайл'}
          </button>
        ) : (
          <MediaQrSlot />
        )}
      </div>
      {playerOpen ? (
        <div className="media-player-overlay" onClick={() => setPlayerOpen(false)}>
          <div className="media-player" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="media-player-close" onClick={() => setPlayerOpen(false)}>
              ×
            </button>
            {kind === 'audio' && displayUrl ? <audio controls src={displayUrl} /> : null}
            {kind === 'video' && displayUrl ? <video controls src={displayUrl} /> : null}
            {kind === 'image' && displayUrl ? <img src={displayUrl} alt="" /> : null}
            {kind === 'link' && url ? (
              <p>
                <a href={url} target="_blank" rel="noreferrer">
                  {url}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
