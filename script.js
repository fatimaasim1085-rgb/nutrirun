/* ═══════════════════════════════════════════════════════
   NUTRIRUN — Main Game Script
   ── All game logic, auth, canvas, questions, leaderboard
   ── Pure vanilla JS, no dependencies
═══════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════
   1. CONSTANTS & CONFIG
══════════════════════════════════════════════════════ */
const CONFIG = {
  LIVES: 3,
  Q_TIME: 15,           // seconds per question
  BASE_SPEED: 4,        // canvas px per frame
  MAX_SPEED: 11,
  SPEED_INC: 0.0008,    // speed increment per frame
  OBSTACLE_MIN_GAP: 160,// min px between obstacles
  POWERUP_CHANCE: 0.003,// probability per frame of spawning a power-up
  SCORE_PER_CORRECT: 100,
  SCORE_PER_METER: 1,
  BOOST_DURATION: 300,  // frames
  DOUBLE_DURATION: 600,
  EASY_THRESHOLD:   800,  // distance to switch difficulty
  HARD_THRESHOLD:  2000,
  CANVAS_H: 0,          // set at init
  GROUND_Y: 0,          // set at init
  JUMP_FORCE: -14,
  GRAVITY: 0.6,
};

/* ══════════════════════════════════════════════════════
   2. STATE
══════════════════════════════════════════════════════ */
let QUESTIONS = [];    // loaded from questions.json

const AUTH = {
  currentUser: null,
  get users() { return JSON.parse(localStorage.getItem('nr_users') || '{}'); },
  save(users) { localStorage.setItem('nr_users', JSON.stringify(users)); },
};

const GAME = {
  running: false,
  paused: false,
  animId: null,
  score: 0,
  distance: 0,
  lives: 3,
  streak: 0,
  bestStreak: 0,
  totalQ: 0,
  correctQ: 0,
  speed: CONFIG.BASE_SPEED,
  difficulty: 'EASY',
  boostActive: false,
  boostTimer: 0,
  doubleActive: false,
  doubleTimer: 0,
  shieldCount: 0,
  boostCount: 0,
  doubleCount: 0,
  questionActive: false,
  tutorialShown: false,
  // canvas entities
  player: null,
  obstacles: [],
  powerups: [],
  particles: [],
  bgLayers: [],
  groundOffset: 0,
  frameCount: 0,
  usedQIds: new Set(),
};

