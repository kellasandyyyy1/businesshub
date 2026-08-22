import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

import { db, putSetting } from '../db/db'

export const THEMES = ['system', 'light', 'dark']

/**
 * Mirrors the stored theme onto the document root. The tokens key off a
 * `.dark` or `.light` class; with neither, the OS preference decides.
 */
export function useThemeSync() {
  const theme = useLiveQuery(async () => {
    const row = await db.settings.where('key').equals('theme').first()
    return row?.value ?? 'system'
  }, [])

  useEffect(() => {
    if (!theme) return
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
  }, [theme])

  return theme ?? 'system'
}

export const setTheme = (value) => putSetting('theme', value)
