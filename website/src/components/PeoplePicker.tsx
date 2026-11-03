import { useEffect, useId, useRef, useState } from 'react';
import type { Directory, Person } from '../data/types';
import { EMAIL_PATTERN } from '../data/rules';
import { initials } from '../lib/format';
import { CloseIcon } from './icons';

interface Props {
  directory: Directory;
  value: Person | null;
  onChange: (person: Person | null) => void;
  invalid?: boolean;
  describedBy?: string;
  inputId?: string;
}

/**
 * Finds a recipient by name. With no directory connected, it accepts a
 * typed email address instead.
 */
export function PeoplePicker({ directory, value, onChange, invalid, describedBy, inputId }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosenRef = useRef<HTMLButtonElement>(null);
  const justChose = useRef(false);

  // Keep focus inside the form after choosing, so Tab and Ctrl+Enter keep working.
  useEffect(() => {
    if (value && justChose.current) {
      justChose.current = false;
      chosenRef.current?.focus();
    }
  }, [value]);

  useEffect(() => {
    if (!directory.searchable || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await directory.search(query);
        if (!cancelled) {
          setResults(found);
          setActive(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, directory]);

  const typedEmail = EMAIL_PATTERN.test(query.trim()) ? query.trim().toLowerCase() : null;
  const options: Person[] = [...results];
  if (typedEmail && !results.some((r) => r.email === typedEmail)) {
    options.push({ name: typedEmail.replace(/@.*/, '').replace(/[._]/g, ' '), email: typedEmail });
  }

  function choose(person: Person) {
    justChose.current = true;
    onChange(person);
    setQuery('');
    setOpen(false);
  }

  if (value) {
    return (
      <div className="person-chosen" data-invalid={invalid || undefined}>
        <span className="person-avatar">{initials(value.name)}</span>
        <span className="person-text">
          <strong>{value.name}</strong>
          <span>
            {value.email}
            {value.department && <> — {value.department}</>}
          </span>
        </span>
        <button
          ref={chosenRef}
          type="button"
          className="icon-btn"
          aria-label={`Remove ${value.name}`}
          onClick={() => {
            onChange(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="people-picker">
      <input
        ref={inputRef}
        id={inputId}
        name="recipient"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={directory.searchable ? 'Search by name or email' : 'name@company.com'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (options.length > 0 || searching) && (
        <ul className="people-list" id={listId} role="listbox">
          {searching && options.length === 0 && <li className="people-searching">Searching…</li>}
          {options.map((p, i) => (
            <li
              key={p.email}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="person-avatar">{initials(p.name)}</span>
              <span className="person-text">
                <strong>{p.name}</strong>
                <span>
                  {p.email}
                  {p.department && <> — {p.department}</>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