/* ══════════════════════════════════════════════════════
   3. BOOT — load questions then init
══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await fetch('questions.json');
    QUESTIONS = await r.json();
  } catch {
    // Fallback inline questions if fetch fails (e.g. file:// protocol)
    QUESTIONS = getFallbackQuestions();
  }

  initStars();
  initPreviewCanvas();
  restoreSession();
  updateTotalPlayers();
  seedDemoLeaderboard();
});

/* ══════════════════════════════════════════════════════
   4. SCREEN MANAGEMENT
══════════════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  // Per-screen setup
  if (id === 'screen-leaderboard') renderLeaderboard();
  if (id === 'screen-dashboard')   renderDashboard();
}

function goHome() {
  if (GAME.running) stopGame();
  showScreen('screen-landing');
}

function showAuth(tab = 'login') {
  showScreen('screen-auth');
  switchAuthTab(tab);
}

function showGameScreen() {
  showScreen('screen-game');
  initGameCanvas();
  // Show tutorial the first time per session
  const tut = document.getElementById('tutorialOverlay');
  if (!GAME.tutorialShown) {
    tut.style.display = 'flex';
  } else {
    tut.style.display = 'none';
    beginGame();
  }
}

/* ══════════════════════════════════════════════════════
   5. STARS (landing background)
══════════════════════════════════════════════════════ */
function initStars() {
  const container = document.getElementById('starsContainer');
  if (!container) return;
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
      width:${sz}px; height:${sz}px;
      top:${Math.random()*100}%;
      left:${Math.random()*100}%;
      --dur:${(Math.random()*4+2).toFixed(1)}s;
      --delay:-${(Math.random()*6).toFixed(1)}s;
    `;
    container.appendChild(s);
  }
}

/* ══════════════════════════════════════════════════════
   6. PREVIEW CANVAS (landing screen demo animation)
══════════════════════════════════════════════════════ */
let previewRaf = null;
function initPreviewCanvas() {
  const canvas = document.getElementById('previewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width, H = canvas.height;
  const groundY = H - 24;
  let offset = 0;
  const FOOD_EMOJIS = ['🥦', '🍎', '🥕', '🥛', '🫀', '💊', '🧬', '🍋'];
  const obstacles = [
    { x: W + 60, emoji: FOOD_EMOJIS[0] },
    { x: W + 300, emoji: FOOD_EMOJIS[1] },
    { x: W + 540, emoji: FOOD_EMOJIS[3] },
  ];
  let playerY = groundY - 28;
  let vy = 0;
  let jumpTimer = 90;

  function drawPreview() {
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0a20');
    bg.addColorStop(1, '#14142a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = '#39ff7a44';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

    // Ground dots
    for (let x = -(offset % 40); x < W; x += 40) {
      ctx.fillStyle = '#39ff7a22';
      ctx.fillRect(x, groundY + 4, 20, 2);
    }

    // Player (simple green rect + glow)
    ctx.save();
    ctx.shadowColor = '#39ff7a';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#39ff7a';
    ctx.fillRect(60, playerY - 28, 22, 28);
    // visor
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(68, playerY - 24, 10, 8);
    ctx.restore();

    // Obstacles
    obstacles.forEach(o => {
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.emoji, o.x, groundY - 4);
      // Question tag
      ctx.fillStyle = 'rgba(157,59,255,.85)';
      roundRect(ctx, o.x - 30, groundY - 48, 60, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Exo 2, sans-serif';
      ctx.fillText('❓ Quiz', o.x, groundY - 35);
    });

    // Score display
    ctx.textAlign = 'left';
    ctx.fillStyle = '#39ff7a';
    ctx.font = 'bold 14px Space Mono, monospace';
    ctx.shadowColor = '#39ff7a'; ctx.shadowBlur = 8;
    ctx.fillText('SCORE: ' + Math.floor(offset * 0.5), 14, 22);
    ctx.shadowBlur = 0;

    // "PREVIEW" watermark
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.font = 'bold 36px Exo 2, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PREVIEW', W / 2, H / 2 + 14);

    // Update
    offset += 3;
    obstacles.forEach(o => {
      o.x -= 3;
      if (o.x < -40) {
        o.x = W + 60 + Math.random() * 200;
        o.emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
      }
    });

    // Auto-jump
    jumpTimer--;
    if (jumpTimer <= 0) { vy = -10; jumpTimer = 80 + Math.random() * 40; }
    vy += 0.6;
    playerY += vy;
    if (playerY >= groundY - 28) { playerY = groundY - 28; vy = 0; }

    previewRaf = requestAnimationFrame(drawPreview);
  }
  drawPreview();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ══════════════════════════════════════════════════════
   7. AUTH
══════════════════════════════════════════════════════ */
function switchAuthTab(tab) {
  const loginEl    = document.getElementById('form-login');
  const signupEl   = document.getElementById('form-signup');
  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  const slider     = document.getElementById('tabSlider');

  if (tab === 'login') {
    loginEl.classList.remove('hidden');
    signupEl.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    if (slider) slider.style.transform = 'translateX(0)';
  } else {
    loginEl.classList.add('hidden');
    signupEl.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    if (slider) slider.style.transform = 'translateX(100%)';
  }
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  if (!username || !password) { errEl.textContent = '⚠ Please fill all fields.'; return; }

  const users = AUTH.users;
  if (!users[username]) { errEl.textContent = '⚠ Username not found.'; return; }
  if (users[username].password !== btoa(password)) { errEl.textContent = '⚠ Incorrect password.'; return; }

  AUTH.currentUser = username;
  localStorage.setItem('nr_session', username);
  postLogin(users[username].name || username);
}

function handleSignup() {
  const name     = document.getElementById('signup-name').value.trim();
  const username = document.getElementById('signup-username').value.trim().toLowerCase().replace(/\s+/g, '_');
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');

  if (!name || !username || !password) { errEl.textContent = '⚠ Please fill all fields.'; return; }
  if (username.length < 3)             { errEl.textContent = '⚠ Username must be ≥ 3 characters.'; return; }
  if (password.length < 4)             { errEl.textContent = '⚠ Password must be ≥ 4 characters.'; return; }

  const users = AUTH.users;
  if (users[username]) { errEl.textContent = '⚠ Username already taken.'; return; }

  users[username] = {
    name, username, password: btoa(password),
    createdAt: Date.now(),
    runs: [], bestScore: 0, totalDist: 0, totalQ: 0,
    correctQ: 0, bestStreak: 0,
  };
  AUTH.save(users);
  AUTH.currentUser = username;
  localStorage.setItem('nr_session', username);
  updateTotalPlayers();
  postLogin(name);
}

function postLogin(displayName) {
  showToast(`👋 Welcome, ${displayName}!`);
  updateNavForLoggedIn();
  showGameScreen();
}

function handleLogout() {
  AUTH.currentUser = null;
  localStorage.removeItem('nr_session');
  updateNavForLoggedIn();
  showToast('👋 Logged out.');
  showScreen('screen-landing');
}

function playAsGuest() {
  AUTH.currentUser = null;
  localStorage.removeItem('nr_session');
  updateNavForLoggedIn();
  showGameScreen();
}

function restoreSession() {
  const saved = localStorage.getItem('nr_session');
  if (saved && AUTH.users[saved]) {
    AUTH.currentUser = saved;
    updateNavForLoggedIn();
  }
}

function updateNavForLoggedIn() {
  const dashBtn = document.getElementById('navDashBtn');
  if (dashBtn) dashBtn.style.display = AUTH.currentUser ? 'block' : 'none';
}

function updateTotalPlayers() {
  const el = document.getElementById('totalPlayersCount');
  if (el) el.textContent = Object.keys(AUTH.users).length;
}

/* ══════════════════════════════════════════════════════
   8. GAME CANVAS INIT
══════════════════════════════════════════════════════ */
const CANVAS = { el: null, ctx: null };

function initGameCanvas() {
  CANVAS.el  = document.getElementById('gameCanvas');
  CANVAS.ctx = CANVAS.el.getContext('2d');
  resizeCanvas();
  window.removeEventListener('resize', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);

  // Input
  window.removeEventListener('keydown', onKey);
  window.addEventListener('keydown', onKey);
  CANVAS.el.removeEventListener('click', onCanvasClick);
  CANVAS.el.addEventListener('click', onCanvasClick);
  CANVAS.el.removeEventListener('touchstart', onCanvasTouch);
  CANVAS.el.addEventListener('touchstart', onCanvasTouch, { passive: true });
}

function resizeCanvas() {
  if (!CANVAS.el) return;
  CANVAS.el.width  = window.innerWidth;
  CANVAS.el.height = window.innerHeight;
  CONFIG.CANVAS_H  = CANVAS.el.height;
  CONFIG.GROUND_Y  = Math.floor(CANVAS.el.height * 0.72);
}

function onKey(e) {
  if ((e.code === 'Space' || e.code === 'ArrowUp') && !GAME.questionActive) {
    e.preventDefault();
    playerJump();
  }
  if (e.code === 'Escape') togglePause();
}
function onCanvasClick()  { if (!GAME.questionActive) playerJump(); }
function onCanvasTouch(e) { if (!GAME.questionActive) { e.preventDefault(); playerJump(); } }

/* ══════════════════════════════════════════════════════
   9. GAME START / STOP / RESET
══════════════════════════════════════════════════════ */
function startGame() {
  document.getElementById('tutorialOverlay').style.display = 'none';
  GAME.tutorialShown = true;
  beginGame();
}

function beginGame() {
  resetGameState();
  buildBackgroundLayers();
  GAME.player = createPlayer();
  GAME.running = true;
  GAME.paused  = false;
  cancelAnimationFrame(GAME.animId);
  GAME.animId = requestAnimationFrame(gameLoop);
}

function resetGameState() {
  GAME.score         = 0;
  GAME.distance      = 0;
  GAME.lives         = CONFIG.LIVES;
  GAME.streak        = 0;
  GAME.bestStreak    = 0;
  GAME.totalQ        = 0;
  GAME.correctQ      = 0;
  GAME.speed         = CONFIG.BASE_SPEED;
  GAME.difficulty    = 'EASY';
  GAME.boostActive   = false;
  GAME.boostTimer    = 0;
  GAME.doubleActive  = false;
  GAME.doubleTimer   = 0;
  GAME.shieldCount   = 0;
  GAME.boostCount    = 0;
  GAME.doubleCount   = 0;
  GAME.questionActive= false;
  GAME.obstacles     = [];
  GAME.powerups      = [];
  GAME.particles     = [];
  GAME.frameCount    = 0;
  GAME.groundOffset  = 0;
  GAME.usedQIds      = new Set();
  updateHUD();
  updatePowerupUI();
  document.getElementById('questionModal').classList.add('hidden');
  document.getElementById('pauseOverlay').classList.add('hidden');
}

function stopGame() {
  GAME.running = false;
  cancelAnimationFrame(GAME.animId);
}

function retryGame() {
  showScreen('screen-game');
  beginGame();
}

/* ══════════════════════════════════════════════════════
   10. GAME LOOP
══════════════════════════════════════════════════════ */
function gameLoop() {
  if (!GAME.running) return;
  if (GAME.paused) { GAME.animId = requestAnimationFrame(gameLoop); return; }

  GAME.frameCount++;
  const ctx = CANVAS.ctx;
  const W = CANVAS.el.width, H = CANVAS.el.height;

  // ── Update ──
  updateSpeed();
  updatePlayer();
  updateObstacles(W);
  updatePowerupItems(W);
  updateParticles();
  updatePowerupTimers();
  updateDifficulty();

  GAME.distance += GAME.speed * 0.04;
  GAME.score    += CONFIG.SCORE_PER_METER * (GAME.doubleActive ? 2 : 1) * 0.04;
  GAME.groundOffset = (GAME.groundOffset + GAME.speed) % 80;

  // ── Draw ──
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, W, H);
  drawGround(ctx, W);
  drawPowerupItems(ctx);
  drawObstacles(ctx);
  drawPlayer(ctx);
  drawParticles(ctx);

  // ── HUD update (throttled) ──
  if (GAME.frameCount % 4 === 0) updateHUD();

  GAME.animId = requestAnimationFrame(gameLoop);
}

/* ══════════════════════════════════════════════════════
   11. BACKGROUND LAYERS (parallax)
══════════════════════════════════════════════════════ */
const LAYER_COLORS = [
  { fill: '#0a0a16', speed: 0 },
  { fill: null,      speed: 0.2, stars: true },
  { fill: '#0f1028', speed: 0.4, hills: true, hillColor: '#1a1a35' },
  { fill: null,      speed: 0.7, hills: true, hillColor: '#14142a' },
];

function buildBackgroundLayers() {
  GAME.bgLayers = LAYER_COLORS.map(l => ({ ...l, offset: 0 }));
}

function drawBackground(ctx, W, H) {
  const gY = CONFIG.GROUND_Y;

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, gY);
  sky.addColorStop(0, '#05050e');
  sky.addColorStop(1, '#0f0f28');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gY);

  // Grid lines (futuristic floor grid vanishing into distance)
  ctx.save();
  ctx.strokeStyle = 'rgba(80,80,200,0.07)';
  ctx.lineWidth = 1;
  for (let x = -(GAME.groundOffset % 80); x < W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, gY - 60); ctx.lineTo(x + 80, gY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 80, gY - 60); ctx.lineTo(x, gY); ctx.stroke();
  }
  ctx.restore();

  // Stars in sky
  if (GAME.frameCount < 10) buildStarCache(W, gY);
  drawStarCache(ctx);

  // Floating food emojis in background (slow parallax)
  drawBgFood(ctx, W, gY);
}

// Star cache for performance
let _starCache = null;
function buildStarCache(W, H) {
  _starCache = [];
  for (let i = 0; i < 60; i++) {
    _starCache.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.9,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.6 + 0.2,
    });
  }
}
function drawStarCache(ctx) {
  if (!_starCache) return;
  _starCache.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,200,255,${s.a})`;
    ctx.fill();
  });
}

