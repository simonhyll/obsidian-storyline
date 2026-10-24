/**
 * Scrivener import availability predicate.
 *
 * Thin production-owned module so that tests can import the real
 * availability check without pulling in the full command registration
 * (which requires FuzzySuggestModal from Obsidian).
 */

import { Platform } from 'obsidian';
import type { PluginTarget } from './plugin-target';

/**
 * Return whether the Scrivener import command should be offered.
 * Desktop-only: the importer relies on Node/Electron APIs unavailable on mobile.
 */
export function canImportScrivener(_p: PluginTarget, checking: boolean): boolean {
	if (Platform.isMobile) return false;
	if (!checking) {
		void import('../commands/scrivener-import').then(m => m.importScrivener(_p));
	}
	return true;
}
