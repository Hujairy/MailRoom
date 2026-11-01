/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `auto` (default), `demo` or `sharepoint`. See README. */
  readonly VITE_DATA_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