// Floating BG food
const BG_FOODS = [
  { emoji:'🥦', x:800,  y:80, speed:0.5 },
  { emoji:'🍎', x:300,  y:120, speed:0.3 },
  { emoji:'💊', x:1100, y:60,  speed:0.7 },
  { emoji:'🧬', x:600,  y:100, speed:0.4 },
  { emoji:'🥕', x:1400, y:90,  speed:0.6 },
];
let bgFoodInit = false;
function drawBgFood(ctx, W, H) {
  if (!bgFoodInit) {
    BG_FOODS.forEach(f => { f.x = Math.random() * W; f.y = 40 + Math.random() * (H * 0.7); });
    bgFoodInit = true;
  }
  BG_FOODS.forEach(f => {
    f.x -= f.speed * (GAME.boostActive ? 0.3 : 1);
    if (f.x < -40) f.x = W + 40;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.emoji, f.x, f.y);
    ctx.restore();
  });
}

/* ══════════════════════════════════════════════════════
   12. GROUND
══════════════════════════════════════════════════════ */
function drawGround(ctx, W) {
  const gY = CONFIG.GROUND_Y;
  const H  = CONFIG.CANVAS_H;

  // Ground fill
  const gGrad = ctx.createLinearGradient(0, gY, 0, H);
  gGrad.addColorStop(0, '#1a1a3a');
  gGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, gY, W, H - gY);

  // Glowing top edge
  ctx.save();
  ctx.shadowColor = '#39ff7a';
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = '#39ff7a55';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke();
  ctx.restore();

  // Moving dashes
  ctx.fillStyle = '#39ff7a1a';
  for (let x = -(GAME.groundOffset % 80); x < W; x += 80) {
    ctx.fillRect(x, gY + 6, 40, 3);
  }
}

/* ══════════════════════════════════════════════════════
   13. PLAYER
══════════════════════════════════════════════════════ */
function createPlayer() {
  return {
    x: 100,
    y: CONFIG.GROUND_Y - 52,
    w: 28, h: 48,
    vy: 0,
    onGround: true,
    jumpCount: 0,
    stunTimer: 0,
    runFrame: 0,
    runTick: 0,
  };
}

function playerJump() {
  if (!GAME.running || GAME.paused || GAME.questionActive) return;
  const p = GAME.player;
  if (p.onGround || p.jumpCount < 2) {
    p.vy = CONFIG.JUMP_FORCE;
    p.onGround = false;
    p.jumpCount++;
    spawnParticles(p.x + p.w / 2, CONFIG.GROUND_Y, '#39ff7a', 6, 'jump');
  }
}

function updatePlayer() {
  const p = GAME.player;
  const gY = CONFIG.GROUND_Y;

  // Gravity
  p.vy += CONFIG.GRAVITY;
  p.y  += p.vy;

  // Land
  if (p.y >= gY - p.h) {
    p.y = gY - p.h;
    p.vy = 0;
    p.onGround = true;
    p.jumpCount = 0;
  }

  // Stun timer
  if (p.stunTimer > 0) p.stunTimer--;

  // Run animation
  p.runTick++;
  if (p.runTick % 8 === 0) p.runFrame = (p.runFrame + 1) % 4;
}

