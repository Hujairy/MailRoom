import { useId } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

/** A row of mutually exclusive choices (radio group styled as segments). */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: Props<T>) {
  const name = useId();
  return (
    <fieldset className={`segmented segmented-${size}`}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="segment">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            {o.label}
            {o.count !== undefined && <span className="segment-count">{o.count}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
