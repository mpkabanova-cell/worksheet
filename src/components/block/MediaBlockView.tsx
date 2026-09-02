import { useState } from 'react'
import type { MediaKind, WorksheetBlock } from '@/data/worksheet'
import { qrCodeUrl } from '@/data/blockUtils'
import { Button, Input } from '@/components/ui'

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

  if (editable && selected && onChange) {
    return (
      <div className="media-block editable">
        <p className="media-placeholder">Открой QR-код и…</p>
        <Input
          value={linkDraft}
          placeholder="Введите ссылку для QR-кода"
          onChange={(e) => setLinkDraft(e.target.value)}
          onBlur={commitLink}
        />
        <div className="media-or">или</div>
        <label className="media-upload">
          Загрузите файл
          <input
            type="file"
            accept="audio/*,video/*,image/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {url ? (
          <div className="media-link-row">
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onChange({ ...block, mediaUrl: undefined, mediaKind: undefined })}
            >
              Удалить ссылку
            </Button>
          </div>
        ) : null}
        {block.mediaFileName ? (
          <div className="media-link-row">
            <span>{block.mediaFileName}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onChange({
                  ...block,
                  mediaFileData: undefined,
                  mediaFileName: undefined,
                  mediaKind: undefined,
                })
              }
            >
              Удалить файл
            </Button>
          </div>
        ) : null}
        {url ? (
          <div className="media-qr-wrap">
            <img src={qrCodeUrl(url)} alt="QR-код" className="media-qr" width={160} height={160} />
            <span className="media-qr-caption">Сгенерировать QR</span>
          </div>
        ) : null}
      </div>
    )
  }

  if (!displayUrl && !url) {
    return (
      <div className="media-block empty">
        <span className="media-placeholder">Открой QR-код и…</span>
      </div>
    )
  }

  return (
    <div className="media-block">
      {url ? (
        <button type="button" className="media-qr-btn" onClick={() => setPlayerOpen(true)}>
          <img src={qrCodeUrl(url)} alt="QR-код" className="media-qr" width={160} height={160} />
        </button>
      ) : null}
      {block.mediaFileData ? (
        <button type="button" className="media-file-btn" onClick={() => setPlayerOpen(true)}>
          {block.mediaFileName ?? 'Медиафайл'}
        </button>
      ) : null}
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
