// ════════════════════════════════════════════════════════
//  SAHUR BALL — Enhanced Edition
// ════════════════════════════════════════════════════════

const canvas   = document.getElementById("game");
const ctx      = canvas.getContext("2d");
const eventEl  = document.getElementById("event");
const warningEl  = document.getElementById("warning");
const challengeEl = document.getElementById("challenge");
const p1ScoreEl  = document.getElementById("p1-score");
const p2ScoreEl  = document.getElementById("p2-score");
const p1Card  = document.getElementById("p1-card");
const p2Card  = document.getElementById("p2-card");
const p1PipsEl  = document.getElementById("p1-pips");
const p2PipsEl  = document.getElementById("p2-pips");
const p1FireEl  = document.getElementById("p1-fire");
const p2FireEl  = document.getElementById("p2-fire");

// ── Mobile detection (coarse pointer = touchscreen) ──────────────
const isMobile = window.matchMedia("(pointer: coarse)").matches;
if (isMobile) document.body.classList.add("is-mobile");

let width = 0, height = 0;
let running = false, roundOver = false, lastTime = 0;
let audioUnlocked = false, audioCtx = null, skyGradient = null;

// ── State ─────────────────────────────────────────────────────────
const state = {
  score: [0, 0], winScore: 5, winner: null,
  chaosTimer: 3.1, eventTimer: 0, time: 0,
  reverseUntil: 0, lowGravityUntil: 0,
  stickyUntil: 0, turboUntil: 0,
  discoUntil: 0, sizeSwapUntil: 0,
  showerUntil: 0, slowMotionUntil: 0,
  shrinkUntil: 0, growUntil: 0,
  tripleJumpUntil: 0, controlFlipUntil: [0, 0],
  platformShortUntil: 0, platformLongUntil: 0, platformTinyUntil: 0,
  // NEW EFFECTS
  earthquakeUntil: 0,
  gravityFlipUntil: 0,
  conveyorUntil: 0, conveyorDir: 1,
  ghostPlatformUntil: 0,
  iceFloorUntil: 0,
  panicUntil: 0, panicTimer: 0,
  windUntil: 0, windDir: 1,
  superGravityUntil: 0,
  suddenDeath: false,
  // POWERUP SYSTEM
  powerups: [],
  powerupSpawnTimer: 10,
  // HUD/timers
  countdownTimer: 0,
  upcomingEventWarning: null, warningTime: 0,
  chaosWarningLead: 2.5, pendingChaosRoll: null,
  streak: [0, 0], roundNumber: 0,
  effectGen: 0, flashTimer: 0, flashColor: "255,255,255",
  challengeId: 0, challengeText: "", challengeDoneText: "",
  challengeStats: [
    { jumps:0, airTime:0, bumpPower:0, hazardHits:0, danger:0, nearMissCd:0 },
    { jumps:0, airTime:0, bumpPower:0, hazardHits:0, danger:0, nearMissCd:0 },
  ],
  hitCommentCd: 0,
  warningUiText: "", challengeUiText: "",
  lastCountdownTick: 0, lastWarningTick: 0,
};

const keys = new Set();

const platform = {
  pivot: { x:0, y:0 }, baseLength: 0, length: 0,
  thickness: 24, angle: 0, angVel: 0,
};

const camera = { shake: 0 };
const particles = [];

// ── Players ───────────────────────────────────────────────────────
const players = [
  {
    id:0, label:"P1", color:"#e8283a", number:"3",
    x:0,y:0,vx:0,vy:0, radius:26, baseRadius:26,
    grounded:false, jumpCd:0, landSfxCd:0, stunned:0,
    spin:0, spinVel:0, trail:[], jumpBuffer:0, coyote:0,
    airJumps:2, maxAirJumps:2,
    shielded:false, frozenUntil:0, boostedUntil:0,
    controls:{ left:"KeyA", right:"KeyD", jump:"KeyW" },
  },
  {
    id:1, label:"P2", color:"#1855e8", number:"8",
    x:0,y:0,vx:0,vy:0, radius:26, baseRadius:26,
    grounded:false, jumpCd:0, landSfxCd:0, stunned:0,
    spin:0, spinVel:0, trail:[], jumpBuffer:0, coyote:0,
    airJumps:2, maxAirJumps:2,
    shielded:false, frozenUntil:0, boostedUntil:0,
    controls:{ left:"ArrowLeft", right:"ArrowRight", jump:"ArrowUp" },
  },
];

const hazards = [];
let hazardSpawnTimer = 1.1;
const clouds = Array.from({ length:9 }, () => ({
  x: Math.random(),
  y: 0.06 + Math.random() * 0.3,
  w: 0.1 + Math.random() * 0.2,
  s: 6 + Math.random() * 12,
  op: 0.55 + Math.random() * 0.35,
}));
const ballSpriteCache = new Map();
const hazardSpriteCache = new Map();
const MAX_PARTICLES = 550;

const ROUND_CHALLENGES = [
  { text:"Challenge: No-jump round",      done:"No-jump cleared 🐐" },
  { text:"Challenge: Max airtime",        done:"Airtime master 🦅" },
  { text:"Challenge: Big impacts",        done:"Impact king 💥" },
  { text:"Challenge: Hazard pressure",    done:"Hazard survivor 🛡️" },
  { text:"Challenge: Don't touch foe",    done:"Ghost mode 👻" },
  { text:"Challenge: Tiny beam gaming",   done:"Precision certified ✨" },
  { text:"Challenge: Beating chaos",      done:"Chaos not found 😤" },
];

// ── Powerup config ────────────────────────────────────────────────
const POWERUP_TYPES = ["zap","shield","boost","swap","giant","shrink_foe"];
const POWERUP_EMOJI = { zap:"⚡", shield:"🛡️", boost:"🔥", swap:"🔀", giant:"🫧", shrink_foe:"🔫" };
const POWERUP_COLOR = { zap:"#ffe44a", shield:"#4ae6ff", boost:"#ff6030", swap:"#c060ff", giant:"#60ff90", shrink_foe:"#ff80e0" };

// ═════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════

function isEffectOn(until) { return state.time < until; }

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function sfx(freq=300, dur=0.08, type="square", vol=0.035) {
  if (!audioUnlocked || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(45, freq*0.82), audioCtx.currentTime+dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+dur);
}

function addShake(power) { camera.shake = Math.min(20, camera.shake + power); }

function scheduleEffect(fn, ms) {
  const gen = state.effectGen;
  setTimeout(() => { if (gen === state.effectGen) fn(); }, ms);
}

function addParticles(x, y, color, count=12, force=260) {
  count = Math.max(3, Math.floor(count * (particles.length > 400 ? 0.35 : 0.45)));
  force *= 0.82;
  if (particles.length + count > MAX_PARTICLES) return;
  for (let i=0; i<count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = force * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed,
      life: 0.35+Math.random()*0.25, t:0, size:2+Math.random()*3, color });
  }
}

