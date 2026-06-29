// Central synth parameter state.
//
// `S` is the active instrument's params object, owned by the project store
// (src/store.js, Architecture E1). Reading `S.cutoff` is unchanged; writes
// should route through `store.set(...)` so they're recorded (undo) and
// serializable. The store applies loads/undo in place, so this reference stays
// valid for the life of the page.

import { store } from './store.js';

export const S = store.params();
