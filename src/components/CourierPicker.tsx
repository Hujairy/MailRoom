import { useId, useState } from 'react';
import { COURIERS } from '../config';

interface Props {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Courier buttons for the usual companies, plus a text box for any other. */
export function CourierPicker({ value, onChange, invalid, describedBy }: Props) {
  const name = useId();
  const preset = COURIERS.find((c) => norm(c) === norm(value));
  const [other, setOther] = useState(!preset && value !== '');

  return (
    <fieldset className="field courier-picker" aria-invalid={invalid} aria-describedby={describedBy}>
      <legend className="field-label">Courier</legend>
      <div className="chips" role="presentation">
        {COURIERS.map((c) => (
          <label key={c} className="chip">
            <input
              type="radio"
              name={name}
              value={c}
              checked={!other && preset === c}
              onChange={() => {
                setOther(false);
                onChange(c);
              }}
            />
            <span>{c}</span>
          </label>
        ))}
        <label className="chip">
          <input
            type="radio"
            name={name}
            value="__other"
            checked={other}
            onChange={() => {
              setOther(true);
              onChange('');
            }}
          />
          <span>Other</span>
        </label>
      </div>
      {other && (
        <input
          className="other-courier"
          aria-label="Courier name"
          placeholder="Courier name"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </fieldset>
  );
}
