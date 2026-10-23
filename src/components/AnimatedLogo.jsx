/**
 * The logomark, building itself.
 *
 * Inline rather than the favicon file the rest of the app uses: CSS cannot
 * reach inside an <img>, so the only way to animate the parts is to have them
 * in the document. Everywhere else keeps the static file, this is for the one
 * screen where the app is introducing itself and has nothing else to show.
 *
 * The whole animation sits inside a no-preference query, so a device asking for
 * less motion gets the finished mark and no movement at all.
 */
export function AnimatedLogo({ size = 72 }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      style={{ display: 'block' }}
      role="img"
      aria-label="Dual Finance"
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          /* fill-box is what makes a bar scale from its own bottom edge rather
             than from the origin of the whole drawing. */
          .al-body,
          .al-b1, .al-b2, .al-b3, .al-b4,
          .al-arrow {
            transform-box: fill-box;
          }

          .al-body {
            transform-origin: center;
            animation: al-wallet-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          @keyframes al-wallet-in {
            from { opacity: 0; transform: translateY(6px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }

          .al-b1, .al-b2, .al-b3, .al-b4 {
            transform-origin: bottom center;
            animation-duration: 4s;
            animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
            animation-iteration-count: infinite;
          }

          .al-b1 { animation-name: al-b1; }
          .al-b2 { animation-name: al-b2; }
          .al-b3 { animation-name: al-b3; }
          .al-b4 { animation-name: al-b4; }

          @keyframes al-b1 {
            0%, 10%   { transform: scaleY(0); }
            60%, 100% { transform: scaleY(1); }
          }
          @keyframes al-b2 {
            0%, 20%   { transform: scaleY(0); }
            70%, 100% { transform: scaleY(1); }
          }
          @keyframes al-b3 {
            0%, 30%   { transform: scaleY(0); }
            80%, 100% { transform: scaleY(1); }
          }
          @keyframes al-b4 {
            0%, 40%   { transform: scaleY(0); }
            90%, 100% { transform: scaleY(1); }
          }

          /* The polyline is 91.6 units long, so a 150 dash covers it whole:
             offset 150 puts every point in the gap, offset 0 in the dash. */
          .al-trend {
            stroke-dasharray: 150;
            animation: al-trend 4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          }
          @keyframes al-trend {
            0%, 45%   { stroke-dashoffset: 150; }
            90%, 100% { stroke-dashoffset: 0; }
          }

          .al-arrow {
            transform-origin: center;
            animation: al-arrow 4s ease infinite;
          }
          @keyframes al-arrow {
            0%, 88%   { opacity: 0; transform: scale(0); }
            95%, 100% { opacity: 0.9; transform: scale(1); }
          }
        }
      `}</style>

      <g className="al-body">
        <rect x="8" y="42" width="124" height="88" rx="14" fill="#0a0a0a" />
        <rect x="8" y="54" width="124" height="8" fill="#3a3a3a" opacity="0.4" />
        <rect x="8" y="54" width="124" height="4" fill="#ffffff" opacity="0.06" />
        <rect x="96" y="58" width="36" height="28" rx="8" fill="#3a3a3a" opacity="0.5" />
        <circle cx="107" cy="72" r="5" fill="#ffffff" opacity="0.3" />
        <circle cx="107" cy="72" r="2.5" fill="#0a0a0a" opacity="0.6" />
        <rect x="8" y="42" width="124" height="14" rx="7" fill="#0a0a0a" />
        <rect x="8" y="42" width="124" height="7" rx="3" fill="#3a3a3a" opacity="0.25" />
        <rect
          x="8"
          y="42"
          width="124"
          height="88"
          rx="14"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.5"
          opacity="0.08"
        />
      </g>

      <rect className="al-b1" x="44" y="86" width="10" height="28" rx="2" fill="#ffffff" opacity="0.15" />
      <rect className="al-b2" x="58" y="76" width="10" height="38" rx="2" fill="#ffffff" opacity="0.18" />
      <rect className="al-b3" x="72" y="68" width="10" height="46" rx="2" fill="#ffffff" opacity="0.21" />
      <rect className="al-b4" x="86" y="58" width="10" height="56" rx="2" fill="#ffffff" opacity="0.25" />

      <polyline
        className="al-trend"
        points="44,90 58,78 72,70 86,60 100,46 112,30"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <polygon className="al-arrow" points="112,30 102,28 110,38" fill="#ffffff" opacity="0.9" />
    </svg>
  )
}

export default AnimatedLogo
