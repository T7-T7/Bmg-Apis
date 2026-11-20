"use client";

export default function DigitalGlobe() {
  return (
    <div className="source-globe source-dot-globe" role="img" aria-label="كرة أرضية نقطية دوارة بقارات العالم">
      <div className="dot-globe-sphere">
        <svg className="dot-globe-map" viewBox="0 0 640 640" aria-hidden="true">
          <defs>
            <clipPath id="dot-globe-clip"><circle cx="320" cy="320" r="286" /></clipPath>
            <pattern id="dot-globe-pattern" width="13" height="13" patternUnits="userSpaceOnUse">
              <circle cx="3.2" cy="3.2" r="2.15" fill="#d4ff00" />
            </pattern>
            <radialGradient id="dot-globe-shade" cx="34%" cy="29%" r="76%">
              <stop offset="0" stopColor="#10150a" stopOpacity="0" />
              <stop offset=".58" stopColor="#050704" stopOpacity=".08" />
              <stop offset="1" stopColor="#000" stopOpacity=".94" />
            </radialGradient>
            <mask id="dot-globe-land">
              <rect width="640" height="640" fill="black" />
              <g fill="white">
                <path d="M74 150 104 113 143 92 176 76 216 83 241 104 274 110 290 133 276 157 249 164 236 187 210 192 202 220 179 235 165 267 142 267 128 245 105 239 91 211 72 197 58 171Z" />
                <path d="m174 273 32 4 23 20 14 34-9 35-15 25-11 43-19 39-18 45-18 12-13-29-3-43-17-34 4-42 13-32 3-41Z" />
                <path d="m281 106 22-22 37 2 23 17-9 20-32 7Z" />
                <path d="m296 171 28-17 34 8 26 25-2 31-19 24-10 39-19 27-20-12-5-35-17-27-8-34Z" />
                <path d="m350 106 29-25 48-12 48 11 38 5 38 24 24 26-14 22-37 1-22 19-35-5-22 19-31-8-18-24-29 2-21-21Z" />
                <path d="m399 216 27-19 36 7 25 24 35 8 20 29-8 31-30 9-29-16-26-3-23-23-27-8Z" />
                <path d="m482 363 29-12 34 13 17 25-16 25-38 2-28-24Z" />
                <path d="m102 75 20-19 28 6 15 20-19 19-29-7Z" />
                <path d="m39 290 24-17 29 9 11 24-22 21-29-11Z" />
                <path d="m540 214 20-11 22 15-3 26-20 12-18-20Z" />
              </g>
            </mask>
          </defs>
          <circle cx="320" cy="320" r="286" fill="#030503" />
          <g clipPath="url(#dot-globe-clip)">
            <g className="dot-globe-continents">
              <rect width="1280" height="640" fill="url(#dot-globe-pattern)" mask="url(#dot-globe-land)" />
            </g>
            <circle cx="320" cy="320" r="286" fill="url(#dot-globe-shade)" />
            <ellipse cx="320" cy="320" rx="286" ry="286" fill="none" stroke="#d4ff00" strokeOpacity=".08" strokeWidth="1" />
          </g>
        </svg>
        <div className="dot-globe-highlight" />
      </div>
    </div>
  );
}
