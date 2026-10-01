// SPDX-License-Identifier: MIT
import type { SitePreferences } from '../site/storage';
/** Proposed optional controls. The community page mounts them only after owner approval. */
export function AccessibilityControls({ preferences, onChange }: { preferences: SitePreferences; onChange: (next: SitePreferences) => void }) {
  return <details className="accessibility-options">
    <summary>Accessibility</summary>
    <label>Motion<select value={preferences.motion} onChange={event => onChange({ ...preferences, motion: event.target.value as SitePreferences['motion'] })}>
      <option value="device">Use device setting</option><option value="reduce">Reduce motion</option><option value="full">Full animation</option>
    </select></label>
    <label><input type="checkbox" checked={preferences.hidden} onChange={event => onChange({ ...preferences, hidden: event.target.checked })} /> Hide 3D dice</label>
    <label><input type="checkbox" checked={preferences.highContrast} onChange={event => onChange({ ...preferences, highContrast: event.target.checked })} /> High contrast</label>
    <label>Announce rolls<select value={preferences.announcements} onChange={event => onChange({ ...preferences, announcements: event.target.value as SitePreferences['announcements'] })}>
      <option value="all">All rolls</option><option value="mine">My rolls</option><option value="off">Off</option>
    </select></label>
  </details>;
}
