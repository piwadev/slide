// Map metadata (layout + scenery builders live in render/maps.js).
export const MAPS = {
  tokyo:      { id: 'tokyo', name: 'Tokyo City', short: 'TOKYO', level: 1, tod: 'night', desc: 'Neon-lit downtown streets, traffic and tight 90° corners.', color: '#ff2d95', pace: 17, discover: 4 },
  arena:      { id: 'arena', name: 'Drift Arena', short: 'ARENA', level: 2, tod: 'night', desc: 'A dedicated floodlit competition circuit with clipping zones.', color: '#ffb000', pace: 19, discover: 3 },
  industrial: { id: 'industrial', name: 'Industrial Zone', short: 'INDUSTRIAL', level: 3, tod: 'day', desc: 'Huge open lots, container islands and technical sections.', color: '#9aa7b5', pace: 20, discover: 4 },
  mountain:   { id: 'mountain', name: 'Mountain Pass', short: 'TOUGE', level: 5, tod: 'dusk', desc: 'Technical downhill touge with hairpins and guard rails.', color: '#ff8a3d', pace: 16, discover: 4 },
  harbor:     { id: 'harbor', name: 'Harbor', short: 'HARBOR', level: 8, tod: 'dusk', desc: 'Wide dockside roads and long, flowing drift corners.', color: '#3fb6c9', pace: 24, discover: 4 },
  desert:     { id: 'desert', name: 'Desert Highway', short: 'DESERT', level: 11, tod: 'day', desc: 'Endless high-speed sweepers under a blazing sun.', color: '#f2b560', pace: 34, discover: 4 },
};
export const MAP_IDS = Object.keys(MAPS);
export const TODS = ['day', 'dusk', 'night'];
