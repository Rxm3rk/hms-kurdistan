/**
 * DataTable: a plain, accessible HTML table with typed columns. Rows can be actionable (press or Enter opens
 * them), tinted by tone, and the selected row is marked. Columns align to the start by default; numbers align
 * to the end.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import type { Tone } from '../data/types.ts';
import { useT } from '../i18n/use-t.ts';
import { uiMessages } from './messages.ts';

export interface Column<T> {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: T) => ReactNode;
  readonly align?: 'start' | 'center' | 'end';
  /** CSS width, for example '8rem' or '20%'. */
  readonly width?: string;
  /** Keep the cell on one line (times, codes, money). */
  readonly nowrap?: boolean;
}

export interface DataTableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  /** The table's accessible name (visually hidden unless `showCaption`). */
  readonly caption: string;
  readonly showCaption?: boolean;
  /** Makes rows actionable: click, Enter or Space. */
  readonly onRowAction?: (row: T) => void;
  /** Tints a row: danger for critical, warning for overdue. */
  readonly rowTone?: (row: T) => Tone | undefined;
  /** The key of the selected row, marked with aria-selected and a stronger edge. */
  readonly selectedKey?: string | null;
  readonly emptyText?: ReactNode;
  readonly dense?: boolean;
  /** Keep the header visible while the table scrolls inside a fixed-height container. */
  readonly stickyHeader?: boolean;
  readonly className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  onRowAction,
  rowTone,
  selectedKey,
  emptyText,
  dense = false,
  stickyHeader = false,
  className,
}: DataTableProps<T>): ReactNode {
  const t = useT(uiMessages);
  const tableClass = ['ui-table', dense ? 'ui-table--dense' : '', stickyHeader ? 'ui-table--sticky' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const onKeyDown = (row: T) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (onRowAction !== undefined && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onRowAction(row);
    }
  };
  return (
    <div className="ui-table-wrap">
      <table className={tableClass}>
        <caption className={showCaption ? 'ui-table__caption' : 'hms-visually-hidden'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={`ui-table__th ui-align-${column.align ?? 'start'}`}
                style={column.width === undefined ? undefined : { inlineSize: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="ui-table__empty" colSpan={columns.length}>
                {emptyText ?? t('noRows')}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const tone = rowTone?.(row);
              const selected = selectedKey !== undefined && selectedKey !== null && selectedKey === key;
              const rowClass = [
                'ui-table__row',
                onRowAction === undefined ? '' : 'ui-table__row--action',
                tone === undefined ? '' : `ui-table__row--${tone}`,
                selected ? 'ui-table__row--selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <tr
                  key={key}
                  className={rowClass}
                  {...(onRowAction === undefined
                    ? {}
                    : {
                        tabIndex: 0,
                        onClick: () => {
                          onRowAction(row);
                        },
                        onKeyDown: onKeyDown(row),
                      })}
                  {...(selectedKey === undefined ? {} : { 'aria-selected': selected })}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={['ui-table__td', `ui-align-${column.align ?? 'start'}`, column.nowrap === true ? 'ui-nowrap' : '']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
