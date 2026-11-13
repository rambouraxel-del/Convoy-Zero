import type { ResourceKey } from '../core/types';

export const ICON: Record<ResourceKey, string> = {
  fuel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h8l4 4v12H6z" fill="#d63b2c" stroke="#1d1612" stroke-width="1.6"/><rect x="13" y="1.5" width="4" height="3" fill="#555" stroke="#1d1612" stroke-width="1.2"/><path d="M9 9l6 7M15 9l-6 7" stroke="#ffd2c4" stroke-width="1.4"/></svg>',
  scrap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2 3 3.5-.8.6 3.5 3.1 1.8-1.6 3.2 1.6 3.2-3.1 1.8-.6 3.5L14 19l-2 3-2-3-3.5.8-.6-3.5-3.1-1.8L4.4 12 2.8 8.8l3.1-1.8.6-3.5L10 5z" fill="#b9bcc2" stroke="#1d1612" stroke-width="1.4"/><circle cx="12" cy="12" r="3.2" fill="#1d1612"/></svg>',
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="1.5" fill="#6f9a3a" stroke="#1d1612" stroke-width="1.6"/><path d="M3 12.5h18M12 6v13" stroke="#1d1612" stroke-width="1.4"/><rect x="8" y="3" width="8" height="3" fill="#a6d86a" stroke="#1d1612" stroke-width="1.2"/></svg>',
};

export const RES_NAME: Record<ResourceKey, string> = { fuel: 'Carburant', scrap: 'Ferraille', food: 'Provisions' };

export function resHtml(k: ResourceKey, v: number, extra = ''): string {
  return `<span class="res" title="${RES_NAME[k]}" data-res="${k}">${ICON[k]}<b>${v}</b>${extra}</span>`;
}