function showEvent(text, dur=2) {
  state.eventTimer = dur;
  eventEl.textContent = text;
  eventEl.classList.add("show");
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═════════════════════════════════════════════════════════════════
//  UI UPDATES
// ═════════════════════════════════════════════════════════════════

function updateWarningUI() {
  if (!warningEl) return;
  if (state.upcomingEventWarning && state.warningTime > 0) {
    const secs = Math.max(1, Math.ceil(state.warningTime));
    const txt = `⚠️ INCOMING: ${state.upcomingEventWarning} [${secs}s]`;
    if (state.warningUiText !== txt) { state.warningUiText = txt; warningEl.textContent = txt; }
    if (!warningEl.classList.contains("show")) warningEl.classList.add("show");
  } else {
    warningEl.classList.remove("show");
    if (state.warningUiText) { state.warningUiText = ""; warningEl.textContent = ""; }
  }
}

function updateChallengeUI() {
  const txt = state.challengeText || "";
  if (state.challengeUiText === txt) return;
  state.challengeUiText = txt;
  if (challengeEl) challengeEl.textContent = txt;
}

function updateScore() {
  if (p1ScoreEl) p1ScoreEl.textContent = state.score[0];
  if (p2ScoreEl) p2ScoreEl.textContent = state.score[1];
  rebuildPips(p1PipsEl, 0);
  rebuildPips(p2PipsEl, 1);
  updateFireBadge(0);
  updateFireBadge(1);
}

function rebuildPips(container, pid) {
  if (!container) return;
  const existing = container.querySelectorAll(".pip");
  for (let i=0; i<state.winScore; i++) {
    let pip = existing[i];
    if (!pip) { pip = document.createElement("div"); pip.className = "pip"; container.appendChild(pip); }
    const shouldFill = i < state.score[pid];
    const wasFilled = pip.classList.contains("filled");
    if (shouldFill && !wasFilled) {
      pip.classList.add("filled","pop");
      setTimeout(() => pip.classList.remove("pop"), 400);
    } else if (!shouldFill && wasFilled) {
      pip.classList.remove("filled","pop");
    }
  }
}

function updateFireBadge(pid) {
  const el = pid === 0 ? p1FireEl : p2FireEl;
  const card = pid === 0 ? p1Card : p2Card;
  if (!el) return;
  const streak = state.streak[pid];
  if (streak >= 2) {
    el.textContent = "🔥".repeat(Math.min(streak, 4));
    if (card) card.classList.add("on-fire");
  } else {
    el.textContent = "";
    if (card) card.classList.remove("on-fire");
  }
}

function pickRoundChallenge() {
  state.challengeId = Math.floor(Math.random() * ROUND_CHALLENGES.length);
  state.challengeText = ROUND_CHALLENGES[state.challengeId].text;
  state.challengeDoneText = ROUND_CHALLENGES[state.challengeId].done;
  for (const s of state.challengeStats) {
    s.jumps=0; s.airTime=0; s.bumpPower=0; s.hazardHits=0; s.danger=0; s.nearMissCd=0;
  }
  updateChallengeUI();
}

function challengeAchieved(pid) {
  const s = state.challengeStats[pid];
  if (state.challengeId===0) return s.jumps===0;
  if (state.challengeId===1) return s.airTime>=2.2;
  if (state.challengeId===2) return s.bumpPower>=320;
  if (state.challengeId===3) return s.hazardHits>=3;
  if (state.challengeId===4) return state.challengeStats[pid].bumpPower<5;
  return false;
}

function triggerFlash(rgb, dur=0.12) {
  state.flashColor = rgb;
  state.flashTimer = Math.max(state.flashTimer, dur);
}

function clearEventIfDone() { if (state.eventTimer <= 0) eventEl.classList.remove("show"); }

function playCountdownAndWarningSfx() {
  if (!running && state.countdownTimer > 0) {
    const tick = Math.max(1, Math.min(3, Math.ceil(state.countdownTimer)));
    if (tick !== state.lastCountdownTick) {
      state.lastCountdownTick = tick;
      sfx(320+tick*90, 0.06, "square", 0.035);
    }
  } else if (state.lastCountdownTick !== 0) {
    state.lastCountdownTick = 0;
    sfx(760, 0.07, "triangle", 0.042);
  }
  if (state.upcomingEventWarning && state.warningTime > 0) {
    const warnTick = Math.max(1, Math.ceil(state.warningTime));
    if (warnTick !== state.lastWarningTick) {
      state.lastWarningTick = warnTick;
      sfx(420+warnTick*35, 0.045, "sawtooth", 0.03);
    }
  } else { state.lastWarningTick = 0; }
}

// ═════════════════════════════════════════════════════════════════
//  PLATFORM
// ═════════════════════════════════════════════════════════════════

function syncPlatformLength() {
  let factor = 1;
  if (isEffectOn(state.platformTinyUntil))  factor *= 0.42;
  if (isEffectOn(state.platformShortUntil)) factor *= 0.5;
  if (isEffectOn(state.platformLongUntil))  factor *= 1.6;
  if (state.suddenDeath)                    factor *= 0.38;
  platform.length = Math.max(160, Math.min(980, platform.baseLength * factor));
}

function randomChaosWarningLead() { return 2 + Math.random() * 0.8; }

function rotateToLocal(x, y) {
  const dx=x-platform.pivot.x, dy=y-platform.pivot.y;
  const c=Math.cos(platform.angle), s=Math.sin(platform.angle);
  return { x: dx*c+dy*s, y: -dx*s+dy*c };
}

function rotateToWorld(x, y) {
  const c=Math.cos(platform.angle), s=Math.sin(platform.angle);
  return { x: platform.pivot.x+x*c-y*s, y: platform.pivot.y+x*s+y*c };
}

// ═════════════════════════════════════════════════════════════════
//  POWERUPS
// ═════════════════════════════════════════════════════════════════

function spawnPowerup() {
  if (state.powerups.length >= 2) return;
  const maxX = platform.length * 0.42;
  const localX = (Math.random()*2-1) * maxX;
  const type = pick(POWERUP_TYPES);
  state.powerups.push({ type, localX, x:0, y:0, life:14, pulse:0, collected:false });
}

function updatePowerups(dt) {
  state.powerupSpawnTimer -= dt;
  if (state.powerupSpawnTimer <= 0) {
    spawnPowerup();
    state.powerupSpawnTimer = 10 + Math.random()*6;
  }

  const surfaceY = -(platform.thickness*0.5 + 22);

  for (let i=state.powerups.length-1; i>=0; i--) {
    const pu = state.powerups[i];
    pu.life -= dt;
    pu.pulse += dt * 3;

    // Keep on platform surface
    const wp = rotateToWorld(pu.localX, surfaceY);
    pu.x = wp.x; pu.y = wp.y;

    if (pu.life <= 0 || pu.collected) { state.powerups.splice(i, 1); continue; }

    for (const p of players) {
      const dx = p.x-pu.x, dy = p.y-pu.y;
      if (dx*dx+dy*dy < (p.radius+18)*(p.radius+18)) {
        collectPowerup(pu, p);
        pu.collected = true;
        break;
      }
    }
  }
}

function collectPowerup(pu, p) {
  const foe = players[p.id===0 ? 1 : 0];
  addParticles(pu.x, pu.y, POWERUP_COLOR[pu.type], 20, 280);
  sfx(660, 0.09, "triangle", 0.045);
  addShake(2);

  if (pu.type === "zap") {
    foe.frozenUntil = state.time + 2.2;
    foe.stunned = 2.2;
    addParticles(foe.x, foe.y, "#ffe44a", 18, 200);
    sfx(300, 0.15, "sawtooth", 0.04);
    const zapMsg=pick([`⚡ ${p.label} ZAPPED ${foe.label}! ${foe.label} is now a popsicle 🧊`,`⚡ ${foe.label} took 1000 damage. Electricity: super effective.`,`⚡ ${foe.label} went from alive to NUMB in 0.3 seconds.`]);
    showEvent(zapMsg, 1.8);
  }
  if (pu.type === "shield") {
    p.shielded = true;
    const shieldMsg=pick([`🛡️ ${p.label} got a SHIELD! Just tanked one hit like nothing.`,`🛡️ ${p.label} is now invincible (briefly). Speedrunning immortality.`,`🛡️ ${p.label}'s guardian angel showed up early.`]);
    showEvent(shieldMsg, 1.6);
  }
  if (pu.type === "boost") {
    p.boostedUntil = state.time + 4;
    const boostMsg=pick([`🔥 ${p.label} is BOOSTED! Their PC got a performance update.`,`🔥 ${p.label} is NOT holding back. Pure zoom mode engaged.`,`🔥 ${p.label} became SPEED DEMON SUPREME.`]);
    showEvent(boostMsg, 1.6);
  }
  if (pu.type === "swap") {
    const tempX=p.x, tempY=p.y, tempVx=p.vx, tempVy=p.vy;
    p.x=foe.x; p.y=foe.y; p.vx=foe.vx*0.5; p.vy=foe.vy*0.5;
    foe.x=tempX; foe.y=tempY; foe.vx=tempVx*0.5; foe.vy=tempVy*0.5;
    addParticles(foe.x, foe.y, foe.color, 15, 280);
    sfx(800, 0.08, "square", 0.03);
    const swapMsg=pick([`🔀 ${p.label} SWAPPED with ${foe.label}! Both confused now.`,`🔀 IDENTITY SWAPPED!! They're having an existential crisis rn.`,`🔀 ${foe.label} is having an OUT OF BODY EXPERIENCE.`]);
    showEvent(swapMsg, 2);
  }
  if (pu.type === "giant") {
    state.growUntil = Math.max(state.growUntil, state.time + 4.5);
    const giantMsg=pick([`🫧 ${p.label} goes BIG. Like REALLY BIG. Monster energy unlocked.`,`🫧 ${p.label} is expanding their real estate. War crime speedrun.`,`🫧 ${foe.label} better start praying rn.`]);
    showEvent(giantMsg, 1.7);
  }
  if (pu.type === "shrink_foe") {
    state.shrinkUntil = Math.max(state.shrinkUntil, state.time + 4);
    const shrinkMsg=pick([`🔫 ${foe.label} got DOWNSIZED to ant size. Nature's cruel.`,`🔫 ${foe.label} speedrunning the smol category.`,`🔫 ${p.label} said 'shrink' and ${foe.label} listened.`]);
    showEvent(shrinkMsg, 1.8);
  }
}

// ═════════════════════════════════════════════════════════════════
//  CHAOS EVENTS (69 total)
// ═════════════════════════════════════════════════════════════════

const TOTAL_CHAOS = 69;

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
    // NEW 49-68:
    "Earthquake","Gravity Flip","Conveyor Belt","Ghost Platform","Ice Age",
    "Panic Mode","Banana Fiesta","Anvil Rain","Size Roulette","Wind Tunnel",
    "Super Gravity","Electric Shock","Comeback Buff","Platform Dive","Freeze One",
    "Giant vs Ant","Downforce Slam","Tomato Party","Nuclear Bounce","Double Chaos",
  ];
  return labels[roll] || "Chaos Spike";
}

function queueUpcomingChaos() {
  state.pendingChaosRoll = Math.floor(Math.random() * TOTAL_CHAOS);
  state.upcomingEventWarning = getChaosEventLabel(state.pendingChaosRoll);
}

