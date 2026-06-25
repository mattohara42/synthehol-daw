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

  // The Static — Noise boss
  // Static-filled eyes (dot grid), erratic vertical-line mouth, noise-spray halo
  noise: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="10" y="8" width="120" height="94" rx="4" stroke-width="1.5" fill="#111" stroke="currentColor"/>
  <rect x="16" y="14" width="108" height="82" rx="2" stroke-width="1" stroke="currentColor" opacity="0.4"/>
  <!-- Noise-spray halo — scattered dots around head border -->
  <circle cx="8" cy="22" r="1" fill="currentColor" opacity="0.5"/>
  <circle cx="5" cy="35" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="7" cy="50" r="1.2" fill="currentColor" opacity="0.3"/>
  <circle cx="6" cy="65" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="132" cy="20" r="1" fill="currentColor" opacity="0.5"/>
  <circle cx="135" cy="38" r="0.8" fill="currentColor" opacity="0.3"/>
  <circle cx="133" cy="55" r="1.2" fill="currentColor" opacity="0.4"/>
  <circle cx="134" cy="72" r="0.8" fill="currentColor" opacity="0.3"/>
  <circle cx="22" cy="6" r="1" fill="currentColor" opacity="0.4"/>
  <circle cx="40" cy="5" r="0.8" fill="currentColor" opacity="0.3"/>
  <circle cx="70" cy="4" r="1" fill="currentColor" opacity="0.5"/>
  <circle cx="100" cy="5" r="0.8" fill="currentColor" opacity="0.3"/>
  <circle cx="118" cy="6" r="1" fill="currentColor" opacity="0.4"/>
  <!-- Left eye — static dot grid in rounded rect -->
  <rect x="26" y="38" width="38" height="28" rx="4" fill="#1a1a1a" stroke-width="1.5"/>
  <!-- Static dots filling left eye -->
  <circle cx="32" cy="44" r="1.2" fill="currentColor" opacity="0.8"/>
  <circle cx="38" cy="44" r="0.8" fill="currentColor" opacity="0.5"/>
  <circle cx="44" cy="44" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="50" cy="44" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="56" cy="44" r="1" fill="currentColor" opacity="0.7"/>
  <circle cx="32" cy="50" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="38" cy="50" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="44" cy="50" r="0.8" fill="currentColor" opacity="0.5"/>
  <circle cx="50" cy="50" r="1.2" fill="currentColor" opacity="0.8"/>
  <circle cx="56" cy="50" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="32" cy="56" r="1" fill="currentColor" opacity="0.7"/>
  <circle cx="38" cy="56" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="44" cy="56" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="50" cy="56" r="0.8" fill="currentColor" opacity="0.6"/>
  <circle cx="56" cy="56" r="1" fill="currentColor" opacity="0.8"/>
  <!-- Right eye — static dot grid in rounded rect -->
  <rect x="76" y="38" width="38" height="28" rx="4" fill="#1a1a1a" stroke-width="1.5"/>
  <!-- Static dots filling right eye -->
  <circle cx="82" cy="44" r="0.8" fill="currentColor" opacity="0.5"/>
  <circle cx="88" cy="44" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="94" cy="44" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="100" cy="44" r="1.2" fill="currentColor" opacity="0.8"/>
  <circle cx="106" cy="44" r="0.8" fill="currentColor" opacity="0.6"/>
  <circle cx="82" cy="50" r="1.2" fill="currentColor" opacity="0.8"/>
  <circle cx="88" cy="50" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="94" cy="50" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="100" cy="50" r="0.8" fill="currentColor" opacity="0.5"/>
  <circle cx="106" cy="50" r="1" fill="currentColor" opacity="0.7"/>
  <circle cx="82" cy="56" r="0.8" fill="currentColor" opacity="0.4"/>
  <circle cx="88" cy="56" r="1" fill="currentColor" opacity="0.7"/>
  <circle cx="94" cy="56" r="0.8" fill="currentColor" opacity="0.5"/>
  <circle cx="100" cy="56" r="1.2" fill="currentColor" opacity="0.9"/>
  <circle cx="106" cy="56" r="0.8" fill="currentColor" opacity="0.4"/>
  <!-- Erratic vertical-line mouth (static waveform) -->
  <line x1="26" y1="80" x2="26" y2="72" stroke-width="1.5" opacity="0.9"/>
  <line x1="31" y1="80" x2="31" y2="76" stroke-width="1.5" opacity="0.6"/>
  <line x1="36" y1="80" x2="36" y2="68" stroke-width="1.5" opacity="0.9"/>
  <line x1="41" y1="80" x2="41" y2="74" stroke-width="1.5" opacity="0.7"/>
  <line x1="46" y1="80" x2="46" y2="70" stroke-width="1.5" opacity="0.8"/>
  <line x1="51" y1="80" x2="51" y2="77" stroke-width="1.5" opacity="0.5"/>
  <line x1="56" y1="80" x2="56" y2="66" stroke-width="1.5" opacity="0.9"/>
  <line x1="61" y1="80" x2="61" y2="73" stroke-width="1.5" opacity="0.7"/>
  <line x1="66" y1="80" x2="66" y2="78" stroke-width="1.5" opacity="0.5"/>
  <line x1="71" y1="80" x2="71" y2="69" stroke-width="1.5" opacity="0.8"/>
  <line x1="76" y1="80" x2="76" y2="75" stroke-width="1.5" opacity="0.6"/>
  <line x1="81" y1="80" x2="81" y2="67" stroke-width="1.5" opacity="0.9"/>
  <line x1="86" y1="80" x2="86" y2="72" stroke-width="1.5" opacity="0.7"/>
  <line x1="91" y1="80" x2="91" y2="76" stroke-width="1.5" opacity="0.5"/>
  <line x1="96" y1="80" x2="96" y2="70" stroke-width="1.5" opacity="0.8"/>
  <line x1="101" y1="80" x2="101" y2="65" stroke-width="1.5" opacity="0.9"/>
  <line x1="106" y1="80" x2="106" y2="74" stroke-width="1.5" opacity="0.6"/>
  <line x1="111" y1="80" x2="111" y2="71" stroke-width="1.5" opacity="0.8"/>
  <!-- Baseline for mouth -->
  <line x1="24" y1="80" x2="114" y2="80" stroke-width="1" opacity="0.3"/>
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

  // The Dissonant — VCO2 boss
  // Two sine waves locked in destructive phase-cancellation, representing
  // sterile perfect unison with no beating
  osc2: `<svg viewBox="0 0 140 110" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body panel -->
  <rect x="8" y="8" width="124" height="94" rx="4" fill="#111" stroke="currentColor" stroke-width="1.5"/>
  <!-- Header bar -->
  <rect x="8" y="8" width="124" height="16" rx="4" fill="currentColor" opacity="0.15"/>
  <text x="20" y="20" font-size="7" fill="currentColor" font-family="monospace" opacity="0.8">OBERHEIM TWO-VOICE</text>

  <!-- Wave 1: sine wave — upper position -->
  <path d="M18 42 C26 32, 34 32, 42 42 C50 52, 58 52, 66 42 C74 32, 82 32, 90 42 C98 52, 106 52, 114 42 C118 37, 120 34, 122 42"
        stroke="currentColor" stroke-width="2" opacity="0.9"/>

  <!-- Wave 2: same sine wave — shifted half-phase (destructive) -->
  <path d="M18 42 C26 52, 34 52, 42 42 C50 32, 58 32, 66 42 C74 52, 82 52, 90 42 C98 32, 106 32, 114 42 C118 47, 120 50, 122 42"
        stroke="currentColor" stroke-width="2" opacity="0.5" stroke-dasharray="3 2"/>

  <!-- Cancellation zone: flat line in the middle where they cancel -->
  <line x1="18" y1="42" x2="122" y2="42" stroke="currentColor" stroke-width="1" opacity="0.2"/>

  <!-- Eyes: two identical LED pairs — perfectly matched, no individuality -->
  <rect x="32" y="58" width="28" height="18" rx="3" fill="#111" stroke="currentColor" stroke-width="1"/>
  <rect x="80" y="58" width="28" height="18" rx="3" fill="#111" stroke="currentColor" stroke-width="1"/>
  <!-- LED dots — both eyes identical -->
  <circle cx="40" cy="67" r="3" fill="currentColor" opacity="0.9"/>
  <circle cx="52" cy="67" r="3" fill="currentColor" opacity="0.9"/>
  <circle cx="88" cy="67" r="3" fill="currentColor" opacity="0.9"/>
  <circle cx="100" cy="67" r="3" fill="currentColor" opacity="0.9"/>

  <!-- Mouth: flat line — no expression, locked in -->
  <line x1="48" y1="88" x2="92" y2="88" stroke="currentColor" stroke-width="2" opacity="0.7"/>

  <!-- Corner tuning knobs — both set to identical positions -->
  <circle cx="22" cy="88" r="5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="22" y1="83" x2="22" y2="86" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="118" cy="88" r="5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="118" y1="83" x2="118" y2="86" stroke="currentColor" stroke-width="1.5"/>

  <!-- Phase label -->
  <text x="50" y="100" font-size="5.5" fill="currentColor" opacity="0.4" font-family="monospace">Δφ = 180°</text>
</svg>`,

  // The Repeater — Delay boss (Act IV)
  // Corrupted tape echo machine: reel hubs, unraveling tape, echo arc waves, knobs
  delay: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <!-- Main housing panel -->
  <rect x="8" y="10" width="184" height="140" rx="5" stroke-width="1.5" fill="#1a0e06" stroke="#c87020"/>
  <rect x="14" y="16" width="172" height="128" rx="3" stroke-width="1" stroke="#a05010" opacity="0.4"/>
  <!-- Housing label strip -->
  <rect x="14" y="16" width="172" height="12" rx="2" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <text x="100" y="25" font-size="6" fill="#c87020" opacity="0.7" font-family="monospace" text-anchor="middle">TAPE ECHO UNIT</text>
  <!-- Left reel hub — outer ring -->
  <circle cx="52" cy="80" r="28" fill="#1a0e06" stroke="#c87020" stroke-width="1.5"/>
  <circle cx="52" cy="80" r="22" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <circle cx="52" cy="80" r="14" fill="#2a1408" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="52" cy="80" r="6" fill="#c87020" opacity="0.6"/>
  <!-- Left reel spokes -->
  <line x1="52" y1="66" x2="52" y2="94" stroke="#a05010" stroke-width="1" opacity="0.6"/>
  <line x1="38" y1="80" x2="66" y2="80" stroke="#a05010" stroke-width="1" opacity="0.6"/>
  <line x1="42" y1="70" x2="62" y2="90" stroke="#a05010" stroke-width="0.8" opacity="0.4"/>
  <line x1="62" y1="70" x2="42" y2="90" stroke="#a05010" stroke-width="0.8" opacity="0.4"/>
  <!-- Right reel hub — outer ring -->
  <circle cx="148" cy="80" r="28" fill="#1a0e06" stroke="#c87020" stroke-width="1.5"/>
  <circle cx="148" cy="80" r="22" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <circle cx="148" cy="80" r="14" fill="#2a1408" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="148" cy="80" r="6" fill="#c87020" opacity="0.6"/>
  <!-- Right reel spokes -->
  <line x1="148" y1="66" x2="148" y2="94" stroke="#a05010" stroke-width="1" opacity="0.6"/>
  <line x1="134" y1="80" x2="162" y2="80" stroke="#a05010" stroke-width="1" opacity="0.6"/>
  <line x1="138" y1="70" x2="158" y2="90" stroke="#a05010" stroke-width="0.8" opacity="0.4"/>
  <line x1="158" y1="70" x2="138" y2="90" stroke="#a05010" stroke-width="0.8" opacity="0.4"/>
  <!-- Tape path between reels (normal path) -->
  <path d="M76,72 L124,72" stroke="#c87020" stroke-width="2.5" opacity="0.5"/>
  <path d="M76,88 L124,88" stroke="#c87020" stroke-width="2.5" opacity="0.5"/>
  <!-- Unraveling tape loops escaping the housing -->
  <path d="M52,52 Q48,38 36,28 Q28,20 18,18" stroke="#c87020" stroke-width="1.5" opacity="0.7"/>
  <path d="M60,54 Q64,40 72,30 Q78,22 80,14" stroke="#a05010" stroke-width="1" opacity="0.5"/>
  <path d="M148,52 Q152,38 162,28 Q172,20 182,16" stroke="#c87020" stroke-width="1.5" opacity="0.7"/>
  <path d="M140,54 Q136,42 130,32 Q124,24 120,14" stroke="#a05010" stroke-width="1" opacity="0.5"/>
  <!-- Echo arc waves (concentric, emanating outward from tape path center) -->
  <path d="M100,60 Q110,50 120,60" stroke="#c87020" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M100,60 Q90,50 80,60" stroke="#c87020" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M100,55 Q116,42 132,55" stroke="#a05010" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M100,55 Q84,42 68,55" stroke="#a05010" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M100,50 Q122,34 144,50" stroke="#a05010" stroke-width="0.6" opacity="0.25" fill="none"/>
  <path d="M100,50 Q78,34 56,50" stroke="#a05010" stroke-width="0.6" opacity="0.25" fill="none"/>
  <!-- Control knobs row at bottom -->
  <rect x="20" y="118" width="160" height="24" rx="2" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <!-- Knob: Delay Time -->
  <circle cx="44" cy="130" r="7" fill="#1a0e06" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="44" cy="130" r="4" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <line x1="44" y1="123" x2="44" y2="126" stroke="#c87020" stroke-width="1.2"/>
  <!-- Knob: Feedback -->
  <circle cx="76" cy="130" r="7" fill="#1a0e06" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="76" cy="130" r="4" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <line x1="79" y1="124" x2="77" y2="127" stroke="#c87020" stroke-width="1.2"/>
  <!-- Knob: Mix -->
  <circle cx="108" cy="130" r="7" fill="#1a0e06" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="108" cy="130" r="4" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <line x1="108" y1="123" x2="108" y2="126" stroke="#c87020" stroke-width="1.2"/>
  <!-- Knob: Tone -->
  <circle cx="140" cy="130" r="7" fill="#1a0e06" stroke="#c87020" stroke-width="1.2"/>
  <circle cx="140" cy="130" r="4" fill="#2a1408" stroke="#a05010" stroke-width="0.8"/>
  <line x1="143" y1="124" x2="141" y2="127" stroke="#c87020" stroke-width="1.2"/>
  <!-- Pilot light (flickering = corrupted) -->
  <circle cx="175" cy="130" r="4" fill="#c87020" opacity="0.8"/>
  <circle cx="175" cy="130" r="2" fill="#ffb040" opacity="0.6"/>
  <!-- Screws in corners -->
  <circle cx="20" cy="24" r="2.5" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <line x1="18.2" y1="22.2" x2="21.8" y2="25.8" stroke="#a05010" stroke-width="0.8"/>
  <circle cx="180" cy="24" r="2.5" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <line x1="178.2" y1="22.2" x2="181.8" y2="25.8" stroke="#a05010" stroke-width="0.8"/>
  <circle cx="20" cy="144" r="2.5" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <line x1="18.2" y1="142.2" x2="21.8" y2="145.8" stroke="#a05010" stroke-width="0.8"/>
  <circle cx="180" cy="144" r="2.5" fill="#1a0e06" stroke="#a05010" stroke-width="1"/>
  <line x1="178.2" y1="142.2" x2="181.8" y2="145.8" stroke="#a05010" stroke-width="0.8"/>
