(function () {
  const svgData = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const team = {
    blue: { main:'#2563eb', dark:'#123b8c', light:'#60a5fa', accent:'#22d3ee' },
    red: { main:'#ef4444', dark:'#8f1d2c', light:'#fb7185', accent:'#fbbf24' }
  };

  function chibi(side='blue', gender='male', pose='idle') {
    const c = team[side] || team.blue;
    const isFemale = gender === 'female';
    const poseMap = {
      idle:{la:'rotate(5 64 155)',ra:'rotate(-5 156 155)',ll:'rotate(0 88 206)',rl:'rotate(0 132 206)',body:'translate(0 0)'},
      run:{la:'rotate(-38 64 155)',ra:'rotate(38 156 155)',ll:'rotate(28 88 206)',rl:'rotate(-25 132 206)',body:'translate(0 -3) rotate(-3 110 160)'},
      attack:{la:'rotate(-58 64 155)',ra:'rotate(-75 156 155)',ll:'rotate(12 88 206)',rl:'rotate(-12 132 206)',body:'translate(0 -2) rotate(-5 110 160)'},
      hit:{la:'rotate(48 64 155)',ra:'rotate(-45 156 155)',ll:'rotate(-12 88 206)',rl:'rotate(15 132 206)',body:'translate(5 5) rotate(7 110 160)'},
      win:{la:'rotate(-110 64 155)',ra:'rotate(110 156 155)',ll:'rotate(0 88 206)',rl:'rotate(0 132 206)',body:'translate(0 -7)'}
    };
    const p = poseMap[pose] || poseMap.idle;
    const headwear = isFemale
      ? `<path d="M61 78c2-39 25-61 50-61 29 0 50 22 50 61 0 22-8 39-19 50l-11-18H88l-12 19C66 116 61 99 61 78Z" fill="#f8fafc" stroke="${c.dark}" stroke-width="6"/><path d="M73 57c20-24 54-28 78-4" fill="none" stroke="${c.main}" stroke-width="10" stroke-linecap="round"/>`
      : `<path d="M60 66c7-35 28-53 54-53 29 0 49 17 55 49-26-10-62-10-109 4Z" fill="#111827"/><path d="M67 39c24-20 61-18 88 0l-8 16c-27-11-50-11-75 1Z" fill="${c.main}" stroke="${c.dark}" stroke-width="5"/><path d="M145 42h34l-9 15h-31Z" fill="${c.light}"/>`;
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 270">
      <defs><filter id="s"><feDropShadow dy="7" stdDeviation="4" flood-opacity=".32"/></filter><radialGradient id="a"><stop stop-color="${c.accent}" stop-opacity=".32"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="110" cy="248" rx="60" ry="12" fill="#020617" opacity=".22"/><ellipse cx="110" cy="155" rx="90" ry="100" fill="url(#a)"/>
      <g filter="url(#s)" transform="${p.body}">
        <g transform="${p.ll}"><path d="M80 192 68 235h27l14-42Z" fill="#172554"/><path d="M67 232h31v14H69c-10 0-11-9-2-14Z" fill="#0f172a"/></g>
        <g transform="${p.rl}"><path d="M140 192 152 235h-27l-14-42Z" fill="#172554"/><path d="M153 232h-31v14h29c10 0 11-9 2-14Z" fill="#0f172a"/></g>
        <path d="M57 137c8-30 29-48 53-48 26 0 47 18 54 48l8 62c-18 17-39 25-62 25-24 0-45-8-63-25Z" fill="${c.main}" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>
        <path d="M77 142h66l-10 48H87Z" fill="${c.light}" opacity=".28"/><path d="M110 129v70M89 151h42" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
        <g transform="${p.la}"><path d="M61 143c-28 8-41 28-39 52 1 13 8 21 19 20 12-1 16-11 15-21-2-15 7-28 23-34Z" fill="#efc09b" stroke="${c.dark}" stroke-width="4"/></g>
        <g transform="${p.ra}"><path d="M159 143c28 8 41 28 39 52-1 13-8 21-19 20-12-1-16-11-15-21 2-15-7-28-23-34Z" fill="#efc09b" stroke="${c.dark}" stroke-width="4"/></g>
        <ellipse cx="110" cy="84" rx="43" ry="48" fill="#efc09b" stroke="${c.dark}" stroke-width="5"/>
        ${headwear}
        <ellipse cx="94" cy="86" rx="6" ry="7" fill="#111827"/><ellipse cx="127" cy="86" rx="6" ry="7" fill="#111827"/><circle cx="92" cy="83" r="2" fill="#fff"/><circle cx="125" cy="83" r="2" fill="#fff"/>
        <path d="M99 106c7 7 15 7 22 0" fill="none" stroke="#9f1239" stroke-width="4" stroke-linecap="round"/>
      </g>
    </svg>`);
  }

  function laser(side='blue') {
    const c = team[side] || team.blue;
    const flip = side === 'red' ? 'scale(-1 1) translate(-220 0)' : '';
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 230"><defs><filter id="g"><feDropShadow stdDeviation="6" flood-color="${c.accent}" flood-opacity=".55"/></filter></defs><g transform="${flip}" filter="url(#g)">
      <ellipse cx="104" cy="212" rx="58" ry="10" fill="#020617" opacity=".3"/><path d="M70 140 49 194h35l24-46 21 46h37l-19-57Z" fill="${c.dark}" stroke="#0f172a" stroke-width="6"/>
      <path d="M51 112c11-29 29-44 56-44 28 0 49 17 59 48l-10 57c-15 13-31 19-49 19-19 0-36-7-51-21Z" fill="${c.main}" stroke="${c.light}" stroke-width="6"/>
      <ellipse cx="107" cy="67" rx="45" ry="43" fill="#efc09b" stroke="${c.dark}" stroke-width="6"/><path d="M62 66c1-38 23-58 48-58 27 0 48 19 50 55l-23-14H84Z" fill="${c.main}" stroke="${c.light}" stroke-width="7"/><circle cx="84" cy="64" r="13" fill="${c.dark}"/><circle cx="150" cy="64" r="13" fill="${c.dark}"/>
      <ellipse cx="92" cy="72" rx="6" ry="7"/><ellipse cx="124" cy="72" rx="6" ry="7"/><circle cx="90" cy="69" r="2" fill="#fff"/><circle cx="122" cy="69" r="2" fill="#fff"/><path d="M98 91c6 6 13 6 20 0" fill="none" stroke="#9f1239" stroke-width="4"/>
      <path d="M160 117c32-2 49 1 53 9 4 8-7 15-27 16l-34 2Z" fill="${c.main}" stroke="${c.dark}" stroke-width="6"/><path d="M194 120h20l-7 11 7 10h-20z" fill="${c.accent}"/>
      <path d="M55 118c-22 2-34 10-36 22-2 10 5 16 15 14 11-2 14-12 23-16Z" fill="${c.main}" stroke="${c.dark}" stroke-width="6"/>
    </g></svg>`);
  }

  function kart(color='#2563eb', accent='#60a5fa', gender='male') {
    const female = gender === 'female';
    return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 160"><defs><filter id="s"><feDropShadow dy="6" stdDeviation="4" flood-opacity=".35"/></filter></defs><g filter="url(#s)">
      <ellipse cx="136" cy="139" rx="100" ry="10" fill="#020617" opacity=".25"/><path d="M28 92c13-25 32-39 64-42h70c32 3 55 16 72 43l-13 35H43Z" fill="${color}" stroke="#fff" stroke-opacity=".5" stroke-width="5"/><path d="M72 61h102c18 0 33 8 43 24H49c5-12 12-19 23-24Z" fill="${accent}" opacity=".55"/>
      <circle cx="72" cy="127" r="24" fill="#111827"/><circle cx="205" cy="127" r="24" fill="#111827"/><circle cx="72" cy="127" r="10" fill="#cbd5e1"/><circle cx="205" cy="127" r="10" fill="#cbd5e1"/>
      <path d="M112 104h55l-9 23h-38z" fill="#fff" opacity=".75"/><path d="M129 102v28" stroke="${color}" stroke-width="7"/>
      <ellipse cx="137" cy="52" rx="31" ry="30" fill="#efc09b" stroke="#0f172a" stroke-width="4"/>
      ${female?`<path d="M105 51c2-29 17-44 34-44 20 0 34 15 34 43 0 15-6 27-14 35l-8-13h-29l-9 14c-6-9-8-21-8-35Z" fill="#fff" stroke="${color}" stroke-width="6"/>`:`<path d="M106 47c4-26 18-39 34-39 20 0 33 12 37 36-19-7-42-7-71 3Z" fill="${color}" stroke="#0f172a" stroke-width="5"/><path d="M114 25c16-12 37-12 54 0" stroke="${accent}" stroke-width="6"/>`}
      <ellipse cx="127" cy="52" rx="4" ry="5"/><ellipse cx="148" cy="52" rx="4" ry="5"/><path d="M131 66c5 4 9 4 14 0" fill="none" stroke="#9f1239" stroke-width="3"/>
    </g></svg>`);
  }

  const BG = {
    'tug-war': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#5ec5ff"/><stop offset=".55" stop-color="#e8f8ff"/><stop offset=".56" stop-color="#77c462"/><stop offset="1" stop-color="#cb8d4d"/></linearGradient><linearGradient id="d" x2="0" y2="1"><stop stop-color="#e8be7d"/><stop offset="1" stop-color="#c98c4e"/></linearGradient></defs><rect width="1200" height="700" fill="url(#s)"/><rect x="305" y="120" width="590" height="175" rx="18" fill="#eff8ff"/><path d="M280 120h640l-78-68H358Z" fill="#f59e0b"/><g fill="#2f7d42"><circle cx="105" cy="195" r="76"/><circle cx="195" cy="182" r="62"/><circle cx="1010" cy="190" r="76"/><circle cx="1100" cy="200" r="62"/></g><rect y="292" width="1200" height="115" fill="#315b3a" opacity=".62"/><g fill="#eef6ff">${Array.from({length:22},(_,i)=>`<circle cx="${60+i*52}" cy="${330+(i%2)*12}" r="12"/>`).join('')}</g><path d="M135 295V180M1065 295V180" stroke="#334155" stroke-width="5"/><path d="M140 185h82l-18 28 18 28h-82Z" fill="#2563eb"/><path d="M1060 185h-82l18 28-18 28h82Z" fill="#ef4444"/><rect y="410" width="1200" height="290" fill="url(#d)"/><path d="M600 414v286" stroke="#fff" stroke-width="7" stroke-opacity=".45" stroke-dasharray="22 16"/><g fill="#1f2937"><ellipse cx="80" cy="570" rx="55" ry="22"/><ellipse cx="1120" cy="570" rx="55" ry="22"/><ellipse cx="220" cy="625" rx="42" ry="16"/><ellipse cx="980" cy="625" rx="42" ry="16"/></g></svg>`,
    'base-battle': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#69c9ff"/><stop offset=".52" stop-color="#e6f8ff"/><stop offset=".53" stop-color="#83c968"/><stop offset="1" stop-color="#6eaa52"/></linearGradient></defs><rect width="1200" height="700" fill="url(#s)"/><rect x="330" y="88" width="540" height="150" rx="18" fill="#eef7ff"/><path d="M300 90h600l-72-62H372Z" fill="#ef9d32"/><rect y="240" width="1200" height="460" fill="#7fbd61"/><path d="M360 700c80-210 170-350 240-420 72 70 162 210 240 420Z" fill="#c7ad70" opacity=".6"/><g><g transform="translate(55 225)"><rect y="95" width="230" height="280" rx="12" fill="#2c67b7" stroke="#163d73" stroke-width="8"/><rect y="45" width="52" height="80" fill="#3479d8"/><rect x="89" y="20" width="52" height="105" fill="#3479d8"/><rect x="178" y="45" width="52" height="80" fill="#3479d8"/><path d="M88 375V260c0-42 55-42 55 0v115Z" fill="#16304f"/><path d="M114 20V-50" stroke="#1e293b" stroke-width="6"/><path d="M117-48h78l-22 25 22 25h-78Z" fill="#2563eb"/></g><g transform="translate(915 225)"><rect y="95" width="230" height="280" rx="12" fill="#c94a45" stroke="#7f1d1d" stroke-width="8"/><rect y="45" width="52" height="80" fill="#ef5f59"/><rect x="89" y="20" width="52" height="105" fill="#ef5f59"/><rect x="178" y="45" width="52" height="80" fill="#ef5f59"/><path d="M88 375V260c0-42 55-42 55 0v115Z" fill="#4b1c1c"/><path d="M114 20V-50" stroke="#1e293b" stroke-width="6"/><path d="M111-48H33l22 25-22 25h78Z" fill="#ef4444"/></g></g><g fill="#8a6847" stroke="#5a432f" stroke-width="4"><rect x="365" y="425" width="82" height="82" rx="5"/><rect x="748" y="435" width="82" height="82" rx="5"/><rect x="545" y="525" width="75" height="75" rx="5"/></g><g fill="#64748b"><rect x="465" y="365" width="95" height="38" rx="10"/><rect x="650" y="355" width="105" height="42" rx="10"/></g></svg>`,
    'battle-royale': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#93c96c"/><stop offset="1" stop-color="#b7864e"/></linearGradient><radialGradient id="l"><stop stop-color="#fff"/><stop offset=".22" stop-color="#8be8ff"/><stop offset=".48" stop-color="#2563eb"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="700" fill="url(#g)"/><path d="M0 470C210 350 320 360 450 440s280 95 430 10 230-70 320-45v295H0Z" fill="#c49a62" opacity=".72"/><g fill="#6b7280" stroke="#4b5563" stroke-width="4"><rect x="80" y="110" width="220" height="34" rx="6"/><rect x="266" y="110" width="34" height="155" rx="6"/><rect x="420" y="80" width="34" height="170" rx="6"/><rect x="420" y="216" width="200" height="34" rx="6"/><rect x="760" y="100" width="230" height="34" rx="6"/><rect x="760" y="100" width="34" height="155" rx="6"/><rect x="930" y="325" width="34" height="170" rx="6"/><rect x="735" y="461" width="229" height="34" rx="6"/><rect x="170" y="390" width="34" height="180" rx="6"/><rect x="170" y="536" width="230" height="34" rx="6"/><rect x="505" y="380" width="170" height="34" rx="6"/></g><g fill="#2f7d42" stroke="#25653a" stroke-width="4"><circle cx="110" cy="280" r="42"/><circle cx="350" cy="165" r="38"/><circle cx="690" cy="175" r="44"/><circle cx="1090" cy="240" r="40"/><circle cx="350" cy="470" r="48"/><circle cx="535" cy="600" r="42"/><circle cx="815" cy="590" r="44"/><circle cx="1085" cy="565" r="46"/></g><circle cx="600" cy="338" r="90" fill="url(#l)"/><path d="M555 300l45-28 45 28v58l-45 28-45-28Z" fill="#2563eb" stroke="#9ae6ff" stroke-width="6"/></svg>`,
    'quiz-race': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#6ccaff"/><stop offset=".58" stop-color="#e7f7ff"/><stop offset=".59" stop-color="#71bd5d"/><stop offset="1" stop-color="#4f8c48"/></linearGradient><linearGradient id="r" x2="0" y2="1"><stop stop-color="#555c66"/><stop offset="1" stop-color="#323740"/></linearGradient></defs><rect width="1200" height="700" fill="url(#s)"/><rect y="135" width="1200" height="135" fill="#2e6b5e" opacity=".55"/><g fill="#f5f7fa">${Array.from({length:26},(_,i)=>`<circle cx="${35+i*46}" cy="${180+(i%2)*10}" r="10"/>`).join('')}</g><rect y="265" width="1200" height="55" fill="#1f2937"/><g>${Array.from({length:14},(_,i)=>`<rect x="${i*90}" y="265" width="45" height="55" fill="#fbbf24"/><rect x="${i*90+45}" y="265" width="45" height="55" fill="#111827"/>`).join('')}</g><rect y="320" width="1200" height="380" fill="url(#r)"/><g stroke="#cbd5e1" stroke-width="5" stroke-dasharray="55 45"><path d="M0 438h1200"/><path d="M0 565h1200"/></g></svg>`,
    'laser-duel': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><defs><radialGradient id="b" cx=".5" cy=".35"><stop stop-color="#193575"/><stop offset=".55" stop-color="#081b42"/><stop offset="1" stop-color="#040a1d"/></radialGradient><linearGradient id="f" x2="0" y2="1"><stop stop-color="#102b5c"/><stop offset="1" stop-color="#07132e"/></linearGradient></defs><rect width="1200" height="700" fill="url(#b)"/><g fill="none" stroke="#163b80" stroke-width="18" opacity=".75"><path d="M0 0h260l110 110v180l-110 110H0"/><path d="M1200 0H940L830 110v180l110 110h260"/></g><g stroke-width="8" fill="none"><path d="M35 95h170l95 95" stroke="#22d3ee"/><path d="M1165 95H995l-95 95" stroke="#d946ef"/></g><g transform="translate(600 210)"><circle r="128" fill="#111b4d" stroke="#7c3aed" stroke-width="16"/><circle r="92" fill="#1d2a67" stroke="#22d3ee" stroke-width="7" opacity=".75"/></g><path d="M0 410h1200v290H0Z" fill="url(#f)"/><ellipse cx="600" cy="505" rx="255" ry="95" fill="#0c1f49" stroke="#7c3aed" stroke-width="8"/><ellipse cx="600" cy="505" rx="175" ry="62" fill="#102a58" stroke="#22d3ee" stroke-width="5"/><g fill="#805634" stroke="#c08b52" stroke-width="5"><rect x="75" y="470" width="125" height="125" rx="10"/><rect x="1000" y="470" width="125" height="125" rx="10"/></g></svg>`
  };

  const A = {};
  ['idle','run','attack','hit','win'].forEach(p => {
    A[`character.male-${p}`] = chibi('blue','male',p);
    A[`character.female-${p}`] = chibi('red','female',p);
  });
  A['modechar.laser-blue'] = laser('blue');
  A['modechar.laser-red'] = laser('red');
  A['vehicle.kart-blue'] = kart('#2563eb','#60a5fa','male');
  A['vehicle.kart-red'] = kart('#ef4444','#fb7185','female');
  A['vehicle.kart-green'] = kart('#16a34a','#4ade80','male');
  A['vehicle.kart-yellow'] = kart('#f59e0b','#fde047','female');
  Object.entries(BG).forEach(([k,v]) => { A[`background.${k}`] = svgData(v); });
  window.GAME_ARENA_V3_ASSETS = Object.freeze(A);
})();