// Per-model recipes for prep.mjs. forward = the model's own front axis; tire = regex of tyre material/primitive name;
// roles = material-name regexes the runtime maps onto paint / glass / lights etc.
export const RECIPES = {
  r34: { src: '1999_nissan_skyline_gt-r_v-spec_ii_r34.glb', forward: '-x', L: 4.60, tire: '^Tire1Mtl$', maxTris: 60000,
    roles: { paint: ['^Hood1Mtl$', '^Door1Mtl$', '^Door2Mtl$'], glass: ['^Glass1Mtl$'], head: ['^L[123]Mtl$'], tail: ['^R[23]Mtl$'] } },
  a80: { src: 'tfg_mk4.glb', forward: '-z', L: 4.51, tire: '^Tire$', maxTris: 60000,
    roles: { paint: ['^Paint$'], glass: ['^Windows$'], head: ['^White_Lights$'], tail: ['^Red_Lights$'] } },
  s13: { src: 'pp_180mx.glb', forward: '+z', L: 4.52, tireNodes: '^Cylinder(\\.00[125])?$', maxTris: 60000, cutR: 1.04,
    roles: { paint: ['^Body\\.001$'], glass: ['^Windows$'], head: ['^Headlights$'], tail: ['^Brakelights\\.001$'] } },
  ae86: { src: 'pp_ae86.glb', forward: '+z', L: 4.15, tireNodes: '^Wheel', maxTris: 60000, cutR: 1.04,
    texSplit: { material: '^Body$', rest: 'Trim', rules: [
      { name: 'Paint', test: (r, g, b) => r > 232 && g > 232 && b > 232 },
      { name: 'Glass', flat: [0.05, 0.08, 0.1, 1], test: (r, g, b) => b > 200 && r < 190 },
    ] },
    roles: { paint: ['^Paint$'], glass: ['^Glass$'] } },
};
