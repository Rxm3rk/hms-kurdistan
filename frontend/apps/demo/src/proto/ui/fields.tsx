/**
 * Form and display fields on React Aria: SearchField, TextInput (one line or multi-line), SelectField,
 * Segmented (a small radio group shown as joined buttons), Checkbox and KeyValueList (a description list).
 * Every field has a visible label unless `hideLabel` is set (the label is then still read aloud).
 */
import type { Key, ReactNode } from 'react';
import {
  Button as AriaButton,
  Checkbox as AriaCheckbox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Radio,
  RadioGroup,
  SearchField as AriaSearchField,
  Select,
  SelectValue,
  TextArea,
  TextField,
} from 'react-aria-components';
import { useT } from '../i18n/use-t.ts';
import { Icon } from './icons.tsx';
import { uiMessages } from './messages.ts';

function labelClass(hide: boolean): string {
  return hide ? 'hms-visually-hidden' : 'ui-field__label';
}

export interface SearchFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly hideLabel?: boolean;
  readonly autoFocus?: boolean;
  readonly className?: string | undefined;
}

export function SearchField({ label, value, onChange, placeholder, hideLabel = false, autoFocus = false, className }: SearchFieldProps): ReactNode {
  const t = useT(uiMessages);
  return (
    <AriaSearchField
      className={['ui-field', 'ui-search', className ?? ''].filter(Boolean).join(' ')}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
    >
      <Label className={labelClass(hideLabel)}>{label}</Label>
      <div className="ui-search__box">
        <Icon name="search" className="ui-search__icon" />
        <Input className="ui-input ui-search__input" {...(placeholder === undefined ? {} : { placeholder })} />
        {value === '' ? null : (
          <AriaButton className="ui-search__clear" aria-label={t('clearSearch')}>
            <Icon name="x" size="1em" />
          </AriaButton>
        )}
      </div>
    </AriaSearchField>
  );
}

export interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly description?: string;
  readonly multiline?: boolean;
  readonly isRequired?: boolean;
  readonly isDisabled?: boolean;
  readonly hideLabel?: boolean;
  /** Text direction of the value: `ltr` for numbers, codes, phone numbers and Latin names. */
  readonly dir?: 'ltr' | 'rtl' | 'auto';
  readonly inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'search';
  readonly className?: string | undefined;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  description,
  multiline = false,
  isRequired = false,
  isDisabled = false,
  hideLabel = false,
  dir,
  inputMode,
  className,
}: TextInputProps): ReactNode {
  const inputProps = {
    className: multiline ? 'ui-input ui-input--multiline' : 'ui-input',
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(dir === undefined ? {} : { dir }),
    ...(inputMode === undefined ? {} : { inputMode }),
  };
  return (
    <TextField
      className={['ui-field', className ?? ''].filter(Boolean).join(' ')}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
    >
      <Label className={labelClass(hideLabel)}>{label}</Label>
      {multiline ? <TextArea {...inputProps} rows={3} /> : <Input {...inputProps} />}
      {description === undefined ? null : <span className="ui-field__description">{description}</span>}
    </TextField>
  );
}

export interface Option {
  readonly id: string;
  readonly label: string;
}

export interface SelectFieldProps {
  readonly label: string;
  readonly options: readonly Option[];
  readonly selectedKey: string | null;
  readonly onSelectionChange: (id: string) => void;
  readonly placeholder?: string;
  readonly hideLabel?: boolean;
  readonly isDisabled?: boolean;
  readonly className?: string | undefined;
}

export function SelectField({
  label,
  options,
  selectedKey,
  onSelectionChange,
  placeholder,
  hideLabel = false,
  isDisabled = false,
  className,
}: SelectFieldProps): ReactNode {
  const t = useT(uiMessages);
  return (
    <Select
      className={['ui-field', 'ui-select', className ?? ''].filter(Boolean).join(' ')}
      selectedKey={selectedKey}
      onSelectionChange={(key: Key | null) => {
        if (key !== null) {
          onSelectionChange(String(key));
        }
      }}
      isDisabled={isDisabled}
      placeholder={placeholder ?? t('selectPlaceholder')}
    >
      <Label className={labelClass(hideLabel)}>{label}</Label>
      <AriaButton className="ui-select__button">
        <SelectValue className="ui-select__value" />
        <Icon name="chevron-down" size="1em" />
      </AriaButton>
      <Popover className="ui-popover" placement="bottom start">
        <ListBox className="ui-listbox" items={options}>
          {(option) => (
            <ListBoxItem id={option.id} className="ui-listbox__item" textValue={option.label}>
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

export interface SegmentedProps {
  readonly label: string;
  readonly options: readonly Option[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly hideLabel?: boolean;
  readonly className?: string | undefined;
}

/** A small set of mutually exclusive choices (filters, views): a radio group drawn as joined buttons. */
export function Segmented({ label, options, value, onChange, hideLabel = false, className }: SegmentedProps): ReactNode {
  return (
    <RadioGroup
      className={['ui-segmented', className ?? ''].filter(Boolean).join(' ')}
      orientation="horizontal"
      value={value}
      onChange={onChange}
    >
      <Label className={labelClass(hideLabel)}>{label}</Label>
      <div className="ui-segmented__options">
        {options.map((option) => (
          <Radio key={option.id} value={option.id} className="ui-segmented__option">
            {option.label}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

export interface CheckboxProps {
  readonly isSelected: boolean;
  readonly onChange: (selected: boolean) => void;
  readonly isDisabled?: boolean;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Checkbox({ isSelected, onChange, isDisabled = false, className, children }: CheckboxProps): ReactNode {
  return (
    <AriaCheckbox
      className={['ui-checkbox', className ?? ''].filter(Boolean).join(' ')}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
    >
      <span className="ui-checkbox__box" aria-hidden="true">
        <Icon name="check" size="0.9em" />
      </span>
      <span>{children}</span>
    </AriaCheckbox>
  );
}

export interface KeyValueItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
}

/** Label and value pairs (patient details, specimen details) as a description list. */
export function KeyValueList({ items, columns = 2, className }: { readonly items: readonly KeyValueItem[]; readonly columns?: 1 | 2 | 3; readonly className?: string | undefined }): ReactNode {
  return (
    <dl className={['ui-kv', `ui-kv--cols-${String(columns)}`, className ?? ''].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <div key={item.id} className="ui-kv__item">
          <dt className="ui-kv__label">{item.label}</dt>
          <dd className="ui-kv__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