</svg>`,

  // The Void — Reverb boss (Act IV)
  // Corrupted spring reverb tank: rectangular housing, spring coils, expanding rings, cracks
  reverb: `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <!-- Main housing -->
  <rect x="8" y="20" width="184" height="120" rx="4" stroke-width="1.5" fill="#050a0a" stroke="#606060"/>
  <rect x="14" y="26" width="172" height="108" rx="2" stroke-width="1" stroke="#1a7a5a" opacity="0.4"/>
  <!-- Void darkness overlay (deep interior shadow) -->
  <rect x="24" y="52" width="152" height="56" rx="2" fill="#0a0a0f" stroke="#1a7a5a" stroke-width="0.8" opacity="0.9"/>
  <!-- Spring coil housing (inner tank window) -->
  <rect x="28" y="56" width="144" height="48" rx="1" fill="#050a0a" stroke="#606060" stroke-width="1"/>
  <!-- Spring coils — zigzag running horizontally across the tank -->
  <polyline points="34,80 40,68 46,80 52,68 58,80 64,68 70,80 76,68 82,80 88,68 94,80 100,68 106,80 112,68 118,80 124,68 130,80 136,68 142,80 148,68 154,80 160,68 166,80" stroke="#1a7a5a" stroke-width="1.8" fill="none" opacity="0.9"/>
  <!-- Second spring coil (offset, deeper) -->
  <polyline points="34,84 40,96 46,84 52,96 58,84 64,96 70,84 76,96 82,84 88,96 94,84 100,96 106,84 112,96 118,84 124,96 130,84 136,96 142,84 148,96 154,84 160,96 166,84" stroke="#1a7a5a" stroke-width="1.2" fill="none" opacity="0.5"/>
  <!-- Spring anchor points -->
  <rect x="28" y="72" width="8" height="16" rx="1" fill="#606060" stroke="#1a7a5a" stroke-width="0.8"/>
  <rect x="164" y="72" width="8" height="16" rx="1" fill="#606060" stroke="#1a7a5a" stroke-width="0.8"/>
  <!-- Expanding ring echoes from left spring end -->
  <path d="M36,80 Q26,68 36,56" stroke="#1a7a5a" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M36,80 Q20,62 36,44" stroke="#1a7a5a" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M36,80 Q14,56 36,32" stroke="#1a7a5a" stroke-width="0.6" opacity="0.2" fill="none"/>
  <path d="M36,80 Q26,92 36,104" stroke="#1a7a5a" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M36,80 Q20,98 36,116" stroke="#1a7a5a" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M36,80 Q14,104 36,128" stroke="#1a7a5a" stroke-width="0.6" opacity="0.2" fill="none"/>
  <!-- Expanding ring echoes from right spring end -->
  <path d="M164,80 Q174,68 164,56" stroke="#1a7a5a" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M164,80 Q180,62 164,44" stroke="#1a7a5a" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M164,80 Q186,56 164,32" stroke="#1a7a5a" stroke-width="0.6" opacity="0.2" fill="none"/>
  <path d="M164,80 Q174,92 164,104" stroke="#1a7a5a" stroke-width="1" opacity="0.6" fill="none"/>
  <path d="M164,80 Q180,98 164,116" stroke="#1a7a5a" stroke-width="0.8" opacity="0.4" fill="none"/>
  <path d="M164,80 Q186,104 164,128" stroke="#1a7a5a" stroke-width="0.6" opacity="0.2" fill="none"/>
  <!-- Cracks in the housing -->
  <path d="M60,26 L64,34 L58,42" stroke="#606060" stroke-width="1" opacity="0.7" fill="none"/>
  <path d="M64,34 L70,38" stroke="#606060" stroke-width="0.8" opacity="0.5" fill="none"/>
  <path d="M130,130 L136,122 L144,118" stroke="#606060" stroke-width="1" opacity="0.7" fill="none"/>
  <path d="M136,122 L130,116" stroke="#606060" stroke-width="0.8" opacity="0.5" fill="none"/>
  <path d="M170,50 L178,56 L174,66" stroke="#606060" stroke-width="0.8" opacity="0.5" fill="none"/>
  <!-- Housing top panel with label -->
  <rect x="8" y="20" width="184" height="20" rx="4" fill="#0a0f0e" stroke="#606060" stroke-width="1.5"/>
  <text x="100" y="33" font-size="6" fill="#1a7a5a" opacity="0.7" font-family="monospace" text-anchor="middle">SPRING REVERB UNIT</text>
  <!-- Input/output jacks -->
  <circle cx="30" cy="30" r="5" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="30" cy="30" r="2.5" fill="#1a7a5a" opacity="0.5"/>
  <circle cx="170" cy="30" r="5" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="170" cy="30" r="2.5" fill="#1a7a5a" opacity="0.5"/>
  <!-- Bottom control strip -->
  <rect x="14" y="118" width="172" height="24" rx="2" fill="#0a0f0e" stroke="#606060" stroke-width="0.8"/>
  <!-- Decay knob -->
  <circle cx="50" cy="130" r="7" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="50" cy="130" r="4" fill="#0a0f0e" stroke="#1a7a5a" stroke-width="0.8"/>
  <line x1="50" y1="123" x2="50" y2="126" stroke="#606060" stroke-width="1.2"/>
  <!-- Size knob -->
  <circle cx="90" cy="130" r="7" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="90" cy="130" r="4" fill="#0a0f0e" stroke="#1a7a5a" stroke-width="0.8"/>
  <line x1="93" y1="124" x2="91" y2="127" stroke="#606060" stroke-width="1.2"/>
  <!-- Damp knob -->
  <circle cx="130" cy="130" r="7" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="130" cy="130" r="4" fill="#0a0f0e" stroke="#1a7a5a" stroke-width="0.8"/>
  <line x1="130" y1="123" x2="130" y2="126" stroke="#606060" stroke-width="1.2"/>
  <!-- Mix knob -->
  <circle cx="165" cy="130" r="7" fill="#050a0a" stroke="#606060" stroke-width="1.2"/>
  <circle cx="165" cy="130" r="4" fill="#0a0f0e" stroke="#1a7a5a" stroke-width="0.8"/>
  <line x1="162" y1="124" x2="164" y2="127" stroke="#606060" stroke-width="1.2"/>
  <!-- Void indicator (dim, barely lit — wrong reverb tail) -->
  <circle cx="22" cy="130" r="4" fill="#0a0a0f" stroke="#1a7a5a" stroke-width="1"/>
  <circle cx="22" cy="130" r="1.5" fill="#1a7a5a" opacity="0.3"/>
  <!-- Screws in corners -->
  <circle cx="16" cy="28" r="2" fill="#050a0a" stroke="#606060" stroke-width="0.8"/>
  <line x1="14.5" y1="26.5" x2="17.5" y2="29.5" stroke="#606060" stroke-width="0.7"/>
  <circle cx="184" cy="28" r="2" fill="#050a0a" stroke="#606060" stroke-width="0.8"/>
  <line x1="182.5" y1="26.5" x2="185.5" y2="29.5" stroke="#606060" stroke-width="0.7"/>
  <circle cx="16" cy="142" r="2" fill="#050a0a" stroke="#606060" stroke-width="0.8"/>
  <line x1="14.5" y1="140.5" x2="17.5" y2="143.5" stroke="#606060" stroke-width="0.7"/>
  <circle cx="184" cy="142" r="2" fill="#050a0a" stroke="#606060" stroke-width="0.8"/>
  <line x1="182.5" y1="140.5" x2="185.5" y2="143.5" stroke="#606060" stroke-width="0.7"/>
</svg>`,
};
