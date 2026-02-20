const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const eventEl = document.getElementById("event");
const warningEl = document.getElementById("warning");
const challengeEl = document.getElementById("challenge");
const p1ScoreEl = document.getElementById("p1-score");
const p2ScoreEl = document.getElementById("p2-score");
const p1Card = document.getElementById("p1-card");
const p2Card = document.getElementById("p2-card");
const p1PipsEl = document.getElementById("p1-pips");
const p2PipsEl = document.getElementById("p2-pips");

let width = 0;
let height = 0;
let running = false;
let roundOver = false;
let lastTime = 0;
let audioUnlocked = false;
let audioCtx = null;
let skyGradient = null;

const state = {
  score: [0, 0],
  winScore: 5,
  winner: null,
  chaosTimer: 3.1,
  eventTimer: 0,
  time: 0,
  reverseUntil: 0,
  lowGravityUntil: 0,
  stickyUntil: 0,
  turboUntil: 0,
  discoUntil: 0,
  sizeSwapUntil: 0,
  showerUntil: 0,
  slowMotionUntil: 0,
  countdownTimer: 0,
  upcomingEventWarning: null,
  warningTime: 0,
  chaosWarningLead: 2.5,
  pendingChaosRoll: null,
  streak: [0, 0],
  roundNumber: 0,
  shrinkUntil: 0,
  growUntil: 0,
  tripleJumpUntil: 0,
  controlFlipUntil: [0, 0],
  platformShortUntil: 0,
  platformLongUntil: 0,
  platformTinyUntil: 0,
  effectGen: 0,
  flashTimer: 0,
  flashColor: "255,255,255",
  challengeId: 0,
  challengeText: "",
  challengeDoneText: "",
  challengeStats: [
    { jumps: 0, airTime: 0, bumpPower: 0, hazardHits: 0, danger: 0, nearMissCd: 0 },
    { jumps: 0, airTime: 0, bumpPower: 0, hazardHits: 0, danger: 0, nearMissCd: 0 },
  ],
  hitCommentCd: 0,
  warningUiText: "",
  challengeUiText: "",
  lastCountdownTick: 0,
  lastWarningTick: 0,
};

const keys = new Set();

const platform = {
  pivot: { x: 0, y: 0 },
  baseLength: 0,
  length: 0,
  thickness: 24,
  angle: -0.05,
  angVel: 0,
};

const camera = {
  shake: 0,
};

const particles = [];

const players = [
  {
    id: 0,
    label: "P1",
    color: "#e8283a",
    number: "3",
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: 26,
    baseRadius: 26,
    grounded: false,
    jumpCd: 0,
    landSfxCd: 0,
    stunned: 0,
    spin: 0,
    spinVel: 0,
    trail: [],
    jumpBuffer: 0,
    coyote: 0,
    airJumps: 1,
    maxAirJumps: 1,
    controls: { left: "KeyA", right: "KeyD", jump: "KeyW" },
  },
  {
    id: 1,
    label: "P2",
    color: "#1855e8",
    number: "8",
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: 26,
    baseRadius: 26,
    grounded: false,
    jumpCd: 0,
    landSfxCd: 0,
    stunned: 0,
    spin: 0,
    spinVel: 0,
    trail: [],
    jumpBuffer: 0,
    coyote: 0,
    airJumps: 1,
    maxAirJumps: 1,
    controls: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp" },
  },
];

const hazards = [];
let hazardSpawnTimer = 1.1;
const clouds = Array.from({ length: 9 }, () => ({
  x: Math.random(),
  y: 0.06 + Math.random() * 0.3,
  w: 0.1 + Math.random() * 0.2,
  s: 6 + Math.random() * 12,
  opacity: 0.55 + Math.random() * 0.35,
}));
const ballSpriteCache = new Map();
const hazardSpriteCache = new Map();
const MAX_PARTICLES = 700;
const ROUND_CHALLENGES = [
  { text: "Challenge: No-jump round", done: "No-jump cleared 🐐" },
  { text: "Challenge: Airtime control", done: "Airtime master 🦅" },
  { text: "Challenge: Big impacts", done: "Impact goal cleared 💥" },
  { text: "Challenge: Hazard pressure", done: "Survived hazard goal 🛡️" },
];

function isEffectOn(until) { return state.time < until; }

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function sfx(freq = 300, duration = 0.08, type = "square", volume = 0.035) {
  if (!audioUnlocked || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.82), audioCtx.currentTime + duration);
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

function addShake(power) {
  camera.shake = Math.min(18, camera.shake + power);
}

function scheduleEffect(fn, delayMs) {
  const gen = state.effectGen;
  setTimeout(() => {
    if (gen !== state.effectGen) return;
    fn();
  }, delayMs);
}

