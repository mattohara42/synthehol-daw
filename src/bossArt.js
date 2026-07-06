// SVG rack-unit face illustrations for Act I bosses.
// viewBox="0 0 140 110", stroke="currentColor", fill="none" by default.
// Each SVG uses module-specific motifs; inherits color from CSS context.

export const BOSS_SVG = {

  // Vox Corruptus — Oscillator boss
  // Knob-eyes, sawtooth-wave mouth, VU-meter brow, patch-cable legs
  osc: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- VU-meter brow strip -->
  <rect x="22" y="20" width="96" height="10" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="25" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.7"/>
  <rect x="35" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.6"/>
  <rect x="45" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.5"/>
  <rect x="55" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.4"/>
  <rect x="65" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.3"/>
  <rect x="75" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.2"/>
  <rect x="85" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.15"/>
  <rect x="95" y="22" width="8" height="6" rx="0.5" fill="currentColor" opacity="0.1"/>
  <!-- Left knob-eye -->
  <circle cx="44" cy="52" r="13" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="44" cy="52" r="9" fill="#222" stroke-width="1"/>
  <circle cx="44" cy="52" r="5" fill="currentColor" opacity="0.9"/>
  <circle cx="46" cy="50" r="1.5" fill="#fff" opacity="0.5"/>
  <!-- Right knob-eye -->
  <circle cx="96" cy="52" r="13" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="96" cy="52" r="9" fill="#222" stroke-width="1"/>
  <circle cx="96" cy="52" r="5" fill="currentColor" opacity="0.9"/>
  <circle cx="98" cy="50" r="1.5" fill="#fff" opacity="0.5"/>
  <!-- Knob tick marks -->
  <line x1="44" y1="37" x2="44" y2="40" stroke-width="1.5"/>
  <line x1="96" y1="37" x2="96" y2="40" stroke-width="1.5"/>
  <!-- Sawtooth mouth -->
  <polyline points="30,76 45,67 45,76 60,67 60,76 75,67 75,76 90,67 90,76 110,76" stroke-width="2" stroke="currentColor"/>
  <!-- Patch cable connectors -->
  <circle cx="36" cy="92" r="4" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="36" cy="92" r="2" fill="currentColor" opacity="0.7"/>
  <circle cx="70" cy="92" r="4" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="70" cy="92" r="2" fill="currentColor" opacity="0.7"/>
  <circle cx="104" cy="92" r="4" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="104" cy="92" r="2" fill="currentColor" opacity="0.7"/>
</svg>`,

  // The Muffled — Filter boss
  // Slider-eyes (one nearly closed), constrained bandpass-curve mouth,
  // steep filter-slope eyebrows, noise stipple on body
  filter: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Noise stipple texture (static/darkness) -->
  <circle cx="25" cy="20" r="0.8" fill="currentColor" opacity="0.2"/>
  <circle cx="32" cy="24" r="0.8" fill="currentColor" opacity="0.15"/>
  <circle cx="108" cy="19" r="0.8" fill="currentColor" opacity="0.2"/>
  <circle cx="115" cy="25" r="0.8" fill="currentColor" opacity="0.15"/>
  <circle cx="119" cy="18" r="0.8" fill="currentColor" opacity="0.1"/>
  <!-- Filter-slope eyebrows (steep roll-off arcs) -->
  <path d="M22,38 Q36,24 52,36" stroke-width="2" stroke="currentColor"/>
  <path d="M88,36 Q104,24 118,38" stroke-width="2" stroke="currentColor"/>
  <!-- Left slider-eye (nearly closed — low cutoff) -->
  <rect x="32" y="44" width="36" height="16" rx="8" fill="#1a1a1a" stroke-width="1.5"/>
  <rect x="34" y="46" width="10" height="12" rx="6" fill="currentColor" opacity="0.85"/>
  <circle cx="39" cy="52" r="3" fill="#fff" opacity="0.2"/>
  <!-- Right slider-eye (open) -->
  <rect x="72" y="44" width="36" height="16" rx="8" fill="#1a1a1a" stroke-width="1.5"/>
  <rect x="94" y="46" width="10" height="12" rx="6" fill="currentColor" opacity="0.85"/>
  <circle cx="99" cy="52" r="3" fill="#fff" opacity="0.2"/>
  <!-- Constrained bandpass mouth (narrow bell curve, squeezed) -->
  <path d="M28,84 Q50,84 60,72 Q70,84 112,84" stroke-width="2" stroke="currentColor"/>
  <!-- Frequency label markings -->
  <line x1="34" y1="87" x2="34" y2="90" stroke-width="1" opacity="0.4"/>
  <line x1="70" y1="87" x2="70" y2="90" stroke-width="1" opacity="0.4"/>
  <line x1="106" y1="87" x2="106" y2="90" stroke-width="1" opacity="0.4"/>
  <!-- Screws in corners -->
  <circle cx="22" cy="22" r="2.5" fill="#1a1a1a" stroke-width="1"/>
  <line x1="20.2" y1="20.2" x2="23.8" y2="23.8" stroke-width="0.8"/>
  <circle cx="118" cy="22" r="2.5" fill="#1a1a1a" stroke-width="1"/>
  <line x1="116.2" y1="20.2" x2="119.8" y2="23.8" stroke-width="0.8"/>
</svg>`,

  // Dronekeeper — Envelope boss
  // ADSR-curve mouth with long flat sustain, attack/release knob-eyes set to max,
  // decay arc across brow
  envelope: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Slow decay brow arc (drooping) -->
  <path d="M22,30 Q70,18 118,30" stroke-width="1.5" stroke="currentColor" opacity="0.7"/>
  <!-- Left eye — attack knob (slow = tick mark at far left) -->
  <circle cx="44" cy="52" r="13" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="44" cy="52" r="9" fill="#222" stroke-width="1"/>
  <circle cx="44" cy="52" r="5" fill="currentColor" opacity="0.85"/>
  <!-- tick at 7 o'clock (max slow) -->
  <line x1="37.5" y1="58" x2="40" y2="55.5" stroke-width="1.5"/>
  <circle cx="46" cy="50" r="1.5" fill="#fff" opacity="0.3"/>
  <!-- Right eye — release knob (slow = tick at 5 o'clock) -->
  <circle cx="96" cy="52" r="13" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="96" cy="52" r="9" fill="#222" stroke-width="1"/>
  <circle cx="96" cy="52" r="5" fill="currentColor" opacity="0.85"/>
  <!-- tick at 5 o'clock -->
  <line x1="102.5" y1="58" x2="100" y2="55.5" stroke-width="1.5"/>
  <circle cx="98" cy="50" r="1.5" fill="#fff" opacity="0.3"/>
  <!-- ADSR mouth: very slow attack, slow decay, long sustain, very slow release -->
  <polyline points="24,82 38,68 48,74 90,74 110,82" stroke-width="2" stroke="currentColor"/>
  <!-- ADSR labels -->
  <text x="29" y="90" font-size="5" fill="currentColor" opacity="0.5" font-family="monospace">A</text>
  <text x="41" y="90" font-size="5" fill="currentColor" opacity="0.5" font-family="monospace">D</text>
  <text x="60" y="90" font-size="5" fill="currentColor" opacity="0.5" font-family="monospace">S</text>
  <text x="97" y="90" font-size="5" fill="currentColor" opacity="0.5" font-family="monospace">R</text>
</svg>`,

  // The Still — LFO boss
  // Frozen sine-wave eyes (flat lines), horizontal flatline mouth, limp antennas
  lfo: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Limp antennas (should oscillate, but hang down) -->
  <path d="M46,8 Q44,4 42,0" stroke-width="1.5" opacity="0.6"/>
  <circle cx="42" cy="0" r="2" fill="currentColor" opacity="0.5"/>
  <path d="M94,8 Q96,4 98,0" stroke-width="1.5" opacity="0.6"/>
  <circle cx="98" cy="0" r="2" fill="currentColor" opacity="0.5"/>
  <!-- Left eye — frozen sine wave (flat, the wave is stilled) -->
  <rect x="26" y="42" width="42" height="18" rx="9" fill="#1a1a1a" stroke-width="1.5"/>
  <!-- Ghost of a sine (drawn but flat = frozen) -->
  <line x1="30" y1="51" x2="64" y2="51" stroke-width="1" opacity="0.3"/>
  <!-- The intended wave, dead flat -->
  <polyline points="30,51 35,51 36,51 37,51 38,51 39,51 40,51 41,51 42,51 43,51 44,51 45,51 46,51 47,51 48,51 49,51 50,51 51,51 52,51 53,51 54,51 55,51 56,51 57,51 58,51 59,51 60,51 61,51 62,51 63,51 64,51" stroke-width="2"/>
  <circle cx="30" cy="51" r="1.5" fill="currentColor"/>
  <circle cx="64" cy="51" r="1.5" fill="currentColor"/>
  <!-- Right eye — frozen sine wave -->
  <rect x="72" y="42" width="42" height="18" rx="9" fill="#1a1a1a" stroke-width="1.5"/>
  <line x1="76" y1="51" x2="110" y2="51" stroke-width="1" opacity="0.3"/>
  <polyline points="76,51 77,51 78,51 79,51 80,51 81,51 82,51 83,51 84,51 85,51 86,51 87,51 88,51 89,51 90,51 91,51 92,51 93,51 94,51 95,51 96,51 97,51 98,51 99,51 100,51 101,51 102,51 103,51 104,51 105,51 106,51 107,51 108,51 109,51 110,51" stroke-width="2"/>
  <circle cx="76" cy="51" r="1.5" fill="currentColor"/>
  <circle cx="110" cy="51" r="1.5" fill="currentColor"/>
  <!-- Flatline mouth -->
  <line x1="30" y1="76" x2="110" y2="76" stroke-width="2.5"/>
  <!-- Small flatline dots -->
  <circle cx="30" cy="76" r="2" fill="currentColor"/>
  <circle cx="110" cy="76" r="2" fill="currentColor"/>
  <!-- Hz label (very low frequency, barely moving) -->
  <text x="56" y="90" font-size="6" fill="currentColor" opacity="0.4" font-family="monospace">0.0 Hz</text>
</svg>`,

  noise: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Static-filled eyes: pure noise, no shape -->
  <rect x="26" y="40" width="38" height="20" rx="3" fill="#1a1a1a" stroke-width="1.5"/>
  <polyline points="28,50 31,44 33,56 35,46 37,54 39,42 41,57 43,47 45,53 47,45 49,55 51,43 53,56 55,48 57,52 59,44 61,55 63,50" stroke-width="1.2"/>
  <rect x="76" y="40" width="38" height="20" rx="3" fill="#1a1a1a" stroke-width="1.5"/>
  <polyline points="78,50 80,45 82,55 84,43 86,56 88,47 90,53 92,42 94,57 96,46 98,54 100,44 102,56 104,48 106,52 108,45 110,55 112,49" stroke-width="1.2"/>
  <!-- Jagged, formless mouth -->
  <polyline points="30,78 38,72 46,80 54,71 62,79 70,73 78,80 86,71 94,79 102,73 110,78" stroke-width="2"/>
  <text x="50" y="93" font-size="6" fill="currentColor" opacity="0.4" font-family="monospace">~ STATIC ~</text>
</svg>`,

  osc2: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Twin oscillator eyes, locked in sterile unison (overlaid, no beating) -->
  <rect x="26" y="40" width="38" height="20" rx="9" fill="#1a1a1a" stroke-width="1.5"/>
  <path d="M28,50 Q33,42 38,50 T48,50 T58,50" stroke-width="1.5"/>
  <path d="M28,50 Q33,42 38,50 T48,50 T58,50" stroke-width="1.2" opacity="0.5"/>
  <rect x="76" y="40" width="38" height="20" rx="9" fill="#1a1a1a" stroke-width="1.5"/>
  <path d="M78,50 Q83,42 88,50 T98,50 T108,50" stroke-width="1.5"/>
  <path d="M78,50 Q83,42 88,50 T98,50 T108,50" stroke-width="1.2" opacity="0.5"/>
  <!-- Doubled mouth, perfectly aligned -->
  <line x1="32" y1="77" x2="108" y2="77" stroke-width="2"/>
  <line x1="32" y1="80" x2="108" y2="80" stroke-width="1.2" opacity="0.5"/>
  <text x="48" y="93" font-size="6" fill="currentColor" opacity="0.4" font-family="monospace">UNISON 0¢</text>
</svg>`,

  // The Mimic — capstone boss (Prophet-5 patch memory)
  // A bank of numbered memory buttons for a brow, diamond "reflecting" eyes,
  // a mouth that shifts from smooth curve to jagged mid-way (it can become
  // any waveform), and a strip of piano keys for a chin.
  mimic: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Patch-memory button bank -->
  <rect x="24" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="36" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="48" y="20" width="9" height="8" rx="1" fill="currentColor" opacity="0.5"/>
  <rect x="60" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="72" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="84" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="96" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <rect x="108" y="20" width="9" height="8" rx="1" fill="#1a1a1a" stroke-width="0.8"/>
  <!-- Diamond "reflecting" eyes -->
  <path d="M44,38 L54,48 L44,58 L34,48 Z" fill="#1a1a1a" stroke-width="1.5"/>
  <path d="M44,42 L50,48 L44,54 L38,48 Z" fill="currentColor" opacity="0.8"/>
  <path d="M96,38 L106,48 L96,58 L86,48 Z" fill="#1a1a1a" stroke-width="1.5"/>
  <path d="M96,42 L102,48 L96,54 L90,48 Z" fill="currentColor" opacity="0.8"/>
  <!-- Mouth: smooth curve morphing into a jagged wave -->
  <path d="M28,76 Q38,68 48,76 T68,76" stroke-width="2"/>
  <polyline points="68,76 76,68 76,76 86,68 86,76 96,68 96,76 112,76" stroke-width="2"/>
  <!-- Piano-key chin -->
  <rect x="30" y="90" width="80" height="7" rx="1" fill="#1a1a1a" stroke-width="1"/>
  <line x1="40" y1="90" x2="40" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="50" y1="90" x2="50" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="60" y1="90" x2="60" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="70" y1="90" x2="70" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="80" y1="90" x2="80" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="90" y1="90" x2="90" y2="97" stroke-width="0.8" opacity="0.6"/>
  <line x1="100" y1="90" x2="100" y2="97" stroke-width="0.8" opacity="0.6"/>
</svg>`,

  // The Predictable — post-graduation bonus-challenge boss (D1), corrupted
  // Buchla Source of Uncertainty. Grid/lookup-table eyes (every value
  // already known, the opposite of "frozen" — it's over-determined, not
  // dead) and a rigid staircase mouth (quantized steps, no true randomness).
  'lfo-sh': `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Left eye — a fixed lookup-table grid, every cell already filled in -->
  <rect x="26" y="38" width="36" height="24" rx="2" fill="#1a1a1a" stroke-width="1.5"/>
  <rect x="30" y="42" width="6" height="6" fill="currentColor" opacity="0.8"/>
  <rect x="38" y="42" width="6" height="6" fill="currentColor" opacity="0.5"/>
  <rect x="46" y="42" width="6" height="6" fill="currentColor" opacity="0.7"/>
  <rect x="30" y="50" width="6" height="6" fill="currentColor" opacity="0.4"/>
  <rect x="38" y="50" width="6" height="6" fill="currentColor" opacity="0.8"/>
  <rect x="46" y="50" width="6" height="6" fill="currentColor" opacity="0.5"/>
  <!-- Right eye — same fixed grid -->
  <rect x="78" y="38" width="36" height="24" rx="2" fill="#1a1a1a" stroke-width="1.5"/>
  <rect x="82" y="42" width="6" height="6" fill="currentColor" opacity="0.6"/>
  <rect x="90" y="42" width="6" height="6" fill="currentColor" opacity="0.8"/>
  <rect x="98" y="42" width="6" height="6" fill="currentColor" opacity="0.4"/>
  <rect x="82" y="50" width="6" height="6" fill="currentColor" opacity="0.7"/>
  <rect x="90" y="50" width="6" height="6" fill="currentColor" opacity="0.5"/>
  <rect x="98" y="50" width="6" height="6" fill="currentColor" opacity="0.8"/>
  <!-- Rigid staircase mouth — quantized, never in-between -->
  <polyline points="26,84 26,80 40,80 40,74 54,74 54,86 68,86 68,72 82,72 82,82 96,82 96,76 110,76 110,84 114,84" stroke-width="2"/>
  <text x="38" y="97" font-size="6" fill="currentColor" opacity="0.4" font-family="monospace">KNOWN VALUE</text>
</svg>`,

  // The Solitary — post-graduation bonus-challenge boss (D1), corrupted
  // Roland CE-1 Chorus Ensemble. A single narrow eye where a doubled pair
  // should be (only one voice left), and a mouth that's a single flat line
  // instead of the two offset, swirling lines a chorused signal would draw.
  chorus: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- A ghost outline of the second eye it should have, empty -->
  <rect x="26" y="42" width="30" height="18" rx="9" stroke-width="1" opacity="0.25" stroke-dasharray="2 3"/>
  <!-- The one remaining eye, narrow and alone, centered -->
  <rect x="55" y="40" width="30" height="20" rx="10" fill="#1a1a1a" stroke-width="1.5"/>
  <circle cx="70" cy="50" r="5" fill="currentColor" opacity="0.85"/>
  <!-- A ghost outline of a matching offset eye on the other side too -->
  <rect x="84" y="42" width="30" height="18" rx="9" stroke-width="1" opacity="0.25" stroke-dasharray="2 3"/>
  <!-- Single flat mouth (a chorused mouth would be two offset, swirling lines) -->
  <path d="M32,80 Q70,80 108,80" stroke-width="2.5"/>
  <text x="42" y="94" font-size="6" fill="currentColor" opacity="0.4" font-family="monospace">ONE VOICE</text>
</svg>`,
};
