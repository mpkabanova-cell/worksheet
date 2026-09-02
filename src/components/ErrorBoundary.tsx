import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui'

interface ErrorBoundaryProps {
  children: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="full-page" style={{ padding: 24, gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Не удалось показать рабочий лист</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 560 }}>
            {this.state.error.message || 'Произошла ошибка отображения.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="brand"
              onClick={() => {
                this.setState({ error: null })
                this.props.onReset?.()
              }}
            >
              Попробовать снова
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Обновить страницу
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