function triggerChaosEvent(forcedRoll=null) {
  const roll = Number.isInteger(forcedRoll) ? forcedRoll : Math.floor(Math.random() * TOTAL_CHAOS);
  sfx(260+(roll%8)*45, 0.045, "square", 0.024);

  // ── Original 0-48 ────────────────────────────────────────────
  if (roll===0)  { state.reverseUntil=Math.max(state.reverseUntil,state.time+4.4); showEvent(pick(["🔄 Your brain has left the server. Controls reversed.","🔄 Who designed this chaos? Your fingers are confused."]),3.1); return; }
  if (roll===1)  { state.lowGravityUntil=Math.max(state.lowGravityUntil,state.time+5.5); showEvent(pick(["🌙 Welcome to the moon. Physics class LIED.","🌙 Gravity said 'nah fam, I'm out.'"]),2.8); return; }
  if (roll===2)  { const g=(Math.random()<.5?-1:1)*(260+Math.random()*240); for(const p of players)p.vx+=g; showEvent("💨 THE WIND SAID MOVE. You have no choice.",1.7); return; }
  if (roll===3)  { state.sizeSwapUntil=Math.max(state.sizeSwapUntil,state.time+6.2); showEvent("↔️ Everyone got their sizes mixed up. Chaos is the result.",3.2); return; }
  if (roll===4)  { state.stickyUntil=Math.max(state.stickyUntil,state.time+5); showEvent("🍯 The platform is STICKY. Oil spill but make it worse.",3); return; }
  if (roll===5)  { state.turboUntil=Math.max(state.turboUntil,state.time+5); showEvent("⚡ TURBO ACTIVATED. Your legs forgot how to obey gravity.",2.3); return; }
  if (roll===6)  { state.showerUntil=Math.max(state.showerUntil,state.time+3.6); showEvent("☄️ INCOMING SPACE ROCKS. This is not a drill.",2.3); return; }
  if (roll===7)  { state.discoUntil=Math.max(state.discoUntil,state.time+5.4); showEvent("🪩 DISCO MODE ACTIVATED. Everything is RUBBER NOW.",2.3); return; }
  if (roll===8)  { for(const p of players){p.vy=-650;addParticles(p.x,p.y,p.color,15,350);sfx(520,.1,"sine",.04);} showEvent("🚀 YEEEEET MODE. Equal opportunity catapult.",2); return; }
  if (roll===9)  { platform.angVel=(Math.random()<.5?-1:1)*2.5; showEvent("🌀 The platform has a seizure. Hold tight.",2.2); return; }
  if (roll===10) { for(const p of players){p.x=Math.random()*width;p.y=Math.random()*height*.4;addParticles(p.x,p.y,p.color,20,400);sfx(800,.08,"square",.03);} showEvent("🌀 ZIP ZAPPED TO RANDOM LOCATIONS. Surprise!!",1.8); return; }
  if (roll===11) { for(const p of players)p.vy=Math.abs(p.vy)*-.8; showEvent("⬆️ Gravity said NOPE. You going up NOW.",1.9); return; }
  if (roll===12) { for(const p of players){p.vx*=1.8;p.vy*=1.5;} showEvent("💨 SPEED BOOST. Accidentally. You're welcome.",2); return; }
  if (roll===13) { state.chaosTimer+=2; for(const p of players){p.vx=0;p.vy=0;} scheduleEffect(()=>{for(const p of players){p.vx+=(Math.random()-.5)*600;p.vy-=400;}},800); showEvent("🧊 FROZEN IN TIME... then released like a spring.",2.1); return; }
  if (roll===14) { for(const p of players){const a=Math.random()*Math.PI*2,sp=350+Math.random()*250;p.vx=Math.cos(a)*sp;p.vy=Math.sin(a)*sp;addParticles(p.x,p.y,p.color,12,280);} showEvent("🎲 Random direction speedrun any%. GO.",1.8); return; }
  if (roll===15) { state.stickyUntil=Math.max(state.stickyUntil,state.time+4.5); showEvent("🛢️ OIL SPILL. Enjoy your new skating experience.",2.2); return; }
  if (roll===16) { state.showerUntil=Math.max(state.showerUntil,state.time+4); hazardSpawnTimer=.15; showEvent("⛈️ HAZARD APOCALYPSE INCOMING. RUN FOR YOUR LIVES.",2.4); return; }
  if (roll===17) { for(const p of players)addParticles(p.x,p.y,"#fff",10,200); state.shrinkUntil=Math.max(state.shrinkUntil,state.time+3.5); showEvent("🔫 MINI RAY INCOMING. You're going small, kiddo.",2); return; }
  if (roll===18) { for(const p of players)addParticles(p.x,p.y,"#fff",10,200); state.growUntil=Math.max(state.growUntil,state.time+3.5); showEvent("🎈 MEGA GROWTH. You're now the threat.",2); return; }
  if (roll===19) { const tx=players[0].x,ty=players[0].y; players[0].x=players[1].x;players[0].y=players[1].y;players[1].x=tx;players[1].y=ty; addParticles(players[0].x,players[0].y,players[0].color,15,300); addParticles(players[1].x,players[1].y,players[1].color,15,300); showEvent("🔀 POSITIONS SWAPPED. Absolute confusion achieved.",2.1); return; }
  if (roll===20) { const v=Math.random()<.5?0:1; state.controlFlipUntil[v]=Math.max(state.controlFlipUntil[v],state.time+4); showEvent(`🕹️ ${players[v].label}'s controls just got SCRAMBLED. Adapt or die.`,2.2); return; }
  if (roll===21) { for(const p of players)p.spinVel=(Math.random()<.5?-1:1)*8; showEvent("💫 SPIN SPIN SPIN SPIN SPIN SPIN",2); return; }
  if (roll===22) { for(const p of players){const dx=width*.5-p.x,dy=height*.5-p.y,d=Math.sqrt(dx*dx+dy*dy)+1;p.vx+=(dx/d)*600;p.vy+=(dy/d)*600;} showEvent("🕳️ Black hole says come here. NOW.",2.1); return; }
  if (roll===23) { state.slowMotionUntil=Math.max(state.slowMotionUntil||0,state.time+3.2); showEvent("⏱️ Time slows... like Monday mornings.",2); return; }
  if (roll===24) { state.showerUntil=Math.max(state.showerUntil,state.time+4.5); for(let i=0;i<8;i++)scheduleEffect(()=>spawnHazard("bomb"),i*300); showEvent("💣 TRACKING BOMBS! They know where you live.",2.3); return; }
  if (roll===25) { for(const p of players){p.vy=Math.abs(p.vy)*-1.2;p.spinVel=(Math.random()<.5?-1:1)*6;} showEvent("🌪️ Anti-gravity spin. Throw up mode: ON.",2.1); return; }
  if (roll===26) { for(const p of players){p.vx=0;p.vy=0;} scheduleEffect(()=>{for(const p of players){const a=Math.random()*Math.PI*2;p.vx=Math.cos(a)*700;p.vy=Math.sin(a)*700;addParticles(p.x,p.y,p.color,20,400);sfx(600,.1,"sine",.05);}},600); showEvent("🚀 ROCKET BOOST! Countdown: oh it already fired.",2); return; }
  if (roll===27) { const l=Math.random()<.5?0:1; showEvent(`🍀 ${players[l].label} got lucky bounce vibes. Or did they?`,2); return; }
  if (roll===28) { platform.angVel=(Math.random()<.5?-1:1)*4; scheduleEffect(()=>{platform.angVel=0;},2500); showEvent("🌀 Platform having an actual breakdown.",2.2); return; }
  if (roll===29) { state.lowGravityUntil=Math.max(state.lowGravityUntil,state.time+4); state.showerUntil=Math.max(state.showerUntil,state.time+4); hazardSpawnTimer=.2; showEvent("🌌 Gravity well + hazards. So kind of them.",2.4); return; }
  if (roll===30) { state.tripleJumpUntil=Math.max(state.tripleJumpUntil,state.time+5); showEvent("🐦 Triple jump! You're basically flying rn.",2.1); return; }
  if (roll===31) { state.discoUntil=Math.max(state.discoUntil,state.time+6); showEvent("🌈 RAINBOW MADNESS!! Eyes not ok.",2.2); return; }
  if (roll===32) { state.platformShortUntil=Math.max(state.platformShortUntil,state.time+4); syncPlatformLength(); showEvent("📏 Platform shrinking! Less room to skill issue.",2.1); return; }
  if (roll===33) { state.platformLongUntil=Math.max(state.platformLongUntil,state.time+4); syncPlatformLength(); showEvent("📏 Platform expanding. More runway to fall from.",2.1); return; }
  if (roll===34) { state.stickyUntil=Math.max(state.stickyUntil,state.time+3.5); state.slowMotionUntil=Math.max(state.slowMotionUntil,state.time+3.5); showEvent("🍯 Sticky slow-mo. Actively suffering.",2.2); return; }
  if (roll===35) { for(let i=0;i<12;i++)scheduleEffect(()=>spawnHazard("meteor"),i*150); showEvent("☄️ METEOR SHOWER! The sky said skill issue.",2.4); return; }
  if (roll===36) { for(const p of players){const d=Math.atan2(platform.pivot.y-p.y,platform.pivot.x-p.x);p.vx+=Math.cos(d)*800;p.vy+=Math.sin(d)*600;addParticles(p.x,p.y,p.color,25,450);} showEvent("💥 SUPERNOVA WIND! You are aerodynamic now.",2.1); return; }
  if (roll===37) { platform.angle*=-1; scheduleEffect(()=>{platform.angle*=-1;},3500); showEvent("🔃 Platform flipped! Your life is also flipped.",2); return; }
  if (roll===38) { for(let i=0;i<10;i++)scheduleEffect(()=>spawnHazard(Math.random()<.5?"spring":"star"),i*120); showEvent("💥 BOUNCE STORM! Uncontrolled chaos incoming.",2.2); return; }
  if (roll===39) { for(let i=0;i<8;i++)scheduleEffect(()=>spawnHazard("crate"),i*150); showEvent("📦 CRATE DROP! Imported. From pain.",2.1); return; }
  if (roll===40) { for(let i=0;i<3;i++)scheduleEffect(()=>{for(const p of players){p.vy-=320;p.vx+=(Math.random()-.5)*380;}addShake(5);},i*360); showEvent("💥 Triple shockwave! The platform has vibrato.",2.3); return; }
  if (roll===41) { state.showerUntil=Math.max(state.showerUntil,state.time+5.2); hazardSpawnTimer=.12; showEvent("⛈️ SKYFALL OVERLOAD! Too much. Way too much.",2.2); return; }
  if (roll===42) { for(const p of players){const dx=platform.pivot.x-p.x,dy=platform.pivot.y-p.y,d=Math.hypot(dx,dy)||1;p.vx+=(dx/d)*900;p.vy+=(dy/d)*800;} addShake(7); showEvent("🎯 CENTER SLAM! Magnets are not your friends.",2.1); return; }
  if (roll===43) { state.controlFlipUntil[0]=Math.max(state.controlFlipUntil[0],state.time+3.2); state.controlFlipUntil[1]=Math.max(state.controlFlipUntil[1],state.time+3.2); showEvent("🪞 Mirror drift. Opposite day for both of you.",2.2); return; }
  if (roll===44) { const cols=12; for(let i=0;i<cols;i++){scheduleEffect(()=>{const tp=i%3===0?"meteor":i%2===0?"rock":"bomb";const h={type:tp,x:(i+.5)*(width/cols),y:-40,vx:0,vy:80,radius:16,life:12,color:"#444",spin:0};if(tp==="meteor"){h.radius=20;h.color="#ff6b35";h.vy=250;}if(tp==="rock"){h.radius=17;h.color="#8b7355";h.vy=190;}if(tp==="bomb"){h.radius=16;h.color="#222";h.vy=170;}hazards.push(h);},i*70);} showEvent("🎯 HAZARD CURTAIN! Tactical suffering deployment.",2.3); return; }
  if (roll===45) { state.platformTinyUntil=Math.max(state.platformTinyUntil,state.time+3.6); syncPlatformLength(); state.turboUntil=Math.max(state.turboUntil,state.time+4.6); showEvent("🔥 TINY TURBO BEAM. Pure evil energy.",2.3); return; }
  if (roll===46) { for(let i=0;i<4;i++){scheduleEffect(()=>{for(const p of players){p.x=width*(.18+Math.random()*.64);p.y=height*(.12+Math.random()*.34);p.vx*=.4;p.vy*=.4;addParticles(p.x,p.y,p.color,14,300);}addShake(4);},i*240);} showEvent("⚡ BLINK STORM! Are you even real rn?",2.2); return; }
  if (roll===47) { for(let i=0;i<6;i++){scheduleEffect(()=>{const dx=players[1].x-players[0].x,dy=players[1].y-players[0].y,d=Math.hypot(dx,dy)||1,pull=320;players[0].vx+=(dx/d)*pull;players[0].vy+=(dy/d)*pull*.8;players[1].vx-=(dx/d)*pull;players[1].vy-=(dy/d)*pull*.8;},i*180);} showEvent("🧲 MAGNET DUEL! Attraction issues detected.",2.3); return; }
  if (roll===48) { addShake(2.5); for(const p of players)addParticles(p.x,p.y,"#fff",9,140); showEvent("💀 False alarm. You panicked for literally nothing.",1.7); return; }

  // ── NEW 49-68 ─────────────────────────────────────────────────
  if (roll===49) {
    state.earthquakeUntil = Math.max(state.earthquakeUntil, state.time+4);
    platform.angVel += (Math.random()-.5)*3;
    showEvent("🌍 EARTHQUAKE!! Hold on to something. ANYTHING.", 2.3); return;
  }
  if (roll===50) {
    state.gravityFlipUntil = Math.max(state.gravityFlipUntil, state.time+2.5);
    for(const p of players)p.vy=-Math.abs(p.vy)-300;
    showEvent("⬆️ GRAVITY FLIPPED! Everything is wrong. Run.", 2.2); return;
  }
  if (roll===51) {
    state.conveyorUntil = Math.max(state.conveyorUntil, state.time+4.5);
    state.conveyorDir = Math.random()<.5 ? 1 : -1;
    showEvent(`${state.conveyorDir>0?"➡️":"⬅️"} CONVEYOR BELT! You're going ${state.conveyorDir>0?"right":"left"} like it or not.`, 2.4); return;
  }
  if (roll===52) {
    state.ghostPlatformUntil = Math.max(state.ghostPlatformUntil, state.time+3);
    showEvent("👻 GHOST PLATFORM! You can't see the beam. Trust issues.", 2.4); return;
  }
  if (roll===53) {
    state.iceFloorUntil = Math.max(state.iceFloorUntil, state.time+5);
    showEvent("🧊 ICE AGE! Platform is now a skating rink. Figure it out.", 2.4); return;
  }
  if (roll===54) {
    state.panicUntil = Math.max(state.panicUntil, state.time+3);
    state.panicTimer = 0;
    showEvent("😱 PANIC MODE! Random impulses every 0.3s. Good luck.", 2.2); return;
  }
  if (roll===55) {
    for(let i=0;i<14;i++) scheduleEffect(()=>spawnHazard("banana"), i*120);
    showEvent("🍌 BANANA FIESTA!! Slipping is the only option.", 2.3); return;
  }
  if (roll===56) {
    for(let i=0;i<10;i++) scheduleEffect(()=>spawnHazard("anvil"), i*160);
    showEvent("⚒️ ANVIL RAIN! Cartoon logic is real now.", 2.3); return;
  }
  if (roll===57) {
    // Size roulette: random resize every 0.4s for 3s
    for(let i=0;i<7;i++) {
      scheduleEffect(()=>{
        const roll2=Math.random();
        if(roll2<.33){state.shrinkUntil=state.time+1.2;}
        else if(roll2<.66){state.growUntil=state.time+1.2;}
        else{state.sizeSwapUntil=state.time+1.2;}
        addParticles(players[0].x,players[0].y,"#fff",6,150);
        addParticles(players[1].x,players[1].y,"#fff",6,150);
      }, i*430);
    }
    showEvent("🎰 SIZE ROULETTE! Nobody knows who they are right now.", 2.4); return;
  }
  if (roll===58) {
    state.windUntil = Math.max(state.windUntil, state.time+5);
    state.windDir = Math.random()<.5 ? 1 : -1;
    showEvent(`${state.windDir>0?"🌬️➡️":"⬅️🌬️"} WIND TUNNEL! The air has opinions.`, 2.3); return;
  }
  if (roll===59) {
    state.superGravityUntil = Math.max(state.superGravityUntil, state.time+3.5);
    showEvent("⬇️ SUPER GRAVITY! You weigh 400kg now. Platform suffers.", 2.3); return;
  }
  if (roll===60) {
    // Electric shock: rapid random velocity pulses
    for(let i=0;i<6;i++) {
      scheduleEffect(()=>{
        for(const p of players){p.vx+=(Math.random()-.5)*500;p.vy+=(Math.random()-.5)*400;}
        addShake(3);
        triggerFlash("200,220,255",.05);
      }, i*220);
    }
    showEvent("⚡ ELECTRIC SHOCK! 6 pulses of pure suffering incoming.", 2.4); return;
  }
  if (roll===61) {
    // Comeback buff: whoever's losing gets a massive boost
    const loserIdx = state.score[0]<state.score[1] ? 0 : 1;
    const loser = players[loserIdx];
    loser.vy -= 500;
    loser.vx += (Math.random()-.5)*400;
    state.turboUntil = Math.max(state.turboUntil, state.time+4);
    addParticles(loser.x,loser.y,"#ffd700",22,350);
    triggerFlash("255,240,80",.1);
    showEvent(`✨ COMEBACK BUFF! ${loser.label} gets divine assistance. NOT FAIR.`, 2.4); return;
  }
  if (roll===62) {
    // Platform dive and rise
    const origY = platform.pivot.y;
    platform.pivot.y += 120;
    scheduleEffect(()=>{ platform.pivot.y = origY; }, 2200);
    addShake(8);
    showEvent("📉 PLATFORM DIVE! Ground drops. GROUND DROPS.", 2.2); return;
  }
  if (roll===63) {
    // Freeze one player only
    const victim = Math.random()<.5 ? 0 : 1;
    players[victim].frozenUntil = state.time + 2.5;
    players[victim].stunned = 2.5;
    addParticles(players[victim].x, players[victim].y, "#4ae6ff", 18, 200);
    sfx(200,.18,"sine",.04);
    showEvent(`🧊 ${players[victim].label} is FROZEN!! Time stops for one. 😂`, 2.3); return;
  }
  if (roll===64) {
    // Giant vs ant: one huge, one tiny
    state.sizeSwapUntil = Math.max(state.sizeSwapUntil, state.time+5);
    state.growUntil = Math.max(state.growUntil, state.time+5);
    showEvent("🐘🐜 GIANT vs ANT! David and Goliath situation.", 2.5); return;
  }
  if (roll===65) {
    // Downforce slam
    for(const p of players){ p.vy += 900; }
    addShake(10);
    triggerFlash("100,100,255",.1);
    showEvent("⬇️ DOWNFORCE SLAM! The sky just sat on you.", 2); return;
  }
  if (roll===66) {
    for(let i=0;i<18;i++) scheduleEffect(()=>spawnHazard("tomato"), i*100);
    showEvent("🍅 TOMATO PARTY!! Absolute carnage. No survivors.", 2.3); return;
  }
  if (roll===67) {
    // Nuclear bounce: super high restitution for 3s
    state.discoUntil = Math.max(state.discoUntil, state.time+3);
    for(const p of players){ p.vy=-800; p.vx+=(Math.random()-.5)*600; }
    addShake(12);
    triggerFlash("255,255,150",.18);
    for(let i=0;i<4;i++) scheduleEffect(()=>addParticles(width*.5,height*.5,i%2?"#ffdd00":"#ff8800",18,380), i*200);
    showEvent("☢️ NUCLEAR BOUNCE!! EVACUATE. EVACUATE. EVACUATE.", 2.4); return;
  }
  if (roll===68) {
    // Double chaos: trigger two more events with delay
    const r1 = Math.floor(Math.random()*48);
    const r2 = Math.floor(Math.random()*48);
    scheduleEffect(()=>triggerChaosEvent(r1), 400);
    scheduleEffect(()=>triggerChaosEvent(r2), 1800);
    showEvent("🎲🎲 DOUBLE CHAOS!! Two events for the price of one. Send help.", 2.5); return;
  }

  // Default fallback
  spawnHazard(); spawnHazard(); spawnHazard();
  showEvent("⚠️ Triple hazard drop! Absolute classic.", 1.8);
}

