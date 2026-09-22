import { useMemo } from 'react'
import './MarkdownPreview.css'

interface MarkdownBlock {
  type: 'code' | 'html' | 'hr' | 'h1' | 'h2' | 'h3' | 'p'
  content: string
}

function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const parts = source.split(/```/g)

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      blocks.push({ type: 'code', content: part.replace(/^\n/, '').replace(/\n$/, '') })
      return
    }

    const lines = part.split('\n')
    let paragraph: string[] = []

    const flushParagraph = () => {
      if (!paragraph.length) return
      const text = paragraph.join('\n')
      if (text.includes('<span class="ctx-') || text.includes('<div class="ctx-')) {
        blocks.push({ type: 'html', content: text })
      } else {
        blocks.push({ type: 'p', content: text })
      }
      paragraph = []
    }

    for (const line of lines) {
      if (line.trim() === '---') {
        flushParagraph()
        blocks.push({ type: 'hr', content: '' })
        continue
      }
      if (line.startsWith('### ')) {
        flushParagraph()
        blocks.push({ type: 'h3', content: line.slice(4) })
        continue
      }
      if (line.startsWith('## ')) {
        flushParagraph()
        blocks.push({ type: 'h2', content: line.slice(3) })
        continue
      }
      if (line.startsWith('# ')) {
        flushParagraph()
        blocks.push({ type: 'h1', content: line.slice(2) })
        continue
      }
      paragraph.push(line)
    }
    flushParagraph()
  })

  return blocks
}

function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown])

  return (
    <div className="markdown-preview">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h1':
            return <h1 key={index}>{block.content}</h1>
          case 'h2':
            return <h2 key={index}>{block.content}</h2>
          case 'h3':
            return <h3 key={index}>{block.content}</h3>
          case 'hr':
            return <hr key={index} />
          case 'code':
            return (
              <pre key={index} className="markdown-preview__code">
                <code>{block.content}</code>
              </pre>
            )
          case 'html':
            return (
              <div
                key={index}
                className="markdown-preview__html"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            )
          default:
            return (
              <p
                key={index}
                dangerouslySetInnerHTML={{ __html: renderInline(block.content) }}
              />
            )
        }
      })}
    </div>
  )
}