function addParticles(x, y, color, count = 12, force = 260) {
  count = Math.max(4, Math.floor(count * 0.45));
  force *= 0.82;
  if (particles.length > MAX_PARTICLES) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = force * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.35 + Math.random() * 0.25,
      t: 0,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function showEvent(text, duration = 2) {
  state.eventTimer = duration;
  eventEl.textContent = text;
  eventEl.classList.add("show");
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function updateWarningUI() {
  if (!warningEl) return;
  if (state.upcomingEventWarning && state.warningTime > 0) {
    const secs = Math.max(1, Math.ceil(state.warningTime));
    const nextText = `⚠️ INCOMING: ${state.upcomingEventWarning} [${secs}s]`;
    if (state.warningUiText !== nextText) {
      state.warningUiText = nextText;
      warningEl.textContent = nextText;
    }
    if (!warningEl.classList.contains("show")) warningEl.classList.add("show");
  } else {
    if (warningEl.classList.contains("show")) warningEl.classList.remove("show");
    if (state.warningUiText !== "") { state.warningUiText = ""; warningEl.textContent = ""; }
  }
}

function updateChallengeUI() {
  if (!challengeEl) return;
  const nextText = state.challengeText || "";
  if (state.challengeUiText === nextText) return;
  state.challengeUiText = nextText;
  challengeEl.textContent = nextText;
}

function pickRoundChallenge() {
  state.challengeId = Math.floor(Math.random() * ROUND_CHALLENGES.length);
  state.challengeText = ROUND_CHALLENGES[state.challengeId].text;
  state.challengeDoneText = ROUND_CHALLENGES[state.challengeId].done;
  for (const s of state.challengeStats) {
    s.jumps = 0; s.airTime = 0; s.bumpPower = 0;
    s.hazardHits = 0; s.danger = 0; s.nearMissCd = 0;
  }
  updateChallengeUI();
}

function challengeAchieved(playerId) {
  const s = state.challengeStats[playerId];
  if (state.challengeId === 0) return s.jumps === 0;
  if (state.challengeId === 1) return s.airTime >= 2.2;
  if (state.challengeId === 2) return s.bumpPower >= 320;
  if (state.challengeId === 3) return s.hazardHits >= 3;
  return false;
}

function triggerFlash(rgb, duration = 0.12) {
  state.flashColor = rgb;
  state.flashTimer = Math.max(state.flashTimer, duration);
}

function playCountdownAndWarningSfx() {
  if (!running && state.countdownTimer > 0) {
    const tick = Math.max(1, Math.min(3, Math.ceil(state.countdownTimer)));
    if (tick !== state.lastCountdownTick) {
      state.lastCountdownTick = tick;
      sfx(320 + tick * 90, 0.06, "square", 0.035);
    }
  } else if (state.lastCountdownTick !== 0) {
    state.lastCountdownTick = 0;
    sfx(760, 0.07, "triangle", 0.042);
  }

  if (state.upcomingEventWarning && state.warningTime > 0) {
    const warnTick = Math.max(1, Math.ceil(state.warningTime));
    if (warnTick !== state.lastWarningTick) {
      state.lastWarningTick = warnTick;
      sfx(420 + warnTick * 35, 0.045, "sawtooth", 0.03);
    }
  } else {
    state.lastWarningTick = 0;
  }
}

function syncPlatformLength() {
  let factor = 1;
  if (isEffectOn(state.platformTinyUntil)) factor *= 0.42;
  if (isEffectOn(state.platformShortUntil)) factor *= 0.5;
  if (isEffectOn(state.platformLongUntil)) factor *= 1.6;
  platform.length = Math.max(180, Math.min(980, platform.baseLength * factor));
}

function randomChaosWarningLead() { return 2 + Math.random() * 0.8; }

function getChaosEventLabel(roll) {
  const labels = [
    "Controls Reversed","Moon Gravity","Wind Blast","Size Swap","Sticky Platform",
    "Turbo Ankles","Meteor Shower","Disco Physics","Bounce Launch","Platform Spin",
    "Random Teleport","Anti Gravity Flick","Speed Surge","Freeze Release","Random Direction",
    "Oil Spill","Hazard Storm","Shrink Ray","Grow Ray","Position Swap",
    "Control Flip","Spin Frenzy","Black Hole Pull","Slow Motion","Tracking Bombs",
    "Anti Gravity Spin","Rocket Boost","Lucky Bounce","Wild Platform","Gravity Well",
    "Triple Jump","Rainbow Madness","Platform Shrink","Platform Expand","Sticky Slow Mo",
    "Meteor Attack","Supernova Wind","Platform Flip","Bounce Storm","Crate Rain",
    "Shockwave Pulses","Skyfall Overload","Center Slam","Mirror Drift","Hazard Curtain",
    "Tiny Turbo Beam","Blink Storm","Magnet Duel","False Alarm",
  ];
  return labels[roll] || "Chaos Spike";
}

function queueUpcomingChaos() {
  state.pendingChaosRoll = Math.floor(Math.random() * 49);
  state.upcomingEventWarning = getChaosEventLabel(state.pendingChaosRoll);
}

function clearEventIfDone() {
  if (state.eventTimer <= 0) eventEl.classList.remove("show");
}

function updateScore() {
  if (p1ScoreEl) p1ScoreEl.textContent = state.score[0];
  if (p2ScoreEl) p2ScoreEl.textContent = state.score[1];
  rebuildPips(p1PipsEl, 0);
  rebuildPips(p2PipsEl, 1);
}

function rebuildPips(container, playerId) {
  if (!container) return;
  const existing = container.querySelectorAll('.pip');
  for (let i = 0; i < state.winScore; i++) {
    let pip = existing[i];
    const shouldFill = i < state.score[playerId];
    if (!pip) {
      pip = document.createElement('div');
      pip.className = 'pip';
      container.appendChild(pip);
    }
    const wasFilled = pip.classList.contains('filled');
    if (shouldFill && !wasFilled) {
      pip.classList.add('filled', 'pop');
      setTimeout(() => pip.classList.remove('pop'), 400);
    } else if (!shouldFill && wasFilled) {
      pip.classList.remove('filled', 'pop');
    }
  }
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  skyGradient = ctx.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, "#b8e8ff");
  skyGradient.addColorStop(0.45, "#83cff0");
  skyGradient.addColorStop(0.82, "#6bbfe0");
  skyGradient.addColorStop(1, "#4fa8cc");

  platform.pivot.x = width * 0.5;
  platform.pivot.y = height * 0.64;
  platform.baseLength = Math.min(width * 0.68, 860);
  syncPlatformLength();

  if (!running && !roundOver) resetRoundPositions();
}

function resetRoundPositions() {
  state.effectGen += 1;
  if (state.score[0] === 0 && state.score[1] === 0 && state.time === 0) {
    platform.angle = 0;
  } else {
    platform.angle = (Math.random() - 0.5) * 0.12;
  }
  platform.angVel = 0;
  syncPlatformLength();

  const offset = platform.length * 0.27;
  spawnBall(players[0], -offset);
  spawnBall(players[1], offset);

  hazards.length = 0;
  hazardSpawnTimer = 0.9;
  roundOver = false;
  state.countdownTimer = 3.05;
  state.upcomingEventWarning = null;
  state.warningTime = 0;
  state.pendingChaosRoll = null;
  state.shrinkUntil = 0;
  state.growUntil = 0;
  state.tripleJumpUntil = 0;
  state.controlFlipUntil[0] = 0;
  state.controlFlipUntil[1] = 0;
  state.platformShortUntil = 0;
  state.platformLongUntil = 0;
  state.platformTinyUntil = 0;
  state.hitCommentCd = 0;
  state.flashTimer = 0;
  state.lastCountdownTick = 0;
  state.lastWarningTick = 0;
  pickRoundChallenge();
  updateWarningUI();
  running = false;
}

function spawnBall(ball, localX) {
  const c = Math.cos(platform.angle);
  const s = Math.sin(platform.angle);
  const surfaceY = -(platform.thickness * 0.5 + ball.radius + 2);
  ball.x = platform.pivot.x + localX * c - surfaceY * s;
  ball.y = platform.pivot.y + localX * s + surfaceY * c;
  ball.vx = 0; ball.vy = 0;
  ball.grounded = false;
  ball.jumpCd = 0; ball.landSfxCd = 0;
  ball.stunned = 0; ball.spin = 0; ball.spinVel = 0;
  ball.trail.length = 0;
  ball.jumpBuffer = 0; ball.coyote = 0;
  ball.airJumps = ball.maxAirJumps;
}

function resetMatch() {
  state.effectGen += 1;
  state.score[0] = 0; state.score[1] = 0;
  state.winner = null;
  state.time = 0;
  state.chaosTimer = 3.1;
  state.reverseUntil = 0; state.lowGravityUntil = 0;
  state.stickyUntil = 0; state.turboUntil = 0;
  state.discoUntil = 0; state.sizeSwapUntil = 0;
  state.showerUntil = 0; state.slowMotionUntil = 0;
  state.upcomingEventWarning = null; state.warningTime = 0;
  state.chaosWarningLead = randomChaosWarningLead();
  state.pendingChaosRoll = null;
  state.streak[0] = 0; state.streak[1] = 0;
  state.roundNumber = 0;
  state.shrinkUntil = 0; state.growUntil = 0;
  state.tripleJumpUntil = 0;
  state.controlFlipUntil[0] = 0; state.controlFlipUntil[1] = 0;
  state.platformShortUntil = 0; state.platformLongUntil = 0;
  state.platformTinyUntil = 0;
  state.hitCommentCd = 0; state.flashTimer = 0;
  state.lastCountdownTick = 0; state.lastWarningTick = 0;
  state.warningUiText = ""; state.challengeUiText = ""; state.challengeText = "";
  updateWarningUI(); updateChallengeUI();
  running = false;
  particles.length = 0;
  updateScore();
  resetRoundPositions();
}

function rotateToLocal(x, y) {
  const dx = x - platform.pivot.x;
  const dy = y - platform.pivot.y;
  const c = Math.cos(platform.angle);
  const s = Math.sin(platform.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

function rotateToWorld(x, y) {
  const c = Math.cos(platform.angle);
  const s = Math.sin(platform.angle);
  return {
    x: platform.pivot.x + x * c - y * s,
    y: platform.pivot.y + x * s + y * c,
  };
}

function applyControls(ball, dt) {
  if (ball.stunned > 0) return;

  const reverse = isEffectOn(state.reverseUntil) ? -1 : 1;
  const turbo = isEffectOn(state.turboUntil) ? 1.2 : 1;
  const foeId = ball.id === 0 ? 1 : 0;
  const comeback = state.score[foeId] - state.score[ball.id] >= 2 ? 1.12 : 1;
  const flipped = isEffectOn(state.controlFlipUntil[ball.id]);
  const leftKey = flipped ? ball.controls.right : ball.controls.left;
  const rightKey = flipped ? ball.controls.left : ball.controls.right;

  let dir = 0;
  if (keys.has(leftKey)) dir -= 1;
  if (keys.has(rightKey)) dir += 1;
  dir *= reverse;

  ball.vx += dir * 700 * turbo * comeback * dt;

  if (keys.has(ball.controls.jump)) ball.jumpBuffer = Math.max(ball.jumpBuffer, 0.12);

  const canGroundJump = ball.grounded || ball.coyote > 0;
  const canAirJump = !canGroundJump && ball.airJumps > 0;

  if (ball.jumpBuffer > 0 && ball.jumpCd <= 0 && (canGroundJump || canAirJump)) {
    const n = { x: Math.sin(platform.angle), y: -Math.cos(platform.angle) };
    const boost = canAirJump ? 0.92 : 1;
    ball.vx += n.x * 430 * boost;
    ball.vy += n.y * 430 * boost;
    ball.jumpCd = 0.22;
    ball.jumpBuffer = 0;
    ball.coyote = 0;
    ball.grounded = false;

    if (canAirJump) {
      ball.airJumps -= 1;
      sfx(680, 0.06, "triangle", 0.028);
    } else {
      sfx(470, 0.07, "square", 0.03);
    }
    state.challengeStats[ball.id].jumps += 1;
    addShake(1.4);
    addParticles(ball.x, ball.y + ball.radius * 0.8, "#ffffff", 8, 160);
  }
}

function ballOnPlatformCollision(ball) {
  ball.grounded = false;
  const local = rotateToLocal(ball.x, ball.y);
  const topSurface = -(platform.thickness * 0.5 + ball.radius);
  const inX = local.x > -platform.length * 0.5 - ball.radius && local.x < platform.length * 0.5 + ball.radius;

  if (inX && local.y > topSurface && local.y < topSurface + 42 && ball.vy >= -300) {
    local.y = topSurface;
    const world = rotateToWorld(local.x, local.y);
    ball.x = world.x;
    ball.y = world.y;

    const tangent = { x: Math.cos(platform.angle), y: Math.sin(platform.angle) };
    const normal = { x: -Math.sin(platform.angle), y: Math.cos(platform.angle) };

    const along = ball.vx * tangent.x + ball.vy * tangent.y;
    const into = ball.vx * normal.x + ball.vy * normal.y;
    const clampedInto = Math.min(0, into);
    const impact = Math.abs(into);

    const restitution = isEffectOn(state.discoUntil) ? 0.18 : 0.06;
    ball.vx = tangent.x * along - normal.x * clampedInto * restitution;
    ball.vy = tangent.y * along - normal.y * clampedInto * restitution;

    const targetSpin = along / Math.max(14, ball.radius);
    ball.spinVel += (targetSpin - ball.spinVel) * 0.36;

    ball.grounded = true;
    if (impact > 145 && ball.landSfxCd <= 0) {
      sfx(180 + impact * 0.18, 0.07, "sawtooth", 0.028);
      ball.landSfxCd = 0.18;
    }
  }
}

function updatePlatform(dt) {
  let torque = 0;
  for (const ball of players) {
    const local = rotateToLocal(ball.x, ball.y);
    if (local.x > -platform.length * 0.52 && local.x < platform.length * 0.52 && local.y < 150) {
      torque += local.x * 0.00012;
    }
  }

  platform.angVel += torque * dt * 38;
  platform.angVel += (-platform.angle * 1.65) * dt;
  platform.angVel *= 0.972;
  const maxVel = 1.05;
  platform.angVel = Math.max(-maxVel, Math.min(maxVel, platform.angVel));
  platform.angle += platform.angVel * dt;
  platform.angle = Math.max(-0.43, Math.min(0.43, platform.angle));
}

function spawnHazard(forceType = "") {
  const typeRoll = Math.random();
  const type = forceType || (typeRoll < 0.2 ? "anvil" : typeRoll < 0.33 ? "tomato" : typeRoll < 0.46 ? "banana" :
               typeRoll < 0.58 ? "bomb" : typeRoll < 0.67 ? "rock" : typeRoll < 0.75 ? "spike" : typeRoll < 0.82 ? "ice" :
               typeRoll < 0.89 ? "meteor" : typeRoll < 0.95 ? "crate" : typeRoll < 0.98 ? "spring" : "star");

  const hazard = {
    type, x: Math.random() * width, y: -40,
    vx: (Math.random() - 0.5) * 150, vy: Math.random() * 70,
    radius: 16, life: 16, color: "#444", spin: Math.random() * Math.PI,
  };

  if (type === "anvil")  { hazard.radius = 20; hazard.color = "#4b4b52"; hazard.vy += 140; }
  if (type === "tomato") { hazard.radius = 14; hazard.color = "#e23051"; }
  if (type === "banana") { hazard.radius = 18; hazard.color = "#f7d637"; hazard.vx *= 1.35; }
  if (type === "bomb")   { hazard.radius = 16; hazard.color = "#222"; hazard.vy += 90; }
  if (type === "rock")   { hazard.radius = 17; hazard.color = "#8b7355"; hazard.vy += 120; }
  if (type === "spike")  { hazard.radius = 15; hazard.color = "#d946ef"; hazard.vy += 160; }
  if (type === "ice")    { hazard.radius = 16; hazard.color = "#00d9ff"; hazard.vx *= 1.6; }
  if (type === "meteor") { hazard.radius = 22; hazard.color = "#ff6b35"; hazard.vy += 200; }
  if (type === "crate")  { hazard.radius = 19; hazard.color = "#9a6a3f"; hazard.vy += 170; }
  if (type === "spring") { hazard.radius = 15; hazard.color = "#2fcf79"; hazard.vx *= 1.3; hazard.vy += 110; }
  if (type === "star")   { hazard.radius = 13; hazard.color = "#8ff3ff"; hazard.vx *= 1.9; hazard.vy += 70; }

  hazards.push(hazard);
}

// ========================= CHAOS EVENTS =========================
function triggerChaosEvent(forcedRoll = null) {
  const roll = Number.isInteger(forcedRoll) ? forcedRoll : Math.floor(Math.random() * 49);
  sfx(260 + (roll % 8) * 45, 0.045, "square", 0.024);

  if (roll === 0) {
    state.reverseUntil = Math.max(state.reverseUntil, state.time + 4.4);
    showEvent("🔄 Controls reversed. Your brain is lagging.", 3.1); return;
  }
  if (roll === 1) {
    state.lowGravityUntil = Math.max(state.lowGravityUntil, state.time + 5.5);
    showEvent("🌙 Moon gravity. Physics teacher is crying.", 2.8); return;
  }
  if (roll === 2) {
    const gust = (Math.random() < 0.5 ? -1 : 1) * (260 + Math.random() * 240);
    for (const p of players) p.vx += gust;
    showEvent("💨 Wind cannon sneezed on everyone.", 1.7); return;
  }
  if (roll === 3) {
    state.sizeSwapUntil = Math.max(state.sizeSwapUntil, state.time + 6.2);
    showEvent("↔️ Size swap. Big vs tiny. Life is unfair.", 3.2); return;
  }
  if (roll === 4) {
    state.stickyUntil = Math.max(state.stickyUntil, state.time + 5);
    showEvent("🍯 Sticky platform. Good luck with that.", 3); return;
  }
  if (roll === 5) {
    state.turboUntil = Math.max(state.turboUntil, state.time + 5);
    showEvent("⚡ TURBO ANKLES. Legs don't fail me now.", 2.3); return;
  }
  if (roll === 6) {
    state.showerUntil = Math.max(state.showerUntil, state.time + 3.6);
    showEvent("☄️ Meteor shower! Not in the school syllabus.", 2.3); return;
  }
  if (roll === 7) {
    state.discoUntil = Math.max(state.discoUntil, state.time + 5.4);
    showEvent("🪩 DISCO PHYSICS. Everything bounces wrong.", 2.3); return;
  }
  if (roll === 8) {
    for (const p of players) { p.vy = -650; addParticles(p.x, p.y, p.color, 15, 350); sfx(520, 0.1, "sine", 0.04); }
    showEvent("🚀 BOING! Equal opportunity launching.", 2); return;
  }
  if (roll === 9) {
    platform.angVel = (Math.random() < 0.5 ? -1 : 1) * 2.5;
    showEvent("🌀 Platform spinning like your excuses.", 2.2); return;
  }
  if (roll === 10) {
    for (const p of players) { p.x = Math.random() * width; p.y = Math.random() * height * 0.4; addParticles(p.x, p.y, p.color, 20, 400); sfx(800, 0.08, "square", 0.03); }
    showEvent("🌀 Teleported. Where even are you rn?", 1.8); return;
  }
  if (roll === 11) {
    for (const p of players) p.vy = Math.abs(p.vy) * -0.8;
    showEvent("⬆️ Gravity said no. Respectfully.", 1.9); return;
  }
  if (roll === 12) {
    for (const p of players) { p.vx *= 1.8; p.vy *= 1.5; }
    showEvent("💨 SPEED DEMON MODE! Slow down bro.", 2); return;
  }
  if (roll === 13) {
    state.chaosTimer += 2;
    for (const p of players) { p.vx = 0; p.vy = 0; }
    scheduleEffect(() => { for (const p of players) { p.vx += (Math.random() - 0.5) * 600; p.vy -= 400; } }, 800);
    showEvent("🧊 FREEZE! ...RELEASE! Got played.", 2.1); return;
  }
  if (roll === 14) {
    for (const p of players) { const angle = Math.random() * Math.PI * 2; const speed = 350 + Math.random() * 250; p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed; addParticles(p.x, p.y, p.color, 12, 280); }
    showEvent("🎲 Random direction. Chaos is the plan.", 1.8); return;
  }
  if (roll === 15) {
    state.stickyUntil = Math.max(state.stickyUntil, state.time + 4.5);
    showEvent("🛢️ Oil spill! Wet floor sign was a warning.", 2.2); return;
  }
  if (roll === 16) {
    state.showerUntil = Math.max(state.showerUntil, state.time + 4);
    hazardSpawnTimer = 0.15;
    showEvent("⛈️ HAZARD STORM! Every direction is pain.", 2.4); return;
  }
  if (roll === 17) {
    for (const p of players) addParticles(p.x, p.y, "#ffffff", 10, 200);
    state.shrinkUntil = Math.max(state.shrinkUntil, state.time + 3.5);
    showEvent("🔫 Shrink ray! Pew pew. You're tiny now.", 2); return;
  }
  if (roll === 18) {
    for (const p of players) addParticles(p.x, p.y, "#ffffff", 10, 200);
    state.growUntil = Math.max(state.growUntil, state.time + 3.5);
    showEvent("🎈 Grow ray go BIG! Big doesn't mean better.", 2); return;
  }
  if (roll === 19) {
    const tempX = players[0].x; const tempY = players[0].y;
    players[0].x = players[1].x; players[0].y = players[1].y;
    players[1].x = tempX; players[1].y = tempY;
    addParticles(players[0].x, players[0].y, players[0].color, 15, 300);
    addParticles(players[1].x, players[1].y, players[1].color, 15, 300);
    showEvent("🔀 Swap! Sudden identity crisis.", 2.1); return;
  }
  if (roll === 20) {
    const victim = Math.random() < 0.5 ? 0 : 1;
    state.controlFlipUntil[victim] = Math.max(state.controlFlipUntil[victim], state.time + 4);
    showEvent(`🕹️ ${players[victim].label}'s controls are cooked.`, 2.2); return;
  }
  if (roll === 21) {
    for (const p of players) p.spinVel = (Math.random() < 0.5 ? -1 : 1) * 8;
    showEvent("💫 SPIN SPIN SPIN SPIN SPIN SPIN", 2); return;
  }
  if (roll === 22) {
    for (const p of players) { const dx = width * 0.5 - p.x; const dy = height * 0.5 - p.y; const dist = Math.sqrt(dx * dx + dy * dy) + 1; p.vx += (dx / dist) * 600; p.vy += (dy / dist) * 600; }
    showEvent("🕳️ Black hole says come here. NOW.", 2.1); return;
  }
  if (roll === 23) {
    state.slowMotionUntil = Math.max(state.slowMotionUntil || 0, state.time + 3.2);
    showEvent("⏱️ Time slows... like Monday mornings.", 2); return;
  }
  if (roll === 24) {
    state.showerUntil = Math.max(state.showerUntil, state.time + 4.5);
    for (let i = 0; i < 8; i++) scheduleEffect(() => spawnHazard("bomb"), i * 300);
    showEvent("💣 TRACKING BOMBS! They know where you live.", 2.3); return;
  }
  if (roll === 25) {
    for (const p of players) { p.vy = Math.abs(p.vy) * -1.2; p.spinVel = (Math.random() < 0.5 ? -1 : 1) * 6; }
    showEvent("🌪️ Anti-gravity spin. Throw up mode: ON.", 2.1); return;
  }
  if (roll === 26) {
    for (const p of players) { p.vx = 0; p.vy = 0; }
    scheduleEffect(() => { for (const p of players) { const angle = Math.random() * Math.PI * 2; p.vx = Math.cos(angle) * 700; p.vy = Math.sin(angle) * 700; addParticles(p.x, p.y, p.color, 20, 400); sfx(600, 0.1, "sine", 0.05); } }, 600);
    showEvent("🚀 ROCKET BOOST! Countdown: oh it already fired.", 2); return;
  }
  if (roll === 27) {
    const lucky = Math.random() < 0.5 ? 0 : 1;
    showEvent(`🍀 ${players[lucky].label} got lucky bounce vibes. Or did they?`, 2); return;
  }
  if (roll === 28) {
    platform.angVel = (Math.random() < 0.5 ? -1 : 1) * 4;
    scheduleEffect(() => { platform.angVel = 0; }, 2500);
    showEvent("🌀 Platform having an actual breakdown.", 2.2); return;
  }
  if (roll === 29) {
    state.lowGravityUntil = Math.max(state.lowGravityUntil, state.time + 4);
    state.showerUntil = Math.max(state.showerUntil, state.time + 4);
    hazardSpawnTimer = 0.2;
    showEvent("🌌 Gravity well + hazards. So kind.", 2.4); return;
  }
  if (roll === 30) {
    state.tripleJumpUntil = Math.max(state.tripleJumpUntil, state.time + 5);
    showEvent("🐦 Triple jump! You're basically flying rn.", 2.1); return;
  }
  if (roll === 31) {
    state.discoUntil = Math.max(state.discoUntil, state.time + 6);
    showEvent("🌈 RAINBOW MADNESS!! Eyes not ok.", 2.2); return;
  }
  if (roll === 32) {
    state.platformShortUntil = Math.max(state.platformShortUntil, state.time + 4);
    syncPlatformLength();
    showEvent("📏 Platform shrinking!! Less room to skill issue.", 2.1); return;
  }
  if (roll === 33) {
    state.platformLongUntil = Math.max(state.platformLongUntil, state.time + 4);
    syncPlatformLength();
    showEvent("📏 Platform expanding. More runway to fall from.", 2.1); return;
  }
  if (roll === 34) {
    state.stickyUntil = Math.max(state.stickyUntil, state.time + 3.5);
    state.slowMotionUntil = Math.max(state.slowMotionUntil, state.time + 3.5);
    showEvent("🍯 Sticky slow-mo. Actively suffering.", 2.2); return;
  }
  if (roll === 35) {
    for (let i = 0; i < 12; i++) scheduleEffect(() => spawnHazard("meteor"), i * 150);
    showEvent("☄️ METEOR SHOWER! The sky said skill issue.", 2.4); return;
  }
  if (roll === 36) {
    for (const p of players) { const d = Math.atan2(platform.pivot.y - p.y, platform.pivot.x - p.x); p.vx += Math.cos(d) * 800; p.vy += Math.sin(d) * 600; addParticles(p.x, p.y, p.color, 25, 450); }
    showEvent("💥 SUPERNOVA WIND! You are aerodynamic now.", 2.1); return;
  }
  if (roll === 37) {
    platform.angle *= -1;
    scheduleEffect(() => { platform.angle *= -1; }, 3500);
    showEvent("🔃 Platform flipped! Your life is also flipped.", 2); return;
  }
  if (roll === 38) {
    for (let i = 0; i < 10; i++) scheduleEffect(() => spawnHazard(Math.random() < 0.5 ? "spring" : "star"), i * 120);
    showEvent("💥 BOUNCE STORM! Uncontrolled chaos incoming.", 2.2); return;
  }
  if (roll === 39) {
    for (let i = 0; i < 8; i++) scheduleEffect(() => spawnHazard("crate"), i * 150);
    showEvent("📦 CRATE DROP! Imported. From pain.", 2.1); return;
  }
  if (roll === 40) {
    for (let i = 0; i < 3; i++) {
      scheduleEffect(() => { for (const p of players) { p.vy -= 320; p.vx += (Math.random() - 0.5) * 380; } addShake(5); }, i * 360);
    }
    showEvent("💥 Triple shockwave! The platform has vibrato.", 2.3); return;
  }
  if (roll === 41) {
    state.showerUntil = Math.max(state.showerUntil, state.time + 5.2);
    hazardSpawnTimer = 0.12;
    showEvent("⛈️ SKYFALL OVERLOAD! Too much. Way too much.", 2.2); return;
  }
  if (roll === 42) {
    for (const p of players) { const dx = platform.pivot.x - p.x; const dy = platform.pivot.y - p.y; const d = Math.hypot(dx, dy) || 1; p.vx += (dx / d) * 900; p.vy += (dy / d) * 800; }
    addShake(7);
    showEvent("🎯 CENTER SLAM! Magnets are not your friends.", 2.1); return;
  }
  if (roll === 43) {
    state.controlFlipUntil[0] = Math.max(state.controlFlipUntil[0], state.time + 3.2);
    state.controlFlipUntil[1] = Math.max(state.controlFlipUntil[1], state.time + 3.2);
    showEvent("🪞 Mirror drift. Opposite day for both of you.", 2.2); return;
  }
  if (roll === 44) {
    const cols = 12;
    for (let i = 0; i < cols; i++) {
      scheduleEffect(() => {
        const type = i % 3 === 0 ? "meteor" : i % 2 === 0 ? "rock" : "bomb";
        const h = { type, x: (i + 0.5) * (width / cols), y: -40, vx: 0, vy: 80, radius: 16, life: 12, color: "#444", spin: 0 };
        if (type === "meteor") { h.radius = 20; h.color = "#ff6b35"; h.vy = 250; }
        if (type === "rock") { h.radius = 17; h.color = "#8b7355"; h.vy = 190; }
        if (type === "bomb") { h.radius = 16; h.color = "#222"; h.vy = 170; }
        hazards.push(h);
      }, i * 70);
    }
    showEvent("🎯 HAZARD CURTAIN! Tactical suffering deployment.", 2.3); return;
  }
  if (roll === 45) {
    state.platformTinyUntil = Math.max(state.platformTinyUntil, state.time + 3.6);
    syncPlatformLength();
    state.turboUntil = Math.max(state.turboUntil, state.time + 4.6);
    showEvent("🔥 TINY TURBO BEAM. Pure evil energy.", 2.3); return;
  }
  if (roll === 46) {
    for (let i = 0; i < 4; i++) {
      scheduleEffect(() => {
        for (const p of players) { p.x = width * (0.18 + Math.random() * 0.64); p.y = height * (0.12 + Math.random() * 0.34); p.vx *= 0.4; p.vy *= 0.4; addParticles(p.x, p.y, p.color, 14, 300); }
        addShake(4);
      }, i * 240);
    }
    showEvent("⚡ BLINK STORM! Are you even real rn?", 2.2); return;
  }
  if (roll === 47) {
    for (let i = 0; i < 6; i++) {
      scheduleEffect(() => {
        const dx = players[1].x - players[0].x; const dy = players[1].y - players[0].y;
        const d = Math.hypot(dx, dy) || 1; const pull = 320;
        players[0].vx += (dx / d) * pull; players[0].vy += (dy / d) * pull * 0.8;
        players[1].vx -= (dx / d) * pull; players[1].vy -= (dy / d) * pull * 0.8;
      }, i * 180);
    }
    showEvent("🧲 MAGNET DUEL! Attraction issues detected.", 2.3); return;
  }
  if (roll === 48) {
    addShake(2.5);
    for (const p of players) addParticles(p.x, p.y, "#ffffff", 9, 140);
    showEvent("💀 False alarm. You panicked for literally nothing.", 1.7); return;
  }

  // Default
  spawnHazard(); spawnHazard(); spawnHazard();
  showEvent("⚠️ Triple hazard drop! Classic.", 1.8);
}

// ========================= UPDATE HAZARDS =========================
function updateHazards(dt) {
  hazardSpawnTimer -= dt;
  const shower = isEffectOn(state.showerUntil);

  if (hazardSpawnTimer <= 0) {
    spawnHazard(shower && Math.random() < 0.5 ? "bomb" : "");
    hazardSpawnTimer = shower ? 0.2 + Math.random() * 0.24 : 0.45 + Math.random() * 0.45;
  }

  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    h.life -= dt;
    h.spin += dt * (2 + Math.abs(h.vx) * 0.02);

    const gravityScale = isEffectOn(state.lowGravityUntil) ? 0.58 : 1;
    h.vy += 890 * dt * gravityScale;
    h.x += h.vx * dt;
    h.y += h.vy * dt;

    if (h.x < h.radius || h.x > width - h.radius) {
      h.vx *= -0.83;
      h.x = Math.max(h.radius, Math.min(width - h.radius, h.x));
    }

    for (const p of players) {
      const dx = p.x - h.x; const dy = p.y - h.y;
      const d2 = dx * dx + dy * dy;
      const rr = p.radius + h.radius;

      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1;
        const nx = dx / d; const ny = dy / d;
        const kick = h.type === "anvil" ? 420 : h.type === "banana" ? 340 : h.type === "bomb" ? 560 :
                     h.type === "rock" ? 380 : h.type === "spike" ? 500 : h.type === "ice" ? 300 :
                     h.type === "meteor" ? 650 : h.type === "crate" ? 520 : h.type === "spring" ? 260 :
                     h.type === "star" ? 220 : 270;

        p.vx += nx * kick + h.vx * 0.22;
        p.vy += ny * kick + h.vy * 0.2;
        p.stunned = 0.3;
        state.challengeStats[p.id].hazardHits += 1;

        if (h.type === "banana") { p.vx += (Math.random() - 0.5) * 440; }
        else if (h.type === "ice") { p.vx += (Math.random() - 0.5) * 500; }
        else if (h.type === "spring") { p.vy -= 520; p.vx += (Math.random() - 0.5) * 160; }
        else if (h.type === "star") { p.vx *= 1.15; p.vy -= 120; }

        addShake(h.type === "bomb" ? 7 : h.type === "meteor" ? 8 : h.type === "crate" ? 7.2 : 4.5);
        triggerFlash(
          h.type === "meteor" ? "255,128,64" : h.type === "spike" ? "234,70,255" :
          h.type === "ice" ? "120,225,255" : h.type === "bomb" ? "255,210,120" : "255,255,255", 0.08
        );

        const pc = h.type === "meteor" ? "#ff6b35" : h.type === "spike" ? "#d946ef" :
                   h.type === "ice" ? "#00d9ff" : h.type === "rock" ? "#8b7355" :
                   h.type === "banana" ? "#f8dc5f" : h.type === "tomato" ? "#f0506e" :
                   h.type === "crate" ? "#9a6a3f" : h.type === "spring" ? "#2fcf79" :
                   h.type === "star" ? "#8ff3ff" : "#d9e0e8";
        addParticles(h.x, h.y, pc, 18, h.type === "bomb" ? 420 : h.type === "meteor" ? 500 : 280);

        const freq = h.type === "meteor" ? 80 : h.type === "spike" ? 320 : h.type === "bomb" ? 140 : h.type === "spring" ? 460 : 210;
        sfx(freq, 0.12, "sawtooth", 0.04);

        if (state.hitCommentCd <= 0 && Math.random() < 0.22) {
          const jokes = [
            `${p.label} got cooked. 💀`,
            `${p.label} walked straight into that.`,
            `${p.label} took that personally.`,
            `${p.label} launched into low orbit.`,
            `RIP ${p.label}. Moment of silence.`,
            `${p.label} was not built for this.`,
            `${p.label}: "I meant to do that."`,
            `${p.label} has departed the server.`,
            `${p.label} hit different (literally).`,
            `${p.label} vs physics. Physics wins.`,
            `${p.label} just got yeeted.`,
            `${p.label} couldn't dodge a parked car.`,
          ];
          showEvent(pick(jokes), 0.95);
          state.hitCommentCd = 1.1;
        }

        hazards.splice(i, 1);
        break;
      }
    }

    if (h.life <= 0 || h.y > height + 120) hazards.splice(i, 1);
  }
}

// ========================= UPDATE PLAYERS =========================
function updatePlayers(dt) {
  const gravityScale = isEffectOn(state.lowGravityUntil) ? 0.58 : 1;
  const groundFriction = isEffectOn(state.stickyUntil) ? 0.973 : 0.988;
  const airFriction = isEffectOn(state.stickyUntil) ? 0.992 : 0.996;
  const g = 980 * gravityScale;

  const sizeSwap = isEffectOn(state.sizeSwapUntil);
  const shrink = isEffectOn(state.shrinkUntil) ? 0.55 : 1;
  const grow = isEffectOn(state.growUntil) ? 1.45 : 1;
  players[0].radius = (sizeSwap ? 20 : players[0].baseRadius) * shrink * grow;
  players[1].radius = (sizeSwap ? 32 : players[1].baseRadius) * shrink * grow;
  const extraJumps = isEffectOn(state.tripleJumpUntil) ? 3 : 1;
  players[0].maxAirJumps = extraJumps;
  players[1].maxAirJumps = extraJumps;

  for (const p of players) {
    const stats = state.challengeStats[p.id];
    p.jumpCd -= dt; p.landSfxCd -= dt;
    p.stunned -= dt; p.jumpBuffer -= dt;
    p.coyote -= dt;
    stats.nearMissCd -= dt; stats.danger -= dt;

    applyControls(p, dt);
    p.vy += g * dt;
    p.vx *= p.grounded ? groundFriction : airFriction;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (!p.grounded) stats.airTime += dt;
    if (p.y > platform.pivot.y + 120 && p.vy > 90) stats.danger = Math.max(stats.danger, 0.85);

    ballOnPlatformCollision(p);

    if (p.grounded) {
      p.coyote = 0.09;
      p.airJumps = p.maxAirJumps;
      if (stats.danger > 0.16 && stats.nearMissCd <= 0) {
        const clutchLines = [
          `${p.label} SAID NOT TODAY. 😤`,
          `${p.label} defied gravity AND expectations.`,
          `${p.label} survives. Somehow. HOW?`,
          `${p.label} refuses to fall off. Respect.`,
          `${p.label} is on thin air and thriving.`,
        ];
        showEvent(pick(clutchLines), 1.05);
        sfx(690, 0.06, "triangle", 0.04);
        addShake(3.2);
        addParticles(p.x, p.y + p.radius * 0.4, "#ffffff", 10, 180);
        triggerFlash("255,255,255", 0.07);
        stats.nearMissCd = 2.1;
      }
      stats.danger = 0;
    }

    if (!p.grounded) p.spinVel *= 0.995;
    p.spin += p.spinVel * dt;

    if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.52; }
    if (p.x > width - p.radius) { p.x = width - p.radius; p.vx *= -0.52; }

    p.trail.push({ x: p.x, y: p.y, r: p.radius, a: 0.16 });
    if (p.trail.length > 7) p.trail.shift();
  }

  // Player collision
  const a = players[0]; const b = players[1];
  const dx = b.x - a.x; const dy = b.y - a.y;
  const minD = a.radius + b.radius;
  const d2 = dx * dx + dy * dy;

  if (d2 < minD * minD) {
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d; const ny = dy / d;
    const overlap = minD - d;
    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;

    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {
      const restitution = isEffectOn(state.discoUntil) ? 1.16 : 0.96;
      const impulse = -rel * restitution;
      a.vx -= nx * impulse; a.vy -= ny * impulse;
      b.vx += nx * impulse; b.vy += ny * impulse;
      a.spinVel -= impulse * 0.03; b.spinVel += impulse * 0.03;

      if (impulse > 140) {
        state.challengeStats[0].bumpPower += impulse;
        state.challengeStats[1].bumpPower += impulse;
        addShake(Math.min(7, impulse * 0.015));
        addParticles((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, "#d8f4ff", 14, 230);
        sfx(220 + Math.min(250, impulse * 0.3), 0.07, "square", 0.03);
        triggerFlash("220,244,255", 0.06);
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    p.vy += 880 * dt * 0.35;
    p.vx *= 0.986; p.vy *= 0.992;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.t >= p.life) particles.splice(i, 1);
  }
}

function checkRoundEnd() {
  if (roundOver || state.winner !== null) return;

  let loser = -1;
  if (players[0].y > height + 90) loser = 0;
  if (players[1].y > height + 90) loser = 1;

  if (loser >= 0) {
    roundOver = true;
    running = false;
    state.upcomingEventWarning = null;
    state.warningTime = 0;
    state.pendingChaosRoll = null;
    updateWarningUI();

    const winnerId = loser === 0 ? 1 : 0;
    const loserBefore = state.score[loser];
    state.roundNumber += 1;
    state.streak[winnerId] += 1;
    state.streak[loser] = 0;
    state.score[winnerId] += 1;

    // Animate score card
    const card = winnerId === 0 ? p1Card : p2Card;
    if (card) { card.classList.remove('scored'); void card.offsetWidth; card.classList.add('scored'); }

    updateScore();
    sfx(300 + winnerId * 90, 0.14, "triangle", 0.05);

    if (state.score[winnerId] >= state.winScore) {
      state.winner = winnerId;
      const finisher = [
        `${players[winnerId].label} IS THE SAHUR BALL CHAMP! 🏆`,
        `${players[winnerId].label} WINS IT ALL! ${players[loser].label} is cooked. 💀`,
        `CERTIFIED GOAT. ${players[winnerId].label} takes the set!`,
        `${players[loser].label} exits the tournament. ${players[winnerId].label} supremacy.`,
      ];
      showEvent(pick(finisher), 3.5);
      triggerFlash("255,235,140", 0.18);
      // Confetti burst
      const colors = ["#ff6e7d","#6ea0ff","#ffdc5e","#7fffb6","#ff9f58","#c879ff"];
      for (let i = 0; i < 6; i++) {
        scheduleEffect(() => {
          addParticles(width * (0.2 + Math.random() * 0.6), height * 0.4, pick(colors), 20, 320);
        }, i * 180);
      }
      scheduleEffect(() => resetMatch(), 4000);
      return;
    }

    const hype = [
      `${players[loser].label} fell off. Skill issue. 💀`,
      `${players[loser].label} L + ratio + touched the void.`,
      `${players[winnerId].label} holds the beam. ${players[loser].label} does not.`,
      `${players[winnerId].label} takes it. ${players[loser].label} is cooked.`,
      `${players[loser].label} fell off faster than their grades.`,
      `${players[winnerId].label} is built different. ${players[loser].label} built wrong.`,
      `${players[loser].label}: "I meant to fall." Sure bro.`,
    ];
    let msg = pick(hype);

    const didChallenge = challengeAchieved(winnerId);
    if (didChallenge) {
      msg = `${players[winnerId].label}: ${state.challengeDoneText}`;
      addParticles(players[winnerId].x, players[winnerId].y, "#fff2a6", 22, 260);
      sfx(760, 0.07, "triangle", 0.045);
      triggerFlash("255,245,190", 0.1);
    } else if (loserBefore - state.score[winnerId] + 1 >= 2) {
      msg = `${players[winnerId].label} starts the comeback arc. 👀`;
    } else if (state.streak[winnerId] >= 2) {
      msg = `${players[winnerId].label} is ON FIRE 🔥 x${state.streak[winnerId]}!`;
      sfx(540, 0.06, "square", 0.04);
    } else if (state.score[winnerId] === state.winScore - 1) {
      msg = `${players[winnerId].label} on MATCH POINT. ${players[loser].label} is cooked. 🫵`;
    } else if (state.score[0] === state.score[1]) {
      msg = `All tied ${state.score[0]}-${state.score[1]}. Getting spicy. 🌶️`;
    }

    showEvent(msg, 1.65);
    triggerFlash("255,255,255", 0.07);
    scheduleEffect(() => { resetRoundPositions(); }, 900);
  }
}

// ========================= DRAWING =========================

function drawBackground() {
  ctx.clearRect(0, 0, width, height);

  // Sky
  const disco = isEffectOn(state.discoUntil);
  if (disco) {
    const t = state.time;
    const dg = ctx.createLinearGradient(0, 0, 0, height);
    dg.addColorStop(0, `hsl(${t * 40 % 360},80%,52%)`);
    dg.addColorStop(0.5, `hsl(${(t * 40 + 120) % 360},80%,58%)`);
    dg.addColorStop(1, `hsl(${(t * 40 + 240) % 360},80%,50%)`);
    ctx.fillStyle = dg;
  } else {
    ctx.fillStyle = skyGradient || "#83cff0";
  }
  ctx.fillRect(0, 0, width, height);

  // Sun
  if (!disco) {
    const sx = width * 0.82;
    const sy = height * 0.1;
    const sunGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, width * 0.18);
    sunGlow.addColorStop(0, "rgba(255,250,200,0.55)");
    sunGlow.addColorStop(0.35, "rgba(255,240,160,0.22)");
    sunGlow.addColorStop(1, "rgba(255,220,100,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(sx, sy, width * 0.042, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,252,210,0.95)";
    ctx.fill();
  }

  // Atmospheric bands
  if (!disco) {
    for (let i = 0; i < 3; i++) {
      const y = height * (0.25 + i * 0.18);
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(60,160,190,0.08)";
      ctx.fillRect(0, y, width, 3);
    }
  }

  // Clouds
  for (const c of clouds) {
    c.x += (c.s / width) * 0.035;
    if (c.x > 1.28) c.x = -0.28;
    const x = c.x * width;
    const y = c.y * height;
    const w = c.w * width;
    ctx.fillStyle = disco
      ? `rgba(255,255,255,${c.opacity * 0.3})`
      : `rgba(255,255,255,${c.opacity})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.34, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.26, y + 6, w * 0.29, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.22, y + 8, w * 0.25, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloud shadow
    ctx.fillStyle = disco ? "rgba(0,0,0,0.04)" : "rgba(70,130,160,0.12)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, w * 0.28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant hill silhouette
  if (!disco) {
    ctx.fillStyle = "rgba(50,120,150,0.18)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.78);
    for (let xi = 0; xi <= 12; xi++) {
      const hx = (xi / 12) * width;
      const hy = height * 0.78 - Math.sin(xi * 0.9 + 1.2) * height * 0.06 - Math.sin(xi * 0.4) * height * 0.04;
      ctx.lineTo(hx, hy);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlatform() {
  const disco = isEffectOn(state.discoUntil);

  ctx.save();
  ctx.translate(platform.pivot.x, platform.pivot.y);
  ctx.rotate(platform.angle);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, platform.thickness * 0.5 + 16, platform.length * 0.52, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Disco glow
  if (disco) {
    const t = state.time;
    ctx.shadowColor = `hsl(${t * 90 % 360},100%,60%)`;
    ctx.shadowBlur = 22;
  }

  const beam = ctx.createLinearGradient(-platform.length * 0.5, -platform.thickness * 0.5, platform.length * 0.5, platform.thickness * 0.5);
  beam.addColorStop(0, disco ? "#3a1a6a" : "#102030");
  beam.addColorStop(0.2, disco ? "#5a2090" : "#1c3a4e");
  beam.addColorStop(0.8, disco ? "#5a2090" : "#1c3a4e");
  beam.addColorStop(1, disco ? "#3a1a6a" : "#102030");
  ctx.fillStyle = beam;
  ctx.fillRect(-platform.length * 0.5, -platform.thickness * 0.5, platform.length, platform.thickness);

  ctx.shadowBlur = 0;

  // Top highlight
  ctx.fillStyle = disco ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.14)";
  ctx.fillRect(-platform.length * 0.5, -platform.thickness * 0.5, platform.length, 3);
  // Bottom edge
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(-platform.length * 0.5, platform.thickness * 0.5 - 3, platform.length, 3);

  // Rivets / tick marks
  ctx.strokeStyle = "rgba(8,16,22,0.5)";
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    const x = (i / 3) * platform.length * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, -platform.thickness * 0.5 + 2);
    ctx.lineTo(x + 8, platform.thickness * 0.5 - 2);
    ctx.stroke();
  }

  // Pivot pole
  ctx.strokeStyle = "#14222e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, platform.thickness * 0.5);
  ctx.lineTo(0, 135);
  ctx.stroke();

  // Pivot circle
  ctx.fillStyle = "#0e1c28";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(-3, -3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawStarPath(c, x, y, points, outerR, innerR) {
  let rot = -Math.PI * 0.5;
  const step = Math.PI / points;
  c.beginPath();
  c.moveTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
  for (let i = 0; i < points; i++) {
    rot += step;
    c.lineTo(x + Math.cos(rot) * innerR, y + Math.sin(rot) * innerR);
    rot += step;
    c.lineTo(x + Math.cos(rot) * outerR, y + Math.sin(rot) * outerR);
  }
  c.closePath();
}

function getHazardSprite(type, radius) {
  const r = Math.max(10, radius);
  const key = `${type}|${r}`;
  let sprite = hazardSpriteCache.get(key);
  if (sprite) return sprite;
  if (hazardSpriteCache.size > 120) hazardSpriteCache.clear();

  const size = Math.max(32, Math.ceil(r * 2.8));
  const sc = document.createElement("canvas");
  sc.width = size; sc.height = size;
  const c = sc.getContext("2d");
  const cx = size * 0.5; const cy = size * 0.5;

  if (type === "anvil") {
    c.fillStyle = "#4f5863";
    c.fillRect(cx - r * 0.95, cy - r * 0.1, r * 1.9, r * 0.9);
    c.fillStyle = "#6a7482";
    c.fillRect(cx - r * 0.6, cy - r * 0.7, r * 1.2, r * 0.45);
    c.fillStyle = "#3d454e";
    c.fillRect(cx - r * 0.7, cy - r * 0.28, r * 1.4, r * 0.22);
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.fillRect(cx - r * 0.52, cy - r * 0.62, r * 0.95, r * 0.14);
  } else if (type === "tomato") {
    c.fillStyle = "#e63e57";
    c.beginPath(); c.arc(cx, cy, r * 0.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2f9b57";
    c.beginPath();
    c.moveTo(cx, cy - r * 0.95); c.lineTo(cx + r * 0.24, cy - r * 0.45);
    c.lineTo(cx - r * 0.1, cy - r * 0.5); c.lineTo(cx + r * 0.5, cy - r * 0.12);
    c.lineTo(cx, cy - r * 0.32); c.lineTo(cx - r * 0.5, cy - r * 0.12);
    c.lineTo(cx - r * 0.1, cy - r * 0.5); c.lineTo(cx - r * 0.24, cy - r * 0.45);
    c.closePath(); c.fill();
  } else if (type === "banana") {
    c.strokeStyle = "#f5d33f"; c.lineWidth = r * 0.42; c.lineCap = "round";
    c.beginPath(); c.arc(cx - r * 0.15, cy + r * 0.1, r * 0.9, 0.2, 1.6); c.stroke();
    c.strokeStyle = "#9b7c1f"; c.lineWidth = r * 0.1;
    c.beginPath(); c.arc(cx - r * 0.12, cy + r * 0.1, r * 0.82, 0.28, 1.52); c.stroke();
  } else if (type === "bomb") {
    c.fillStyle = "#222"; c.beginPath(); c.arc(cx, cy, r * 0.86, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3c3c3c"; c.beginPath(); c.arc(cx, cy - r * 0.8, r * 0.18, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#c58d28"; c.lineWidth = Math.max(2, r * 0.12); c.lineCap = "round";
    c.beginPath(); c.moveTo(cx + r * 0.05, cy - r * 0.9); c.lineTo(cx + r * 0.42, cy - r * 1.18); c.stroke();
    c.fillStyle = "#ff9f1c"; c.beginPath(); c.arc(cx + r * 0.44, cy - r * 1.2, r * 0.1, 0, Math.PI * 2); c.fill();
  } else if (type === "rock") {
    c.fillStyle = "#88745f";
    c.beginPath();
    c.moveTo(cx - r * 0.85, cy - r * 0.25); c.lineTo(cx - r * 0.3, cy - r * 0.9);
    c.lineTo(cx + r * 0.62, cy - r * 0.62); c.lineTo(cx + r * 0.92, cy + r * 0.1);
    c.lineTo(cx + r * 0.4, cy + r * 0.82); c.lineTo(cx - r * 0.62, cy + r * 0.62);
    c.closePath(); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.2)"; c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.moveTo(cx - r * 0.3, cy - r * 0.5); c.lineTo(cx + r * 0.32, cy - r * 0.1); c.lineTo(cx - r * 0.05, cy + r * 0.42);
    c.stroke();
  } else if (type === "spike") {
    c.fillStyle = "#e54fff";
    c.beginPath();
    c.moveTo(cx, cy - r * 0.95); c.lineTo(cx + r * 0.9, cy + r * 0.88); c.lineTo(cx - r * 0.9, cy + r * 0.88);
    c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,0.26)";
    c.beginPath();
    c.moveTo(cx, cy - r * 0.68); c.lineTo(cx + r * 0.45, cy + r * 0.62); c.lineTo(cx, cy + r * 0.42);
    c.closePath(); c.fill();
  } else if (type === "ice") {
    c.fillStyle = "#8eefff";
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + Math.cos(a) * r * 0.92; const py = cy + Math.sin(a) * r * 0.92;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.moveTo(cx - r * 0.35, cy - r * 0.1); c.lineTo(cx + r * 0.42, cy - r * 0.34);
    c.moveTo(cx - r * 0.15, cy + r * 0.48); c.lineTo(cx + r * 0.22, cy + r * 0.05);
    c.stroke();
  } else if (type === "meteor") {
    const g = c.createRadialGradient(cx - r * 0.28, cy - r * 0.32, r * 0.2, cx, cy, r * 0.95);
    g.addColorStop(0, "#ffd47a"); g.addColorStop(0.6, "#ff8d42"); g.addColorStop(1, "#cc4a21");
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.95, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(87,35,20,0.35)";
    c.beginPath(); c.arc(cx + r * 0.26, cy + r * 0.12, r * 0.2, 0, Math.PI * 2);
    c.arc(cx - r * 0.26, cy - r * 0.15, r * 0.14, 0, Math.PI * 2); c.fill();
  } else if (type === "crate") {
    c.fillStyle = "#9f6d3d"; c.fillRect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
    c.strokeStyle = "#6c4525"; c.lineWidth = Math.max(2, r * 0.14);
    c.strokeRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    c.beginPath();
    c.moveTo(cx - r * 0.6, cy - r * 0.6); c.lineTo(cx + r * 0.6, cy + r * 0.6);
    c.moveTo(cx + r * 0.6, cy - r * 0.6); c.lineTo(cx - r * 0.6, cy + r * 0.6);
    c.stroke();
  } else if (type === "spring") {
    c.fillStyle = "#2ac16f"; c.beginPath(); c.arc(cx, cy + r * 0.55, r * 0.52, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#d6ffe9"; c.lineWidth = Math.max(2, r * 0.12); c.lineCap = "round";
    c.beginPath(); c.moveTo(cx - r * 0.45, cy + r * 0.45); c.quadraticCurveTo(cx, cy - r * 0.75, cx + r * 0.45, cy + r * 0.45); c.stroke();
    c.strokeStyle = "#1f7f4c"; c.lineWidth = Math.max(1.4, r * 0.08);
    c.beginPath(); c.moveTo(cx - r * 0.4, cy + r * 0.28); c.quadraticCurveTo(cx, cy - r * 0.55, cx + r * 0.4, cy + r * 0.28); c.stroke();
  } else if (type === "star") {
    c.fillStyle = "#91eeff";
    drawStarPath(c, cx, cy, 5, r * 0.95, r * 0.45); c.fill();
    c.fillStyle = "rgba(255,255,255,0.4)";
    drawStarPath(c, cx - r * 0.1, cy - r * 0.1, 5, r * 0.52, r * 0.24); c.fill();
  } else {
    c.fillStyle = "#d35f6f";
    c.beginPath(); c.arc(cx, cy, r * 0.9, 0, Math.PI * 2); c.fill();
  }

  hazardSpriteCache.set(key, sc);
  return sc;
}

function drawHazards() {
  for (const h of hazards) {
    if (h.x < -h.radius * 2 || h.x > width + h.radius * 2 || h.y < -h.radius * 2 || h.y > height + h.radius * 2) continue;
    ctx.beginPath();
    ctx.arc(h.x + 2, h.y + 4, h.radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fill();
    const sprite = getHazardSprite(h.type, Math.round(h.radius));
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.spin);
    ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);
    ctx.restore();
  }
}

function drawSpeedTrails() {
  for (const p of players) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < 180) continue;
    const angle = Math.atan2(p.vy, p.vx);
    const len = Math.min(56, speed * 0.1);
    const colorRgb = p.id === 0 ? "232,40,58" : "24,85,232";
    ctx.strokeStyle = `rgba(${colorRgb},0.38)`;
    ctx.lineWidth = Math.max(3, p.radius * 0.28);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(angle) * len * 0.2, p.y - Math.sin(angle) * len * 0.2);
    ctx.lineTo(p.x - Math.cos(angle) * len * 1.3, p.y - Math.sin(angle) * len * 1.3);
    ctx.stroke();
  }
}

function drawParticles() {
  const heavyLoad = particles.length > 420;
  for (const p of particles) {
    if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
    const lifeRatio = 1 - p.t / p.life;
    const size = p.size * lifeRatio;
    if (size < 0.35) continue;

    if (!heavyLoad) {
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.15 * lifeRatio; ctx.fill();
    }

    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.globalAlpha = 0.8 * lifeRatio; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFlashOverlay() {
  if (state.flashTimer <= 0) return;
  const a = Math.min(0.28, state.flashTimer * 2.3);
  ctx.fillStyle = `rgba(${state.flashColor},${a})`;
  ctx.fillRect(0, 0, width, height);
}

function drawBall(p) {
  const r = Math.max(10, Math.round(p.radius));
  const key = `${p.color}|${p.number}|${r}`;
  let sprite = ballSpriteCache.get(key);
  if (!sprite) {
    if (ballSpriteCache.size > 48) ballSpriteCache.clear();
    const size = r * 2 + 6;
    const sc = document.createElement("canvas");
    sc.width = size; sc.height = size;
    const sctx = sc.getContext("2d");
    const cx = size * 0.5; const cy = size * 0.5;

    const grad = sctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.2, cx, cy, r * 1.15);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.12, "#f4f4f4");
    grad.addColorStop(0.22, p.color);
    grad.addColorStop(0.82, p.color);
    grad.addColorStop(1, "#0d1318");
    sctx.fillStyle = grad;
    sctx.beginPath(); sctx.arc(cx, cy, r, 0, Math.PI * 2); sctx.fill();

    sctx.strokeStyle = "rgba(255,255,255,0.18)"; sctx.lineWidth = Math.max(1.5, r * 0.08);
    sctx.beginPath(); sctx.arc(cx, cy, r * 0.68, 0.2, Math.PI * 1.8); sctx.stroke();

    sctx.fillStyle = "rgba(255,255,255,0.55)";
    sctx.beginPath(); sctx.arc(cx - r * 0.36, cy - r * 0.36, r * 0.22, 0, Math.PI * 2); sctx.fill();

    sctx.fillStyle = "#f4f4f4";
    sctx.beginPath(); sctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); sctx.fill();

    sctx.fillStyle = "#111";
    sctx.font = `bold ${Math.max(12, r * 0.55)}px sans-serif`;
    sctx.textAlign = "center"; sctx.textBaseline = "middle";
    sctx.fillText(p.number, cx, cy + 1);

    ballSpriteCache.set(key, sc);
    sprite = sc;
  }

  // Drop shadow
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + r * 0.6, r * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fill();

  // Glow when grounded
  if (p.grounded) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "transparent"; ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.spin);
  ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);
  ctx.restore();

  // Player label floating above ball
  const labelY = p.y - r - 10;
  ctx.save();
  ctx.font = `900 ${Math.max(12, r * 0.54)}px 'Nunito', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 5;
  ctx.fillStyle = p.id === 0 ? "#ff8090" : "#80aaff";
  ctx.fillText(p.label, p.x, labelY);
  ctx.restore();

  // Stun indicator
  if (p.stunned > 0) {
    ctx.save();
    ctx.font = `${Math.max(14, r * 0.7)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💫", p.x + Math.cos(state.time * 8) * r * 0.8, p.y - r - 22);
    ctx.restore();
  }
}

function drawWinnerText() {
  if (state.winner === null) return;

  const w = players[state.winner];
  const loser = players[state.winner === 0 ? 1 : 0];

  // Overlay
  ctx.fillStyle = "rgba(2,8,18,0.82)";
  ctx.fillRect(0, 0, width, height);

  // Trophy
  ctx.save();
  const trophySize = Math.min(90, width * 0.11);
  ctx.font = `${trophySize}px serif`;
  ctx.textAlign = "center";
  ctx.fillText("🏆", width * 0.5, height * 0.3);
  ctx.restore();

  // Winner name with glow
  ctx.save();
  const nameSize = Math.min(78, width * 0.1);
  ctx.shadowColor = w.color;
  ctx.shadowBlur = 36;
  ctx.font = `900 ${nameSize}px 'Bebas Neue', 'Nunito', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = w.id === 0 ? "#ff6e7d" : "#6ea0ff";
  ctx.fillText(`${w.label} WINS!`, width * 0.5, height * 0.46);
  ctx.restore();

  // Score recap
  ctx.save();
  ctx.font = `bold ${Math.min(26, width * 0.036)}px 'Nunito', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`${state.score[0]}  :  ${state.score[1]}`, width * 0.5, height * 0.56);
  ctx.restore();

  // Rematch prompt (pulsing)
  const pulse = 0.7 + 0.3 * Math.sin(state.time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.font = `bold ${Math.min(19, width * 0.028)}px 'Nunito', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("Press any key  ·  Tap to REMATCH 👊", width * 0.5, height * 0.64);
  ctx.restore();
}

function drawCountdown() {
  if (state.countdownTimer <= 0) return;
  const countNum = Math.ceil(state.countdownTimer);
  if (countNum > 3) return;

  const frac = state.countdownTimer % 1;
  const scale = 1 + (1 - frac) * 0.45;
  const alpha = frac > 0.18 ? 1 : frac / 0.18;

  const colors = ["#ff4455", "#ff9932", "#ffdd44"];
  const glows  = ["rgba(232,40,58,0.7)", "rgba(255,153,50,0.7)", "rgba(255,220,50,0.7)"];

  ctx.save();
  ctx.globalAlpha = alpha;
  const fs = Math.min(180, width * 0.2) * scale;
  ctx.font = `900 ${fs}px 'Bebas Neue', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = glows[countNum - 1];
  ctx.shadowBlur = 48;
  ctx.fillStyle = colors[countNum - 1];
  ctx.fillText(countNum, width * 0.5, height * 0.42);
  ctx.restore();
}

// ========================= MAIN LOOP =========================

function update(dt) {
  state.eventTimer -= dt;
  state.countdownTimer -= dt;
  state.flashTimer -= dt;
  state.hitCommentCd -= dt;
  clearEventIfDone();

  if (state.countdownTimer <= 0 && !running && !roundOver && state.winner === null) {
    running = true;
  }

  updateWarningUI();
  playCountdownAndWarningSfx();
  if (!running || state.winner !== null) return;

  const slowMoScale = isEffectOn(state.slowMotionUntil) ? 0.35 : 1;
  dt *= slowMoScale;

  state.time += dt;
  state.chaosTimer -= dt;
  syncPlatformLength();

  if (state.pendingChaosRoll === null && state.chaosTimer > 0 && state.chaosTimer <= state.chaosWarningLead) {
    queueUpcomingChaos();
  }

  if (state.pendingChaosRoll !== null) state.warningTime = Math.max(0, state.chaosTimer);
  updateWarningUI();

  updatePlatform(dt);
  updatePlayers(dt);
  updateHazards(dt);
  updateParticles(dt);
  checkRoundEnd();

  if (state.chaosTimer <= 0) {
    state.upcomingEventWarning = null;
    state.warningTime = 0;
    triggerChaosEvent(state.pendingChaosRoll);
    state.pendingChaosRoll = null;
    updateWarningUI();
    state.chaosTimer = 2.4 + Math.random() * 2.1;
    state.chaosWarningLead = randomChaosWarningLead();
  }
}

function render() {
  const shakeNow = camera.shake;
  if (shakeNow > 0) {
    const sx = (Math.random() - 0.5) * shakeNow;
    const sy = (Math.random() - 0.5) * shakeNow;
    ctx.save();
    ctx.translate(sx, sy);
  }

  drawBackground();
  drawPlatform();
  drawHazards();
  drawSpeedTrails();
  drawParticles();
  drawBall(players[0]);
  drawBall(players[1]);
  drawFlashOverlay();
  drawCountdown();
  drawWinnerText();

  if (shakeNow > 0) {
    ctx.restore();
    camera.shake *= 0.85;
    if (camera.shake < 0.2) camera.shake = 0;
  }
}

function loop(ts) {
  const dt = Math.min(0.02, (ts - lastTime) / 1000 || 1 / 120);
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ========================= INPUT =========================

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);

  if (!audioUnlocked) { audioUnlocked = true; ensureAudio(); }

  // Detect keyboard use → fade touch controls
  document.body.classList.add("has-keyboard");

  if (e.code === players[0].controls.jump) players[0].jumpBuffer = 0.12;
  if (e.code === players[1].controls.jump) players[1].jumpBuffer = 0.12;

  // Rematch on any key press
  if (state.winner !== null) { state.effectGen++; resetMatch(); }
});

window.addEventListener("keyup", (e) => { keys.delete(e.code); });

// Rematch on tap when winner shown
window.addEventListener("touchstart", (e) => {
  if (!audioUnlocked) { audioUnlocked = true; ensureAudio(); }
  // Only fire if not touching a game button
  const target = e.target;
  if (target && target.classList.contains('tbtn')) return;
  if (state.winner !== null) { e.preventDefault(); state.effectGen++; resetMatch(); }
}, { passive: false });

// ========================= TOUCH CONTROLS =========================

function setupTouch() {
  const map = [
    ["p1-left",  players[0].controls.left],
    ["p1-right", players[0].controls.right],
    ["p1-jump",  players[0].controls.jump],
    ["p2-left",  players[1].controls.left],
    ["p2-right", players[1].controls.right],
    ["p2-jump",  players[1].controls.jump],
  ];

  for (const [id, code] of map) {
    const el = document.getElementById(id);
    if (!el) continue;

    const press = () => {
      keys.add(code);
      if (code === players[0].controls.jump) players[0].jumpBuffer = 0.14;
      if (code === players[1].controls.jump) players[1].jumpBuffer = 0.14;
      if (!audioUnlocked) { audioUnlocked = true; ensureAudio(); }
      el.classList.add("held");
    };

    const release = () => {
      keys.delete(code);
      el.classList.remove("held");
    };

    el.addEventListener("touchstart",  (e) => { e.preventDefault(); press(); },   { passive: false });
    el.addEventListener("touchend",    (e) => { e.preventDefault(); release(); },  { passive: false });
    el.addEventListener("touchcancel", (e) => { e.preventDefault(); release(); },  { passive: false });
    el.addEventListener("mousedown",   press);
    el.addEventListener("mouseup",     release);
    el.addEventListener("mouseleave",  release);
  }
}

window.addEventListener("resize", resize);

resize();
setupTouch();
resetMatch();
requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(loop);
});