// ═════════════════════════════════════════════════════════════════
//  GAME INIT / RESET
// ═════════════════════════════════════════════════════════════════

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  skyGradient = ctx.createLinearGradient(0,0,0,height);
  skyGradient.addColorStop(0,"#b8e8ff");
  skyGradient.addColorStop(.45,"#83cff0");
  skyGradient.addColorStop(.82,"#6bbfe0");
  skyGradient.addColorStop(1,"#4fa8cc");

  platform.pivot.x = width*.5;
  platform.pivot.y = height*.64;
  platform.baseLength = Math.min(width*.68,860);
  syncPlatformLength();

  if (!running && !roundOver) resetRoundPositions();
}

function resetRoundPositions() {
  state.effectGen += 1;
  if (state.score[0]===0 && state.score[1]===0 && state.time===0) {
    platform.angle = 0;
  } else {
    platform.angle = (Math.random()-.5)*.12;
  }
  platform.angVel = 0;
  platform.pivot.y = height*.64; // reset any platform dive
  syncPlatformLength();

  const offset = platform.length * .27;
  spawnBall(players[0], -offset);
  spawnBall(players[1], offset);

  hazards.length = 0;
  state.powerups.length = 0;
  hazardSpawnTimer = .9;
  state.powerupSpawnTimer = 10 + Math.random()*4;
  roundOver = false;
  state.countdownTimer = 3.05;
  state.upcomingEventWarning = null;
  state.warningTime = 0;
  state.pendingChaosRoll = null;
  // Reset effects
  state.shrinkUntil = 0; state.growUntil = 0; state.tripleJumpUntil = 0;
  state.controlFlipUntil[0] = 0; state.controlFlipUntil[1] = 0;
  state.platformShortUntil = 0; state.platformLongUntil = 0; state.platformTinyUntil = 0;
  state.hitCommentCd = 0; state.flashTimer = 0;
  state.lastCountdownTick = 0; state.lastWarningTick = 0;
  // New effects
  state.earthquakeUntil = 0; state.gravityFlipUntil = 0;
  state.conveyorUntil = 0; state.ghostPlatformUntil = 0;
  state.iceFloorUntil = 0; state.panicUntil = 0; state.panicTimer = 0;
  state.windUntil = 0; state.superGravityUntil = 0;
  // Player powerup states
  for(const p of players){ p.shielded=false; p.frozenUntil=0; p.boostedUntil=0; }
  pickRoundChallenge();
  updateWarningUI();
  running = false;

  // Sudden death check
  if (state.score[0]===state.winScore-1 && state.score[1]===state.winScore-1) {
    state.suddenDeath = true;
    syncPlatformLength();
    scheduleEffect(()=>{
      showEvent("💀 SUDDEN DEATH! Tiny beam. No mercy. One shot one kill. 💀",3.5);
      state.showerUntil = state.time + 99;
      hazardSpawnTimer = .25;
      sfx(80,.5,"sawtooth",.06);
      triggerFlash("255,30,30",.3);
    }, 3200);
  } else {
    state.suddenDeath = false;
  }
}

function spawnBall(ball, localX) {
  const c=Math.cos(platform.angle), s=Math.sin(platform.angle);
  const surfY=-(platform.thickness*.5+ball.radius+2);
  ball.x = platform.pivot.x+localX*c-surfY*s;
  ball.y = platform.pivot.y+localX*s+surfY*c;
  ball.vx=0; ball.vy=0; ball.grounded=false;
  ball.jumpCd=0; ball.landSfxCd=0; ball.stunned=0;
  ball.spin=0; ball.spinVel=0; ball.trail.length=0;
  ball.jumpBuffer=0; ball.coyote=0; ball.airJumps=ball.maxAirJumps;
  ball.shielded=false; ball.frozenUntil=0; ball.boostedUntil=0;
}

function resetMatch() {
  state.effectGen += 1;
  state.score[0]=0; state.score[1]=0; state.winner=null;
  state.time=0; state.chaosTimer=3.1;
  state.reverseUntil=0; state.lowGravityUntil=0;
  state.stickyUntil=0; state.turboUntil=0;
  state.discoUntil=0; state.sizeSwapUntil=0;
  state.showerUntil=0; state.slowMotionUntil=0;
  state.upcomingEventWarning=null; state.warningTime=0;
  state.chaosWarningLead=randomChaosWarningLead();
  state.pendingChaosRoll=null;
  state.streak[0]=0; state.streak[1]=0; state.roundNumber=0;
  state.shrinkUntil=0; state.growUntil=0; state.tripleJumpUntil=0;
  state.controlFlipUntil[0]=0; state.controlFlipUntil[1]=0;
  state.platformShortUntil=0; state.platformLongUntil=0; state.platformTinyUntil=0;
  state.hitCommentCd=0; state.flashTimer=0;
  state.lastCountdownTick=0; state.lastWarningTick=0;
  state.warningUiText=""; state.challengeUiText=""; state.challengeText="";
  state.earthquakeUntil=0; state.gravityFlipUntil=0;
  state.conveyorUntil=0; state.ghostPlatformUntil=0;
  state.iceFloorUntil=0; state.panicUntil=0; state.panicTimer=0;
  state.windUntil=0; state.superGravityUntil=0;
  state.suddenDeath=false;
  state.powerups.length=0; state.powerupSpawnTimer=10;
  updateWarningUI(); updateChallengeUI();
  running=false; particles.length=0;
  updateScore();
  resetRoundPositions();
}

// ═════════════════════════════════════════════════════════════════
//  CONTROLS + PHYSICS
// ═════════════════════════════════════════════════════════════════

function applyControls(ball, dt) {
  if (ball.stunned > 0 || state.time < ball.frozenUntil) return;

  const reverse  = isEffectOn(state.reverseUntil) ? -1 : 1;
  const isBoosted = state.time < ball.boostedUntil;
  const turbo    = (isEffectOn(state.turboUntil) || isBoosted) ? 1.2 : 1;
  const foeId    = ball.id===0 ? 1 : 0;
  const comeback = state.score[foeId]-state.score[ball.id]>=2 ? 1.12 : 1;
  const flipped  = isEffectOn(state.controlFlipUntil[ball.id]);
  const leftKey  = flipped ? ball.controls.right : ball.controls.left;
  const rightKey = flipped ? ball.controls.left  : ball.controls.right;

  let dir=0;
  if (keys.has(leftKey))  dir -= 1;
  if (keys.has(rightKey)) dir += 1;
  dir *= reverse;

  // Conveyor belt force
  if (isEffectOn(state.conveyorUntil)) dir += state.conveyorDir * .6;
  // Wind force
  if (isEffectOn(state.windUntil) && !ball.grounded) dir += state.windDir * .5;

  ball.vx += dir * 700 * turbo * comeback * dt;

  if (keys.has(ball.controls.jump)) ball.jumpBuffer = Math.max(ball.jumpBuffer,.12);

  const canGroundJump = ball.grounded || ball.coyote > 0;
  const canAirJump   = !canGroundJump && ball.airJumps > 0;

  if (ball.jumpBuffer>0 && (canGroundJump||canAirJump)) {
    const n = { x:Math.sin(platform.angle), y:-Math.cos(platform.angle) };
    const boost = (canAirJump ? .92 : 1) * (isBoosted ? 1.3 : 1);
    ball.vx += n.x*320*boost;
    ball.vy += n.y*320*boost;
    ball.jumpCd=0; ball.jumpBuffer=0; ball.coyote=0; ball.grounded=false;

    if (canAirJump) { ball.airJumps--; sfx(680,.06,"triangle",.028); }
    else sfx(470,.07,"square",.03);

    state.challengeStats[ball.id].jumps += 1;
    addShake(1.4);
    addParticles(ball.x,ball.y+ball.radius*.8,"#ffffff",8,160);
  }
}

