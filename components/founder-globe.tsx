import styles from "./founder-globe.module.css";

export default function FounderGlobe() {
  return (
    <section className={styles.panel} aria-labelledby="founder-origin-title">
      <div className={styles.copy}>
        <span className={styles.eyebrow}>FOUNDER ORIGIN</span>
        <h2 id="founder-origin-title">جذور المنصة من مصر</h2>
        <p>
          مصر هي بلد مؤسس NOX APIS. نعرضها هنا كجزء من هوية المنصة، وليس كموقع
          لخوادمها أو لمراكز بياناتها.
        </p>
        <div className={styles.country}>
          <span className={styles.flag} aria-hidden="true">
            <i /><i /><i />
          </span>
          <span>
            <strong>مصر</strong>
            <small>بلد المؤسس · شمال أفريقيا</small>
          </span>
        </div>
        <span className={styles.coordinates}>30.0444° N&nbsp; · &nbsp;31.2357° E</span>
      </div>

      <div className={styles.visual}>
        <div className={styles.orbit} aria-hidden="true" />
        <svg
          className={styles.globe}
          viewBox="0 0 320 320"
          role="img"
          aria-labelledby="founder-globe-title founder-globe-desc"
        >
          <title id="founder-globe-title">الكرة الأرضية مع تحديد مصر</title>
          <desc id="founder-globe-desc">
            رسم توضيحي للأرض يحدد مصر بنقطة مضيئة في شمال شرق أفريقيا.
          </desc>
          <defs>
            <radialGradient id="earth-fill" cx="34%" cy="27%" r="78%">
              <stop offset="0%" stopColor="#536d5b" />
              <stop offset="58%" stopColor="#263d35" />
              <stop offset="100%" stopColor="#14231f" />
            </radialGradient>
            <linearGradient id="earth-shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity=".2" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity=".32" />
            </linearGradient>
            <clipPath id="earth-clip">
              <circle cx="160" cy="160" r="132" />
            </clipPath>
            <filter id="egypt-glow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="160" cy="160" r="141" fill="#d9f36a" opacity=".055" />
          <circle cx="160" cy="160" r="132" fill="url(#earth-fill)" stroke="#82967b" strokeOpacity=".55" strokeWidth="1.2" />

          <g clipPath="url(#earth-clip)">
            <g className={styles.gridLines}>
              <ellipse cx="160" cy="160" rx="49" ry="132" />
              <ellipse cx="160" cy="160" rx="93" ry="132" />
              <ellipse cx="160" cy="160" rx="132" ry="47" />
              <ellipse cx="160" cy="160" rx="132" ry="91" />
              <path d="M28 160h264M160 28v264" />
            </g>

            <g className={styles.land}>
              <path d="M58 76 78 61 100 66 111 82 104 98 91 105 87 124 72 128 62 112 48 103Z" />
              <path d="M105 126 122 111 143 115 153 132 148 151 137 164 133 188 119 207 109 192 103 169 94 151Z" />
              <path d="M137 91 151 77 171 74 184 84 179 98 164 105 154 119 140 112Z" />
              <path d="M154 119 170 111 187 117 198 132 191 148 179 157 172 178 159 193 148 177 145 157Z" />
              <path d="M187 91 210 77 238 82 256 101 250 119 230 124 217 139 199 132 185 116Z" />
              <path d="M205 146 224 139 242 151 248 170 237 184 219 181 207 166Z" />
              <path d="M228 204 243 196 256 207 252 222 237 226 226 217Z" />
              <path d="M76 221 91 213 105 219 111 234 99 244 83 239Z" />
              <path d="M264 112 277 107 289 117 285 132 271 137 261 127Z" />
              <path d="M45 151 55 143 66 148 66 161 55 168 45 162Z" />
            </g>

            <path className={styles.egypt} d="M165 111 181 108 187 117 182 128 168 128 162 120Z" />
            <circle className={styles.marker-halo} cx="176" cy="119" r="12" />
            <circle className={styles.marker} cx="176" cy="119" r="4.2" filter="url(#egypt-glow)" />
            <path className={styles.marker-line} d="M184 113 213 91 246 91" />
            <g className={styles.marker-label}>
              <rect x="218" y="77" width="66" height="24" rx="3" />
              <text x="251" y="93" textAnchor="middle">EGYPT</text>
            </g>
            <circle cx="160" cy="160" r="132" fill="url(#earth-shine)" />
          </g>

          <circle cx="160" cy="160" r="132" fill="none" stroke="#d9f36a" strokeOpacity=".28" />
          <path className={styles.arc} d="M47 214a132 132 0 0 0 224-2" />
        </svg>
        <span className={styles.visualTag}>NORTH AFRICA <i /> 01 / 01</span>
      </div>
    </section>
  );
}
