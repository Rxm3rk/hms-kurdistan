/**
 * Tabs on React Aria (arrow keys follow the reading direction). Controlled or uncontrolled.
 */
import type { Key, ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from 'react-aria-components';

export interface TabItem {
  readonly id: string;
  readonly label: ReactNode;
  /** A count or badge after the label. */
  readonly badge?: ReactNode;
  readonly content: ReactNode;
  readonly isDisabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  /** The tab list's accessible name. */
  readonly 'aria-label': string;
  readonly selectedKey?: string;
  readonly defaultSelectedKey?: string;
  readonly onSelectionChange?: (id: string) => void;
  readonly className?: string | undefined;
}

export function Tabs({ items, selectedKey, defaultSelectedKey, onSelectionChange, className, ...aria }: TabsProps): ReactNode {
  const disabledKeys = items.filter((item) => item.isDisabled === true).map((item) => item.id);
  return (
    <AriaTabs
      className={['ui-tabs', className ?? ''].filter(Boolean).join(' ')}
      disabledKeys={disabledKeys}
      {...(selectedKey === undefined ? {} : { selectedKey })}
      {...(defaultSelectedKey === undefined ? {} : { defaultSelectedKey })}
      {...(onSelectionChange === undefined
        ? {}
        : {
            onSelectionChange: (key: Key) => {
              onSelectionChange(String(key));
            },
          })}
    >
      <TabList className="ui-tabs__list" aria-label={aria['aria-label']}>
        {items.map((item) => (
          <Tab key={item.id} id={item.id} className="ui-tabs__tab">
            <span>{item.label}</span>
            {item.badge === undefined ? null : <span className="ui-tabs__badge">{item.badge}</span>}
          </Tab>
        ))}
      </TabList>
      {items.map((item) => (
        <TabPanel key={item.id} id={item.id} className="ui-tabs__panel">
          {item.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