function ballOnPlatformCollision(ball) {
  ball.grounded = false;
  const local = rotateToLocal(ball.x, ball.y);
  const topSurface = -(platform.thickness*.5+ball.radius);
  const inX = local.x > -platform.length*.5-ball.radius && local.x < platform.length*.5+ball.radius;

  if (inX && local.y>topSurface && local.y<topSurface+42 && ball.vy>=-300) {
    local.y = topSurface;
    const world = rotateToWorld(local.x, local.y);
    ball.x=world.x; ball.y=world.y;

    const tangent={x:Math.cos(platform.angle),y:Math.sin(platform.angle)};
    const normal={x:-Math.sin(platform.angle),y:Math.cos(platform.angle)};
    const along  = ball.vx*tangent.x+ball.vy*tangent.y;
    const into   = ball.vx*normal.x +ball.vy*normal.y;
    const impact = Math.abs(into);

    const restitution = isEffectOn(state.discoUntil) ? .18 : .06;
    ball.vx = tangent.x*along - normal.x*Math.min(0,into)*restitution;
    ball.vy = tangent.y*along - normal.y*Math.min(0,into)*restitution;

    ball.spinVel += (along/Math.max(14,ball.radius)-ball.spinVel)*.36;
    ball.grounded = true;
    if (impact>145 && ball.landSfxCd<=0) {
      sfx(180+impact*.18,.07,"sawtooth",.028);
      ball.landSfxCd=.18;
    }
  }
}

function updatePlatform(dt) {
  let torque=0;
  for(const ball of players){
    const local=rotateToLocal(ball.x,ball.y);
    if(local.x>-platform.length*.52 && local.x<platform.length*.52 && local.y<150)
      torque += local.x*.00012;
  }
  platform.angVel += torque*dt*38;
  platform.angVel += (-platform.angle*1.65)*dt;

  // Earthquake adds periodic wobble
  if (isEffectOn(state.earthquakeUntil)) {
    platform.angVel += Math.sin(state.time*14)*.04;
    addShake(3.5);
  }
  platform.angVel *= .972;
  platform.angVel = Math.max(-1.05, Math.min(1.05, platform.angVel));
  platform.angle  += platform.angVel*dt;
  platform.angle   = Math.max(-.43, Math.min(.43, platform.angle));
}

function updatePlayers(dt) {
  const gravityFlipped = isEffectOn(state.gravityFlipUntil);
  const superGrav      = isEffectOn(state.superGravityUntil);
  const gravityScale   = isEffectOn(state.lowGravityUntil) ? .58 : (superGrav ? 2.8 : 1);
  const gravDir        = gravityFlipped ? -1 : 1;

  const iceFloor       = isEffectOn(state.iceFloorUntil);
  const groundFriction = iceFloor ? .9995 : (isEffectOn(state.stickyUntil) ? .973 : .988);
  const airFriction    = isEffectOn(state.stickyUntil) ? .992 : .996;
  const g              = 980 * gravityScale * gravDir;

  const sizeSwap = isEffectOn(state.sizeSwapUntil);
  const shrink   = isEffectOn(state.shrinkUntil) ? .55 : 1;
  const grow     = isEffectOn(state.growUntil)   ? 1.45 : 1;
  players[0].radius = (sizeSwap ? 20 : players[0].baseRadius) * shrink * grow;
  players[1].radius = (sizeSwap ? 32 : players[1].baseRadius) * shrink * grow;
  const extraJumps = isEffectOn(state.tripleJumpUntil) ? 3 : 1;
  players[0].maxAirJumps = players[1].maxAirJumps = extraJumps;

  // Panic mode pulses
  if (isEffectOn(state.panicUntil)) {
    state.panicTimer -= dt;
    if (state.panicTimer <= 0) {
      for(const p of players){ p.vx+=(Math.random()-.5)*480; p.vy+=(Math.random()-.5)*280; }
      addShake(3);
      sfx(200+Math.random()*200,.04,"sawtooth",.02);
      state.panicTimer = .28;
    }
  }

  for(const p of players){
    const stats = state.challengeStats[p.id];
    p.jumpCd-=dt; p.landSfxCd-=dt; p.stunned-=dt;
    p.jumpBuffer-=dt; p.coyote-=dt;
    stats.nearMissCd-=dt; stats.danger-=dt;

    applyControls(p, dt);
    p.vy += g*dt;
    p.vx *= p.grounded ? groundFriction : airFriction;
    p.x += p.vx*dt;
    p.y += p.vy*dt;

    if(!p.grounded) stats.airTime+=dt;
    if(p.y>platform.pivot.y+120 && p.vy>90) stats.danger=Math.max(stats.danger,.85);

    ballOnPlatformCollision(p);

    if(p.grounded){
      p.coyote=.09;
      p.airJumps=p.maxAirJumps;
      if(stats.danger>.16 && stats.nearMissCd<=0){
        const clutchLines=[
          `${p.label} SAID NOT TODAY. 😤`,
          `${p.label} defied gravity AND expectations.`,
          `${p.label} survives. HOW?! HOOOOW?!`,
          `${p.label} refuses to fall off. Respect honestly.`,
          `${p.label} is on 1% HP and thriving.`,
          `${p.label} touched the void. Came back. Sent back down.`,
          `CLUTCH!!! ${p.label} saying NO to gravity.`,
          `${p.label} pulled the impossible. They're a wizard.`,
          `${p.label} said "not today satan." Not today indeed.`,
          `${p.label} speedrunning the comeback% category.`,
          `${p.label} just made their teacher proud somewhere.`,
        ];
        showEvent(pick(clutchLines),1.05);
        sfx(690,.06,"triangle",.04);
        addShake(3.2);
        addParticles(p.x,p.y+p.radius*.4,"#ffffff",10,180);
        triggerFlash("255,255,255",.07);
        stats.nearMissCd=2.1;
      }
      stats.danger=0;
    }

    if(!p.grounded) p.spinVel*=.995;
    p.spin+=p.spinVel*dt;

    if(p.x<p.radius){p.x=p.radius;p.vx*=-.52;}
    if(p.x>width-p.radius){p.x=width-p.radius;p.vx*=-.52;}

    p.trail.push({x:p.x,y:p.y,r:p.radius,a:.16});
    if(p.trail.length>7) p.trail.shift();
  }

  // Player-player collision
  const a=players[0],b=players[1];
  const dx=b.x-a.x,dy=b.y-a.y;
  const minD=a.radius+b.radius;
  const d2=dx*dx+dy*dy;
  if(d2<minD*minD){
    const d=Math.sqrt(d2)||1;
    const nx=dx/d,ny=dy/d;
    const overlap=minD-d;
    a.x-=nx*overlap*.5; a.y-=ny*overlap*.5;
    b.x+=nx*overlap*.5; b.y+=ny*overlap*.5;
    const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(rel<0){
      const restitution=isEffectOn(state.discoUntil)?1.16:.96;
      const impulse=-rel*restitution;
      a.vx-=nx*impulse; a.vy-=ny*impulse;
      b.vx+=nx*impulse; b.vy+=ny*impulse;
      a.spinVel-=impulse*.03; b.spinVel+=impulse*.03;
      if(impulse>140){
        state.challengeStats[0].bumpPower+=impulse;
        state.challengeStats[1].bumpPower+=impulse;
        addShake(Math.min(7,impulse*.015));
        addParticles((a.x+b.x)*.5,(a.y+b.y)*.5,"#d8f4ff",14,230);
        sfx(220+Math.min(250,impulse*.3),.07,"square",.03);
        triggerFlash("220,244,255",.06);
      }
    }
  }
}

function updateHazards(dt) {
  hazardSpawnTimer -= dt;
  const shower = isEffectOn(state.showerUntil) || state.suddenDeath;

  if(hazardSpawnTimer<=0){
    spawnHazard(shower&&Math.random()<.5?"bomb":"");
    hazardSpawnTimer = shower ? .15+Math.random()*.18 : .45+Math.random()*.45;
  }

  for(let i=hazards.length-1;i>=0;i--){
    const h=hazards[i];
    h.life-=dt;
    h.spin+=dt*(2+Math.abs(h.vx)*.02);
    const gravScale=isEffectOn(state.lowGravityUntil)?.58:1;
    h.vy+=890*dt*gravScale;
    h.x+=h.vx*dt; h.y+=h.vy*dt;
    if(h.x<h.radius||h.x>width-h.radius){h.vx*=-.83;h.x=Math.max(h.radius,Math.min(width-h.radius,h.x));}

    for(const p of players){
      const dx=p.x-h.x,dy=p.y-h.y;
      const d2=dx*dx+dy*dy;
      const rr=p.radius+h.radius;
      if(d2<rr*rr){
        // Shield absorbs!
        if(p.shielded){
          p.shielded=false;
          addParticles(h.x,h.y,"#4ae6ff",20,300);
          sfx(800,.12,"triangle",.05);
          showEvent(`🛡️ ${p.label}'s SHIELD blocked it! Incredible scenes.`,1.4);
          hazards.splice(i,1);
          break;
        }

        const d=Math.sqrt(d2)||1;
        const nx=dx/d,ny=dy/d;
        const kick=h.type==="anvil"?420:h.type==="banana"?340:h.type==="bomb"?560:
                   h.type==="rock"?380:h.type==="spike"?500:h.type==="ice"?300:
                   h.type==="meteor"?650:h.type==="crate"?520:h.type==="spring"?260:
                   h.type==="star"?220:270;

        p.vx+=nx*kick+h.vx*.22;
        p.vy+=ny*kick+h.vy*.2;
        p.stunned=.3;
        state.challengeStats[p.id].hazardHits+=1;

        if(h.type==="banana"){p.vx+=(Math.random()-.5)*440;}
        else if(h.type==="ice"){p.vx+=(Math.random()-.5)*500;}
        else if(h.type==="spring"){p.vy-=520;p.vx+=(Math.random()-.5)*160;}
        else if(h.type==="star"){p.vx*=1.15;p.vy-=120;}

        addShake(h.type==="bomb"?7:h.type==="meteor"?8:h.type==="crate"?7.2:4.5);
        triggerFlash(h.type==="meteor"?"255,128,64":h.type==="spike"?"234,70,255":h.type==="ice"?"120,225,255":h.type==="bomb"?"255,210,120":"255,255,255",.08);

        const pc=h.type==="meteor"?"#ff6b35":h.type==="spike"?"#d946ef":h.type==="ice"?"#00d9ff":h.type==="rock"?"#8b7355":h.type==="banana"?"#f8dc5f":h.type==="tomato"?"#f0506e":h.type==="crate"?"#9a6a3f":h.type==="spring"?"#2fcf79":h.type==="star"?"#8ff3ff":"#d9e0e8";
        addParticles(h.x,h.y,pc,18,h.type==="bomb"?420:h.type==="meteor"?500:280);

        sfx(h.type==="meteor"?80:h.type==="spike"?320:h.type==="bomb"?140:h.type==="spring"?460:210,.12,"sawtooth",.04);

        if(state.hitCommentCd<=0&&Math.random()<.32){
          const jokes=[
            `${p.label} got cooked. 💀`,`${p.label} walked straight into that.`,
            `${p.label} took that personally.`,`${p.label} launched into orbit.`,
            `RIP ${p.label}. Moment of silence.`,`${p.label} wasn't built for this.`,
            `${p.label}: "I meant to do that."`,`${p.label} has left the server.`,
            `${p.label} hit different (literally).`,`${p.label} vs physics. Physics wins.`,
            `${p.label} just got absolutely yeeted.`,`${p.label} could NOT dodge a parked car.`,
            `${p.label} speedrunning the fall%.`,`${p.label} thought they were safe. They were not.`,
            `${p.label} needs to see a doctor after that.`,`${p.label} technically flying. Downward.`,
            `${p.label} experienced PAIN. Raw suffering.`,`${p.label} = ☠️.`,
            `OUCH. ${p.label} felt that in their soul.`,`${p.label} eating canvas for breakfast.`,
            `${p.label} made a poor life choice just now.`,`${p.label} is having NO fun.`,
            `This is fine. - ${p.label}`,`${p.label}'s parents are crying somewhere.`,
            `${p.label} just witnessed physics in real time.`,`${p.label} collided with destiny. Destiny won.`,
          ];
          showEvent(pick(jokes),.95);
          state.hitCommentCd=1.1;
        }
        hazards.splice(i,1);
        break;
      }
    }
    if(h.life<=0||h.y>height+120) hazards.splice(i,1);
  }
}

