/**
 * The two work mode checkboxes that an old `remote` cell (yes / no / hybrid) stands for. Used once by Setup, when the
 * columns is_remote and is_hybrid are added to a sheet that already holds jobs.
 */
export function workModeFlags(remote: string): { is_remote: boolean; is_hybrid: boolean } {
  const value = remote.trim().toLowerCase();
  return { is_remote: value === 'yes', is_hybrid: value === 'hybrid' };
}
