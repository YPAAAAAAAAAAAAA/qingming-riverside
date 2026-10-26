/* Qingming riverside scroll. Original clean-room code. LICENSE.txt */
(function () {
  const VIEW_W = 440;
  const WORLD = 5400;
  const BRIDGE_L = 2730;
  const BRIDGE_R = 3090;
  const BRIDGE_C = (BRIDGE_L + BRIDGE_R) / 2;
  const HIT_L = BRIDGE_L + 70;
  const HIT_R = BRIDGE_R - 70;
  const RISE = 108;
  const STREET_F = 0.56;
  const TEA_X = 914;
  const DOCK1 = 1755;
  const DOCK2 = 3970;
  const FONT = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif';
  const ROBES = ["#f4f0e4", "#b4332c", "#2d4a6a", "#d8c4a0", "#3e6b4c", "#c47a32", "#6d4a78", "#8a8c84"];
  const UMB = ["#9c2e2a", "#2c4c6a", "#c6a15a", "#3e6b4c", "#6d4a78", "#8a5a34"];

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const toggle = document.getElementById("toggle");
  const panel = document.getElementById("panel");
  const chip = document.getElementById("chip");
  if (!ctx) return;

  let W = 390, H = 700, Sscale = 1, DPR = 1, streetY = 350, cam = 0, time = 0, coast = 0;
  let dragging = false, dragId = 0, dragX = 0, startX = 0, dragT = 0, dragMoved = false;
  let lastDt = 0.016;
  let pal = null;
  let readySent = false;
  let actx = null, riverGain = null, rainGain = null;
  let glowImg = null, grainPat = null;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function u(n) { return n * Sscale; }
  function sx(wx) { return (wx - cam) * Sscale; }

  const houses = [
    { x: 70, w: 180, h: 158, kind: "gate" },
    { x: 290, w: 104, h: 96, kind: "shop", sign: "酒", cloth: "#9c2e2a" },
    { x: 420, w: 86, h: 80, kind: "shop", sign: "米", cloth: "#c6a15a" },
    { x: 540, w: 116, h: 104, kind: "shop", sign: "绸", cloth: "#2c4c6a" },
    { x: 700, w: 78, h: 62, kind: "stall" },
    { x: 840, w: 148, h: 112, kind: "tea", sign: "茶", cloth: "#9c2e2a" },
    { x: 1040, w: 96, h: 88, kind: "shop", sign: "药", cloth: "#2f6a4a" },
    { x: 1220, w: 124, h: 100, kind: "mill" },
    { x: 1480, w: 104, h: 90, kind: "shop", sign: "渔", cloth: "#3a5e72" },
    { x: 1680, w: 150, h: 72, kind: "dock" },
    { x: 1980, w: 100, h: 90, kind: "shop", sign: "饼", cloth: "#b26a32" },
    { x: 2140, w: 84, h: 68, kind: "stall" },
    { x: 3360, w: 108, h: 94, kind: "shop", sign: "灯", cloth: "#9c2e2a" },
    { x: 3520, w: 80, h: 64, kind: "stall" },
    { x: 3680, w: 136, h: 116, kind: "inn", sign: "客", cloth: "#8e3a2a" },
    { x: 3900, w: 140, h: 72, kind: "dock" },
    { x: 4140, w: 110, h: 98, kind: "shop", sign: "书", cloth: "#2c4c6a" },
    { x: 4320, w: 96, h: 86, kind: "shop", sign: "扇", cloth: "#c6a15a" },
    { x: 4540, w: 190, h: 168, kind: "temple" },
    { x: 4820, w: 160, h: 140, kind: "gate" }
  ];
  const willows = [480, 1080, 1460, 2060, 2688, 3400, 4180, 4680, 5120];

  function buildPeople() {
    const R = rng(20261026);
    const list = [];
    const hero = [
      [2762, 0, 1, "straw", false],
      [2806, 12, 2, "cap", false],
      [2852, 0, 0, "wing", true],
      [2924, 0, 5, "straw", false],
      [2972, 14, 4, "none", false],
      [3018, 0, 3, "cap", false],
      [3056, 10, 6, "wing", false]
    ];
    for (let i = 0; i < hero.length; i++) {
      const h = hero[i];
      list.push({
        x: h[0], home: h[0], range: h[1] ? 36 : 0, speed: h[1], dir: i % 2 ? -1 : 1,
        robe: h[2], hat: h[3], phase: R() * 6, pole: h[4], kite: h[0] === 2924
      });
    }
    const zones = [[180, 2300], [3380, 5240]];
    for (let i = 0; i < 24; i++) {
      const z = zones[i % 2];
      const home = z[0] + R() * (z[1] - z[0]);
      const stand = R() < 0.38;
      list.push({
        x: home, home, range: stand ? 0 : 46 + R() * 70,
        speed: stand ? 0 : 8 + R() * 14, dir: R() < 0.5 ? -1 : 1,
        robe: (i * 3) % 8, hat: ["none", "cap", "straw", "wing"][i % 4],
        phase: R() * 6, pole: R() < 0.2, kite: false
      });
    }
    return list;
  }
  const people = buildPeople();

  const boats = [
    { id: "ferry", x: DOCK1, vx: 0, mast: 1, mastTo: 1, kind: "ferry", hitCd: 0, safe: false, wasFar: true, target: null },
    { id: "cargo", x: 2972, vx: 5, mast: 0.16, mastTo: 0.16, kind: "cargo", auto: true },
    { id: "fisher", x: 2812, vx: 2, mast: 0.18, mastTo: 0.18, kind: "skiff", auto: true },
    { id: "down", x: 4300, vx: -22, mast: 1, mastTo: 1, kind: "cargo", auto: true }
  ];
  const ferry = boats[0];

  const bits = [];
  for (let i = 0; i < 52; i++) {
    bits.push({
      x: ((i * 97) % 1000) / 1000,
      y: ((i * 53) % 1000) / 1000,
      v: 0.35 + (i % 7) * 0.08,
      ph: i * 1.7
    });
  }
  const stars = [];
  const starR = rng(7);
  for (let i = 0; i < 28; i++) stars.push({ x: starR(), y: starR() * 0.42, s: 0.4 + starR() });

  const state = {
    x: 2860,
    dir: 1,
    mode: "walk",
    sky: "day",
    season: "spring",
    teaT: 0,
    sketchT: 0,
    note: "",
    noteT: 0,
    seal: 0,
    shake: 0,
    target: null
  };

  function makePal(season, sky) {
    const p = {
      skyTop: "#8ec8dc", skyMid: "#d5e6d4", skyBot: "#e7f1ea",
      sun: "#fff3c4", hill: "#8ea58d", hill2: "#c9c2aa",
      waterTop: "#7eabba", waterBot: "#3d6c7c", foam: "rgba(255,255,255,0.38)",
      roof: "#3e5866", wall: "#f3ebda", wallShade: "#e3d4ba",
      wood: "#8a5634", earth: "#cbb892", bridge: "#b07240", bridgeDark: "#7a4a28",
      leaf: "#5f8f55", blossom: "#f0a3b6", reed: "#6d8a52",
      ink: "rgba(48,36,26,0.62)", skin: "#e2b48e", window: "#5c4636",
      lantern: "#e25a42", night: false, snowCap: false, rain: false
    };
    if (season === "summer") {
      p.skyTop = "#5eb4d4"; p.skyMid = "#b7ddc0"; p.skyBot = "#e7f0c4";
      p.leaf = "#2f7a45"; p.hill = "#6d9464"; p.waterTop = "#4e98b0";
      p.blossom = "#f4f7ea"; p.reed = "#3f7a48";
    } else if (season === "autumn") {
      p.skyTop = "#e39a58"; p.skyMid = "#f0c48a"; p.skyBot = "#f6e0b4";
      p.leaf = "#d07a32"; p.hill = "#b48858"; p.roof = "#6a3e34";
      p.blossom = "#e08a3c"; p.reed = "#a07840"; p.waterTop = "#6e94a4";
    } else if (season === "winter") {
      p.skyTop = "#d5dee6"; p.skyMid = "#e7eef2"; p.skyBot = "#f4f7f8";
      p.leaf = "#8e9894"; p.hill = "#b7c2c6"; p.hill2 = "#d5dde2";
      p.waterTop = "#9eb4be"; p.waterBot = "#6d8c98"; p.wall = "#f7f5f2";
      p.blossom = "#ffffff"; p.reed = "#9aa890"; p.snowCap = true; p.earth = "#ddd4c4";
    }
    if (sky === "rain") {
      p.rain = true;
      p.skyTop = season === "winter" ? "#c5ced4" : "#8e99a3";
      p.skyMid = season === "winter" ? "#d5dce0" : "#aeb8be";
      p.skyBot = season === "winter" ? "#e6ebed" : "#c5ced3";
      p.sun = "rgba(0,0,0,0)";
      p.waterTop = "#5c7c88"; p.waterBot = "#314e5a";
      p.foam = "rgba(255,255,255,0.22)";
      if (season === "winter") p.snowCap = true;
    } else if (sky === "night") {
      p.night = true;
      p.skyTop = "#12182c"; p.skyMid = "#1c2740"; p.skyBot = "#2a3348";
      p.sun = "#f3e7c4";
      p.hill = "#24323c"; p.hill2 = "#33424c";
      p.waterTop = "#1a3344"; p.waterBot = "#0d1a24";
      p.wall = "#b7ae9e"; p.wallShade = "#8e8678";
      p.roof = "#24323c"; p.window = "#ffc56e";
      p.bridge = "#6e4a30"; p.bridgeDark = "#3e2818";
      p.earth = "#6a5c48"; p.leaf = season === "autumn" ? "#7a4a28" : "#1d3a32";
      p.reed = "#1a3328"; p.foam = "rgba(180,200,210,0.18)";
      p.ink = "rgba(12,10,16,0.55)";
      if (season === "winter") p.snowCap = true;
    }
    return p;
  }

  function bridgeT(wx) {
    return (wx - BRIDGE_C) / ((BRIDGE_R - BRIDGE_L) / 2);
  }
  function archAmount(wx) {
    const t = bridgeT(wx);
    if (t <= -1 || t >= 1) return 0;
    const x = Math.abs(t);
    return Math.sqrt(Math.max(0, 1 - x * x));
  }
  function archY(wx) { return streetY - u(RISE) * archAmount(wx); }
  function underY(wx) {
    const a = archAmount(wx);
    return archY(wx) + u(12 + 18 * a);
  }
  function feetY(wx) {
    if (wx > BRIDGE_L && wx < BRIDGE_R) return archY(wx);
    return streetY;
  }
  function boatCenterY() { return streetY + u(3); }
  function mastTipY(b) {
    const len = b.kind === "ferry" ? 156 : b.kind === "skiff" ? 102 : 138;
    return boatCenterY() - u(10) - u(len) * b.mast;
  }
  function onBridge(x) { return x > BRIDGE_L + 16 && x < BRIDGE_R - 16; }
  function ferryAtQuay() {
    return Math.abs(ferry.x - DOCK1) < 96 || Math.abs(ferry.x - DOCK2) < 96;
  }
  function movingPlayer() {
    return dragging || state.target != null || Math.abs(coast) > 8;
  }

  function airKind() {
    if (state.sky === "night" && state.season !== "winter") return "bug";
    if (state.sky === "rain") return state.season === "winter" ? "snow" : "rain";
    if (state.season === "spring") return "petal";
    if (state.season === "autumn") return "leaf";
    if (state.season === "winter") return "snow";
    return "none";
  }

  function tone(freq, dur, type, gain) {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    const t0 = actx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function thud() { tone(140, 0.12, "triangle", 0.06); tone(80, 0.16, "sine", 0.04); }
  function chime() { tone(523, 0.18, "sine", 0.05); tone(659, 0.22, "sine", 0.04); tone(784, 0.28, "sine", 0.035); }
  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) {
      try { actx = new AC(); } catch (err) { return; }
      const len = actx.sampleRate;
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      let n = 0;
      for (let i = 0; i < len; i++) {
        n = (n + 0.02 * (Math.random() * 2 - 1)) * 0.96;
        d[i] = n * 2.2;
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = actx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      riverGain = actx.createGain();
      riverGain.gain.value = 0.03;
      src.connect(filter);
      filter.connect(riverGain);
      riverGain.connect(actx.destination);
      src.start();
      const src2 = actx.createBufferSource();
      src2.buffer = buf;
      src2.loop = true;
      const hp = actx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      rainGain = actx.createGain();
      rainGain.gain.value = 0;
      src2.connect(hp);
      hp.connect(rainGain);
      rainGain.connect(actx.destination);
      src2.start();
    }
    if (actx.state === "suspended") actx.resume();
  }
  function syncRainGain() {
    if (!rainGain || !actx) return;
    const g = state.sky === "rain" && state.season !== "winter" ? 0.045 : 0;
    rainGain.gain.setTargetAtTime(g, actx.currentTime, 0.2);
  }

  function currentAction() {
    if (state.mode === "tea") return null;
    if (state.mode === "boat") {
      const left = ferry.x > BRIDGE_L - 230 && ferry.x < HIT_L && ferry.vx >= -12;
      const right = ferry.x < BRIDGE_R + 230 && ferry.x > HIT_R && ferry.vx <= 12;
      if (ferry.mast > 0.5 && (left || right)) return { id: "mast", label: "收桅" };
      if (ferryAtQuay() && Math.abs(ferry.vx) < 18) return { id: "land", label: "上岸" };
      return null;
    }
    if (Math.abs(state.x - TEA_X) < 100) return { id: "tea", label: "饮茶" };
    if (!onBridge(state.x) && ferryAtQuay() && Math.abs(state.x - ferry.x) < 110) return { id: "board", label: "乘船" };
    return null;
  }
  function refreshChip() {
    const act = currentAction();
    if (!act) {
      chip.classList.remove("show", "hot");
      chip.dataset.act = "";
      chip.textContent = "";
      return;
    }
    chip.classList.add("show");
    chip.classList.toggle("hot", act.id === "mast");
    if (chip.dataset.act !== act.id) {
      chip.dataset.act = act.id;
      chip.textContent = act.label;
    }
  }
  function doAction(id) {
    ensureAudio();
    if (id === "tea" && state.mode === "walk") {
      state.mode = "tea";
      state.teaT = 3.3;
      state.target = null;
      coast = 0;
      state.note = "一盏清茗";
      state.noteT = 2.2;
      tone(520, 0.08, "sine", 0.04);
    } else if (id === "board" && state.mode === "walk") {
      state.mode = "boat";
      ferry.vx = 52;
      ferry.target = null;
      state.x = ferry.x;
      coast = 0;
      state.target = null;
      thud();
    } else if (id === "land" && state.mode === "boat") {
      state.mode = "walk";
      state.x = ferry.x;
      ferry.vx = 0;
      ferry.target = null;
      coast = 0;
      thud();
    } else if (id === "mast" && state.mode === "boat") {
      ferry.mastTo = 0.1;
      thud();
    }
  }

  function updateAuto(b, dt) {
    const d = b.x - BRIDGE_C;
    const toward = (b.vx > 4 && d < -30 && d > -560) || (b.vx < -4 && d > 30 && d < 560);
    const inside = b.x > BRIDGE_L - 20 && b.x < BRIDGE_R + 20;
    if (toward || (inside && Math.abs(b.vx) > 2)) b.mastTo = 0.14;
    else if (Math.abs(d) > 300) b.mastTo = 1;
    b.x += b.vx * dt;
    if (b.x > WORLD + 120) b.x = -80;
    if (b.x < -120) b.x = WORLD + 80;
    b.mast += (b.mastTo - b.mast) * Math.min(1, dt * 2.4);
  }
  function updateFerry(dt) {
    ferry.hitCd = Math.max(0, ferry.hitCd - dt);
    if (state.mode === "boat") {
      if (!dragging && ferry.target != null) {
        const d = ferry.target - ferry.x;
        if (Math.abs(d) < 8) { ferry.target = null; ferry.vx = 0; }
        else ferry.vx = Math.sign(d) * 76;
      } else if (!dragging) {
        ferry.vx *= Math.exp(-dt * 1.3);
        if (Math.abs(ferry.vx) < 6) ferry.vx = 0;
      }
      ferry.x += ferry.vx * dt;
      ferry.x = clamp(ferry.x, 80, WORLD - 80);
      if (ferry.x === 80 || ferry.x === WORLD - 80) { ferry.vx = 0; ferry.target = null; }
      const far = Math.abs(ferry.x - BRIDGE_C) > 480;
      if (far && !ferry.wasFar) ferry.mastTo = 1;
      ferry.wasFar = far;
      if (ferry.hitCd <= 0 && ferry.mast > 0.55 && ferry.mastTo > 0.45 && ferry.x > HIT_L && ferry.x < HIT_R && mastTipY(ferry) < underY(ferry.x)) {
        const back = ferry.vx >= 0 ? -1 : 1;
        ferry.x = back < 0 ? HIT_L - 18 : HIT_R + 18;
        ferry.vx = back * 96;
        ferry.target = null;
        ferry.safe = false;
        ferry.hitCd = 0.8;
        state.shake = 1;
        state.note = "桅太高";
        state.noteT = 1.3;
        thud();
      }
      const inside = ferry.x > HIT_L && ferry.x < HIT_R;
      if (ferry.mast < 0.32 && inside) ferry.safe = true;
      if (ferry.safe && !inside) {
        ferry.safe = false;
        state.seal = 1.6;
        state.note = "顺风过桥";
        state.noteT = 1.7;
        chime();
      }
      state.x = ferry.x;
      state.dir = ferry.vx >= 0 ? 1 : -1;
    }
    ferry.mast += (ferry.mastTo - ferry.mast) * Math.min(1, dt * 6.5);
  }
  function updatePeople(dt) {
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.speed <= 0) continue;
      p.x += p.dir * p.speed * dt;
      if (p.x > p.home + p.range) { p.x = p.home + p.range; p.dir = -1; }
      if (p.x < p.home - p.range) { p.x = p.home - p.range; p.dir = 1; }
    }
  }
  function updateBits(dt, kind) {
    if (kind === "none") return;
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      if (kind === "rain") {
        b.y += dt * b.v * 0.9;
        b.x -= dt * b.v * 0.25;
      } else if (kind === "snow") {
        b.y += dt * b.v * (state.sky === "rain" ? 0.28 : 0.12);
        b.x += Math.sin(time + b.ph) * dt * 0.05;
      } else if (kind === "petal" || kind === "leaf") {
        b.y += dt * b.v * 0.22;
        b.x += Math.sin(time * 1.4 + b.ph) * dt * 0.09;
      } else {
        b.x += Math.sin(time * 2 + b.ph) * dt * 0.1;
        b.y += Math.cos(time * 1.5 + b.ph) * dt * 0.07;
      }
      if (b.y > 1.06) b.y = -0.04;
      if (b.y < -0.08) b.y = 1.02;
      if (b.x > 1.08) b.x = -0.04;
      if (b.x < -0.08) b.x = 1.04;
    }
  }
  function placeCam(instant, dt) {
    let target = state.x - VIEW_W * 0.36;
    target = clamp(target, 20, WORLD - VIEW_W - 20);
    if (instant) cam = target;
    else cam += (target - cam) * (1 - Math.exp(-(dt || 0.016) * 4.5));
  }
  function update(dt) {
    time += dt;
    if (state.mode === "tea") {
      state.teaT -= dt;
      if (state.teaT <= 0) state.mode = "walk";
    } else if (state.mode === "walk" && !dragging) {
      if (state.target != null) {
        const d = state.target - state.x;
        const step = 125 * dt;
        if (Math.abs(d) <= step) { state.x = state.target; state.target = null; coast = 0; }
        else { state.x += Math.sign(d) * step; state.dir = d > 0 ? 1 : -1; }
      } else if (Math.abs(coast) > 4) {
        state.x += coast * dt;
        coast *= Math.exp(-dt * 2.6);
        state.dir = coast >= 0 ? 1 : -1;
      }
      state.x = clamp(state.x, 50, WORLD - 50);
    }
    updateFerry(dt);
    for (let i = 0; i < boats.length; i++) if (boats[i].auto) updateAuto(boats[i], dt);
    updatePeople(dt);
    updateBits(dt, airKind());
    state.noteT -= dt;
    if (state.seal > 0) state.seal -= dt;
    if (state.sketchT > 0) state.sketchT -= dt;
    state.shake *= Math.exp(-dt * 5);
    placeCam(false, dt);
    syncRainGain();
    refreshChip();
  }

  function roofAt(x, y, w, lift) {
    ctx.fillStyle = pal.roof;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.5, y - lift * 1.4, x + w, y);
    ctx.lineTo(x + w - u(3), y + lift * 0.42);
    ctx.quadraticCurveTo(x + w * 0.5, y - lift * 0.2, x + u(3), y + lift * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.bridgeDark;
    ctx.lineWidth = Math.max(1, Sscale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.5, y - lift * 1.4, x + w, y);
    ctx.stroke();
    if (pal.snowCap) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.moveTo(x + u(2), y);
      ctx.quadraticCurveTo(x + w * 0.5, y - lift * 1.35, x + w - u(2), y);
      ctx.quadraticCurveTo(x + w * 0.5, y - lift * 0.55, x + u(2), y);
      ctx.fill();
    }
  }
  function drawBanner(x, y, ch, color) {
    const s = Sscale;
    const h = 34 * s;
    const w = 15 * s;
    const wave = Math.sin(time * 2.2 + x * 0.02) * 2.2 * s;
    ctx.fillStyle = color || "#9c2e2a";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + wave);
    ctx.quadraticCurveTo(x + w + wave, y + h * 0.55, x + w * 0.72, y + h);
    ctx.lineTo(x + wave * 0.2, y + h - 2 * s);
    ctx.quadraticCurveTo(x - s, y + h * 0.45, x, y);
    ctx.fill();
    ctx.fillStyle = "#fff8ee";
    ctx.font = "600 " + Math.max(10, 12 * s) + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, x + w * 0.42 + wave * 0.15, y + h * 0.48);
  }
  function drawSteam(x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = (time * 0.32 + i * 0.37) % 1;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + Math.sin(time * 2 + i) * u(4) * p, y - p * u(34), u(1.8 + p * 2), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function glowAt(x, y, sc) {
    if (!pal.night || !glowImg) return;
    const s = u(54) * (sc || 1);
    ctx.drawImage(glowImg, x - s / 2, y - s / 2, s, s);
  }

  function drawHouse(h) {
    const x = sx(h.x);
    const w = u(h.w);
    if (x > W + 30 || x + w < -30) return;
    const bh = u(h.h);
    const y = streetY;
    if (h.kind === "dock") {
      ctx.fillStyle = "#7a5434";
      ctx.fillRect(x + w * 0.28, y, w * 0.42, u(40));
      ctx.fillStyle = "#5c3d26";
      for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.3, y + u(6) + i * u(9), w * 0.38, u(3));
      ctx.fillRect(x + w * 0.3, y + u(34), u(4), u(14));
      ctx.fillRect(x + w * 0.62, y + u(34), u(4), u(14));
      ctx.fillStyle = pal.wall;
      ctx.fillRect(x, y - bh, w * 0.4, bh);
      roofAt(x - u(4), y - bh, w * 0.46, u(12));
      return;
    }
    if (h.kind === "stall") {
      ctx.fillStyle = pal.wood;
      ctx.fillRect(x + w * 0.15, y - u(28), u(3), u(28));
      ctx.fillRect(x + w * 0.8, y - u(28), u(3), u(28));
      ctx.fillStyle = "#c4493a";
      ctx.beginPath();
      ctx.moveTo(x, y - u(28));
      ctx.lineTo(x + w, y - u(24));
      ctx.lineTo(x + w * 0.86, y - u(14));
      ctx.lineTo(x + w * 0.08, y - u(16));
      ctx.fill();
      ctx.fillStyle = "#d8c07a";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + w * (0.3 + i * 0.18), y - u(6), u(5), 0, 7);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = pal.wall;
    const bodyH = h.kind === "gate" || h.kind === "temple" ? bh * 0.7 : bh;
    ctx.fillRect(x, y - bodyH, w, bodyH);
    ctx.fillStyle = pal.wallShade;
    ctx.fillRect(x + w * 0.74, y - bodyH, w * 0.26, bodyH);
    if (h.kind === "gate" || h.kind === "temple") {
      const dw = w * 0.32;
      const dx = x + (w - dw) / 2;
      const archTop = y - bodyH * 0.62;
      ctx.fillStyle = pal.night ? "#140e0a" : "#3a2a20";
      ctx.beginPath();
      ctx.moveTo(dx, y);
      ctx.lineTo(dx, archTop);
      ctx.arc(dx + dw / 2, archTop, dw / 2, Math.PI, 0);
      ctx.lineTo(dx + dw, y);
      ctx.fill();
      roofAt(x - u(8), y - bodyH, w + u(16), u(18));
      roofAt(x + w * 0.14, y - bodyH - u(26), w * 0.72, u(14));
      if (h.kind === "temple") {
        ctx.fillStyle = pal.window;
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y - bodyH - u(8), u(7), 0, 7);
        ctx.fill();
        if (pal.night) glowAt(x + w * 0.5, y - bodyH * 0.45, 1.3);
      }
      ctx.fillStyle = "#8e2f2a";
      ctx.fillRect(x + w * 0.36, y - bodyH * 0.78, w * 0.28, u(14));
      return;
    }
    const dw = Math.min(w * 0.26, u(18));
    ctx.fillStyle = pal.night ? "#2a1c12" : pal.wood;
    ctx.fillRect(x + w * 0.4, y - bodyH * 0.52, dw, bodyH * 0.52);
    ctx.fillStyle = pal.window;
    ctx.fillRect(x + w * 0.12, y - bodyH * 0.72, w * 0.16, bodyH * 0.2);
    ctx.fillRect(x + w * 0.66, y - bodyH * 0.72, w * 0.16, bodyH * 0.2);
    if (pal.night) {
      glowAt(x + w * 0.2, y - bodyH * 0.62, 0.9);
      glowAt(x + w * 0.74, y - bodyH * 0.62, 0.9);
    }
    roofAt(x - u(6), y - bodyH, w + u(12), u(h.kind === "inn" ? 20 : 15));
    if (h.kind === "inn") roofAt(x + w * 0.12, y - bodyH - u(18), w * 0.76, u(12));
    if (h.sign) drawBanner(x + w * 0.78, y - bodyH - u(6), h.sign, h.cloth);
    if (h.kind === "tea") drawSteam(x + w * 0.3, y - u(8), 3);
    if (h.kind === "mill") {
      const wx = x + w + u(8);
      const wy = y + u(16);
      const r = u(24);
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(time * 0.55);
      ctx.strokeStyle = pal.wood;
      ctx.lineWidth = 2 * Sscale;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 7);
      ctx.stroke();
      ctx.fillStyle = pal.bridge;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(r - u(2), -u(4), u(8), u(8));
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function drawBridge() {
    const s = Sscale;
    const steps = 28;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const wx = BRIDGE_L + ((BRIDGE_R - BRIDGE_L) * i) / steps;
      pts.push({ x: sx(wx), y: archY(wx), u: underY(wx), wx: wx });
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].u);
    ctx.closePath();
    ctx.fillStyle = pal.bridge;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].u - u(5));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].u - u(4));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].u);
    ctx.closePath();
    ctx.fillStyle = pal.bridgeDark;
    ctx.fill();
    ctx.strokeStyle = "rgba(62, 36, 18, 0.72)";
    ctx.lineWidth = Math.max(1, s * 1.25);
    for (let wx = BRIDGE_L + 14; wx < BRIDGE_R - 8; wx += 20) {
      const x = sx(wx);
      ctx.beginPath();
      ctx.moveTo(x, archY(wx) + u(1));
      ctx.lineTo(x, underY(wx) - u(1));
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, s * 0.9);
    ctx.strokeStyle = "rgba(90, 52, 28, 0.55)";
    for (let wx = BRIDGE_L + 14; wx < BRIDGE_R - 28; wx += 40) {
      const x1 = sx(wx);
      const x2 = sx(wx + 20);
      ctx.beginPath();
      ctx.moveTo(x1, archY(wx) + u(2));
      ctx.lineTo(x2, underY(wx + 20) - u(2));
      ctx.moveTo(x2, archY(wx + 20) + u(2));
      ctx.lineTo(x1, underY(wx) - u(2));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.lineWidth = 1.6 * s;
    ctx.strokeStyle = pal.bridgeDark;
    for (let i = 0; i < pts.length; i++) {
      const y = pts[i].y - u(13);
      if (i === 0) ctx.moveTo(pts[i].x, y);
      else ctx.lineTo(pts[i].x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = pal.wood;
    ctx.lineWidth = Math.max(1, s);
    for (let wx = BRIDGE_L + 10; wx < BRIDGE_R; wx += 24) {
      const x = sx(wx);
      const y = archY(wx);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - u(13));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 236, 210, 0.38)";
    ctx.lineWidth = 1.5 * s;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y + u(2));
      else ctx.lineTo(pts[i].x, pts[i].y + u(2));
    }
    ctx.stroke();
    drawAbutment(BRIDGE_L, -1);
    drawAbutment(BRIDGE_R, 1);
    if (sx(BRIDGE_L + 36) > -20 && sx(BRIDGE_L + 36) < W + 20) {
      drawBanner(sx(BRIDGE_L + 28), archY(BRIDGE_L + 28) - u(48), "虹", "#9c2e2a");
    }
    if (sx(BRIDGE_R - 36) > -20 && sx(BRIDGE_R - 36) < W + 20) {
      drawBanner(sx(BRIDGE_R - 28), archY(BRIDGE_R - 28) - u(48), "桥", "#9c2e2a");
    }
  }
  function drawAbutment(wx, side) {
    const x = sx(wx);
    const top = archY(wx);
    const w = u(34);
    const h = u(52);
    const left = side < 0 ? x - w * 0.25 : x - w * 0.75;
    ctx.fillStyle = "#d7cdb8";
    ctx.fillRect(left, top, w, h);
    ctx.fillStyle = "#b7aa92";
    ctx.fillRect(left + w * 0.72, top, w * 0.28, h);
    ctx.strokeStyle = "rgba(80, 60, 40, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = top + (h * i) / 4;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
    }
    ctx.fillStyle = pal.bridgeDark;
    ctx.fillRect(left - u(3), top - u(2), w + u(6), u(6));
    if (pal.night) glowAt(left + w * 0.5, top + u(8), 0.7);
  }

  function drawBoat(b) {
    const x = sx(b.x);
    if (x < -u(140) || x > W + u(140)) return;
    const y = boatCenterY();
    const s = Sscale;
    const big = b.kind !== "skiff";
    const len = (b.kind === "skiff" ? 52 : b.kind === "ferry" ? 86 : 104) * s;
    ctx.fillStyle = "rgba(16, 36, 48, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x + 4 * s, y + 12 * s, len * 0.62, 5.5 * s, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = b.kind === "ferry" ? "#8d5a32" : b.kind === "skiff" ? "#5d6e78" : "#6a3e24";
    ctx.beginPath();
    ctx.moveTo(x - len, y - 1 * s);
    ctx.quadraticCurveTo(x - len * 0.15, y + 16 * s, x + len * 0.42, y + 11 * s);
    ctx.quadraticCurveTo(x + len * 0.95, y + 3 * s, x + len * 0.7, y - 9 * s);
    ctx.lineTo(x - len * 0.62, y - 9 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 24, 12, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 236, 210, 0.4)";
    ctx.beginPath();
    ctx.moveTo(x - len * 0.72, y);
    ctx.quadraticCurveTo(x, y + 7 * s, x + len * 0.48, y - 2 * s);
    ctx.stroke();
    if (big) {
      ctx.fillStyle = "#c6a15a";
      ctx.fillRect(x - 34 * s, y - 22 * s, 15 * s, 12 * s);
      ctx.fillStyle = "#8a5430";
      ctx.fillRect(x - 18 * s, y - 27 * s, 16 * s, 16 * s);
      ctx.fillStyle = pal.night ? "#a84832" : "#f4efe2";
      ctx.fillRect(x + 4 * s, y - 32 * s, 30 * s, 22 * s);
      roofAt(x, y - 32 * s, 38 * s, 9 * s);
      ctx.fillStyle = pal.window;
      ctx.fillRect(x + 15 * s, y - 25 * s, 8 * s, 9 * s);
    }
    const tip = mastTipY(b);
    const baseY = y - 8 * s;
    const mx = x - (big ? 30 : 8) * s;
    if (b.mast > 0.05) {
      ctx.strokeStyle = "#3a2918";
      ctx.lineWidth = Math.max(1.2, 2.1 * s);
      ctx.beginPath();
      ctx.moveTo(mx, baseY);
      ctx.lineTo(mx, tip);
      ctx.stroke();
      if (b.mast > 0.45) {
        ctx.fillStyle = b.kind === "ferry" ? "rgba(246, 240, 224, 0.94)" : "rgba(186, 92, 48, 0.9)";
        ctx.beginPath();
        ctx.moveTo(mx, tip + 6 * s);
        ctx.quadraticCurveTo(mx + 30 * s * b.mast, (tip + baseY) * 0.5, mx + 20 * s * b.mast, baseY);
        ctx.lineTo(mx, baseY);
        ctx.fill();
      } else {
        ctx.strokeStyle = "#e4d2ae";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(mx - 3.2 * s, tip + 3 * s);
        ctx.lineTo(mx + 3.2 * s, baseY - 1 * s);
        ctx.moveTo(mx + 3.2 * s, tip + 3 * s);
        ctx.lineTo(mx - 3.2 * s, baseY - 1 * s);
        ctx.stroke();
      }
    }
    const wake = (time * 28 + (b.x % 40)) % 26;
    ctx.strokeStyle = pal.foam;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x - len * 0.2, y + 14 * s);
    ctx.quadraticCurveTo(x - len * 0.55 - wake, y + 18 * s, x - len - wake * 1.4, y + 12 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (b === ferry && state.mode === "boat") {
      drawPersonAt(x + 16 * s, y - 2 * s, {
        robe: "#1e3f6b", sash: "#c4372f", hat: "cap", scale: 0.92,
        dir: state.dir, moving: false, phase: 0.2, seated: true, marker: true
      });
    } else if (b.kind === "skiff") {
      drawPersonAt(x + 8 * s, y - 2 * s, {
        robe: "#3e6b4c", hat: "straw", scale: 0.78, dir: 1, moving: false, phase: 2, seated: true
      });
    }
    if (pal.night) glowAt(x + 18 * s, y - 24 * s, 1.2);
  }

  function drawPersonAt(px, feet, opt) {
    const sc = (opt.scale || 1) * Sscale;
    const bob = opt.moving ? Math.sin(time * 8 + opt.phase) * 1.3 * sc : Math.sin(time * 1.6 + opt.phase) * 0.35 * sc;
    const y = feet + bob;
    const leg = opt.moving ? Math.sin(time * 8 + opt.phase) : 0;
    const rain = state.sky === "rain" && !opt.seated;
    ctx.save();
    ctx.translate(px, y);
    ctx.fillStyle = opt.marker ? "rgba(160,48,40,0.28)" : "rgba(40,30,20,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 2, (opt.marker ? 9 : 8) * sc, 3 * sc, 0, 0, 7);
    ctx.fill();
    if (!opt.seated) {
      ctx.strokeStyle = pal.night ? "#241c16" : "#3a2c22";
      ctx.lineWidth = Math.max(1, 1.5 * sc);
      ctx.beginPath();
      ctx.moveTo(-2.2 * sc, -7 * sc);
      ctx.lineTo(-2.2 * sc + leg * 4 * sc, 0);
      ctx.moveTo(2.2 * sc, -7 * sc);
      ctx.lineTo(2.2 * sc - leg * 4 * sc, 0);
      ctx.stroke();
    }
    ctx.fillStyle = opt.robe;
    ctx.beginPath();
    if (opt.seated) {
      ctx.moveTo(-8 * sc, -16 * sc);
      ctx.lineTo(8 * sc, -16 * sc);
      ctx.lineTo(11 * sc, -4 * sc);
      ctx.lineTo(-11 * sc, -4 * sc);
    } else {
      ctx.moveTo(-7 * sc, -28 * sc);
      ctx.lineTo(7 * sc, -28 * sc);
      ctx.lineTo(9.5 * sc, -8 * sc);
      ctx.lineTo(-9.5 * sc, -8 * sc);
    }
    ctx.closePath();
    ctx.fill();
    if (opt.sash) {
      ctx.fillStyle = opt.sash;
      ctx.fillRect(-7 * sc, opt.seated ? -12 * sc : -18 * sc, 14 * sc, 2.2 * sc);
    }
    const headY = opt.seated ? -20 * sc : -33 * sc;
    ctx.fillStyle = "#2a211c";
    ctx.beginPath();
    ctx.arc(0, headY - 1.2 * sc, 4.4 * sc, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(opt.dir * 0.3 * sc, headY, 4 * sc, 0, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(60,30,24,0.55)";
    ctx.fillRect(-0.7 * sc, headY - 0.2 * sc, 1.3 * sc, 1.1 * sc);
    if (opt.hat === "straw") {
      ctx.fillStyle = "#e0c88a";
      ctx.beginPath();
      ctx.ellipse(0, headY - 2 * sc, 9 * sc, 2.5 * sc, 0, 0, 7);
      ctx.fill();
    } else if (opt.hat === "cap") {
      ctx.fillStyle = "#22262c";
      ctx.fillRect(-4 * sc, headY - 5.5 * sc, 8 * sc, 3.6 * sc);
    } else if (opt.hat === "wing") {
      ctx.fillStyle = "#1c1e24";
      ctx.fillRect(-9 * sc, headY - 4 * sc, 18 * sc, 2.1 * sc);
      ctx.fillRect(-3 * sc, headY - 7 * sc, 6 * sc, 4 * sc);
    }
    if (opt.pole && !rain && !opt.seated) {
      ctx.strokeStyle = pal.wood;
      ctx.lineWidth = 1.2 * sc;
      ctx.beginPath();
      ctx.moveTo(-13 * sc, -24 * sc);
      ctx.lineTo(13 * sc, -23 * sc);
      ctx.stroke();
      ctx.fillStyle = "#c6a15a";
      ctx.fillRect(-15 * sc, -21 * sc, 4.5 * sc, 4 * sc);
      ctx.fillRect(11 * sc, -20 * sc, 4.5 * sc, 4 * sc);
    }
    if (rain) {
      ctx.fillStyle = UMB[(opt.phase | 0) % UMB.length];
      ctx.beginPath();
      ctx.ellipse(0, headY - 10 * sc, 13 * sc, 4.2 * sc, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#3a2a1c";
      ctx.beginPath();
      ctx.moveTo(0, headY - 10 * sc);
      ctx.lineTo(0, headY + 2 * sc);
      ctx.stroke();
    }
    if (opt.seated && opt.marker) {
      ctx.fillStyle = "#f4f0e6";
      ctx.fillRect(10 * sc, -6 * sc, 7 * sc, 3 * sc);
      ctx.fillStyle = "#8e2f2a";
      ctx.fillRect(11.2 * sc, -10 * sc, 4.4 * sc, 4.2 * sc);
    }
    ctx.restore();
    if (opt.seated && opt.marker) drawSteam(px + 13 * Sscale, feet - 10 * Sscale, 3);
  }

  function drawWillow(wx) {
    const x = sx(wx);
    if (x < -u(50) || x > W + u(50)) return;
    const y = streetY;
    const s = Sscale;
    ctx.strokeStyle = "#6e4a30";
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 6 * s, y - 28 * s, x - 1 * s, y - 54 * s);
    ctx.stroke();
    ctx.strokeStyle = pal.leaf;
    ctx.lineWidth = 1.25 * s;
    for (let i = 0; i < 6; i++) {
      const a = -1 + i * 0.38;
      const sway = Math.sin(time * 1.3 + wx * 0.01 + i) * 5 * s;
      ctx.beginPath();
      ctx.moveTo(x, y - 40 * s);
      ctx.quadraticCurveTo(x + Math.sin(a) * 22 * s, y - 18 * s, x + Math.sin(a) * 32 * s + sway, y + 2 * s);
      ctx.stroke();
    }
    if (state.season === "spring" && state.sky === "day") {
      ctx.fillStyle = pal.blossom;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(x + (i - 2) * 7 * s, y - 34 * s - (i % 2) * 8 * s, 2.1 * s, 0, 7);
        ctx.fill();
      }
    }
  }
  function drawKite(p) {
    if (!p.kite || state.sky !== "day") return;
    const x = sx(p.x);
    const y = feetY(p.x);
    if (x < -20 || x > W + 20) return;
    const kx = x - u(34) + Math.sin(time * 0.8 + p.phase) * u(10);
    const ky = y - u(112) + Math.sin(time * 1.1) * u(6);
    ctx.strokeStyle = "rgba(60,40,30,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - u(34));
    ctx.lineTo(kx, ky);
    ctx.stroke();
    ctx.fillStyle = "#c4372f";
    ctx.beginPath();
    ctx.moveTo(kx, ky - u(9));
    ctx.lineTo(kx + u(7), ky);
    ctx.lineTo(kx, ky + u(9));
    ctx.lineTo(kx - u(7), ky);
    ctx.fill();
    ctx.fillStyle = "#f6e2aa";
    ctx.beginPath();
    ctx.moveTo(kx, ky - u(4));
    ctx.lineTo(kx + u(3.2), ky);
    ctx.lineTo(kx, ky + u(4));
    ctx.lineTo(kx - u(3.2), ky);
    ctx.fill();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, streetY);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.55, pal.skyMid);
    g.addColorStop(1, pal.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (pal.night) {
      ctx.fillStyle = "rgba(244,236,210,0.85)";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = 0.45 + Math.sin(time * 2 + i) * 0.35;
        ctx.globalAlpha = tw;
        ctx.fillRect(s.x * W, s.y * H * 0.7, s.s * 1.7, s.s * 1.7);
      }
      ctx.globalAlpha = 1;
    }
    if (state.sky !== "rain") {
      const sunX = W * (pal.night ? 0.78 : 0.18);
      const sunY = H * 0.11;
      const rad = ctx.createRadialGradient(sunX, sunY, u(4), sunX, sunY, u(pal.night ? 28 : 46));
      rad.addColorStop(0, pal.sun);
      rad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, u(pal.night ? 28 : 46), 0, 7);
      ctx.fill();
      if (pal.night) {
        ctx.fillStyle = "#f4ead0";
        ctx.beginPath();
        ctx.arc(sunX, sunY, u(9), 0, 7);
        ctx.fill();
      }
    }
  }
  function drawRidge(color, base, amp, par, seed) {
    ctx.beginPath();
    const step = 28;
    let started = false;
    for (let x = -20; x <= W + 30; x += step) {
      const wx = (x + cam * par) * 0.012 + seed;
      const y = base + Math.sin(wx) * amp + Math.sin(wx * 0.37 + seed) * amp * 0.4;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 30, base + amp * 2);
    ctx.lineTo(-20, base + amp * 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function drawPagoda() {
    const s = Sscale;
    const x = W * 0.82 - (cam * 0.03);
    const base = archY(BRIDGE_C) - u(78);
    ctx.save();
    ctx.globalAlpha = pal.night ? 0.4 : 0.5;
    ctx.fillStyle = pal.hill2;
    let y = base;
    for (let i = 0; i < 5; i++) {
      const w = (42 - i * 5) * s;
      const h = 10 * s;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.72, y - h);
      ctx.lineTo(x, y - h - 8 * s);
      ctx.lineTo(x + w * 0.72, y - h);
      ctx.lineTo(x + w * 0.46, y);
      ctx.lineTo(x - w * 0.46, y);
      ctx.fill();
      y -= h + 7 * s;
    }
    ctx.restore();
  }
  function drawClouds() {
    if (state.sky === "rain") return;
    ctx.fillStyle = pal.night ? "rgba(180,190,210,0.08)" : "rgba(255,252,246,0.75)";
    for (let i = 0; i < 3; i++) {
      const x = ((i * W * 0.38 + time * 10) % (W + 180)) - 70;
      const y = H * (0.07 + i * 0.055);
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.1, u(11), 0, 0, 7);
      ctx.ellipse(x + u(18), y + u(2), W * 0.06, u(8), 0, 0, 7);
      ctx.fill();
    }
  }
  function drawDistantTrees(base) {
    ctx.fillStyle = pal.hill;
    for (let i = 0; i < 11; i++) {
      const span = W + 36;
      const x = ((i * 64 - cam * 0.16) % span + span) % span - 8;
      const h = u(14 + (i % 4) * 7);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x, base + u(4));
      ctx.quadraticCurveTo(x + u(7), base - h, x + u(14), base + u(4));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawBirds() {
    if (state.sky === "rain") return;
    ctx.strokeStyle = pal.night ? "rgba(210,214,224,0.55)" : "rgba(48,38,28,0.55)";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < 4; i++) {
      const x = ((i * 150 + time * 16) % (W + 50)) - 20;
      const y = H * 0.09 + i * 12 + Math.sin(time * 2 + i) * 6;
      const wing = 6 + Math.sin(time * 7 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x - wing, y);
      ctx.quadraticCurveTo(x - wing * 0.35, y - wing * 0.55, x, y);
      ctx.quadraticCurveTo(x + wing * 0.35, y - wing * 0.55, x + wing, y);
      ctx.stroke();
    }
  }
  function drawFarShore() {
    const base = archY(BRIDGE_C) - u(52);
    ctx.globalAlpha = pal.night ? 0.4 : 0.62;
    ctx.fillStyle = pal.roof;
    for (let i = 0; i < 7; i++) {
      const span = W + 70;
      const x = ((i * 118 - cam * 0.12) % span + span) % span - 24;
      const rw = u(16 + (i % 3) * 7);
      const rh = u(9 + (i % 2) * 4);
      const y = base - rh;
      ctx.fillRect(x, y, rw, rh);
      ctx.beginPath();
      ctx.moveTo(x - u(3), y);
      ctx.lineTo(x + rw * 0.5, y - u(6));
      ctx.lineTo(x + rw + u(3), y);
      ctx.fill();
      if (pal.night && i % 2 === 0) glowAt(x + rw * 0.5, y + rh * 0.4, 0.55);
    }
    ctx.globalAlpha = 1;
  }
  function drawReflection() {
    const xL = sx(BRIDGE_L);
    const xR = sx(BRIDGE_R);
    if (xR < -20 || xL > W + 20) return;
    const water = streetY + u(10);
    ctx.save();
    ctx.globalAlpha = pal.night ? 0.14 : 0.2;
    ctx.fillStyle = pal.bridgeDark;
    ctx.beginPath();
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const wx = BRIDGE_L + ((BRIDGE_R - BRIDGE_L) * i) / steps;
      const depth = (streetY - archY(wx)) * 0.55;
      const x = sx(wx);
      const y = water + depth;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(sx(BRIDGE_R), water);
    ctx.lineTo(sx(BRIDGE_L), water);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawDucks() {
    if (state.sky === "rain" && state.season !== "winter") return;
    for (let i = 0; i < 4; i++) {
      const x = sx(1680 + i * 980 + Math.sin(time * 0.35 + i) * 24);
      if (x < -12 || x > W + 12) continue;
      const y = boatCenterY() + u(36 + (i % 2) * 22);
      if (y > H - 10) continue;
      ctx.fillStyle = i % 2 ? "#6d4a28" : "#2a241c";
      ctx.beginPath();
      ctx.ellipse(x, y, u(7), u(3.1), 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#e2a04a";
      ctx.beginPath();
      ctx.moveTo(x + u(6), y - u(1));
      ctx.lineTo(x + u(11), y + u(0.4));
      ctx.lineTo(x + u(6), y + u(1.6));
      ctx.fill();
    }
  }
  function drawWater() {
    const top = streetY - u(2);
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, pal.waterTop);
    g.addColorStop(1, pal.waterBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
    ctx.strokeStyle = pal.foam;
    ctx.lineWidth = 1;
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const y = top + u(12) + ((H - top) * (i + 0.4)) / (bands + 0.3);
      if (y > H - 4) break;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      const shift = time * 30 + i * 40;
      for (let x = 0; x <= W; x += 18) {
        const yy = y + Math.sin((x + cam * 0.5 + shift) * 0.028 + i) * (1.2 + i * 0.2);
        if (x === 0) ctx.moveTo(0, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (state.season === "summer" && !pal.night) {
      ctx.fillStyle = "rgba(40,120,72,0.72)";
      for (let i = 0; i < 8; i++) {
        const x = sx(360 + i * 640);
        if (x < -10 || x > W + 10) continue;
        const y = boatCenterY() + u(46 + (i % 3) * 16);
        if (y > H - 6) continue;
        ctx.beginPath();
        ctx.ellipse(x, y, u(11), u(4), 0.3, 0, 7);
        ctx.fill();
      }
    }
  }
  function drawBank() {
    const xL = sx(BRIDGE_L);
    const xR = sx(BRIDGE_R);
    const y = streetY - u(8);
    const h = u(20);
    ctx.fillStyle = pal.earth;
    if (xL > 2) ctx.fillRect(0, y, Math.min(xL - u(2), W), h);
    if (xR < W - 2) {
      const left = Math.max(0, xR + u(2));
      ctx.fillRect(left, y, W - left, h);
    }
    ctx.fillStyle = "rgba(92, 70, 46, 0.28)";
    if (xL > 2) ctx.fillRect(0, y, Math.min(xL - u(2), W), u(4));
    if (xR < W - 2) {
      const left = Math.max(0, xR + u(2));
      ctx.fillRect(left, y, W - left, u(4));
    }
  }
  function drawReeds() {
    const y0 = H - 1;
    ctx.strokeStyle = pal.reed;
    ctx.lineWidth = Math.max(1, 1.3 * Sscale);
    for (let i = 0; i < 22; i++) {
      const span = W + 50;
      const x = ((i * 41 - cam * 1.15) % span + span) % span - 20;
      const h = u(34 + (i % 5) * 14);
      const sway = Math.sin(time * 1.4 + i) * u(5);
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + sway, y0 - h * 0.55, x + sway * 1.3, y0 - h);
      ctx.stroke();
    }
  }
  function drawBits(kind) {
    if (kind === "none") return;
    const heavy = state.sky === "rain";
    for (let i = 0; i < bits.length; i++) {
      if (!heavy && kind === "snow" && i % 2 === 1) continue;
      const b = bits[i];
      const x = b.x * W;
      const y = b.y * H;
      if (kind === "rain") {
        ctx.strokeStyle = "rgba(226,234,238,0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - u(7), y + u(16));
        ctx.stroke();
        if (y > streetY && (i % 4) === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.beginPath();
          ctx.arc(x, streetY + u(14) + (i % 5) * u(8), u(3 + (time * 8 + i) % 4), 0, 7);
          ctx.stroke();
        }
      } else if (kind === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x, y, 2.2, 2.2);
      } else if (kind === "petal") {
        ctx.fillStyle = pal.blossom;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time + b.ph);
        ctx.fillRect(-2, -1.2, 4, 2.4);
        ctx.restore();
      } else if (kind === "leaf") {
        ctx.fillStyle = "#d07a32";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 0.6 + b.ph);
        ctx.fillRect(-2.4, -1.4, 5, 2.6);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(210,255,140,0.8)";
        ctx.globalAlpha = 0.4 + Math.sin(time * 5 + b.ph) * 0.4;
        ctx.fillRect(x, y, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawFish() {
    ctx.strokeStyle = pal.night ? "rgba(180,210,210,0.65)" : "rgba(36,64,74,0.6)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const cyc = 7;
      const u0 = (time + i * 2.4) % cyc;
      if (u0 > 0.75) continue;
      const p = u0 / 0.75;
      const x = sx(900 + i * 1500);
      if (x < -10 || x > W + 10) continue;
      const y = boatCenterY() + u(18) - Math.sin(p * Math.PI) * u(24);
      ctx.beginPath();
      ctx.ellipse(x, y, u(7), u(2.2), -0.4 + p, 0, 7);
      ctx.stroke();
    }
  }
  function drawSeal(x, y, ch, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(-0.08);
    ctx.strokeStyle = "#c4372f";
    ctx.lineWidth = 2;
    ctx.strokeRect(-15, -15, 30, 30);
    ctx.fillStyle = "#c4372f";
    ctx.font = "700 15px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, 0, 1);
    ctx.restore();
  }
  function drawSketch() {
    if (state.sketchT <= 0) return;
    const fade = state.sketchT < 0.55 ? state.sketchT / 0.55 : 1;
    const m = 12;
    ctx.save();
    ctx.globalAlpha = 0.16 * fade;
    ctx.fillStyle = "#f3ead8";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = "rgba(48,34,22,0.8)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.strokeRect(m + 4, m + 4, W - (m + 4) * 2, H - (m + 4) * 2);
    ctx.fillStyle = "#8e2f2a";
    ctx.font = "600 " + Math.max(12, 13 * Sscale) + "px " + FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("沿河画稿", m + 10, m + 10);
    ctx.restore();
    drawSeal(W - m - 34, H - m - 46, "河", fade);
  }
  function drawNote() {
    if (state.noteT <= 0 || !state.note) return;
    const x = sx(state.mode === "boat" ? ferry.x : state.x);
    const y = (state.mode === "boat" ? boatCenterY() : feetY(state.x)) - u(78);
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.noteT);
    ctx.fillStyle = pal.night ? "#f6e7c8" : "#3a2718";
    ctx.font = "600 " + Math.max(13, 15 * Sscale) + "px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.note, x, y);
    ctx.restore();
  }
  function drawVignette() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(40,24,12,0.1)");
    g.addColorStop(0.18, "rgba(40,24,12,0)");
    g.addColorStop(0.78, "rgba(40,24,12,0)");
    g.addColorStop(1, "rgba(20,16,10,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (grainPat) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = grainPat;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    pal = makePal(state.season, state.sky);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    if (state.shake > 0.05) {
      const m = state.shake * 5;
      ctx.translate(Math.sin(time * 46) * m, Math.cos(time * 33) * m * 0.45);
    }
    drawSky();
    drawClouds();
    const crown = archY(BRIDGE_C);
    drawRidge(pal.hill2, crown - u(86), u(16), 0.12, 1.2);
    drawRidge(pal.hill, crown - u(40), u(14), 0.2, 2.4);
    drawDistantTrees(crown - u(34));
    drawPagoda();
    drawBirds();
    drawFarShore();
    drawWater();
    drawReflection();
    drawFish();
    drawDucks();
    drawBank();
    for (let i = 0; i < houses.length; i++) drawHouse(houses[i]);
    for (let i = 0; i < willows.length; i++) drawWillow(willows[i]);
    for (let i = 0; i < boats.length; i++) drawBoat(boats[i]);
    drawBridge();
    const umbrellaSky = state.sky === "rain";
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const x = sx(p.x);
      if (x < -u(30) || x > W + u(30)) continue;
      drawPersonAt(x, feetY(p.x), {
        robe: ROBES[p.robe % ROBES.length],
        hat: umbrellaSky ? "straw" : p.hat,
        scale: 1,
        dir: p.dir,
        moving: p.speed > 0,
        phase: p.phase,
        pole: p.pole
      });
      drawKite(p);
    }
    if (state.mode !== "boat") {
      drawPersonAt(sx(state.x), feetY(state.x), {
        robe: "#1e3f6b",
        sash: "#c4372f",
        hat: "cap",
        scale: 1.18,
        dir: state.dir,
        moving: state.mode !== "tea" && movingPlayer(),
        phase: 0.4,
        seated: state.mode === "tea",
        marker: true
      });
    }
    drawReeds();
    drawBits(airKind());
    if (state.seal > 0) drawSeal(sx(BRIDGE_C), archY(BRIDGE_C) - u(36), "过", Math.min(1, state.seal));
    drawNote();
    drawSketch();
    drawVignette();
    ctx.restore();
    return true;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = r.width || window.innerWidth || 390;
    const h = r.height || window.innerHeight || 700;
    W = w > 2 ? w : 390;
    H = h > 2 ? h : 700;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(W * DPR);
    const bh = Math.round(H * DPR);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    Sscale = W / VIEW_W;
    streetY = H * STREET_F;
  }
  function syncSize() {
    const r = canvas.getBoundingClientRect();
    if (Math.abs((r.width || W) - W) > 0.5 || Math.abs((r.height || H) - H) > 0.5) resize();
  }

  function maybeReady() {
    if (readySent) return;
    const box = window.__gbSandbox;
    if (box && typeof box.ready === "function") {
      readySent = true;
      box.ready();
    }
  }

  function makeSprites() {
    const g = document.createElement("canvas");
    g.width = 64;
    g.height = 64;
    const gg = g.getContext("2d");
    const rad = gg.createRadialGradient(32, 32, 2, 32, 32, 32);
    rad.addColorStop(0, "rgba(255,196,100,0.9)");
    rad.addColorStop(0.4, "rgba(255,140,40,0.28)");
    rad.addColorStop(1, "rgba(255,120,20,0)");
    gg.fillStyle = rad;
    gg.fillRect(0, 0, 64, 64);
    glowImg = g;
    const n = document.createElement("canvas");
    n.width = 80;
    n.height = 80;
    const ng = n.getContext("2d");
    const img = ng.createImageData(80, 80);
    let s = 99;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const v = s & 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    grainPat = ctx.createPattern(n, "repeat");
  }

  function syncPanel() {
    const skies = panel.querySelectorAll("[data-sky]");
    for (let i = 0; i < skies.length; i++) skies[i].classList.toggle("on", skies[i].dataset.sky === state.sky);
    const seasons = panel.querySelectorAll("[data-season]");
    for (let i = 0; i < seasons.length; i++) seasons[i].classList.toggle("on", seasons[i].dataset.season === state.season);
  }

  function trap(el) {
    const stop = function (e) { e.stopPropagation(); };
    const names = ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "mousedown", "click", "wheel"];
    for (let i = 0; i < names.length; i++) el.addEventListener(names[i], stop);
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    ensureAudio();
    dragging = true;
    dragMoved = false;
    dragId = e.pointerId;
    dragX = e.clientX;
    startX = e.clientX;
    dragT = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onMove(e) {
    if (!dragging || e.pointerId !== dragId) return;
    const now = performance.now();
    const dt = Math.max(0.016, (now - dragT) / 1000);
    dragT = now;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    if (Math.abs(e.clientX - startX) > 8) dragMoved = true;
    if (state.mode === "tea") return;
    const worldDx = dx / Sscale;
    if (state.mode === "boat") {
      ferry.target = null;
      ferry.vx = clamp(worldDx / dt, -200, 200);
    } else {
      state.target = null;
      state.x = clamp(state.x + worldDx, 50, WORLD - 50);
      coast = clamp(worldDx / dt, -260, 260);
      if (worldDx > 0.4) state.dir = 1;
      if (worldDx < -0.4) state.dir = -1;
    }
  }
  function onUp(e) {
    if (!dragging || (e.pointerId != null && e.pointerId !== dragId)) return;
    const tap = !dragMoved;
    dragging = false;
    if (!tap || state.mode === "tea") return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left) / Sscale + cam;
    if (state.mode === "boat") ferry.target = clamp(wx, 80, WORLD - 80);
    else {
      state.target = clamp(wx, 50, WORLD - 50);
      coast = 0;
      state.dir = state.target >= state.x ? 1 : -1;
    }
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  trap(toggle);
  trap(panel);
  trap(chip);
  toggle.addEventListener("pointerup", function (e) {
    e.stopPropagation();
    ensureAudio();
    const on = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", on ? "true" : "false");
    toggle.textContent = on ? "×" : "≡";
  });
  panel.addEventListener("pointerup", function (e) {
    const b = e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    if (b.dataset.sky) state.sky = b.dataset.sky;
    if (b.dataset.season) state.season = b.dataset.season;
    if (b.id === "sketchbtn") state.sketchT = 3.4;
    syncPanel();
    ensureAudio();
  });
  chip.addEventListener("pointerup", function (e) {
    e.stopPropagation();
    if (chip.dataset.act) doAction(chip.dataset.act);
  });

  let last = 0;
  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    lastDt = dt || 0.016;
    syncSize();
    update(dt);
    draw();
    maybeReady();
    requestAnimationFrame(frame);
  }

  makeSprites();
  resize();
  placeCam(true, 0);
  syncPanel();
  draw();
  maybeReady();
  requestAnimationFrame(frame);
  window.addEventListener("resize", resize);
})();
