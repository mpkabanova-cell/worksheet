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
        <div className="full-page ui-error-page">
          <h1>Не удалось показать рабочий лист</h1>
          <p className="ui-error-text">
            {this.state.error.message || 'Произошла ошибка отображения.'}
          </p>
          <div className="ui-error-actions">
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