function drawPlayer(ctx) {
  const p = GAME.player;
  const stunned = p.stunTimer > 0;
  const boosted = GAME.boostActive;

  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);

  // Stun shake
  if (stunned && p.stunTimer % 4 < 2) ctx.translate(3, 0);

  // Body glow
  ctx.shadowColor = boosted ? '#ffe600' : (stunned ? '#ff3333' : '#39ff7a');
  ctx.shadowBlur  = boosted ? 24 : 14;

  // Body
  ctx.fillStyle = stunned ? '#ff6666' : (boosted ? '#ffe600' : '#39ff7a');
  roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 6);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#00e5ff';
  ctx.shadowBlur = 6;
  roundRect(ctx, -p.w / 2 + 6, -p.h / 2 + 6, p.w - 10, 10, 3);
  ctx.fill();

  // Legs (animated)
  const legSwing = Math.sin(p.runFrame * Math.PI / 2) * 4;
  ctx.fillStyle = boosted ? '#cc9900' : '#2aaa55';
  ctx.shadowBlur = 0;
  // left leg
  ctx.fillRect(-9, p.h / 2 - 8, 7, 10 + legSwing);
  // right leg
  ctx.fillRect(2,  p.h / 2 - 8, 7, 10 - legSwing);

  // Shield bubble
  if (GAME.shieldCount > 0) {
    ctx.strokeStyle = '#00e5ff88';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(0, 0, p.w * 1.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ══════════════════════════════════════════════════════
   14. OBSTACLES
══════════════════════════════════════════════════════ */
const OBSTACLE_EMOJIS = {
  EASY:   ['🥦', '🥕', '🍎', '🧅', '🫑'],
  MEDIUM: ['💊', '🧬', '🫀', '🩺', '⚗️'],
  HARD:   ['☣️', '🔬', '🧪', '💉', '🫁'],
};

function updateObstacles(W) {
  if (GAME.questionActive) return;

  const spd = GAME.boostActive ? GAME.speed * 0.45 : GAME.speed;

  // Move existing
  GAME.obstacles.forEach(o => { o.x -= spd; o.angle += 0.03; });

  // Remove off-screen
  GAME.obstacles = GAME.obstacles.filter(o => o.x > -80);

  // Spawn new
  const last = GAME.obstacles[GAME.obstacles.length - 1];
  const minGap = CONFIG.OBSTACLE_MIN_GAP + (CONFIG.OBSTACLE_MIN_GAP / GAME.speed) * 10;
  if (!last || last.x < W - minGap) {
    if (Math.random() < 0.015) spawnObstacle(W);
  }

  // Collision
  const p = GAME.player;
  GAME.obstacles.forEach(o => {
    if (o.hit) return;
    if (
      p.x + p.w - 8 > o.x - o.r &&
      p.x + 8        < o.x + o.r &&
      p.y + p.h - 6  > o.y - o.r &&
      p.y + 6         < o.y + o.r
    ) {
      o.hit = true;
      handleObstacleCollision(o);
    }
  });

  // Remove hit obstacles after delay
  GAME.obstacles = GAME.obstacles.filter(o => !o.hit);
}

function spawnObstacle(W) {
  const diff = GAME.difficulty;
  const emojis = OBSTACLE_EMOJIS[diff];
  const emoji  = emojis[Math.floor(Math.random() * emojis.length)];

  // Vary height: ground level OR mid-air
  const gY = CONFIG.GROUND_Y;
  const onGround = Math.random() > 0.35;
  const y = onGround ? gY - 30 : gY - 80 - Math.random() * 60;

  GAME.obstacles.push({ x: W + 60, y, r: 28, emoji, angle: 0, hit: false, diff });
}

function handleObstacleCollision(obstacle) {
  // Shield absorbs one hit
  if (GAME.shieldCount > 0) {
    GAME.shieldCount--;
    updatePowerupUI();
    spawnParticles(obstacle.x, obstacle.y, '#00e5ff', 12, 'shield');
    showToast('🛡️ Shield absorbed the hit!');
    return;
  }
  // Show question
  showQuestion(obstacle.diff || GAME.difficulty);
}

function drawObstacles(ctx) {
  GAME.obstacles.forEach(o => {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle);

    // Glow ring
    const ringColor = o.diff === 'HARD' ? '#ff2d78' : o.diff === 'MEDIUM' ? '#ff8c00' : '#9d3bff';
    ctx.shadowColor = ringColor;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = ringColor + '99';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(0, 0, o.r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Emoji
    ctx.shadowBlur = 0;
    ctx.font = '36px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.emoji, 0, 0);

    // "?" badge
    ctx.fillStyle = ringColor;
    ctx.shadowColor = ringColor; ctx.shadowBlur = 10;
    ctx.font = 'bold 12px Exo 2, sans-serif';
    ctx.fillText('❓', 0, -o.r - 10);

    ctx.restore();
  });
}

/* ══════════════════════════════════════════════════════
   15. POWER-UP ITEMS (collectible on the track)
══════════════════════════════════════════════════════ */
const PU_TYPES = [
  { type: 'boost',  emoji: '⚡', color: '#ffe600', label: 'BOOST' },
  { type: 'shield', emoji: '🛡️', color: '#00e5ff', label: 'SHIELD' },
  { type: 'double', emoji: '2×', color: '#ff2d78', label: '2×' },
];

function updatePowerupItems(W) {
  const spd = GAME.boostActive ? GAME.speed * 0.45 : GAME.speed;
  GAME.powerups.forEach(p => { p.x -= spd; p.bob += 0.1; });

  // Spawn
  if (Math.random() < CONFIG.POWERUP_CHANCE && GAME.powerups.length < 3) {
    const t   = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
    const gY  = CONFIG.GROUND_Y;
    GAME.powerups.push({
      x: W + 30,
      y: gY - 60 - Math.random() * 80,
      r: 20,
      bob: 0,
      collected: false,
      ...t,
    });
  }

  // Collision
  const pl = GAME.player;
  GAME.powerups.forEach(pu => {
    if (pu.collected) return;
    const dx = (pl.x + pl.w / 2) - pu.x;
    const dy = (pl.y + pl.h / 2) - pu.y;
    if (Math.sqrt(dx * dx + dy * dy) < pu.r + 20) {
      pu.collected = true;
      collectPowerup(pu);
    }
  });

  GAME.powerups = GAME.powerups.filter(p => !p.collected && p.x > -60);
}

function collectPowerup(pu) {
  if (pu.type === 'boost')  GAME.boostCount++;
  if (pu.type === 'shield') GAME.shieldCount++;
  if (pu.type === 'double') GAME.doubleCount++;
  updatePowerupUI();
  spawnParticles(pu.x, pu.y, pu.color, 14, 'collect');
  showToast(`${pu.emoji} ${pu.label} collected!`);
}

function drawPowerupItems(ctx) {
  GAME.powerups.forEach(pu => {
    const bobY = Math.sin(pu.bob) * 6;
    ctx.save();
    ctx.translate(pu.x, pu.y + bobY);

    ctx.shadowColor = pu.color;
    ctx.shadowBlur  = 20;
    ctx.strokeStyle = pu.color + 'cc';
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, pu.r, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = pu.color + '22';
    ctx.fill();

    ctx.font = pu.type === 'double' ? 'bold 13px Exo 2, sans-serif' : '22px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = pu.color;
    ctx.shadowBlur   = 0;
    ctx.fillText(pu.type === 'double' ? '2×' : pu.emoji, 0, 0);

    ctx.restore();
  });
}

/* ══════════════════════════════════════════════════════
   16. PARTICLES
══════════════════════════════════════════════════════ */
function spawnParticles(x, y, color, count, kind) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const spd   = 2 + Math.random() * 4;
    GAME.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - (kind === 'jump' ? 2 : 0),
      r: 3 + Math.random() * 4,
      color,
      life: 1,
      decay: 0.025 + Math.random() * 0.03,
    });
  }
}

function updateParticles() {
  GAME.particles.forEach(p => {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.15;
    p.life -= p.decay;
    p.r    *= 0.97;
  });
  GAME.particles = GAME.particles.filter(p => p.life > 0);
}

