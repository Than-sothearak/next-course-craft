export type InteractiveSceneTheme = "data" | "security" | "network" | "agriculture";

export function InteractiveScene({ theme, stretch = false }: { theme: InteractiveSceneTheme; stretch?: boolean }) {
  if (theme === "data")
    return (
      <svg data-scene-theme="data" viewBox="0 0 1200 675" preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="block h-full w-full">
        <rect width="1200" height="675" fill="#0b1220" />
        <rect width="1200" height="66" fill="#111c2e" />
        <circle cx="39" cy="33" r="13" fill="#38bdf8" />
        <path d="M33 34h12M39 28v12" stroke="#082f49" strokeWidth="3" strokeLinecap="round" />
        <text x="66" y="38" fill="#e2e8f0" fontSize="20" fontWeight="700" fontFamily="system-ui">SIGNAL LAB</text>
        <text x="1040" y="38" fill="#94a3b8" fontSize="14" fontFamily="system-ui">MODEL MONITOR</text>
        <rect x="28" y="92" width="190" height="550" rx="18" fill="#111c2e" />
        <text x="52" y="133" fill="#94a3b8" fontSize="13" fontWeight="700" fontFamily="system-ui">WORKSPACE</text>
        <rect x="47" y="157" width="151" height="40" rx="9" fill="#1d3552" />
        <circle cx="66" cy="177" r="5" fill="#22d3ee" />
        <text x="82" y="182" fill="#e0f2fe" fontSize="14" fontFamily="system-ui">Overview</text>
        <text x="82" y="238" fill="#94a3b8" fontSize="14" fontFamily="system-ui">Data quality</text>
        <text x="82" y="284" fill="#94a3b8" fontSize="14" fontFamily="system-ui">Model drift</text>
        <text x="82" y="330" fill="#94a3b8" fontSize="14" fontFamily="system-ui">Experiments</text>
        <rect x="246" y="92" width="926" height="112" rx="18" fill="#111c2e" />
        <text x="274" y="132" fill="#f8fafc" fontSize="20" fontWeight="700" fontFamily="system-ui">Weekly signal review</text>
        <text x="274" y="163" fill="#94a3b8" fontSize="13" fontFamily="system-ui">Click the reading that breaks the pattern</text>
        <rect x="881" y="116" width="113" height="54" rx="11" fill="#17263a" />
        <text x="898" y="138" fill="#94a3b8" fontSize="10" fontFamily="system-ui">RECORDS</text>
        <text x="898" y="158" fill="#e2e8f0" fontSize="17" fontWeight="700" fontFamily="system-ui">24.8k</text>
        <rect x="1008" y="116" width="136" height="54" rx="11" fill="#17263a" />
        <text x="1025" y="138" fill="#94a3b8" fontSize="10" fontFamily="system-ui">QUALITY</text>
        <text x="1025" y="158" fill="#4ade80" fontSize="17" fontWeight="700" fontFamily="system-ui">98.2%</text>
        <rect x="246" y="222" width="926" height="420" rx="18" fill="#111c2e" />
        <text x="274" y="264" fill="#e2e8f0" fontSize="16" fontWeight="700" fontFamily="system-ui">Feature distribution</text>
        <text x="274" y="288" fill="#64748b" fontSize="11" fontFamily="system-ui">OBSERVATION WINDOW · LAST 7 DAYS</text>
        {[330, 410, 490, 570, 650, 730, 810, 890, 970, 1050].map((y) => <path key={`h${y}`} d={`M310 ${y}H1138`} stroke="#243247" strokeWidth="1" />)}
        {[390, 550, 710, 870, 1030].map((x) => <path key={`v${x}`} d={`M${x} 310V570`} stroke="#1d2b3e" strokeWidth="1" />)}
        <path d="M330 535C480 505 560 468 670 435S860 376 1100 345" fill="none" stroke="#38bdf8" strokeWidth="4" strokeDasharray="9 10" opacity=".7" />
        {[[365,520],[430,488],[480,505],[525,456],[570,478],[620,430],[665,448],[700,405],[745,422],[780,382],[825,395],[865,362],[910,380],[950,345],[1000,365],[1055,330]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r="8" fill={i%3===0?"#818cf8":"#38bdf8"} opacity=".88" />)}
        <circle cx="930" cy="305" r="15" fill="#fbbf24" opacity=".18" />
        <circle cx="930" cy="305" r="8" fill="#fbbf24" />
        <text x="326" y="602" fill="#64748b" fontSize="11" fontFamily="system-ui">LOW FEATURE VALUE</text>
        <text x="1000" y="602" fill="#64748b" fontSize="11" fontFamily="system-ui">HIGH FEATURE VALUE</text>
      </svg>
    );

  if (theme === "security")
    return (
      <svg data-scene-theme="security" viewBox="0 0 1200 675" preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="block h-full w-full">
        <rect width="1200" height="675" fill="#dbeafe" />
        <rect y="0" width="1200" height="72" fill="#0f172a" />
        <circle cx="46" cy="36" r="14" fill="#38bdf8" />
        <path d="M39 36h14M46 29v14" stroke="#082f49" strokeWidth="3" strokeLinecap="round" />
        <text x="72" y="42" fill="#f8fafc" fontSize="20" fontWeight="700" fontFamily="system-ui">MAILGUARD</text>
        <rect x="28" y="99" width="210" height="545" rx="16" fill="#f8fafc" />
        <rect x="50" y="124" width="164" height="44" rx="12" fill="#2563eb" />
        <text x="91" y="152" fill="#fff" fontSize="14" fontWeight="700" fontFamily="system-ui">Compose</text>
        <text x="60" y="214" fill="#334155" fontSize="14" fontWeight="700" fontFamily="system-ui">Inbox</text>
        <text x="60" y="260" fill="#64748b" fontSize="14" fontFamily="system-ui">Starred</text>
        <text x="60" y="306" fill="#64748b" fontSize="14" fontFamily="system-ui">Sent</text>
        <text x="60" y="352" fill="#64748b" fontSize="14" fontFamily="system-ui">Junk</text>
        <rect x="260" y="99" width="912" height="545" rx="16" fill="#fff" />
        <text x="302" y="148" fill="#0f172a" fontSize="22" fontWeight="700" fontFamily="system-ui">Account verification required</text>
        <rect x="302" y="173" width="142" height="25" rx="12" fill="#fee2e2" />
        <text x="317" y="190" fill="#b91c1c" fontSize="11" fontWeight="700" fontFamily="system-ui">ACTION REQUIRED</text>
        <circle cx="331" cy="246" r="23" fill="#cbd5e1" />
        <text x="322" y="252" fill="#334155" fontSize="14" fontWeight="700" fontFamily="system-ui">S</text>
        <text x="369" y="241" fill="#0f172a" fontSize="14" fontWeight="700" fontFamily="system-ui">Security Team</text>
        <text x="369" y="263" fill="#64748b" fontSize="12" fontFamily="system-ui">security-alert@verify-account.help</text>
        <text x="302" y="319" fill="#334155" fontSize="15" fontFamily="system-ui">We detected an unusual sign-in attempt. Your account may be paused today.</text>
        <text x="302" y="351" fill="#334155" fontSize="15" fontFamily="system-ui">Review the activity and confirm your details to keep access.</text>
        <text x="302" y="400" fill="#64748b" fontSize="13" fontFamily="system-ui">To review, use the secure account page below:</text>
        <rect x="302" y="426" width="376" height="62" rx="10" fill="#eff6ff" stroke="#bfdbfe" />
        <circle cx="333" cy="457" r="14" fill="#dbeafe" />
        <path d="M327 457h12M333 451v12" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
        <text x="357" y="453" fill="#1d4ed8" fontSize="13" fontWeight="700" fontFamily="system-ui">https://verify-account.help/sign-in</text>
        <text x="357" y="473" fill="#64748b" fontSize="11" fontFamily="system-ui">Review your account activity</text>
        <rect x="302" y="526" width="192" height="46" rx="10" fill="#2563eb" />
        <text x="350" y="555" fill="#fff" fontSize="14" fontWeight="700" fontFamily="system-ui">Review activity</text>
        <text x="302" y="610" fill="#94a3b8" fontSize="11" fontFamily="system-ui">MAIL PREVIEW · TRAINING SCENARIO</text>
      </svg>
    );

  if (theme === "network")
    return (
      <svg data-scene-theme="network" viewBox="0 0 1200 675" preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="block h-full w-full">
        <rect width="1200" height="675" fill="#0b1220" />
        <rect width="1200" height="675" fill="#102039" opacity=".55" />
        <path d="M0 82H1200" stroke="#2a3d57" strokeWidth="2" />
        <circle cx="46" cy="41" r="15" fill="#22d3ee" />
        <path d="M39 41h14M46 34v14" stroke="#083344" strokeWidth="3" strokeLinecap="round" />
        <text x="76" y="48" fill="#e2e8f0" fontSize="22" fontWeight="700" fontFamily="system-ui">PACKET PATH · NETWORK LAB</text>
        <rect x="32" y="112" width="1136" height="520" rx="24" fill="#111e31" stroke="#273a53" strokeWidth="2" />
        <text x="68" y="158" fill="#94a3b8" fontSize="14" fontWeight="700" fontFamily="system-ui" letterSpacing="2">FOLLOW THE CONNECTION</text>
        <path d="M235 360C330 360 362 292 462 292S592 360 683 360 832 282 966 282" fill="none" stroke="#29415c" strokeWidth="18" strokeLinecap="round" />
        <path d="M235 360C330 360 362 292 462 292S592 360 683 360 832 282 966 282" fill="none" stroke="#22d3ee" strokeWidth="4" strokeDasharray="10 18" strokeLinecap="round" opacity=".8" />
        <g transform="translate(154 303)">
          <rect width="164" height="116" rx="20" fill="#20334b" stroke="#5b7897" strokeWidth="3" />
          <rect x="22" y="18" width="120" height="72" rx="10" fill="#0b1625" />
          <path d="M72 116h20m-10 0v13m-28 0h56" stroke="#8aa3bd" strokeWidth="7" strokeLinecap="round" />
          <text x="42" y="58" fill="#bae6fd" fontSize="14" fontWeight="700" fontFamily="system-ui">CLIENT</text>
        </g>
        <g transform="translate(405 222)">
          <path d="M24 44 76 12l52 32v60L76 136 24 104Z" fill="#155e75" stroke="#67e8f9" strokeWidth="4" />
          <path d="m24 44 52 32 52-32M76 76v60" fill="none" stroke="#a5f3fc" strokeWidth="3" />
          <circle cx="76" cy="76" r="14" fill="#fef08a" opacity=".2" />
          <circle cx="76" cy="76" r="8" fill="#fef08a" />
          <text x="35" y="164" fill="#cbd5e1" fontSize="14" fontWeight="700" fontFamily="system-ui">ROUTER</text>
        </g>
        <g transform="translate(633 300)">
          <rect width="132" height="112" rx="18" fill="#27364a" stroke="#93c5fd" strokeWidth="3" />
          <rect x="20" y="19" width="92" height="21" rx="6" fill="#0b1625" />
          <rect x="20" y="51" width="92" height="21" rx="6" fill="#0b1625" />
          <circle cx="34" cy="29" r="4" fill="#4ade80" />
          <circle cx="34" cy="61" r="4" fill="#38bdf8" />
          <path d="M50 29h44m-44 32h44" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
          <text x="26" y="139" fill="#cbd5e1" fontSize="13" fontWeight="700" fontFamily="system-ui">ACCESS POINT</text>
        </g>
        <g transform="translate(894 212)">
          <path d="M25 96h148a34 34 0 0 0 0-68 49 49 0 0 0-94-10 41 41 0 0 0-54 78Z" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="4" />
          <path d="M75 57h53m-18-18 18 18-18 18" fill="none" stroke="#bfdbfe" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="54" y="128" fill="#cbd5e1" fontSize="14" fontWeight="700" fontFamily="system-ui">SERVICE</text>
        </g>
        <circle cx="462" cy="292" r="18" fill="#fbbf24" opacity=".18" />
        <circle cx="462" cy="292" r="15" fill="#fde68a" opacity=".2" />
        <circle cx="462" cy="292" r="9" fill="#fde68a" />
        <rect x="72" y="544" width="234" height="48" rx="13" fill="#0b1625" stroke="#2a3d57" />
        <text x="94" y="574" fill="#7dd3fc" fontSize="12" fontWeight="700" fontFamily="system-ui">PACKET STATUS: ROUTING</text>
        <rect x="890" y="544" width="228" height="48" rx="13" fill="#0b1625" stroke="#2a3d57" />
        <text x="912" y="574" fill="#86efac" fontSize="12" fontWeight="700" fontFamily="system-ui">LINKS: 4 ACTIVE</text>
      </svg>
    );

  return (
    <svg data-scene-theme="agriculture" viewBox="0 0 1200 675" preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true" className="block h-full w-full">
      <rect width="1200" height="675" fill="#bde7f7" />
      <circle cx="1040" cy="110" r="46" fill="#fde68a" />
      <path d="M0 330C180 270 315 300 470 330S790 285 1200 322V675H0Z" fill="#6fae58" />
      <path d="M0 438C250 385 385 414 600 442S960 388 1200 424V675H0Z" fill="#4d873f" />
      <path d="M0 564C245 500 468 533 650 566S987 515 1200 552V675H0Z" fill="#8d6542" />
      <path d="M0 612C265 557 440 592 650 613S990 575 1200 606" fill="none" stroke="#c18c57" strokeWidth="16" opacity=".55" />
      <path d="M0 654C265 599 440 634 650 655S990 617 1200 648" fill="none" stroke="#c18c57" strokeWidth="16" opacity=".45" />
      {[170,360,550,740,930,1110].map((x,index) => {
        const y = [488,455,500,462,492,456][index];
        const stressed = index === 4;
        const leaf = stressed ? "#eabf46" : "#23884d";
        return <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 0C-3 -74 0 -135 4 -190" fill="none" stroke="#236b3b" strokeWidth="12" strokeLinecap="round" />
          <path d="M1 -40C-78 -110 -105 -74 -57 -31C-34 -10 -12 -15 1 -34Z" fill={leaf} />
          <path d="M3 -68C64 -141 103 -102 59 -58C36 -36 16 -41 3 -61Z" fill={stressed?"#facc62":"#2fa35c"} />
          <path d="M3 -111C-50 -169 -73 -143 -43 -108C-26 -89 -10 -92 3 -105Z" fill={stressed?"#d99f38":"#36a967"} />
          <path d="M-40 -38L0 -8M38 -64L4 -22M-29 -112L2 -62" fill="none" stroke="#b4e3a9" strokeWidth="3" opacity=".55" />
          <path d="M-58 -87l13 8m29 39l12 7m26 -36l13 -8" stroke="#543b2c" strokeWidth="5" strokeLinecap="round" opacity={stressed?".75":".18"} />
        </g>;
      })}
      <path d="M0 292C200 272 360 281 520 300M690 300C875 270 1040 275 1200 295" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="10 14" opacity=".58" />
      <rect x="34" y="28" width="255" height="48" rx="14" fill="#f8fafc" opacity=".92" />
      <circle cx="59" cy="52" r="8" fill="#15803d" />
      <text x="80" y="58" fill="#14532d" fontSize="15" fontWeight="700" fontFamily="system-ui">FIELD SCOUT · PLOT 04</text>
      <rect x="901" y="570" width="258" height="58" rx="14" fill="#16351f" opacity=".88" />
      <text x="925" y="595" fill="#bbf7d0" fontSize="11" fontWeight="700" fontFamily="system-ui">SCOUTING PASS</text>
      <text x="925" y="615" fill="#f0fdf4" fontSize="13" fontFamily="system-ui">Inspect before choosing a response</text>
    </svg>
  );
}