function updateParticles(dt) {
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.t+=dt;
    p.vy+=880*dt*.35;
    p.vx*=.986; p.vy*=.992;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.t>=p.life) particles.splice(i,1);
  }
}

function spawnHazard(forceType="") {
  const r=Math.random();
  const type=forceType||(r<.2?"anvil":r<.33?"tomato":r<.46?"banana":r<.58?"bomb":r<.67?"rock":r<.75?"spike":r<.82?"ice":r<.89?"meteor":r<.95?"crate":r<.98?"spring":"star");
  const h={type,x:Math.random()*width,y:-40,vx:(Math.random()-.5)*150,vy:Math.random()*70,radius:16,life:16,color:"#444",spin:Math.random()*Math.PI};
  if(type==="anvil") {h.radius=20;h.color="#4b4b52";h.vy+=140;}
  if(type==="tomato"){h.radius=14;h.color="#e23051";}
  if(type==="banana"){h.radius=18;h.color="#f7d637";h.vx*=1.35;}
  if(type==="bomb")  {h.radius=16;h.color="#222";h.vy+=90;}
  if(type==="rock")  {h.radius=17;h.color="#8b7355";h.vy+=120;}
  if(type==="spike") {h.radius=15;h.color="#d946ef";h.vy+=160;}
  if(type==="ice")   {h.radius=16;h.color="#00d9ff";h.vx*=1.6;}
  if(type==="meteor"){h.radius=22;h.color="#ff6b35";h.vy+=200;}
  if(type==="crate") {h.radius=19;h.color="#9a6a3f";h.vy+=170;}
  if(type==="spring"){h.radius=15;h.color="#2fcf79";h.vx*=1.3;h.vy+=110;}
  if(type==="star")  {h.radius=13;h.color="#8ff3ff";h.vx*=1.9;h.vy+=70;}
  hazards.push(h);
}

function checkRoundEnd() {
  if(roundOver||state.winner!==null) return;
  let loser=-1;
  if(players[0].y>height+90) loser=0;
  if(players[1].y>height+90) loser=1;

  if(loser>=0){
    roundOver=true; running=false;
    state.upcomingEventWarning=null; state.warningTime=0; state.pendingChaosRoll=null;
    updateWarningUI();

    const winnerId=loser===0?1:0;
    state.roundNumber+=1;
    state.streak[winnerId]+=1; state.streak[loser]=0;
    state.score[winnerId]+=1;

    // Animate score card
    const card=winnerId===0?p1Card:p2Card;
    if(card){card.classList.remove("scored");void card.offsetWidth;card.classList.add("scored");}

    updateScore();
    sfx(300+winnerId*90,.14,"triangle",.05);

    if(state.score[winnerId]>=state.winScore){
      state.winner=winnerId;
    const finisher=[
      `${players[winnerId].label} IS THE SAHUR BALL CHAMPION! 🏆`,
      `${players[winnerId].label} WINS IT! ${players[loser].label} is absolutely cooked. 💀`,
      `CERTIFIED GOAT. ${players[winnerId].label} takes the whole set!`,
      `${players[loser].label} exits the tournament. ${players[winnerId].label} SUPREMACY. 👑`,
      `${players[winnerId].label} WINS. ${players[loser].label} needs to sit down and think about their life.`,
      `${players[winnerId].label}: UNDEFEATED. UNBOTHERED. MOISTURIZED. ✨`,
      `${players[loser].label} has been eliminated. No survivors.`,
      `VICTORY ROYALE: ${players[winnerId].label}. ${players[loser].label} was NOT the impostor.`,
      `${players[winnerId].label} is THAT GUY. Story of the match.`,
      `MATCH OVER. ${players[winnerId].label} > ${players[loser].label}. Math checks out.`,
    ];
      showEvent(pick(finisher),3.5);
      triggerFlash("255,235,140",.2);
      const confettiColors=["#ff6e7d","#6ea0ff","#ffdc5e","#7fffb6","#ff9f58","#c879ff","#ffffff"];
      for(let i=0;i<8;i++) scheduleEffect(()=>addParticles(width*(.2+Math.random()*.6),height*.4,pick(confettiColors),22,340),i*160);
      sfx(660,.5,"triangle",.055);
      scheduleEffect(()=>resetMatch(),4500);
      return;
    }

    // Round-over quips
    const hype=[
      `${players[loser].label} fell off. Skill issue. 💀`,
      `${players[loser].label} L + ratio + touched the void.`,
      `${players[winnerId].label} holds the beam. ${players[loser].label} does not.`,
      `${players[loser].label} fell off faster than their grades.`,
      `${players[winnerId].label} is built different. ${players[loser].label} built wrong.`,
      `${players[loser].label}: "I meant to fall." Sure bro.`,
      `${players[loser].label} forgot the whole point is STAYING ON.`,
      `${players[loser].label} donated a point. So generous. 🫡`,
      `${players[winnerId].label} clocked out. ${players[loser].label} fell out.`,
      `${players[loser].label} hit that L pose perfectly. 🫠`,
      `${players[loser].label} just rage-quit reality.`,
      `${players[winnerId].label} = skill. ${players[loser].label} = ?`,
      `Better luck next time ${players[loser].label}. You'll need it.`,
      `${players[loser].label}: *falls* 🤸 "It's part of my strategy."`,
      `${players[winnerId].label} is what peak performance looks like.`,
      `${players[loser].label} just broke the world record for fastest off.`,
      `Certified ${players[winnerId].label} W. ${players[loser].label} L.`,
      `${players[loser].label} tried their best. It wasn't enough. 😬`,
    ];
    let msg=pick(hype);

    const didChallenge=challengeAchieved(winnerId);
    if(didChallenge){
      msg=`${players[winnerId].label}: ${state.challengeDoneText}`;
      addParticles(players[winnerId].x,players[winnerId].y,"#fff2a6",22,260);
      sfx(760,.07,"triangle",.045);
      triggerFlash("255,245,190",.1);
    } else if(state.streak[winnerId]>=2){
      msg=`${players[winnerId].label} is ON FIRE 🔥 x${state.streak[winnerId]}! ${players[loser].label} needs prayer.`;
      sfx(540,.06,"square",.04);
    } else if(state.score[winnerId]===state.winScore-1){
      msg=`${players[winnerId].label} on MATCH POINT. 🫵 ${players[loser].label} is finished.`;
    } else if(state.score[0]===state.score[1]){
      msg=`All tied ${state.score[0]}-${state.score[1]}. Getting very spicy. 🌶️`;
    }

    // Float RIP from fallen player
    addParticles(players[loser].x, players[loser].y+40, "#ff4444", 10, 120);

    showEvent(msg,1.7);
    triggerFlash("255,255,255",.07);
    scheduleEffect(()=>resetRoundPositions(),950);
  }
}

// ═════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═════════════════════════════════════════════════════════════════

function update(dt) {
  state.eventTimer-=dt; state.countdownTimer-=dt;
  state.flashTimer-=dt; state.hitCommentCd-=dt;
  clearEventIfDone();

  if(state.countdownTimer<=0&&!running&&!roundOver&&state.winner===null) running=true;

  updateWarningUI();
  playCountdownAndWarningSfx();
  if(!running||state.winner!==null) return;

  const slowMo=isEffectOn(state.slowMotionUntil)?.35:1;
  dt*=slowMo;

  state.time+=dt;
  state.chaosTimer-=dt;
  syncPlatformLength();

  if(state.pendingChaosRoll===null&&state.chaosTimer>0&&state.chaosTimer<=state.chaosWarningLead)
    queueUpcomingChaos();
  if(state.pendingChaosRoll!==null) state.warningTime=Math.max(0,state.chaosTimer);
  updateWarningUI();

  updatePlatform(dt);
  updatePlayers(dt);
  updateHazards(dt);
  updateParticles(dt);
  updatePowerups(dt);
  checkRoundEnd();

  if(state.chaosTimer<=0){
    state.upcomingEventWarning=null; state.warningTime=0;
    triggerChaosEvent(state.pendingChaosRoll);
    state.pendingChaosRoll=null;
    updateWarningUI();
    state.chaosTimer=2.4+Math.random()*2.1;
    state.chaosWarningLead=randomChaosWarningLead();
  }
}

// ═════════════════════════════════════════════════════════════════
//  RENDERING
// ═════════════════════════════════════════════════════════════════

function drawBackground() {
  ctx.clearRect(0,0,width,height);
  const disco=isEffectOn(state.discoUntil);
  const suddenDeath=state.suddenDeath;

  if(disco){
    const t=state.time;
    const dg=ctx.createLinearGradient(0,0,0,height);
    dg.addColorStop(0,`hsl(${t*40%360},80%,52%)`);
    dg.addColorStop(.5,`hsl(${(t*40+120)%360},80%,58%)`);
    dg.addColorStop(1,`hsl(${(t*40+240)%360},80%,50%)`);
    ctx.fillStyle=dg;
  } else if(suddenDeath){
    const g=ctx.createLinearGradient(0,0,0,height);
    g.addColorStop(0,"#5a1a1a");
    g.addColorStop(.4,"#4a1414");
    g.addColorStop(1,"#2a0a0a");
    ctx.fillStyle=g;
  } else {
    ctx.fillStyle=skyGradient||"#83cff0";
  }
  ctx.fillRect(0,0,width,height);

  // Sudden death pulsing effect
  if(state.suddenDeath){
    const pulse=0.15+0.08*Math.sin(state.time*3.5);
    ctx.fillStyle=`rgba(200,20,20,${pulse})`;
    ctx.fillRect(0,0,width,height);
  }

  // Sun
  if(!disco){
    const sx=width*.82,sy=height*.1;
    const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,width*.18);
    sg.addColorStop(0,"rgba(255,250,200,.55)");
    sg.addColorStop(.35,"rgba(255,240,160,.22)");
    sg.addColorStop(1,"rgba(255,220,100,0)");
    ctx.fillStyle=sg; ctx.fillRect(0,0,width,height);
    ctx.beginPath(); ctx.arc(sx,sy,width*.042,0,Math.PI*2);
    ctx.fillStyle="rgba(255,252,210,.95)"; ctx.fill();
  }

  // Atmospheric bands
  if(!disco){
    for(let i=0;i<3;i++){
      ctx.fillStyle=i%2?"rgba(255,255,255,.07)":"rgba(60,160,190,.08)";
      ctx.fillRect(0,height*(.25+i*.18),width,3);
    }
  }

  // Clouds
  for(const c of clouds){
    c.x+=(c.s/width)*.035;
    if(c.x>1.28) c.x=-0.28;
    const x=c.x*width,y=c.y*height,w=c.w*width;
    ctx.fillStyle=disco?`rgba(255,255,255,${c.op*.3})`:`rgba(255,255,255,${c.op})`;
    ctx.beginPath();
    ctx.ellipse(x,y,w*.34,22,0,0,Math.PI*2);
    ctx.ellipse(x+w*.26,y+6,w*.29,18,0,0,Math.PI*2);
    ctx.ellipse(x-w*.22,y+8,w*.25,16,0,0,Math.PI*2);
    ctx.fill();
  }

  // Hill silhouette
  if(!disco){
    ctx.fillStyle="rgba(50,120,150,.18)";
    ctx.beginPath(); ctx.moveTo(0,height*.78);
    for(let xi=0;xi<=12;xi++){
      ctx.lineTo((xi/12)*width, height*.78-Math.sin(xi*.9+1.2)*height*.06-Math.sin(xi*.4)*height*.04);
    }
    ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.fill();
  }
}