function drawParticles(ctx) {
  GAME.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/* ══════════════════════════════════════════════════════
   17. SPEED & DIFFICULTY
══════════════════════════════════════════════════════ */
function updateSpeed() {
  if (GAME.boostActive) return; // freeze speed ramp during boost
  if (GAME.speed < CONFIG.MAX_SPEED) GAME.speed += CONFIG.SPEED_INC;
}

function updateDifficulty() {
  const d = GAME.distance;
  let newDiff = 'EASY';
  if (d >= CONFIG.HARD_THRESHOLD)  newDiff = 'HARD';
  else if (d >= CONFIG.EASY_THRESHOLD) newDiff = 'MEDIUM';

  if (newDiff !== GAME.difficulty) {
    GAME.difficulty = newDiff;
    const badge = document.getElementById('diffBadge');
    const labels = { EASY: '🌱 Easy', MEDIUM: '🔥 Medium', HARD: '☠️ Hard' };
    if (badge) badge.textContent = labels[newDiff];
  }
}

/* ══════════════════════════════════════════════════════
   18. POWER-UP TIMERS (active boosts)
══════════════════════════════════════════════════════ */
function updatePowerupTimers() {
  if (GAME.boostActive) {
    GAME.boostTimer--;
    if (GAME.boostTimer <= 0) {
      GAME.boostActive = false;
      GAME.speed = Math.min(GAME.speed, CONFIG.MAX_SPEED);
    }
  }
  if (GAME.doubleActive) {
    GAME.doubleTimer--;
    if (GAME.doubleTimer <= 0) GAME.doubleActive = false;
  }
}

function usePowerup(type) {
  if (!GAME.running || GAME.paused) return;
  if (type === 'boost' && GAME.boostCount > 0) {
    GAME.boostCount--;
    GAME.boostActive = true;
    GAME.boostTimer  = CONFIG.BOOST_DURATION;
    GAME.speed       = Math.max(GAME.speed * 0.45, 2);
    showToast('⚡ Metabolism Boost — Slow motion!');
  }
  if (type === 'shield' && GAME.shieldCount > 0) {
    // Shield is passive (absorbs one collision) — just notify
    showToast('🛡️ Shield is already active!');
    return;
  }
  if (type === 'double' && GAME.doubleCount > 0) {
    GAME.doubleCount--;
    GAME.doubleActive = true;
    GAME.doubleTimer  = CONFIG.DOUBLE_DURATION;
    showToast('2× Double Points active!');
  }
  updatePowerupUI();
}

function updatePowerupUI() {
  const slots = { boost: GAME.boostCount, shield: GAME.shieldCount, double: GAME.doubleCount };
  Object.entries(slots).forEach(([key, count]) => {
    const slot = document.getElementById(`pu-${key}`);
    const cnt  = document.getElementById(`cnt-${key}`);
    if (!slot) return;
    slot.classList.toggle('has-item', count > 0);
    slot.classList.toggle('empty',    count === 0);
    slot.classList.toggle('active',   key === 'boost' && GAME.boostActive || key === 'double' && GAME.doubleActive);
    if (cnt) cnt.textContent = count;
  });
}

/* ══════════════════════════════════════════════════════
   19. HUD UPDATE
══════════════════════════════════════════════════════ */
function updateHUD() {
  const scoreEl = document.getElementById('scoreDisplay');
  const distEl  = document.getElementById('distanceDisplay');
  const strkEl  = document.getElementById('streakDisplay');
  const livesEl = document.getElementById('livesDisplay');

  if (scoreEl) scoreEl.textContent = Math.floor(GAME.score);
  if (distEl)  distEl.textContent  = Math.floor(GAME.distance) + ' m';
  if (strkEl)  strkEl.textContent  = '🔥 ×' + GAME.streak;

  if (livesEl) {
    const hearts = livesEl.querySelectorAll('.heart');
    hearts.forEach((h, i) => {
      h.classList.toggle('lost', i >= GAME.lives);
    });
  }
}

/* ══════════════════════════════════════════════════════
   20. QUESTION SYSTEM
══════════════════════════════════════════════════════ */
let questionTimer = null;
let qTimerFrame   = 0;
let currentQ      = null;

function showQuestion(difficulty) {
  GAME.questionActive = true;
  GAME.paused         = true; // freeze game while question shows

  // Pick a random unseen question of matching difficulty
  const pool = QUESTIONS.filter(q =>
    q.difficulty === difficulty && !GAME.usedQIds.has(q.id)
  );
  // Fallback: any unseen question
  const fallback = QUESTIONS.filter(q => !GAME.usedQIds.has(q.id));
  const available = pool.length > 0 ? pool : fallback.length > 0 ? fallback : QUESTIONS;
  currentQ = available[Math.floor(Math.random() * available.length)];
  if (currentQ) GAME.usedQIds.add(currentQ.id);

  // Reset IDs if all used
  if (GAME.usedQIds.size >= QUESTIONS.length) GAME.usedQIds.clear();

  // Populate modal
  const modal  = document.getElementById('questionModal');
  const diffEl = document.getElementById('qDiffTag');
  const textEl = document.getElementById('qText');
  const optsEl = document.getElementById('qOptions');
  const fbEl   = document.getElementById('qFeedback');

  diffEl.textContent  = currentQ.difficulty;
  diffEl.className    = `q-diff-tag ${currentQ.difficulty}`;
  textEl.textContent  = currentQ.question;
  fbEl.className      = 'q-feedback hidden';
  fbEl.textContent    = '';

  optsEl.innerHTML = '';
  currentQ.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'q-opt';
    btn.textContent = opt;
    btn.onclick = () => handleAnswer(idx);
    optsEl.appendChild(btn);
  });

  modal.classList.remove('hidden');
  GAME.totalQ++;
  startQuestionTimer();
}

function startQuestionTimer() {
  clearInterval(questionTimer);
  qTimerFrame = CONFIG.Q_TIME;
  updateTimerDisplay(qTimerFrame);

  questionTimer = setInterval(() => {
    qTimerFrame--;
    updateTimerDisplay(qTimerFrame);
    if (qTimerFrame <= 0) {
      clearInterval(questionTimer);
      handleAnswer(-1); // time out = wrong
    }
  }, 1000);
}

function updateTimerDisplay(t) {
  const numEl    = document.getElementById('timerNum');
  const circleEl = document.getElementById('timerCircle');
  if (!numEl || !circleEl) return;
  numEl.textContent = t;

  const circumference = 100.5;
  const ratio = t / CONFIG.Q_TIME;
  circleEl.style.strokeDashoffset = circumference * (1 - ratio);
  circleEl.style.stroke = ratio > 0.5 ? '#39ff7a' : ratio > 0.25 ? '#ff8c00' : '#ff3333';
  if (numEl) numEl.style.color = circleEl.style.stroke;
}

