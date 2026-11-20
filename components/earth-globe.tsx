import type { SVGProps } from "react";

export default function EarthGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="earth-globe" aria-hidden="true">
      <svg viewBox="0 0 520 420" role="img" {...props}>
        <defs>
          <clipPath id="earth-clip"><circle cx="260" cy="210" r="164" /></clipPath>
          <radialGradient id="earth-shade" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#d4ff00" stopOpacity=".12" />
            <stop offset="72%" stopColor="#d4ff00" stopOpacity=".025" />
            <stop offset="100%" stopColor="#050605" stopOpacity=".7" />
          </radialGradient>
          <pattern id="earth-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#f2f3ec" fillOpacity=".35" /></pattern>
        </defs>
        <ellipse className="globe-orbit" cx="260" cy="210" rx="206" ry="78" transform="rotate(-18 260 210)" />
        <circle className="globe-shell" cx="260" cy="210" r="164" />
        <g clipPath="url(#earth-clip)">
          <circle cx="260" cy="210" r="164" fill="url(#earth-shade)" />
          <g className="globe-grid">
            <ellipse cx="260" cy="210" rx="164" ry="55" /><ellipse cx="260" cy="210" rx="164" ry="112" />
            <ellipse cx="260" cy="210" rx="68" ry="164" /><ellipse cx="260" cy="210" rx="125" ry="164" />
            <path d="M96 210h328M112 150h296M112 270h296M260 46v328" />
          </g>
          <g className="globe-land">
            <path d="M128 112l20-22 29-7 18 11 24-3 17 17-7 17-18 7-9 18-19 7-8 20-21 4-11-16-20-6-12-23-13-6 5-18 15-8z" />
            <path d="M206 194l18 10 12 22-7 23-13 18-5 28-14 25-12-12 2-25-12-24 7-26-3-19 14-20z" />
            <path d="M246 116l20-15 24 5 14 15-8 13-20 1-8 14-18-4-12-15z" />
            <path d="M264 151l27-13 24 11 9 24-13 21-7 30-16 28-17 23-15-15 4-29-13-22 3-30-8-14z" />
            <path d="M293 104l27-21 40 4 25 18 35 4 21 19-10 17-28 2-18 18-28-5-12 16-24-10-14-22-20-4-9-18z" />
            <path d="M364 250l20-9 21 8 7 17-14 17-22-2-15-13z" />
            <path d="M174 74l12-9 12 4-4 13-13 5zM338 306l10-7 9 9-5 11-13-3z" />
          </g>
          <circle cx="260" cy="210" r="164" fill="url(#earth-dots)" />
        </g>
        <circle cx="260" cy="210" r="164" fill="none" stroke="rgba(212,255,0,.42)" strokeWidth="1.2" />
        <circle cx="260" cy="210" r="176" fill="none" stroke="rgba(242,243,236,.08)" strokeDasharray="2 8" />
      </svg>
    </div>
  );
}
