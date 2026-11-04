/* eslint-disable */
import * as React from 'react';
import type { ReactNode } from 'react';
import { RefreshIcon } from './icons';

interface Props {
  title: string;
  text?: string;
  loading?: boolean;
  onRefresh?: () => void;
  children?: ReactNode;
}

export function PageHead({ title, text, loading, onRefresh, children }: Props) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1 className="page-title">{title}</h1>
        {text && <p className="page-text">{text}</p>}
      </div>
      <div className="page-head-tools">
        {children}
        {onRefresh && (
          <button type="button" className="icon-btn" aria-label="Refresh" title="Refresh" disabled={loading} onClick={onRefresh}>
            <RefreshIcon className={loading ? 'spin' : undefined} />
          </button>
        )}
      </div>
    </header>
  );
}