function handleAnswer(idx) {
  clearInterval(questionTimer);
  if (!currentQ) return;

  const correct  = idx === currentQ.correct;
  const optsEl   = document.getElementById('qOptions');
  const fbEl     = document.getElementById('qFeedback');
  const buttons  = optsEl.querySelectorAll('.q-opt');

  // Disable all buttons
  buttons.forEach(b => { b.disabled = true; });

  // Highlight correct / wrong
  buttons.forEach((b, i) => {
    if (i === currentQ.correct) b.classList.add('correct');
    else if (i === idx)          b.classList.add('wrong');
  });

  if (correct) {
    GAME.correctQ++;
    GAME.streak++;
    if (GAME.streak > GAME.bestStreak) GAME.bestStreak = GAME.streak;
    const streakBonus = Math.min(GAME.streak - 1, 5) * 20;
    const earnedPts   = (CONFIG.SCORE_PER_CORRECT + streakBonus) * (GAME.doubleActive ? 2 : 1);
    GAME.score += earnedPts;

    fbEl.textContent  = `✅ Correct! +${Math.floor(earnedPts)} pts  ${GAME.streak > 1 ? '🔥 ×'+GAME.streak+' streak!' : ''}\n${currentQ.explanation}`;
    fbEl.className    = 'q-feedback correct-fb';
    showScorePop('+' + Math.floor(earnedPts), '#39ff7a');
    spawnParticles(window.innerWidth / 2, window.innerHeight / 2, '#39ff7a', 20, 'correct');

  } else {
    GAME.streak = 0;
    loseLife();

    const msg = idx === -1 ? '⏰ Time\'s up!' : '❌ Wrong!';
    fbEl.textContent = `${msg}  Correct: ${currentQ.options[currentQ.correct]}\n${currentQ.explanation}`;
    fbEl.className   = 'q-feedback wrong-fb';
  }

  fbEl.classList.remove('hidden');

  // Close question after delay
  setTimeout(closeQuestion, correct ? 1800 : 2600);
}

function closeQuestion() {
  const modal = document.getElementById('questionModal');
  modal.classList.add('hidden');
  GAME.questionActive = false;
  GAME.paused         = false;
  currentQ            = null;
}

/* ══════════════════════════════════════════════════════
   21. LIFE MANAGEMENT
══════════════════════════════════════════════════════ */
function loseLife() {
  GAME.lives--;
  GAME.player.stunTimer = 50;
  spawnParticles(GAME.player.x + 14, GAME.player.y + 24, '#ff3333', 16, 'hit');
  if (GAME.lives <= 0) {
    // Trigger game over after feedback is shown
    setTimeout(triggerGameOver, 2800);
  }
}

/* ══════════════════════════════════════════════════════
   22. GAME OVER
══════════════════════════════════════════════════════ */
function triggerGameOver() {
  stopGame();
  saveRunData();
  showGameOverScreen();
}

function saveRunData() {
  const run = {
    score:    Math.floor(GAME.score),
    distance: Math.floor(GAME.distance),
    streak:   GAME.bestStreak,
    accuracy: GAME.totalQ > 0 ? Math.round((GAME.correctQ / GAME.totalQ) * 100) : 0,
    date:     Date.now(),
  };

  // Save to user profile
  if (AUTH.currentUser) {
    const users = AUTH.users;
    const user  = users[AUTH.currentUser];
    if (user) {
      user.runs       = [run, ...(user.runs || [])].slice(0, 20);
      user.bestScore  = Math.max(user.bestScore || 0, run.score);
      user.totalDist  = (user.totalDist  || 0) + run.distance;
      user.totalQ     = (user.totalQ     || 0) + GAME.totalQ;
      user.correctQ   = (user.correctQ   || 0) + GAME.correctQ;
      user.bestStreak = Math.max(user.bestStreak || 0, run.streak);
      AUTH.save(users);
    }
  }

  // Save to leaderboard
  const lb = JSON.parse(localStorage.getItem('nr_leaderboard') || '[]');
  lb.push({
    username:    AUTH.currentUser || 'Guest',
    name:        AUTH.currentUser ? (AUTH.users[AUTH.currentUser]?.name || AUTH.currentUser) : 'Guest',
    score:       run.score,
    distance:    run.distance,
    accuracy:    run.accuracy,
    date:        run.date,
  });
  lb.sort((a, b) => b.score - a.score);
  localStorage.setItem('nr_leaderboard', JSON.stringify(lb.slice(0, 100)));
}

function showGameOverScreen() {
  const score    = Math.floor(GAME.score);
  const distance = Math.floor(GAME.distance);
  const accuracy = GAME.totalQ > 0 ? Math.round((GAME.correctQ / GAME.totalQ) * 100) : 0;
  const rank     = getRank(score);

  document.getElementById('goScore').textContent    = score.toLocaleString();
  document.getElementById('goDistance').textContent = distance + 'm';
  document.getElementById('goStreak').textContent   = '×' + GAME.bestStreak;
  document.getElementById('goAccuracy').textContent = accuracy + '%';
  document.getElementById('goTitle').textContent    = score > 500 ? 'Well Done!' : 'Game Over!';
  document.getElementById('goEmoji').textContent    = score > 1000 ? '🏆' : score > 500 ? '⭐' : '💀';
  document.getElementById('goRank').textContent     = rank.title;

  // Check personal best
  const prevBest = AUTH.currentUser ? (AUTH.users[AUTH.currentUser]?.runs?.slice(1) || []) : [];
  const wasBest  = prevBest.length === 0 || score >= (AUTH.users[AUTH.currentUser]?.runs?.[1]?.score || 0);
  document.getElementById('goNewBest').classList.toggle('hidden', !wasBest || score === 0);

  // Particles
  spawnGameOverParticles();
  showScreen('screen-gameover');
}

function spawnGameOverParticles() {
  const container = document.getElementById('goParticles');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#39ff7a', '#9d3bff', '#ff2d78', '#00e5ff', '#ffe600'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'go-particle';
    const sz = 6 + Math.random() * 14;
    el.style.cssText = `
      width:${sz}px; height:${sz}px;
      background:${colors[i % colors.length]};
      left:${Math.random()*100}%;
      bottom:${Math.random()*30}%;
      --dur:${(Math.random()*3+2).toFixed(1)}s;
      --delay:-${(Math.random()*4).toFixed(1)}s;
    `;
    container.appendChild(el);
  }
}

/* ══════════════════════════════════════════════════════
   23. RANK SYSTEM
══════════════════════════════════════════════════════ */
const RANKS = [
  { min: 5000, title: '🧬 Dietician Supreme',   level: 10 },
  { min: 3000, title: '🩺 Clinical Nutritionist', level: 8 },
  { min: 2000, title: '🔬 Biochemistry Expert',  level: 7 },
  { min: 1500, title: '💊 Diet Therapist',       level: 6 },
  { min: 1000, title: '🥗 Nutrition Specialist', level: 5 },
  { min: 700,  title: '🍎 Health Educator',      level: 4 },
  { min: 400,  title: '🥦 Dietetics Student',    level: 3 },
  { min: 200,  title: '🌱 Nutrition Learner',    level: 2 },
  { min: 0,    title: '🏃 Nutrition Novice',     level: 1 },
];

