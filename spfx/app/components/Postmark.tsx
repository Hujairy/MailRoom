/* eslint-disable */
import * as React from 'react';
import { useId } from 'react';
import { formatDateTime, formatDayMonth, formatTime } from '../lib/format';

/** A postal cancellation mark: wavy lines and a dated ring with the unit's name. */
export function Postmark({ unit, date }: { unit: string; date: string | null }) {
  const ringId = useId();
  const ring = `${unit} mail room  ·  received  ·  `.toUpperCase();
  return (
    <div className="postmark" role="img" aria-label={`Received ${formatDateTime(date)}`}>
      <svg viewBox="0 0 176 104" aria-hidden="true">
        <defs>
          <path id={ringId} d="M 124 52 m -38 0 a 38 38 0 1 1 76 0 a 38 38 0 1 1 -76 0" />
        </defs>
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M4 36 q8 -7 16 0 t16 0 t16 0 t16 0" strokeWidth="2.4" />
          <path d="M4 52 q8 -7 16 0 t16 0 t16 0 t16 0" strokeWidth="2.4" />
          <path d="M4 68 q8 -7 16 0 t16 0 t16 0 t16 0" strokeWidth="2.4" />
          <circle cx="124" cy="52" r="47" strokeWidth="2.6" />
          <circle cx="124" cy="52" r="29" strokeWidth="1.4" />
        </g>
        <text className="pm-ring" fill="currentColor">
          <textPath href={`#${ringId}`} startOffset="0" textLength={233} lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
        <text className="pm-day" x="124" y="53" textAnchor="middle" fill="currentColor">
          {formatDayMonth(date).toUpperCase()}
        </text>
        <text className="pm-time" x="124" y="67" textAnchor="middle" fill="currentColor">
          {formatTime(date)}
        </text>
      </svg>
    </div>
  );
}
