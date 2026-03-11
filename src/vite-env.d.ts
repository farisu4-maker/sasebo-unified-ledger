/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_SPREADSHEET_ID: string
  readonly VITE_GOOGLE_PROJECT_ID: string
  readonly VITE_GOOGLE_PRIVATE_KEY: string
  readonly VITE_GOOGLE_CLIENT_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
