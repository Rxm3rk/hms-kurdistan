/**
 * The prototype's shared UI helpers. Screens import from here and never edit these files.
 *
 *   import { Card, PageHeader, StatTile, Badge, DataTable, Tabs, EmptyState, Button } from '../../ui/index.ts';
 *
 * The stylesheet (ui.css, tokens only, logical properties only) is imported once by this module.
 */
import './ui.css';

export { Icon, type IconName, type IconProps } from './icons.tsx';
export { Card, Grid, PageHeader, Section, Stack, Toolbar, cx, type CardProps, type GridProps, type PageHeaderProps, type StackProps } from './layout.tsx';
export { Badge, Dot, Tag, type BadgeProps } from './badge.tsx';
export {
  Button,
  IconButton,
  LinkButton,
  TextLink,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonProps,
  type LinkButtonProps,
} from './button.tsx';
export { Callout, EmptyState, type CalloutProps, type EmptyStateProps } from './feedback.tsx';
export { DataTable, type Column, type DataTableProps } from './data-table.tsx';
export { Tabs, type TabItem, type TabsProps } from './tabs.tsx';
export { StatTile, type StatTileProps } from './stat-tile.tsx';
export { BarChart, Meter, Sparkline, type BarChartProps, type BarDatum, type MeterProps, type SparklineProps } from './charts.tsx';
export { BloodPressure, Code, Money, PROTO_UNIT_DISPLAY_MAP, Qty, type MoneyProps, type QtyProps } from './quantity.tsx';
export {
  Checkbox,
  KeyValueList,
  SearchField,
  Segmented,
  SelectField,
  TextInput,
  type CheckboxProps,
  type KeyValueItem,
  type Option,
  type SearchFieldProps,
  type SegmentedProps,
  type SelectFieldProps,
  type TextInputProps,
} from './fields.tsx';
export { Avatar, PatientInline, PatientName, StaffName, initials, personName, staffName, type PatientInlineProps, type PatientNameProps } from './person.tsx';
export { ToastProvider, useToast, type ToastInput } from './toast.tsx';
export { Dialog, type DialogProps } from './dialog.tsx';
