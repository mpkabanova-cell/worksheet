import type { WorksheetBlock } from '@/data/worksheet'
import { MathEditableInput } from '@/components/MathEditableInput'
import { MathText } from '@/components/MathText'

interface GroupingViewProps {
  groups: NonNullable<WorksheetBlock['groups']>
  isEditing: boolean
  onChangeGroup?: (groupId: string, patch: { title?: string; items?: string[] }) => void
}

export function GroupingView({ groups, isEditing, onChangeGroup }: GroupingViewProps) {
  return (
    <div className="group-grid">
      {groups.map((group) => (
        <div key={group.id} className="group-card">
          {isEditing ? (
            <>
              <MathEditableInput
                className="group-title-input"
                value={group.title}
                placeholder="Название группы"
                showToolbar
                floatingToolbar
                onChange={(title) => onChangeGroup?.(group.id, { title })}
                onClick={(e) => e.stopPropagation()}
              />
              <ul className="group-items-edit">
                {(group.items ?? []).map((item, index) => (
                  <li key={`${group.id}-${index}`}>
                    <MathEditableInput
                      className="group-item-input"
                      value={item}
                      placeholder="Элемент"
                      showToolbar
                      floatingToolbar
                      onChange={(value) => {
                        const next = [...(group.items ?? [])]
                        next[index] = value
                        onChangeGroup?.(group.id, { items: next })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <strong>
                <MathText text={group.title || 'Название группы'} />
              </strong>
              <ul>
                {(group.items ?? []).map((item) => (
                  <li key={item}>
                    {item.trim() ? <MathText text={item} /> : 'Элемент'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
