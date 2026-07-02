// lib/costCenter.js
// ⚠️ DEPRECATED — superseded by lib/clientType.js (single source of truth
// for CBRE/UPS client-type detection, styles and admin-hours policy).
// No components import this file anymore; it only re-exports for safety.
// Safe to delete once you have confirmed nothing references it.
import { deriveClientTypeFromDescription } from './clientType';

export const isCbreDescription = (description) =>
  deriveClientTypeFromDescription(description) === 'CBRE';
