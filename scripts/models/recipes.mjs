// Per-model recipes for prep.mjs. forward = the model's own front axis; tire = regex of tyre material/primitive name;
// roles = material-name regexes the runtime maps onto paint / glass / lights etc.
export const RECIPES = {
  r34: { src: '1999_nissan_skyline_gt-r_v-spec_ii_r34.glb', forward: '-x', L: 4.60, tire: '^Tire1Mtl$', maxTris: 60000,
    roles: { paint: ['^Hood1Mtl$', '^Door1Mtl$', '^Door2Mtl$'], glass: ['^Glass1Mtl$'], head: ['^L[123]Mtl$'], tail: ['^R[23]Mtl$'] } },
};
