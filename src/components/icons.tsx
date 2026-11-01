import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const EnvelopeIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 6.5L20.5 7" /></svg>
);

export const BoxIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" /><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" /><path d="m7.8 5.5 8.4 4" /></svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);

export const ListIcon = (p: P) => (
  <svg {...base} {...p}><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.5" cy="6.5" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17.5" r="1" /></svg>
);

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" /></svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const RefreshIcon = (p: P) => (
  <svg {...base} {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
);

export const ScanIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>
);

export const UndoIcon = (p: P) => (
  <svg {...base} {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
);

export const PencilIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
);
