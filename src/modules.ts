import definitions from './modules.json';

export const MODULES = definitions;

export function resolveModule(requested: string | null): string {
  if (requested === null) return 'fetal-position';
  return requested === 'all' || MODULES.some(module => module.id === requested)
    ? requested
    : 'all';
}
