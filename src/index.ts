/**
 * Host half of dsh-appearance. It does nothing on the server: the root row in
 * cordis.patch.yml only exists so DSH loads this bundle's web client.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-appearance'

export function apply(_ctx: Context): void {
  // Browser-only plugin; see ./client/index.tsx.
}
