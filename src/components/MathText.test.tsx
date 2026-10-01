import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MathText } from './MathText'

describe('MathText', () => {
  it('renders markdown bold without showing asterisks', () => {
    render(<MathText text="Котёнок спит на мягком **коврике**." />)
    expect(screen.getByText('коврике').tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*коврике\*\*/)).toBeNull()
  })
})