function getRank(score) {
  return RANKS.find(r => score >= r.min) || RANKS[RANKS.length - 1];
}

/* ══════════════════════════════════════════════════════
   24. PAUSE
══════════════════════════════════════════════════════ */
function togglePause() {
  if (!GAME.running) return;
  GAME.paused = !GAME.paused;
  const overlay = document.getElementById('pauseOverlay');
  overlay.classList.toggle('hidden', !GAME.paused);
}

/* ══════════════════════════════════════════════════════
   25. LEADERBOARD
══════════════════════════════════════════════════════ */
let lbTab = 'alltime';

function showLBTab(tab) {
  lbTab = tab;
  document.getElementById('lbt-alltime').classList.toggle('active', tab === 'alltime');
  document.getElementById('lbt-today').classList.toggle('active',   tab === 'today');
  renderLeaderboard();
}

function renderLeaderboard() {
  const list = JSON.parse(localStorage.getItem('nr_leaderboard') || '[]');
  const now  = Date.now();
  const dayMs = 86400000;

  let filtered = list;
  if (lbTab === 'today') {
    filtered = list.filter(e => now - e.date < dayMs);
  }

  // Deduplicate: keep best per username
  const seen = {};
  filtered = filtered.filter(e => {
    if (seen[e.username]) return false;
    seen[e.username] = true; return true;
  });

  const container = document.getElementById('leaderboardList');
  const mySection = document.getElementById('myRankSection');

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<div class="lb-empty">🏃 No runs yet — be the first!</div>';
    if (mySection) mySection.style.display = 'none';
    return;
  }

  filtered.slice(0, 20).forEach((entry, idx) => {
    const row = document.createElement('div');
    const isMe = AUTH.currentUser && entry.username === AUTH.currentUser;
    row.className = `lb-entry${isMe ? ' me' : ''}`;

    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
    const rank  = getRank(entry.score);

    row.innerHTML = `
      <span class="lb-col rank">
        ${medal ? `<span class="rank-medal">${medal}</span>` : `<span class="rank-num">#${idx+1}</span>`}
      </span>
      <span class="lb-col player">
        <div class="player-cell">
          <span class="player-avatar">🏃</span>
          <div>
            <div class="player-name">${esc(entry.name)} ${isMe ? '(you)' : ''}</div>
            <div class="player-rank-tag">${rank.title}</div>
          </div>
        </div>
      </span>
      <span class="lb-col score">${entry.score.toLocaleString()}</span>
      <span class="lb-col dist">${entry.distance}m</span>
      <span class="lb-col acc">${entry.accuracy}%</span>
    `;
    container.appendChild(row);
  });

  // My rank section
  if (AUTH.currentUser && mySection) {
    const myIdx = filtered.findIndex(e => e.username === AUTH.currentUser);
    if (myIdx >= 0) {
      mySection.style.display = 'block';
      mySection.textContent   = `Your rank: #${myIdx + 1} of ${filtered.length} players`;
    } else {
      mySection.style.display = 'none';
    }
  }
}

function seedDemoLeaderboard() {
  const lb = JSON.parse(localStorage.getItem('nr_leaderboard') || '[]');
  if (lb.length >= 5) return; // already has data

  const demoNames = [
    { username:'dr_nutri',  name:'Dr. Nutri',      score:4820, dist:2800, acc:92 },
    { username:'vitamins',  name:'VitaminVault',    score:3500, dist:2100, acc:88 },
    { username:'biochem',   name:'BioChem Raj',     score:2750, dist:1800, acc:80 },
    { username:'diet_guru', name:'Diet Guru',       score:1900, dist:1300, acc:75 },
    { username:'runner99',  name:'Runner99',         score:980,  dist:700,  acc:60 },
  ];

  const now = Date.now();
  demoNames.forEach(d => {
    lb.push({ ...d, distance: d.dist, accuracy: d.acc, date: now - Math.random() * 86400000 * 5 });
  });
  lb.sort((a, b) => b.score - a.score);
  localStorage.setItem('nr_leaderboard', JSON.stringify(lb.slice(0, 100)));
}

/* ══════════════════════════════════════════════════════
   26. DASHBOARD
══════════════════════════════════════════════════════ */
const ALL_BADGES = [
  { id:'first_run',   icon:'🏃', name:'First Run',      desc:'Complete your first run',        check: u => (u.runs||[]).length >= 1 },
  { id:'streak5',     icon:'🔥', name:'On Fire!',        desc:'Get a 5× answer streak',          check: u => (u.bestStreak||0) >= 5 },
  { id:'score1k',     icon:'⭐', name:'1K Club',         desc:'Score 1,000+ points',             check: u => (u.bestScore||0) >= 1000 },
  { id:'score3k',     icon:'🏆', name:'3K Legend',       desc:'Score 3,000+ points',             check: u => (u.bestScore||0) >= 3000 },
  { id:'marathon',    icon:'📏', name:'Marathon',        desc:'Run 1000m total distance',        check: u => (u.totalDist||0) >= 1000 },
  { id:'curious',     icon:'🔬', name:'Curious Mind',    desc:'Answer 20 questions',             check: u => (u.totalQ||0) >= 20 },
  { id:'accuracy',    icon:'🎯', name:'Sharp Shooter',   desc:'80%+ accuracy over 10 questions', check: u => (u.totalQ||0) >= 10 && ((u.correctQ||0)/(u.totalQ||1)) >= 0.8 },
  { id:'runs10',      icon:'🥇', name:'Dedicated',       desc:'Complete 10 runs',                check: u => (u.runs||[]).length >= 10 },
];

