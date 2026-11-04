/* eslint-disable */
import * as React from 'react';
import type { MailItem } from '../data/types';
import { Segmented } from './Segmented';

export type Show = 'Waiting' | 'Received' | 'All';

interface Props {
  value: Show;
  onChange: (value: Show) => void;
  /** Items to count; omit to hide counts. */
  items?: MailItem[];
}

/** The "Received" filter: No / Yes / All. */
export function ReceivedFilter({ value, onChange, items }: Props) {
  const count = (s: Show) => (items ? (s === 'All' ? items.length : items.filter((i) => i.status === s).length) : undefined);
  return (
    <Segmented
      label="Received"
      value={value}
      onChange={onChange}
      options={[
        { value: 'Waiting', label: 'Not received', count: count('Waiting') },
        { value: 'Received', label: 'Received', count: count('Received') },
        { value: 'All', label: 'All', count: count('All') },
      ]}
    />
  );
}
