import { NAV_LABELS, type NavId } from '@/data/worksheet'
import { Button } from '@/components/ui'
import './ComingSoon.css'

interface ComingSoonProps {
  navId: NavId
  onHome: () => void
}

export function ComingSoon({ navId, onHome }: ComingSoonProps) {
  return (
    <div className="coming-soon page-pad">
      <h1>{NAV_LABELS[navId]}</h1>
      <p>Раздел в разработке. Пока доступны рабочий стол и библиотека рабочих листов.</p>
      <Button variant="brand" onClick={onHome}>
        На рабочий стол
      </Button>
    </div>
  )
}