function renderDashboard() {
  const user = AUTH.currentUser ? AUTH.users[AUTH.currentUser] : null;

  if (!user) {
    // Guest view
    document.getElementById('dashName').textContent     = 'Guest Runner';
    document.getElementById('dashUsername').textContent = '@guest';
    document.getElementById('dashRank').textContent     = '🏃 Nutrition Novice';
    document.getElementById('dashLevel').textContent    = '?';
    document.getElementById('dsBestScore').textContent  = '-';
    document.getElementById('dsTotalRuns').textContent  = '-';
    document.getElementById('dsAccuracy').textContent   = '-';
    document.getElementById('dsBestStreak').textContent = '-';
    document.getElementById('dsTotalDist').textContent  = '-';
    document.getElementById('dsTotalQ').textContent     = '-';
    document.getElementById('badgesGrid').innerHTML     = '<p style="color:var(--muted);font-size:.85rem">Login to track badges.</p>';
    document.getElementById('runHistoryList').innerHTML = '<p style="color:var(--muted);font-size:.85rem">Login to see history.</p>';
    return;
  }

  const rank      = getRank(user.bestScore || 0);
  const accuracy  = user.totalQ > 0 ? Math.round(((user.correctQ||0) / user.totalQ) * 100) : 0;

  document.getElementById('dashName').textContent     = user.name || user.username;
  document.getElementById('dashUsername').textContent = '@' + user.username;
  document.getElementById('dashRank').textContent     = rank.title;
  document.getElementById('dashLevel').textContent    = rank.level;
  document.getElementById('dsBestScore').textContent  = (user.bestScore || 0).toLocaleString();
  document.getElementById('dsTotalRuns').textContent  = (user.runs || []).length;
  document.getElementById('dsAccuracy').textContent   = accuracy + '%';
  document.getElementById('dsBestStreak').textContent = user.bestStreak || 0;
  document.getElementById('dsTotalDist').textContent  = Math.floor(user.totalDist || 0) + 'm';
  document.getElementById('dsTotalQ').textContent     = user.totalQ || 0;

  // Badges
  const bg = document.getElementById('badgesGrid');
  bg.innerHTML = '';
  ALL_BADGES.forEach(badge => {
    const earned = badge.check(user);
    const el = document.createElement('div');
    el.className = `badge-item${earned ? '' : ' locked'}`;
    el.innerHTML = `
      <span class="badge-icon">${badge.icon}</span>
      <div class="badge-info">
        <div class="badge-name">${badge.name}</div>
        <div class="badge-desc">${badge.desc}</div>
      </div>
    `;
    bg.appendChild(el);
  });

  // Run history
  const hist = document.getElementById('runHistoryList');
  hist.innerHTML = '';
  const runs = (user.runs || []).slice(0, 10);
  if (runs.length === 0) {
    hist.innerHTML = '<p style="color:var(--muted);font-size:.85rem">No runs yet — go play!</p>';
    return;
  }
  runs.forEach(run => {
    const d    = new Date(run.date);
    const ds   = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const el   = document.createElement('div');
    el.className = 'run-item';
    el.innerHTML = `
      <div class="run-left">
        <div class="run-date">${ds}</div>
        <div class="run-score">${(run.score||0).toLocaleString()} pts</div>
      </div>
      <div class="run-right">
        <div class="run-meta">
          <div class="run-meta-val">${run.distance||0}m</div>
          <div class="run-meta-label">Distance</div>
        </div>
        <div class="run-meta">
          <div class="run-meta-val">${run.accuracy||0}%</div>
          <div class="run-meta-label">Accuracy</div>
        </div>
        <div class="run-meta">
          <div class="run-meta-val">×${run.streak||0}</div>
          <div class="run-meta-label">Streak</div>
        </div>
      </div>
    `;
    hist.appendChild(el);
  });
}

/* ══════════════════════════════════════════════════════
   27. SCORE POP ANIMATION
══════════════════════════════════════════════════════ */
function showScorePop(text, color) {
  const el = document.createElement('div');
  el.className   = 'score-pop';
  el.textContent = text;
  el.style.cssText = `
    left:${40 + Math.random()*60}%;
    top:${30 + Math.random()*20}%;
    color:${color};
    text-shadow:0 0 12px ${color};
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

/* ══════════════════════════════════════════════════════
   28. TOAST
══════════════════════════════════════════════════════ */
let toastTimeout = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════════════════
   29. UTILITIES
══════════════════════════════════════════════════════ */
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════
   30. FALLBACK QUESTIONS (if JSON fetch fails)
══════════════════════════════════════════════════════ */
function getFallbackQuestions() {
  return [
    {
      id:1, difficulty:'EASY',
      question:'Which macronutrient provides 4 kcal per gram AND is the brain\'s primary fuel?',
      options:['Fats','Proteins','Carbohydrates','Minerals'],
      correct:2,
      explanation:'Glucose from carbohydrates provides 4 kcal/g and is the CNS\'s preferred fuel source.'
    },
    {
      id:2, difficulty:'EASY',
      question:'Which vitamin is known as the "Sunshine Vitamin"?',
      options:['Vitamin A','Vitamin B12','Vitamin C','Vitamin D'],
      correct:3,
      explanation:'Vitamin D is synthesised in skin under UV sunlight from 7-dehydrocholesterol.'
    },
    {
      id:3, difficulty:'EASY',
      question:'How many calories does 1 gram of fat provide?',
      options:['4 kcal','7 kcal','9 kcal','11 kcal'],
      correct:2,
      explanation:'Fat provides 9 kcal/g — the most energy-dense macronutrient.'
    },
    {
      id:4, difficulty:'MEDIUM',
      question:'Kwashiorkor oedema is primarily due to low serum levels of which protein?',
      options:['Haemoglobin','Albumin','Fibrinogen','Globulin'],
      correct:1,
      explanation:'Low albumin reduces oncotic pressure, causing fluid to leak into interstitial spaces.'
    },
    {
      id:5, difficulty:'MEDIUM',
      question:'Which B-vitamin deficiency causes Beriberi?',
      options:['Riboflavin (B2)','Niacin (B3)','Thiamin (B1)','Pyridoxine (B6)'],
      correct:2,
      explanation:'Thiamin (B1) deficiency causes beriberi, affecting the nervous and cardiovascular systems.'
    },
    {
      id:6, difficulty:'HARD',
      question:'In hepatic encephalopathy, protein is restricted primarily to reduce production of which toxic compound?',
      options:['Urea','Ammonia','Creatinine','Bilirubin'],
      correct:1,
      explanation:'Impaired liver cannot convert ammonia to urea. Accumulated ammonia is neurotoxic, causing encephalopathy.'
    },
    {
      id:7, difficulty:'HARD',
      question:'The WHO-ORS formula does NOT contain which of the following?',
      options:['Glucose 20g/L','NaCl 3.5g/L','KCl 1.5g/L','Calcium gluconate 2g/L'],
      correct:3,
      explanation:'WHO-ORS = NaCl, NaHCO₃, KCl, Glucose. Calcium gluconate is not a component.'
    },
    {
      id:8, difficulty:'EASY',
      question:'Which mineral carries oxygen in red blood cells?',
      options:['Calcium','Iron','Zinc','Magnesium'],
      correct:1,
      explanation:'Iron is the key component of haemoglobin\'s haem group, which binds and transports O₂.'
    },
    {
      id:9, difficulty:'MEDIUM',
      question:'Which lipoprotein is called "bad cholesterol"?',
      options:['HDL','VLDL','LDL','Chylomicrons'],
      correct:2,
      explanation:'LDL deposits cholesterol in arterial walls. High LDL (>130 mg/dL) increases CHD risk.'
    },
    {
      id:10, difficulty:'MEDIUM',
      question:'The RDA for protein for an adult Indian is:',
      options:['0.5 g/kg/day','1.0 g/kg/day','1.5 g/kg/day','2.0 g/kg/day'],
      correct:1,
      explanation:'ICMR recommends 1 g protein/kg body weight per day for healthy adults.'
    },
  ];
}

/* ══════════════════════════════════════════════════════
   31. KEYBOARD SHORTCUT HINTS (dev QoL)
══════════════════════════════════════════════════════ */
// Space / ArrowUp = jump (handled in onKey above)
// Escape = pause
// These are registered in initGameCanvas()