function drawPlatform() {
  const disco=isEffectOn(state.discoUntil);
  const ghost=isEffectOn(state.ghostPlatformUntil);

  ctx.save();
  if(ghost) ctx.globalAlpha=.12;

  ctx.translate(platform.pivot.x,platform.pivot.y);
  ctx.rotate(platform.angle);

  const beam=ctx.createLinearGradient(-platform.length*.5,-platform.thickness*.5,platform.length*.5,platform.thickness*.5);
  if(state.suddenDeath){
    const pulse=0.8+0.2*Math.sin(state.time*4);
    beam.addColorStop(0,`rgba(80,0,0,${pulse})`); beam.addColorStop(.5,`rgba(150,20,20,${pulse})`); beam.addColorStop(1,`rgba(80,0,0,${pulse})`);
  } else if(disco){
    beam.addColorStop(0,"#3a1a6a"); beam.addColorStop(.5,"#5a2090"); beam.addColorStop(1,"#3a1a6a");
  } else {
    beam.addColorStop(0,"#102030"); beam.addColorStop(.2,"#1c3a4e"); beam.addColorStop(.8,"#1c3a4e"); beam.addColorStop(1,"#102030");
  }
  ctx.fillStyle=beam;
  ctx.fillRect(-platform.length*.5,-platform.thickness*.5,platform.length,platform.thickness);

  ctx.fillStyle=disco?"rgba(255,255,255,.22)":"rgba(255,255,255,.14)";
  ctx.fillRect(-platform.length*.5,-platform.thickness*.5,platform.length,3);
  ctx.fillStyle="rgba(0,0,0,.22)";
  ctx.fillRect(-platform.length*.5,platform.thickness*.5-3,platform.length,3);

  ctx.strokeStyle="rgba(8,16,22,.5)"; ctx.lineWidth=1.6;
  for(let i=-3;i<=3;i++){
    const x=(i/3)*platform.length*.4;
    ctx.beginPath();
    ctx.moveTo(x,-platform.thickness*.5+2);
    ctx.lineTo(x+8,platform.thickness*.5-2);
    ctx.stroke();
  }

  // Conveyor belt animation
  if(isEffectOn(state.conveyorUntil)){
    ctx.strokeStyle=`rgba(255,220,50,${.5+.3*Math.sin(state.time*6)})`;
    ctx.lineWidth=3; ctx.setLineDash([14,10]);
    ctx.lineDashOffset=-state.time*120*state.conveyorDir;
    ctx.beginPath();
    ctx.moveTo(-platform.length*.5,0);
    ctx.lineTo(platform.length*.5,0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle="#14222e"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(0,platform.thickness*.5); ctx.lineTo(0,135); ctx.stroke();
  ctx.fillStyle="#0e1c28"; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(-3,-3,4,0,Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawPowerups() {
  for(const pu of state.powerups){
    if(pu.collected) continue;
    const pulse=.8+.2*Math.sin(pu.pulse);
    const r=14*pulse;
    const color=POWERUP_COLOR[pu.type];

    // Glow
    const grd=ctx.createRadialGradient(pu.x,pu.y,0,pu.x,pu.y,r*2.2);
    grd.addColorStop(0,color+"aa");
    grd.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(pu.x,pu.y,r*2.2,0,Math.PI*2); ctx.fill();

    // Core ring
    ctx.beginPath(); ctx.arc(pu.x,pu.y,r,0,Math.PI*2);
    ctx.fillStyle=color+"cc"; ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2.5;
    ctx.stroke();

    // Emoji
    ctx.save();
    ctx.font=`${Math.round(r*1.2)}px serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(POWERUP_EMOJI[pu.type], pu.x, pu.y+1);
    ctx.restore();

    // Life bar (tiny)
    const lifeRatio=pu.life/14;
    ctx.fillStyle="rgba(255,255,255,.25)";
    ctx.fillRect(pu.x-16,pu.y+r+5,32,3);
    ctx.fillStyle=color;
    ctx.fillRect(pu.x-16,pu.y+r+5,32*lifeRatio,3);
  }
}

function drawStarPath(c,x,y,pts,oR,iR){
  let rot=-Math.PI*.5; const step=Math.PI/pts;
  c.beginPath(); c.moveTo(x+Math.cos(rot)*oR,y+Math.sin(rot)*oR);
  for(let i=0;i<pts;i++){rot+=step;c.lineTo(x+Math.cos(rot)*iR,y+Math.sin(rot)*iR);rot+=step;c.lineTo(x+Math.cos(rot)*oR,y+Math.sin(rot)*oR);}
  c.closePath();
}

function getHazardSprite(type,radius){
  const r=Math.max(10,radius); const key=`${type}|${r}`;
  let sprite=hazardSpriteCache.get(key);
  if(sprite) return sprite;
  if(hazardSpriteCache.size>80) hazardSpriteCache.clear();
  const size=Math.max(32,Math.ceil(r*2.8));
  const sc=document.createElement("canvas"); sc.width=sc.height=size;
  const c=sc.getContext("2d"); const cx=size*.5,cy=size*.5;
  if(type==="anvil"){c.fillStyle="#4f5863";c.fillRect(cx-r*.95,cy-r*.1,r*1.9,r*.9);c.fillStyle="#6a7482";c.fillRect(cx-r*.6,cy-r*.7,r*1.2,r*.45);c.fillStyle="#3d454e";c.fillRect(cx-r*.7,cy-r*.28,r*1.4,r*.22);c.fillStyle="rgba(255,255,255,.18)";c.fillRect(cx-r*.52,cy-r*.62,r*.95,r*.14);}
  else if(type==="tomato"){c.fillStyle="#e63e57";c.beginPath();c.arc(cx,cy,r*.9,0,Math.PI*2);c.fill();c.fillStyle="#2f9b57";c.beginPath();c.moveTo(cx,cy-r*.95);c.lineTo(cx+r*.24,cy-r*.45);c.lineTo(cx-r*.1,cy-r*.5);c.lineTo(cx+r*.5,cy-r*.12);c.lineTo(cx,cy-r*.32);c.lineTo(cx-r*.5,cy-r*.12);c.lineTo(cx-r*.1,cy-r*.5);c.lineTo(cx-r*.24,cy-r*.45);c.closePath();c.fill();}
  else if(type==="banana"){c.strokeStyle="#f5d33f";c.lineWidth=r*.42;c.lineCap="round";c.beginPath();c.arc(cx-r*.15,cy+r*.1,r*.9,.2,1.6);c.stroke();c.strokeStyle="#9b7c1f";c.lineWidth=r*.1;c.beginPath();c.arc(cx-r*.12,cy+r*.1,r*.82,.28,1.52);c.stroke();}
  else if(type==="bomb"){c.fillStyle="#222";c.beginPath();c.arc(cx,cy,r*.86,0,Math.PI*2);c.fill();c.fillStyle="#3c3c3c";c.beginPath();c.arc(cx,cy-r*.8,r*.18,0,Math.PI*2);c.fill();c.strokeStyle="#c58d28";c.lineWidth=Math.max(2,r*.12);c.lineCap="round";c.beginPath();c.moveTo(cx+r*.05,cy-r*.9);c.lineTo(cx+r*.42,cy-r*1.18);c.stroke();c.fillStyle="#ff9f1c";c.beginPath();c.arc(cx+r*.44,cy-r*1.2,r*.1,0,Math.PI*2);c.fill();}
  else if(type==="rock"){c.fillStyle="#88745f";c.beginPath();c.moveTo(cx-r*.85,cy-r*.25);c.lineTo(cx-r*.3,cy-r*.9);c.lineTo(cx+r*.62,cy-r*.62);c.lineTo(cx+r*.92,cy+r*.1);c.lineTo(cx+r*.4,cy+r*.82);c.lineTo(cx-r*.62,cy+r*.62);c.closePath();c.fill();}
  else if(type==="spike"){c.fillStyle="#e54fff";c.beginPath();c.moveTo(cx,cy-r*.95);c.lineTo(cx+r*.9,cy+r*.88);c.lineTo(cx-r*.9,cy+r*.88);c.closePath();c.fill();c.fillStyle="rgba(255,255,255,.26)";c.beginPath();c.moveTo(cx,cy-r*.68);c.lineTo(cx+r*.45,cy+r*.62);c.lineTo(cx,cy+r*.42);c.closePath();c.fill();}
  else if(type==="ice"){c.fillStyle="#8eefff";c.beginPath();for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;const px=cx+Math.cos(a)*r*.92,py=cy+Math.sin(a)*r*.92;if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fill();c.strokeStyle="rgba(255,255,255,.6)";c.lineWidth=Math.max(1,r*.08);c.beginPath();c.moveTo(cx-r*.35,cy-r*.1);c.lineTo(cx+r*.42,cy-r*.34);c.moveTo(cx-r*.15,cy+r*.48);c.lineTo(cx+r*.22,cy+r*.05);c.stroke();}
  else if(type==="meteor"){const g=c.createRadialGradient(cx-r*.28,cy-r*.32,r*.2,cx,cy,r*.95);g.addColorStop(0,"#ffd47a");g.addColorStop(.6,"#ff8d42");g.addColorStop(1,"#cc4a21");c.fillStyle=g;c.beginPath();c.arc(cx,cy,r*.95,0,Math.PI*2);c.fill();}
  else if(type==="crate"){c.fillStyle="#9f6d3d";c.fillRect(cx-r*.9,cy-r*.9,r*1.8,r*1.8);c.strokeStyle="#6c4525";c.lineWidth=Math.max(2,r*.14);c.strokeRect(cx-r*.85,cy-r*.85,r*1.7,r*1.7);c.beginPath();c.moveTo(cx-r*.6,cy-r*.6);c.lineTo(cx+r*.6,cy+r*.6);c.moveTo(cx+r*.6,cy-r*.6);c.lineTo(cx-r*.6,cy+r*.6);c.stroke();}
  else if(type==="spring"){c.fillStyle="#2ac16f";c.beginPath();c.arc(cx,cy+r*.55,r*.52,0,Math.PI*2);c.fill();c.strokeStyle="#d6ffe9";c.lineWidth=Math.max(2,r*.12);c.lineCap="round";c.beginPath();c.moveTo(cx-r*.45,cy+r*.45);c.quadraticCurveTo(cx,cy-r*.75,cx+r*.45,cy+r*.45);c.stroke();}
  else if(type==="star"){c.fillStyle="#91eeff";drawStarPath(c,cx,cy,5,r*.95,r*.45);c.fill();c.fillStyle="rgba(255,255,255,.4)";drawStarPath(c,cx-r*.1,cy-r*.1,5,r*.52,r*.24);c.fill();}
  else{c.fillStyle="#d35f6f";c.beginPath();c.arc(cx,cy,r*.9,0,Math.PI*2);c.fill();}
  hazardSpriteCache.set(key,sc); return sc;
}

function drawHazards(){
  for(const h of hazards){
    if(h.x<-h.radius*2||h.x>width+h.radius*2||h.y<-h.radius*2||h.y>height+h.radius*2) continue;
    const sp=getHazardSprite(h.type,Math.round(h.radius));
    ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.spin);ctx.drawImage(sp,-sp.width*.5,-sp.height*.5);ctx.restore();
  }
}

function drawSpeedTrails(){
  for(const p of players){
    const speed=Math.hypot(p.vx,p.vy);
    if(speed<180) continue;
    const angle=Math.atan2(p.vy,p.vx),len=Math.min(56,speed*.1);
    const rgb=p.id===0?"232,40,58":"24,85,232";
    ctx.strokeStyle=`rgba(${rgb},.38)`;ctx.lineWidth=Math.max(3,p.radius*.28);ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(p.x-Math.cos(angle)*len*.2,p.y-Math.sin(angle)*len*.2);ctx.lineTo(p.x-Math.cos(angle)*len*1.3,p.y-Math.sin(angle)*len*1.3);ctx.stroke();
  }
}

function drawParticles(){
  const heavy=particles.length>420;
  for(const p of particles){
    if(p.x<-20||p.x>width+20||p.y<-20||p.y>height+20) continue;
    const lr=1-p.t/p.life,sz=p.size*lr;
    if(sz<.35) continue;
    if(!heavy){ctx.beginPath();ctx.arc(p.x,p.y,sz*1.8,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=.15*lr;ctx.fill();}
    ctx.beginPath();ctx.arc(p.x,p.y,sz,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=.8*lr;ctx.fill();
  }
  ctx.globalAlpha=1;
}

function drawFlashOverlay(){
  if(state.flashTimer<=0) return;
  ctx.fillStyle=`rgba(${state.flashColor},${Math.min(.28,state.flashTimer*2.3)})`;
  ctx.fillRect(0,0,width,height);
}

function getBallSprite(p){
  const r=Math.max(10,Math.round(p.radius));
  const key=`${p.color}|${p.number}|${r}`;
  let sprite=ballSpriteCache.get(key);
  if(sprite) return sprite;
  if(ballSpriteCache.size>32) ballSpriteCache.clear();
  const size=r*2+6;
  const sc=document.createElement("canvas"); sc.width=sc.height=size;
  const sctx=sc.getContext("2d"); const cx=size*.5,cy=size*.5;
  const grad=sctx.createRadialGradient(cx-r*.34,cy-r*.38,r*.2,cx,cy,r*1.15);
  grad.addColorStop(0,"#ffffff");grad.addColorStop(.12,"#f4f4f4");grad.addColorStop(.22,p.color);grad.addColorStop(.82,p.color);grad.addColorStop(1,"#0d1318");
  sctx.fillStyle=grad;sctx.beginPath();sctx.arc(cx,cy,r,0,Math.PI*2);sctx.fill();
  sctx.strokeStyle="rgba(255,255,255,.18)";sctx.lineWidth=Math.max(1.5,r*.08);sctx.beginPath();sctx.arc(cx,cy,r*.68,.2,Math.PI*1.8);sctx.stroke();
  sctx.fillStyle="rgba(255,255,255,.55)";sctx.beginPath();sctx.arc(cx-r*.36,cy-r*.36,r*.22,0,Math.PI*2);sctx.fill();
  sctx.fillStyle="#f4f4f4";sctx.beginPath();sctx.arc(cx,cy,r*.38,0,Math.PI*2);sctx.fill();
  sctx.fillStyle="#111";sctx.font=`bold ${Math.max(12,r*.55)}px sans-serif`;sctx.textAlign="center";sctx.textBaseline="middle";sctx.fillText(p.number,cx,cy+1);
  ballSpriteCache.set(key,sc); return sc;
}

function drawBall(p){
  const r=Math.max(10,Math.round(p.radius));
  const sprite=getBallSprite(p);

  // On-fire visual (streak >= 2)
  const onFire = state.streak[p.id] >= 2;
  if(onFire){
    const t=state.time;
    const flames=6;
    for(let i=0;i<flames;i++){
      const a=(i/flames)*Math.PI*2+t*4;
      const dist=r*.9+Math.sin(t*7+i*2)*6;
      const fx=p.x+Math.cos(a)*dist;
      const fy=p.y+Math.sin(a)*dist-r*.2;
      const fr=4+Math.sin(t*9+i)*3;
      const hue=20+Math.sin(t*5+i)*20;
      ctx.beginPath();ctx.arc(fx,fy,fr,0,Math.PI*2);
      ctx.fillStyle=`hsl(${hue},100%,60%)`;ctx.globalAlpha=.7;ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // Shield ring
  if(p.shielded){
    const pulse=.85+.15*Math.sin(state.time*8);
    ctx.beginPath();ctx.arc(p.x,p.y,r*1.35*pulse,0,Math.PI*2);
    ctx.strokeStyle=`rgba(74,230,255,${.7+.3*Math.sin(state.time*6)})`;
    ctx.lineWidth=3; ctx.stroke();
  }

  // Frozen overlay
  const frozen = state.time < p.frozenUntil;
  if(frozen){
    ctx.beginPath();ctx.arc(p.x,p.y,r*1.15,0,Math.PI*2);
    ctx.fillStyle="rgba(140,220,255,.35)"; ctx.fill();
    ctx.strokeStyle="rgba(140,220,255,.8)"; ctx.lineWidth=2; ctx.stroke();
  }

  // Grounded glow
  if(p.grounded){
    ctx.beginPath();ctx.arc(p.x,p.y,r*1.1,0,Math.PI*2);
    ctx.strokeStyle=p.color;ctx.globalAlpha=0.3;ctx.lineWidth=r*.2;ctx.stroke();
    ctx.globalAlpha=1;
  }

  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);ctx.drawImage(sprite,-sprite.width*.5,-sprite.height*.5);ctx.restore();

  // Player label
  const labelY=p.y-r-9;
  ctx.save();
  ctx.font=`900 ${Math.max(11,r*.52)}px 'Nunito', sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="bottom";
  ctx.fillStyle="rgba(0,0,0,.6)";
  ctx.fillText(p.label,p.x+1,labelY+1);
  ctx.fillStyle=p.id===0?"#ff8090":"#80aaff";
  ctx.fillText(p.label,p.x,labelY);
  ctx.restore();

  // Stun
  if(p.stunned>0){
    ctx.font=`${Math.max(14,r*.7)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("💫",p.x+Math.cos(state.time*8)*r*.8,p.y-r-22);
  }
  // Frozen indicator
  if(frozen){
    ctx.font=`${Math.max(14,r*.7)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("🧊",p.x,p.y-r-24);
  }
  // Boosted indicator
  if(state.time < p.boostedUntil){
    ctx.font=`${Math.max(12,r*.6)}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("⚡",p.x+r*.8,p.y-r);
  }
}

function drawCountdown(){
  if(state.countdownTimer<=0) return;
  const countNum=Math.ceil(state.countdownTimer);
  if(countNum>3) return;
  const frac=state.countdownTimer%1;
  const scale=1+(1-frac)*.45;
  const alpha=frac>.18?1:frac/.18;
  const colors=["#ff4455","#ff9932","#ffdd44"];
  ctx.save();
  ctx.globalAlpha=alpha;
  const fs=Math.min(180,width*.2)*scale;
  ctx.font=`900 ${fs}px 'Bebas Neue', sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  // Text outline effect instead of shadow
  ctx.strokeStyle="rgba(0,0,0,.5)";
  ctx.lineWidth=6;
  ctx.strokeText(countNum,width*.5,height*.42);
  ctx.fillStyle=colors[countNum-1];
  ctx.fillText(countNum,width*.5,height*.42);
  if(state.suddenDeath) ctx.fillText("☠️",width*.5,height*.56);
  ctx.restore();
}

function drawWinnerText(){
  if(state.winner===null) return;
  const w=players[state.winner];

  ctx.fillStyle="rgba(2,8,18,.84)";ctx.fillRect(0,0,width,height);

  const trophySize=Math.min(90,width*.11);
  ctx.font=`${trophySize}px serif`;ctx.textAlign="center";
  ctx.fillText("🏆",width*.5,height*.31);

  ctx.save();
  const ns=Math.min(78,width*.1);
  ctx.font=`900 ${ns}px 'Bebas Neue','Nunito',sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  // Outline effect
  ctx.strokeStyle="rgba(0,0,0,.8)";
  ctx.lineWidth=8;
  ctx.strokeText(`${w.label} WINS!`,width*.5,height*.46);
  ctx.fillStyle=w.id===0?"#ff6e7d":"#6ea0ff";
  ctx.fillText(`${w.label} WINS!`,width*.5,height*.46);
  ctx.restore();

  ctx.save();
  ctx.font=`bold ${Math.min(26,width*.036)}px 'Nunito',sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="rgba(255,255,255,.55)";
  ctx.fillText(`Final: ${state.score[0]} – ${state.score[1]}`,width*.5,height*.56);
  ctx.restore();

  const pulse=.7+.3*Math.sin(state.time*4);
  ctx.save();ctx.globalAlpha=pulse;
  ctx.font=`bold ${Math.min(19,width*.028)}px 'Nunito',sans-serif`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="#fff";
  const rematchHint = isMobile ? "Tap anywhere to REMATCH 👊" : "Press any key · Tap to REMATCH 👊";
  ctx.fillText(rematchHint,width*.5,height*.65);
  ctx.restore();
}

function render(){
  const shakeNow=camera.shake;
  if(shakeNow>0){
    const sx=(Math.random()-.5)*shakeNow, sy=(Math.random()-.5)*shakeNow;
    ctx.save();ctx.translate(sx,sy);
  }

  drawBackground();
  drawPlatform();
  drawPowerups();
  drawHazards();
  drawSpeedTrails();
  drawParticles();
  drawBall(players[0]);
  drawBall(players[1]);
  drawFlashOverlay();
  drawCountdown();
  drawWinnerText();

  if(shakeNow>0){
    ctx.restore();
    camera.shake*=.85;
    if(camera.shake<.2) camera.shake=0;
  }
}

function loop(ts){
  const dt=Math.min(.02,(ts-lastTime)/1000||1/120);
  lastTime=ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ═════════════════════════════════════════════════════════════════
//  INPUT
// ═════════════════════════════════════════════════════════════════

window.addEventListener("keydown",(e)=>{
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if(!audioUnlocked){audioUnlocked=true;ensureAudio();}
  if(e.code===players[0].controls.jump) players[0].jumpBuffer=.12;
  if(e.code===players[1].controls.jump) players[1].jumpBuffer=.12;
  if(state.winner!==null){state.effectGen++;resetMatch();}
});

window.addEventListener("keyup",(e)=>keys.delete(e.code));

window.addEventListener("touchstart",(e)=>{
  if(!audioUnlocked){audioUnlocked=true;ensureAudio();}
  const target=e.target;
  if(target&&target.classList.contains("tbtn")) return;
  if(state.winner!==null){e.preventDefault();state.effectGen++;resetMatch();}
},{passive:false});

// ── Touch Controls ────────────────────────────────────────────────
function setupTouch(){
  const map=[
    ["p1-left", players[0].controls.left],
    ["p1-right",players[0].controls.right],
    ["p1-jump", players[0].controls.jump],
    ["p2-left", players[1].controls.left],
    ["p2-right",players[1].controls.right],
    ["p2-jump", players[1].controls.jump],
  ];
  for(const [id,code] of map){
    const el=document.getElementById(id);
    if(!el) continue;
    const press=()=>{
      keys.add(code);
      if(code===players[0].controls.jump) players[0].jumpBuffer=.14;
      if(code===players[1].controls.jump) players[1].jumpBuffer=.14;
      if(!audioUnlocked){audioUnlocked=true;ensureAudio();}
      el.classList.add("held");
    };
    const release=()=>{keys.delete(code);el.classList.remove("held");};
    el.addEventListener("touchstart",(e)=>{e.preventDefault();press();},{passive:false});
    el.addEventListener("touchend",  (e)=>{e.preventDefault();release();},{passive:false});
    el.addEventListener("touchcancel",(e)=>{e.preventDefault();release();},{passive:false});
    el.addEventListener("mousedown",press);
    el.addEventListener("mouseup",release);
    el.addEventListener("mouseleave",release);
  }
}

// ── Boot ─────────────────────────────────────────────────────────
window.addEventListener("resize",resize);
resize();
setupTouch();
resetMatch();
requestAnimationFrame((t)=>{lastTime=t;requestAnimationFrame(loop);});
