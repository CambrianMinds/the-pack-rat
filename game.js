// The Pack Rat (1992 by Steve Blanding) — Complete Web Game Engine

(function () {
  'use strict';

  // --- Canvas & Rendering Setup ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const VIRTUAL_W = 320;
  const VIRTUAL_H = 200;
  const TILE_SIZE = 16;
  const MAP_W = 64;
  const MAP_H = 64;

  // Sound Engine
  const sound = new SoundSystem();

  // Pre-rendered sprite and tile caches
  const tileBitmaps = {};
  const ratBitmaps = {
    right: { idle: null, jump: null, walk: [] },
    left: { idle: null, jump: null, walk: [] }
  };
  const enemyBitmaps = { left: [], right: [] };

  // --- Pre-render Assets ---
  function preRenderAssets() {
    const assets = window.PACKRAT_ASSETS;
    if (!assets) return;

    const pal = assets.palette;

    // Helper: create ImageBitmap or offscreen canvas from raw pixels
    function createTileCanvas(w, h, pixels) {
      const oc = document.createElement('canvas');
      oc.width = w;
      oc.height = h;
      const octx = oc.getContext('2d');
      const imgData = octx.createImageData(w, h);
      const d = imgData.data;

      for (let i = 0; i < pixels.length; i++) {
        const colorIdx = pixels[i];
        if (colorIdx === 0) {
          // Transparent
          d[i * 4 + 3] = 0;
        } else {
          const rgb = pal[colorIdx] || [255, 255, 255];
          d[i * 4 + 0] = rgb[0];
          d[i * 4 + 1] = rgb[1];
          d[i * 4 + 2] = rgb[2];
          d[i * 4 + 3] = 255;
        }
      }
      octx.putImageData(imgData, 0, 0);
      return oc;
    }

    // Helper: flip canvas horizontally
    function createFlippedCanvas(sourceCanvas) {
      const fc = document.createElement('canvas');
      fc.width = sourceCanvas.width;
      fc.height = sourceCanvas.height;
      const fctx = fc.getContext('2d');
      fctx.translate(fc.width, 0);
      fctx.scale(-1, 1);
      fctx.drawImage(sourceCanvas, 0, 0);
      return fc;
    }

    // Pre-render tiles (authentic 16x16 map tiles are 1..35)
    for (const [idStr, tile] of Object.entries(assets.tiles)) {
      const id = parseInt(idStr, 10);
      if (id <= 35) {
        tileBitmaps[id] = createTileCanvas(tile.w, tile.h, tile.pixels);
      }
    }

    // Pre-render raw rat animation frames
    // In PACKRAT.EXE:
    // Frames 0..6 are left-facing (0=idle, 1..6=walk)
    // Frames 7..14 are right-facing (9=idle, 7,8,10..14=walk)
    // Frame 15 is left-facing jump, Frame 16 is right-facing jump
    const rawRat = [];
    for (let i = 0; i < assets.ratFrames.length; i++) {
      const rf = assets.ratFrames[i];
      rawRat.push(createTileCanvas(rf.w, rf.h, rf.pixels));
    }

    // Right-facing set
    ratBitmaps.right = {
      idle: rawRat[9] || (rawRat[0] ? createFlippedCanvas(rawRat[0]) : null),
      jump: rawRat[16] || (rawRat[15] ? createFlippedCanvas(rawRat[15]) : null),
      walk: [rawRat[9], rawRat[7], rawRat[8], rawRat[10], rawRat[11], rawRat[12], rawRat[13], rawRat[14]].filter(Boolean)
    };

    // Left-facing set
    ratBitmaps.left = {
      idle: rawRat[0] || (rawRat[9] ? createFlippedCanvas(rawRat[9]) : null),
      jump: rawRat[15] || (rawRat[16] ? createFlippedCanvas(rawRat[16]) : null),
      walk: [rawRat[0], rawRat[1], rawRat[2], rawRat[3], rawRat[4], rawRat[5], rawRat[6]].filter(Boolean)
    };

    // Pre-render enemy rat animation frames (naturally left-facing)
    for (let i = 0; i < assets.enemyFrames.length; i++) {
      const ef = assets.enemyFrames[i];
      const eCanvas = createTileCanvas(ef.w, ef.h, ef.pixels);
      enemyBitmaps.left.push(eCanvas);
      enemyBitmaps.right.push(createFlippedCanvas(eCanvas));
    }
  }

  // --- High Scores Storage ---
  const DEFAULT_SCORES = [
    { name: 'Steve', score: 38450 },
    { name: 'Kray', score: 25100 },
    { name: 'Doreen', score: 18400 },
    { name: 'Jon', score: 14250 },
    { name: 'Dan', score: 10800 },
    { name: 'Paul', score: 7650 },
    { name: 'Mike', score: 5200 }
  ];

  function getHighScores() {
    try {
      const saved = localStorage.getItem('packrat_highscores');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_SCORES.slice();
  }

  function saveHighScore(name, score) {
    const list = getHighScores();
    list.push({ name: name || 'PLAYER', score });
    list.sort((a, b) => b.score - a.score);
    const top7 = list.slice(0, 7);
    try {
      localStorage.setItem('packrat_highscores', JSON.stringify(top7));
    } catch (e) {}
    return top7;
  }

  // --- Game Engine State ---
  const GAME_STATE = {
    TITLE: 0,
    PLAYING: 1,
    PAUSED: 2,
    LEVEL_CLEAR: 3,
    GAME_OVER: 4,
    MINIMAP: 5
  };

  let currentState = GAME_STATE.TITLE;

  let currentLevelIdx = 0;
  let levelData = null;
  let currentTiles = [];
  let currentDestMap = [];
  let levelBgColor = '#000000';

  let score = 0;
  let lives = 3;
  let nextLifeScore = 10000;
  let highScore = 38450;
  let gameTicks = 0;
  let showHud = true;

  // Particle Effects (Coin pickups, landing dust, sparks)
  let particles = [];

  function addSparkles(x, y, color = '#ffd028', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.2 + Math.random() * 2.0;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        color,
        life: 25 + Math.floor(Math.random() * 15),
        maxLife: 40,
        size: 1.5 + Math.random() * 1.5
      });
    }
  }

  // --- Entities & Enemies ---
  let enemies = [];

  class EnemyRat {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 26;
      this.h = 14;
      this.vx = 0.8;
      this.dir = 1;
      this.animFrame = 0;
      this.animTimer = 0;
    }

    update() {
      // Check floor ahead
      const nextX = this.x + this.vx * this.dir;
      const checkTileX = Math.floor((this.dir > 0 ? nextX + this.w : nextX) / TILE_SIZE);
      const floorTileY = Math.floor((this.y + this.h + 2) / TILE_SIZE);
      const wallTileY = Math.floor((this.y + this.h / 2) / TILE_SIZE);

      const hasFloor = isTileSolid(getTileAt(checkTileX, floorTileY));
      const hitsWall = isTileSolid(getTileAt(checkTileX, wallTileY));

      if (!hasFloor || hitsWall) {
        this.dir *= -1;
      } else {
        this.x += this.vx * this.dir;
      }

      this.animTimer++;
      if (this.animTimer > 5) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
    }

    draw(camX, camY) {
      const frames = this.dir > 0 ? enemyBitmaps.right : enemyBitmaps.left;
      const sprite = frames[this.animFrame] || frames[0];
      if (sprite) {
        ctx.drawImage(sprite, Math.floor(this.x - camX), Math.floor(this.y - camY));
      }
    }
  }

  // --- Movable Blocks ---
  let movableBlocks = [];

  class MovableBlock {
    constructor(tx, ty, tileId) {
      this.tx = tx;
      this.ty = ty;
      this.x = tx * TILE_SIZE;
      this.y = ty * TILE_SIZE;
      this.tileId = tileId;
      this.vx = 0;
      this.vy = 0;
      this.falling = false;
    }

    update() {
      // Horizontal sliding (ice cubes or crates)
      if (Math.abs(this.vx) > 0.05) {
        this.x += this.vx;
        this.vx *= 0.90;
        const checkTx = Math.floor((this.vx > 0 ? this.x + 15 : this.x) / TILE_SIZE);
        const checkTy = Math.floor((this.y + 8) / TILE_SIZE);
        if (isTileSolid(getTileAt(checkTx, checkTy))) {
          this.vx = 0;
          this.x = Math.round(this.x / TILE_SIZE) * TILE_SIZE;
        }
      } else {
        this.vx = 0;
      }

      // Gravity check
      const centerTx = Math.floor((this.x + 8) / TILE_SIZE);
      const feetY = Math.floor((this.y + 16) / TILE_SIZE);
      const tileBelow = getTileAt(centerTx, feetY);

      if (!isTileSolid(tileBelow)) {
        this.falling = true;
        this.vy += 0.35;
        if (this.vy > 6.0) this.vy = 6.0;
        this.y += this.vy;

        // Snap to grid when landing
        const landTileY = Math.floor((this.y + 16) / TILE_SIZE);
        if (isTileSolid(getTileAt(centerTx, landTileY))) {
          this.y = (landTileY - 1) * TILE_SIZE;
          this.vy = 0;
          this.vx = 0;
          this.falling = false;
          this.tx = centerTx;
          this.ty = landTileY - 1;
          this.x = this.tx * TILE_SIZE;
          setTileAt(this.tx, this.ty, this.tileId);
          sound.play(5); // Bump sound
        }
      } else if (this.vx === 0 && !this.falling) {
        this.tx = centerTx;
        this.ty = Math.floor(this.y / TILE_SIZE);
        this.x = this.tx * TILE_SIZE;
        this.y = this.ty * TILE_SIZE;
        setTileAt(this.tx, this.ty, this.tileId);
      }
    }

    draw(camX, camY) {
      const sprite = tileBitmaps[this.tileId % 36];
      if (sprite) {
        ctx.drawImage(sprite, Math.floor(this.x - camX), Math.floor(this.y - camY));
      }
    }
  }

  // --- Player (The Pack Rat) ---
  const player = {
    x: 48,
    y: 992,
    vx: 0,
    vy: 0,
    w: 14,
    h: 22,
    facing: 1, // 1 = right, -1 = left
    onGround: false,
    jumping: false,
    pushing: false,
    lookingUp: false,
    lookingDown: false,
    inPipe: false,
    pipeDir: 1, // 0=up, 1=right, 2=down, 3=left
    pipeSpeed: 3.5,
    animFrame: 0,
    animTimer: 0,
    invulnerableTimer: 0,
    dislodgeTimer: 0,

    reset(startX, startY) {
      this.x = startX * TILE_SIZE + 1;
      this.y = startY * TILE_SIZE - (this.h - TILE_SIZE) - 2;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.jumping = false;
      this.pushing = false;
      this.lookingUp = false;
      this.lookingDown = false;
      this.inPipe = false;
      this.animFrame = 0;
      this.animTimer = 0;
      this.invulnerableTimer = 60; // 1 second immunity
    }
  };

  // --- Camera ---
  const camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    lookOffset: 0,

    update() {
      // Look offset when looking up or down
      let targetLook = 0;
      if (player.lookingUp) targetLook = -48;
      if (player.lookingDown) targetLook = 48;
      this.lookOffset += (targetLook - this.lookOffset) * 0.15;

      this.targetX = player.x + player.w / 2 - VIRTUAL_W / 2;
      this.targetY = player.y + player.h / 2 - VIRTUAL_H / 2 + this.lookOffset;

      // Clamp camera
      const maxCamX = MAP_W * TILE_SIZE - VIRTUAL_W;
      const maxCamY = MAP_H * TILE_SIZE - VIRTUAL_H;
      this.targetX = Math.max(0, Math.min(maxCamX, this.targetX));
      this.targetY = Math.max(0, Math.min(maxCamY, this.targetY));

      // Smooth camera interpolation
      this.x += (this.targetX - this.x) * 0.2;
      this.y += (this.targetY - this.y) * 0.2;
    }
  };

  // --- Configurable Controls System ---
  const DEFAULT_BINDINGS = {
    left: { name: 'Move Left', keys: ['ArrowLeft', 'KeyA'] },
    right: { name: 'Move Right', keys: ['ArrowRight', 'KeyD'] },
    up: { name: 'Look Up', keys: ['ArrowUp', 'KeyW'] },
    down: { name: 'Look Down / Dislodge', keys: ['ArrowDown', 'KeyS'] },
    jump: { name: 'Jump', keys: ['Space', 'ControlLeft', 'KeyZ'] },
    push: { name: 'Push Objects', keys: ['AltLeft', 'ShiftLeft', 'KeyX'] },
    minimap: { name: 'Zoom View / Minimap', keys: ['KeyM'] },
    suicide: { name: 'Kill Rat (Stuck)', keys: ['KeyK'] },
    pause: { name: 'Pause Game', keys: ['Escape', 'F3'] }
  };

  let customBindings = null;
  let rebindingAction = null;

  function loadBindings() {
    try {
      const saved = localStorage.getItem('packrat_controls');
      if (saved) {
        customBindings = JSON.parse(saved);
        return;
      }
    } catch (e) {}
    customBindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }

  function saveBindings() {
    try {
      localStorage.setItem('packrat_controls', JSON.stringify(customBindings));
    } catch (e) {}
  }

  function formatKeyName(code) {
    if (!code) return 'NONE';
    if (code.startsWith('Key')) return code.substring(3);
    if (code.startsWith('Digit')) return code.substring(5);
    const map = {
      'ArrowLeft': '← LEFT',
      'ArrowRight': '→ RIGHT',
      'ArrowUp': '↑ UP',
      'ArrowDown': '↓ DOWN',
      'Space': 'SPACE',
      'ControlLeft': 'L-CTRL',
      'ControlRight': 'R-CTRL',
      'AltLeft': 'L-ALT',
      'AltRight': 'R-ALT',
      'ShiftLeft': 'L-SHIFT',
      'ShiftRight': 'R-SHIFT',
      'Escape': 'ESC'
    };
    return map[code] || code;
  }

  loadBindings();

  // Active Key States
  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    push: false
  };

  function matchesAction(actionName, code) {
    if (!customBindings || !customBindings[actionName]) return false;
    return customBindings[actionName].keys.includes(code);
  }

  // Setup Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    sound.init(); // enable audio context on user gesture

    // Check if currently rebinding a key in the controls modal
    if (rebindingAction) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        customBindings[rebindingAction].keys = [e.code];
        saveBindings();
      }
      rebindingAction = null;
      populateControlsList();
      return;
    }

    if (matchesAction('left', e.code)) {
      keys.left = true;
      e.preventDefault();
    }
    if (matchesAction('right', e.code)) {
      keys.right = true;
      e.preventDefault();
    }
    if (matchesAction('up', e.code)) {
      keys.up = true;
      e.preventDefault();
    }
    if (matchesAction('down', e.code)) {
      keys.down = true;
      e.preventDefault();
    }
    if (matchesAction('jump', e.code)) {
      if (!keys.jump && currentState === GAME_STATE.PLAYING) {
        handleJump();
      }
      keys.jump = true;
      e.preventDefault();
    }
    if (matchesAction('push', e.code)) {
      keys.push = true;
      e.preventDefault();
    }
    if (matchesAction('suicide', e.code)) {
      if (currentState === GAME_STATE.PLAYING) {
        killPlayer();
      }
    }
    if (matchesAction('minimap', e.code)) {
      toggleMinimap();
      e.preventDefault();
    }
    if (matchesAction('pause', e.code)) {
      togglePause();
      e.preventDefault();
    }

    // Fixed functional keys
    switch (e.code) {
      case 'F1':
        openModal('modalHelp');
        e.preventDefault();
        break;
      case 'F2':
        toggleSoundSetting();
        e.preventDefault();
        break;
      case 'F10':
        showHud = !showHud;
        document.getElementById('hudBar').style.display = showHud ? 'flex' : 'none';
        e.preventDefault();
        break;
      case 'Enter':
        if (currentState === GAME_STATE.TITLE || currentState === GAME_STATE.GAME_OVER) {
          startGame(0);
        }
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (matchesAction('left', e.code)) keys.left = false;
    if (matchesAction('right', e.code)) keys.right = false;
    if (matchesAction('up', e.code)) keys.up = false;
    if (matchesAction('down', e.code)) keys.down = false;
    if (matchesAction('jump', e.code)) keys.jump = false;
    if (matchesAction('push', e.code)) keys.push = false;
  });

  // Touch Virtual Controls
  function bindTouch(id, onStart, onEnd) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.init();
      onStart();
    });
    el.addEventListener('pointerup', (e) => {
      e.preventDefault();
      onEnd();
    });
    el.addEventListener('pointercancel', (e) => {
      e.preventDefault();
      onEnd();
    });
  }

  bindTouch('touchLeft', () => { keys.left = true; }, () => { keys.left = false; });
  bindTouch('touchRight', () => { keys.right = true; }, () => { keys.right = false; });
  bindTouch('touchUp', () => { keys.up = true; }, () => { keys.up = false; });
  bindTouch('touchDown', () => { keys.down = true; }, () => { keys.down = false; });
  bindTouch('touchJump', () => {
    if (!keys.jump && currentState === GAME_STATE.PLAYING) handleJump();
    keys.jump = true;
  }, () => { keys.jump = false; });
  bindTouch('touchPush', () => { keys.push = true; }, () => { keys.push = false; });

  // Gamepad Polling
  function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads || !gamepads[0]) return;
    const gp = gamepads[0];

    // D-Pad or Left Stick
    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;
    const btnLeft = gp.buttons[14]?.pressed || axisX < -0.4;
    const btnRight = gp.buttons[15]?.pressed || axisX > 0.4;
    const btnUp = gp.buttons[12]?.pressed || axisY < -0.4;
    const btnDown = gp.buttons[13]?.pressed || axisY > 0.4;
    const btnJump = gp.buttons[0]?.pressed || gp.buttons[1]?.pressed; // A or B
    const btnPush = gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || gp.buttons[5]?.pressed; // X, Y, RB
    const btnStart = gp.buttons[9]?.pressed; // Start

    keys.left = btnLeft;
    keys.right = btnRight;
    keys.up = btnUp;
    keys.down = btnDown;

    if (btnJump && !keys.jump && currentState === GAME_STATE.PLAYING) {
      handleJump();
    }
    keys.jump = btnJump;
    keys.push = btnPush;

    if (btnStart) {
      togglePause();
    }
  }

  // --- Tile Map Helpers ---
  function getTileAt(tx, ty) {
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return 1; // Out of bounds is solid brick
    return currentTiles[ty * MAP_W + tx] || 0;
  }

  function setTileAt(tx, ty, tileId) {
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return;
    currentTiles[ty * MAP_W + tx] = tileId;
  }

  function getDestAt(tx, ty) {
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return 0;
    return currentDestMap[ty * MAP_W + tx] || 0;
  }

  function isTileSolid(id) {
    // Tile IDs >= 36 are illusionary pass-through tiles
    if (id >= 36) return false;
    // Tile 10 is also illusionary brick (secret wall)
    if (id === 10) return false;
    // Tile 1 = Brick, Tile 16 = Ice Cube / Stone
    if (id === 1 || id === 16) return true;
    // Tile 3..9 = Crates / Movable blocks
    if (id >= 3 && id <= 9) return true;
    return false;
  }

  function isTileMovable(id) {
    if (id >= 36) return false;
    // Crates (3..9) and Ice Cubes (16)
    return (id >= 3 && id <= 9) || id === 16;
  }

  function isTileHazard(id) {
    // Illusionary tiles (>= 36, such as decoy trap 38) are never lethal
    if (id >= 36) return false;
    // Tile 2: Mousetrap
    // Tile 11..14: Water
    // Tile 18..19: Electric sparks
    // Note: Tile 17 is the bouncy rubber column, NOT a hazard!
    if (id === 2 || (id >= 11 && id <= 14) || id === 18 || id === 19) {
      return true;
    }
    return false;
  }

  function isTileBauble(id) {
    if (id >= 36) return false;
    return id >= 31 && id <= 35;
  }

  // --- Level Loading ---
  function loadLevel(idx) {
    const assets = window.PACKRAT_ASSETS;
    if (!assets || !assets.levels || assets.levels.length === 0) return;

    if (idx < 0) idx = 0;
    if (idx >= assets.levels.length) idx = 0;

    currentLevelIdx = idx;
    levelData = assets.levels[idx];
    currentTiles = levelData.tiles.slice();
    currentDestMap = levelData.destMap.slice();

    const pal = assets.palette;
    const bgRgb = pal[levelData.bg] || [0, 0, 0];
    levelBgColor = `rgb(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})`;

    // Spawn player at start coordinates
    player.reset(levelData.startX, levelData.startY);

    // Initialize Movable Blocks and Enemies
    movableBlocks = [];
    enemies = [];
    particles = [];

    // Scan map for potential enemy patrol zones
    for (let ty = 0; ty < MAP_H; ty++) {
      let consecutiveFloor = 0;
      let floorStartX = 0;

      for (let tx = 0; tx < MAP_W; tx++) {
        const tid = getTileAt(tx, ty);

        // Enemy platform patrol detection
        if (isTileSolid(tid)) {
          if (consecutiveFloor === 0) floorStartX = tx;
          consecutiveFloor++;
        } else {
          if (consecutiveFloor >= 8 && ty > 8) {
            // Found a platform! Check if space above is clear
            const airAbove = getTileAt(floorStartX + 2, ty - 1) === 0 && getTileAt(floorStartX + 4, ty - 1) === 0;
            // Spawn 1 enemy rat per suitable long platform (limit to 3-5 per level)
            if (airAbove && enemies.length < 5 && Math.abs(floorStartX * 16 - player.x) > 120) {
              enemies.push(new EnemyRat((floorStartX + 2) * TILE_SIZE, (ty - 1) * TILE_SIZE + 2));
            }
          }
          consecutiveFloor = 0;
        }
      }
    }

    camera.x = player.x - VIRTUAL_W / 2;
    camera.y = player.y - VIRTUAL_H / 2;

    updateHud();
  }

  function updateHud() {
    document.getElementById('hudScore').textContent = String(score).padStart(6, '0');
    document.getElementById('hudHigh').textContent = String(highScore).padStart(6, '0');
    document.getElementById('hudLevel').textContent = String(currentLevelIdx);
    
    let lifeIcons = '';
    for (let i = 0; i < lives; i++) {
      lifeIcons += '🐀 ';
    }
    document.getElementById('hudLives').textContent = lifeIcons || '💀';
  }

  // --- Player Actions & Physics ---
  function handleJump() {
    if (player.onGround && !player.inPipe) {
      player.vy = -6.4;
      player.onGround = false;
      player.jumping = true;
      sound.play(0); // Jump sound!
      addSparkles(player.x + player.w / 2, player.y + player.h, '#ffffff', 4);
    }
  }

  function killPlayer() {
    if (player.invulnerableTimer > 0) return;

    lives--;
    updateHud();
    sound.play(8); // Trap/hurt snap!
    addSparkles(player.x + player.w / 2, player.y + player.h / 2, '#ff2a7a', 16);

    if (lives <= 0) {
      gameOver();
    } else {
      // Respawn at level start
      player.reset(levelData.startX, levelData.startY);
    }
  }

  function gameOver() {
    currentState = GAME_STATE.GAME_OVER;
    sound.play(4); // Sad Game Over melody!
    saveHighScore('PLAYER', score);
    highScore = Math.max(highScore, score);
    updateHud();
  }

  function addScore(pts) {
    score += pts;
    if (score >= nextLifeScore) {
      lives++;
      nextLifeScore += 10000;
      sound.play(2); // Extra life fanfare!
    }
    highScore = Math.max(highScore, score);
    updateHud();
  }

  function completeLevel(nextLvl) {
    currentState = GAME_STATE.LEVEL_CLEAR;
    sound.play(3); // Level victory fanfare!
    addScore(500); // 500 bonus points!
    addSparkles(player.x + 8, player.y + 8, '#ffd028', 24);

    setTimeout(() => {
      currentState = GAME_STATE.PLAYING;
      loadLevel(nextLvl);
    }, 1800);
  }

  // Dislodge block beneath player or in front of feet when crouching (Crates 3..9 and Ice Cubes 16)
  function dislodgeBlockBelow() {
    const feetY = Math.floor((player.y + player.h + 2) / TILE_SIZE);
    const txMid = Math.floor((player.x + player.w / 2) / TILE_SIZE);
    const txAhead = Math.floor((player.x + (player.facing > 0 ? player.w + 6 : -6)) / TILE_SIZE);
    const txLeft = Math.floor((player.x + 2) / TILE_SIZE);
    const txRight = Math.floor((player.x + player.w - 2) / TILE_SIZE);

    let targetTx = -1;
    let tid = 0;

    for (const testTx of [txMid, txAhead, txRight, txLeft]) {
      const t = getTileAt(testTx, feetY);
      if (isTileMovable(t)) {
        targetTx = testTx;
        tid = t;
        break;
      }
    }

    if (targetTx >= 0 && isTileMovable(tid)) {
      setTileAt(targetTx, feetY, 0); // Dislodge! Remove from grid
      sound.play(5); // Bump sound
      const pColor = (tid === 16) ? '#00e5ff' : '#ffd028';
      addSparkles(targetTx * TILE_SIZE + 8, feetY * TILE_SIZE + 8, pColor, 10);
      movableBlocks.push(new MovableBlock(targetTx, feetY, tid));
    }
  }

  // Push movable block in front of player
  function tryPushBlock(dir) {
    const checkX = player.x + (dir > 0 ? player.w + 4 : -4);
    const tx = Math.floor(checkX / TILE_SIZE);

    // Check chest level first, then foot level
    let ty = Math.floor((player.y + player.h / 2) / TILE_SIZE);
    let tid = getTileAt(tx, ty);
    if (!isTileMovable(tid)) {
      ty = Math.floor((player.y + player.h - 4) / TILE_SIZE);
      tid = getTileAt(tx, ty);
    }

    if (isTileMovable(tid)) {
      const destTx = tx + dir;
      const targetTile = getTileAt(destTx, ty);
      if (!isTileSolid(targetTile)) {
        // Space is free! Push the block!
        setTileAt(tx, ty, 0);
        sound.play(7); // Push block sound
        const blk = new MovableBlock(destTx, ty, tid);
        if (tid === 16) {
          // Ice cube slides horizontally!
          blk.vx = dir * 2.2;
          addSparkles(destTx * TILE_SIZE + 8, ty * TILE_SIZE + 8, '#00e5ff', 6);
        }
        movableBlocks.push(blk);
        player.pushing = true;
      }
    }
  }

  // --- Main Update Loop ---
  function update() {
    gameTicks++;
    pollGamepad();

    if (currentState !== GAME_STATE.PLAYING) return;

    if (player.invulnerableTimer > 0) {
      player.invulnerableTimer--;
    }

    // --- Pipe Network Transport ---
    const centerTx = Math.floor((player.x + player.w / 2) / TILE_SIZE);
    const centerTy = Math.floor((player.y + player.h / 2) / TILE_SIZE);
    const currentTile = getTileAt(centerTx, centerTy);

    // Pipe entrance (Tile 23)
    if (!player.inPipe && currentTile === 23) {
      player.inPipe = true;
      player.pipeDir = 1; // slide right
      sound.play(0);
    }

    if (player.inPipe) {
      // High-speed pipe transport following tube corners
      switch (currentTile) {
        case 25:
          player.pipeDir = (player.pipeDir === 2) ? 1 : 0;
          break;
        case 26:
          player.pipeDir = (player.pipeDir === 1) ? 0 : 3;
          break;
        case 27:
          if (player.pipeDir === 2) player.pipeDir = 3;
          break;
        case 28:
          if (player.pipeDir === 1) player.pipeDir = 0;
          break;
        case 29:
          player.pipeDir = (player.pipeDir === 0) ? 1 : 2;
          break;
        case 30:
          player.pipeDir = (player.pipeDir === 0) ? 3 : 2;
          break;
      }

      // Move in pipe direction
      const dirs = [
        { dx: 0, dy: -1 }, // up
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }  // left
      ];
      const d = dirs[player.pipeDir] || dirs[1];
      player.x += d.dx * player.pipeSpeed;
      player.y += d.dy * player.pipeSpeed;

      // If exited pipe tiles (no longer in 23..30)
      if (currentTile < 23 || currentTile > 30) {
        player.inPipe = false;
      }

      camera.update();
      return;
    }

    // --- Standard Platformer Movement ---
    player.lookingUp = keys.up && player.onGround && Math.abs(player.vx) < 0.2;
    player.lookingDown = keys.down && player.onGround && Math.abs(player.vx) < 0.2;

    if (player.lookingDown || (keys.down && player.onGround)) {
      player.dislodgeTimer++;
      if (player.dislodgeTimer >= 15 || (keys.push && player.dislodgeTimer >= 2)) {
        player.dislodgeTimer = 0;
        dislodgeBlockBelow();
      }
    } else {
      player.dislodgeTimer = 0;
    }

    // Slippery physics when on Ice Cubes (Tile 16)
    const feetCheckY = Math.floor((player.y + player.h + 1) / TILE_SIZE);
    const feetCheckX1 = Math.floor((player.x + 2) / TILE_SIZE);
    const feetCheckX2 = Math.floor((player.x + player.w - 2) / TILE_SIZE);
    const onIce = player.onGround && (getTileAt(feetCheckX1, feetCheckY) === 16 || getTileAt(feetCheckX2, feetCheckY) === 16);

    // Horizontal Acceleration
    const ACCEL = onIce ? 0.18 : 0.35;
    const MAX_SPEED = onIce ? 2.8 : 2.4;
    const FRICTION = onIce ? 0.96 : 0.82;

    if (keys.left) {
      player.vx -= ACCEL;
      player.facing = -1;
      if (keys.push) tryPushBlock(-1);
    } else if (keys.right) {
      player.vx += ACCEL;
      player.facing = 1;
      if (keys.push) tryPushBlock(1);
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }

    // Auto-push against blocks if walking into them
    if (Math.abs(player.vx) < 0.15 && (keys.left || keys.right)) {
      player.pushCounter = (player.pushCounter || 0) + 1;
      if (player.pushCounter > 10) {
        player.pushCounter = 0;
        tryPushBlock(keys.right ? 1 : -1);
      }
    } else {
      player.pushCounter = 0;
    }

    // Clamp horizontal speed
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

    // Gravity
    const GRAVITY = 0.32;
    const TERMINAL_VEL = 7.0;
    player.vy += GRAVITY;
    if (player.vy > TERMINAL_VEL) player.vy = TERMINAL_VEL;

    // --- Bouncy Rubber Things (Tile 17) ---
    const bouncePts = [
      { x: player.x + player.w / 2, y: player.y + player.h },     // feet
      { x: player.x + 2, y: player.y + player.h },                // left foot
      { x: player.x + player.w - 2, y: player.y + player.h },     // right foot
      { x: player.x + player.w / 2, y: player.y + player.h / 2 }  // center
    ];

    let onBouncy = false;
    for (const pt of bouncePts) {
      const btx = Math.floor(pt.x / TILE_SIZE);
      const bty = Math.floor(pt.y / TILE_SIZE);
      if (getTileAt(btx, bty) === 17) {
        onBouncy = true;
        break;
      }
    }

    if (onBouncy) {
      const bouncePower = keys.jump ? -8.8 : -7.8;
      player.vy = bouncePower;
      player.onGround = false;
      player.jumping = true;
      sound.play(0); // Jump/spring sound
      addSparkles(player.x + player.w / 2, player.y + player.h, '#00e5ff', 6);
      addSparkles(player.x + player.w / 2, player.y + player.h, '#ffd028', 4);
    }

    // --- Horizontal Collision ---
    player.x += player.vx;
    const leftTile = Math.floor(player.x / TILE_SIZE);
    const rightTile = Math.floor((player.x + player.w) / TILE_SIZE);
    const topTile = Math.floor(player.y / TILE_SIZE);
    const bottomTile = Math.floor((player.y + player.h - 1) / TILE_SIZE);

    if (player.vx > 0) {
      for (let ty = topTile; ty <= bottomTile; ty++) {
        if (isTileSolid(getTileAt(rightTile, ty))) {
          player.x = rightTile * TILE_SIZE - player.w - 0.01;
          player.vx = 0;
          break;
        }
      }
    } else if (player.vx < 0) {
      for (let ty = topTile; ty <= bottomTile; ty++) {
        if (isTileSolid(getTileAt(leftTile, ty))) {
          player.x = (leftTile + 1) * TILE_SIZE + 0.01;
          player.vx = 0;
          break;
        }
      }
    }

    // --- Vertical Collision ---
    player.y += player.vy;
    const newTopTile = Math.floor(player.y / TILE_SIZE);
    const newBottomTile = Math.floor((player.y + player.h) / TILE_SIZE);
    const curLeftTile = Math.floor(player.x / TILE_SIZE);
    const curRightTile = Math.floor((player.x + player.w) / TILE_SIZE);

    player.onGround = false;

    if (player.vy > 0) {
      for (let tx = curLeftTile; tx <= curRightTile; tx++) {
        if (isTileSolid(getTileAt(tx, newBottomTile))) {
          player.y = newBottomTile * TILE_SIZE - player.h;
          player.vy = 0;
          player.onGround = true;
          player.jumping = false;
          break;
        }
      }
    } else if (player.vy < 0) {
      for (let tx = curLeftTile; tx <= curRightTile; tx++) {
        if (isTileSolid(getTileAt(tx, newTopTile))) {
          player.y = (newTopTile + 1) * TILE_SIZE;
          player.vy = 0;
          break;
        }
      }
    }

    // --- Out of Bounds / Bottom Screen Death ---
    if (player.y > MAP_H * TILE_SIZE + 32) {
      killPlayer();
      return;
    }

    // --- Tile Interactions & Pickups ---
    const checkTiles = [
      { tx: Math.floor((player.x + 2) / TILE_SIZE), ty: Math.floor((player.y + 4) / TILE_SIZE) },
      { tx: Math.floor((player.x + player.w - 2) / TILE_SIZE), ty: Math.floor((player.y + 4) / TILE_SIZE) },
      { tx: Math.floor((player.x + 2) / TILE_SIZE), ty: Math.floor((player.y + player.h - 2) / TILE_SIZE) },
      { tx: Math.floor((player.x + player.w - 2) / TILE_SIZE), ty: Math.floor((player.y + player.h - 2) / TILE_SIZE) }
    ];

    for (const pt of checkTiles) {
      const tid = getTileAt(pt.tx, pt.ty);

      // Baubles collection
      if (isTileBauble(tid)) {
        setTileAt(pt.tx, pt.ty, 0); // remove bauble
        sound.play(1); // Pickup sound!

        let pts = 10;
        let pColor = '#ffd028';
        if (tid === 31) { pts = 10; pColor = '#39ff14'; } // Button
        if (tid === 32) { pts = 25; pColor = '#d6d6d6'; } // Silver Coin
        if (tid === 33) { pts = 50; pColor = '#ffd028'; } // Gold Coin
        if (tid === 34) { pts = 100; pColor = '#f59e0b'; } // Cookie
        if (tid === 35) { pts = 250; pColor = '#ff2a7a'; } // Cheese

        addScore(pts);
        addSparkles(pt.tx * TILE_SIZE + 8, pt.ty * TILE_SIZE + 8, pColor, 10);
      }

      // Mouse Hole Exit (Tile 15)
      if (tid === 15) {
        const nextLvl = getDestAt(pt.tx, pt.ty);
        completeLevel(nextLvl);
        return;
      }

      // Hazards
      if (isTileHazard(tid)) {
        killPlayer();
        return;
      }
    }

    // --- Enemy Rat Collisions ---
    for (const enemy of enemies) {
      enemy.update();

      // Check overlap with player
      if (
        player.x < enemy.x + enemy.w &&
        player.x + player.w > enemy.x &&
        player.y < enemy.y + enemy.h &&
        player.y + player.h > enemy.y
      ) {
        killPlayer();
        return;
      }
    }

    // --- Update Movable Blocks ---
    for (let i = movableBlocks.length - 1; i >= 0; i--) {
      const mb = movableBlocks[i];
      mb.update();
      if (!mb.falling && mb.vx === 0) {
        // Remove from dynamic list once rested back into grid
        movableBlocks.splice(i, 1);
      }
    }

    // --- Update Particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // --- Animation Frames ---
    player.animTimer++;
    if (Math.abs(player.vx) > 0.2 && player.onGround) {
      if (player.animTimer > 4) {
        player.animTimer = 0;
        player.animFrame = (player.animFrame + 1) % 8; // cycle run frames
      }
    } else {
      player.animFrame = 0; // idle
    }

    camera.update();
  }

  // --- Rendering Functions ---
  function render() {
    ctx.fillStyle = levelBgColor;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    if (currentState === GAME_STATE.TITLE) {
      renderTitleScreen();
      return;
    }

    if (currentState === GAME_STATE.MINIMAP) {
      renderMinimap();
      return;
    }

    const camX = Math.floor(camera.x);
    const camY = Math.floor(camera.y);

    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(MAP_W - 1, Math.floor((camX + VIRTUAL_W) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(MAP_H - 1, Math.floor((camY + VIRTUAL_H) / TILE_SIZE) + 1);

    // Water animation frame (cycles 11..14 every 12 frames)
    const waterAnimFrame = 11 + (Math.floor(gameTicks / 12) % 4);
    // Electric spark animation frame (cycles 18..19 every 8 frames)
    const sparkAnimFrame = 18 + (Math.floor(gameTicks / 8) % 2);

    // 1. Draw Map Tiles (modulo 36 prevents illusionary tiles showing as rat sprites!)
    for (let ty = startRow; ty <= endRow; ty++) {
      for (let tx = startCol; tx <= endCol; tx++) {
        const rawTid = getTileAt(tx, ty);
        if (rawTid === 0) continue;

        let tid = rawTid % 36;
        if (tid === 0) continue;

        // Animated water
        if (tid >= 11 && tid <= 14) {
          tid = waterAnimFrame;
        }
        // Animated electric sparks
        if (tid === 18 || tid === 19) {
          tid = sparkAnimFrame;
        }

        const sprite = tileBitmaps[tid];
        if (sprite) {
          const screenX = tx * TILE_SIZE - camX;
          const screenY = ty * TILE_SIZE - camY;
          ctx.drawImage(sprite, screenX, screenY);
        }
      }
    }

    // 2. Draw Movable Blocks
    for (const mb of movableBlocks) {
      mb.draw(camX, camY);
    }

    // 3. Draw Enemy Rats
    for (const enemy of enemies) {
      enemy.draw(camX, camY);
    }

    // 4. Draw Player (The Pack Rat)
    renderPlayer(camX, camY);

    // 5. Draw Particles
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.floor(p.x - camX), Math.floor(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1.0;

    // 6. Pause Overlay
    if (currentState === GAME_STATE.PAUSED) {
      renderPauseOverlay();
    } else if (currentState === GAME_STATE.GAME_OVER) {
      renderGameOverOverlay();
    } else if (currentState === GAME_STATE.LEVEL_CLEAR) {
      renderLevelClearOverlay();
    }
  }

  function renderPlayer(camX, camY) {
    // Invulnerability flashing
    if (player.invulnerableTimer > 0 && Math.floor(gameTicks / 4) % 2 === 0) {
      return;
    }

    const set = player.facing > 0 ? ratBitmaps.right : ratBitmaps.left;
    if (!set || !set.idle) return;

    let sprite = set.idle;
    let offsetY = 0;

    if (player.jumping || !player.onGround) {
      sprite = set.jump || set.idle;
    } else if (player.lookingDown) {
      sprite = set.idle;
      offsetY = 3; // duck / dislodge crouch
    } else if (player.lookingUp) {
      sprite = set.idle;
      offsetY = -2; // look up
    } else if (Math.abs(player.vx) > 0.2) {
      const walkIdx = player.animFrame % set.walk.length;
      sprite = set.walk[walkIdx] || set.idle;
    } else {
      sprite = set.idle;
    }

    if (sprite) {
      // Draw sprite centered over bounding box
      const drawX = Math.floor(player.x - camX - (sprite.width - player.w) / 2);
      const drawY = Math.floor(player.y - camY - (sprite.height - player.h) + offsetY);
      ctx.drawImage(sprite, drawX, drawY);
    }
  }

  // Minimap / Full Level Zoom Mode (Z or M key)
  function renderMinimap() {
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    const cellW = VIRTUAL_W / MAP_W; // 5 px
    const cellH = VIRTUAL_H / MAP_H; // 3.125 px

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const rawTid = getTileAt(tx, ty);
        if (rawTid === 0) continue;
        const tid = rawTid % 36;
        if (tid === 0) continue;

        if (tid === 1) ctx.fillStyle = '#8b2020'; // Brick
        else if (tid === 16) ctx.fillStyle = '#00e5ff'; // Ice Cube
        else if (tid === 17) ctx.fillStyle = '#ffd028'; // Bouncy Rubber Tube
        else if (tid >= 31 && tid <= 35) ctx.fillStyle = '#ffd028'; // Baubles
        else if (tid === 15) ctx.fillStyle = '#39ff14'; // Mouse Hole
        else if (tid >= 11 && tid <= 14) ctx.fillStyle = '#00a0dc'; // Water
        else ctx.fillStyle = '#6b7280';

        ctx.fillRect(tx * cellW, ty * cellH, cellW, cellH);
      }
    }

    // Player indicator
    const px = (player.x / TILE_SIZE) * cellW;
    const py = (player.y / TILE_SIZE) * cellH;
    ctx.fillStyle = (Math.floor(gameTicks / 8) % 2 === 0) ? '#ff2a7a' : '#ffffff';
    ctx.fillRect(px - 1, py - 1, 4, 4);

    // Title text
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd028';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${currentLevelIdx} — ZOOM VIEW (M to return)`, VIRTUAL_W / 2, 14);
  }

  function renderTitleScreen() {
    // Title background animation
    ctx.fillStyle = '#0c101a';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // Decorative retro grid lines
    ctx.strokeStyle = '#182033';
    ctx.lineWidth = 1;
    for (let x = 0; x < VIRTUAL_W; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIRTUAL_H);
      ctx.stroke();
    }
    for (let y = 0; y < VIRTUAL_H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIRTUAL_W, y);
      ctx.stroke();
    }

    // Title logo
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd028';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 208, 40, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('THE PACK RAT', VIRTUAL_W / 2, 34);
    ctx.shadowBlur = 0;

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('1992 VGA 256-COLOR CLASSIC', VIRTUAL_W / 2, 48);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#39ff14';
    ctx.fillText('CONVERTED FROM ORIGINAL .EXE BY', VIRTUAL_W / 2, 63);
    ctx.fillText('JUSTIN BOGNER, OCTOBER 2026', VIRTUAL_W / 2, 75);

    ctx.fillStyle = '#8e99b3';
    ctx.fillText('(C) 1992 BY STEVE BLANDING', VIRTUAL_W / 2, 88);

    // Animated Pack Rat sprite showcase
    const showcaseFrames = (ratBitmaps.right && ratBitmaps.right.walk && ratBitmaps.right.walk.length > 0) ? ratBitmaps.right.walk : [ratBitmaps.right?.idle];
    const showcaseSprite = showcaseFrames[Math.floor(gameTicks / 8) % showcaseFrames.length];
    if (showcaseSprite) {
      ctx.drawImage(showcaseSprite, VIRTUAL_W / 2 - 10, 102);
    }

    // Press Enter to play
    if (Math.floor(gameTicks / 30) % 2 === 0) {
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PRESS ENTER OR PLAY', VIRTUAL_W / 2, 154);
    }

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('SELECT OPTION FROM TOOLBAR BELOW', VIRTUAL_W / 2, 176);
  }

  function renderPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd028';
    ctx.textAlign = 'center';
    ctx.fillText('GAME PAUSED', VIRTUAL_W / 2, VIRTUAL_H / 2 - 10);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS ESC OR F3 TO RESUME', VIRTUAL_W / 2, VIRTUAL_H / 2 + 15);
  }

  function renderGameOverOverlay() {
    ctx.fillStyle = 'rgba(10, 0, 0, 0.85)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff2a7a';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', VIRTUAL_W / 2, VIRTUAL_H / 2 - 20);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd028';
    ctx.fillText(`FINAL SCORE: ${score}`, VIRTUAL_W / 2, VIRTUAL_H / 2 + 5);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS ENTER OR PLAY TO RETRY', VIRTUAL_W / 2, VIRTUAL_H / 2 + 30);
  }

  function renderLevelClearOverlay() {
    ctx.fillStyle = 'rgba(0, 15, 25, 0.8)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETED!', VIRTUAL_W / 2, VIRTUAL_H / 2 - 15);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd028';
    ctx.fillText('+500 BONUS POINTS!', VIRTUAL_W / 2, VIRTUAL_H / 2 + 10);
  }

  // --- Game Loop ---
  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  // --- Start Game & Mode Changes ---
  function startGame(lvlIdx = 0) {
    score = 0;
    lives = 3;
    nextLifeScore = 10000;
    currentState = GAME_STATE.PLAYING;
    loadLevel(lvlIdx);
  }

  function togglePause() {
    if (currentState === GAME_STATE.PLAYING) {
      currentState = GAME_STATE.PAUSED;
    } else if (currentState === GAME_STATE.PAUSED) {
      currentState = GAME_STATE.PLAYING;
    }
  }

  function toggleMinimap() {
    if (currentState === GAME_STATE.PLAYING) {
      currentState = GAME_STATE.MINIMAP;
    } else if (currentState === GAME_STATE.MINIMAP) {
      currentState = GAME_STATE.PLAYING;
    }
  }

  function toggleSoundSetting() {
    const isEnabled = sound.toggleSound();
    const btn = document.getElementById('btnSound');
    btn.querySelector('.lbl').textContent = `SOUND: ${isEnabled ? 'ON' : 'OFF'}`;
    btn.querySelector('.icon').textContent = isEnabled ? '🔊' : '🔇';
  }

  // --- Modal Helpers ---
  function openModal(id) {
    closeAllModals();
    const m = document.getElementById(id);
    if (m) m.classList.add('active');

    if (id === 'modalLevels') populateLevelGrid();
    if (id === 'modalScores') populateHighScores();
    if (id === 'modalEditor') setupEditor();
    if (id === 'modalControls') populateControlsList();
  }

  function closeAllModals() {
    rebindingAction = null;
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // --- Configurable Controls UI ---
  function populateControlsList() {
    const listEl = document.getElementById('controlsBindingList');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const [actionKey, binding] of Object.entries(customBindings)) {
      const row = document.createElement('div');
      row.className = 'control-row';

      const nameEl = document.createElement('div');
      nameEl.className = 'control-name';
      nameEl.textContent = binding.name;

      const badge = document.createElement('button');
      badge.className = `control-key-badge ${rebindingAction === actionKey ? 'listening' : ''}`;
      badge.textContent = rebindingAction === actionKey ? 'PRESS KEY...' : binding.keys.map(formatKeyName).join(' / ');
      badge.title = 'Click to rebind';

      badge.addEventListener('click', () => {
        rebindingAction = actionKey;
        populateControlsList();
      });

      row.appendChild(nameEl);
      row.appendChild(badge);
      listEl.appendChild(row);
    }
  }

  document.getElementById('btnResetControls')?.addEventListener('click', () => {
    customBindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    saveBindings();
    rebindingAction = null;
    populateControlsList();
  });

  // --- Level Select Grid ---
  function populateLevelGrid() {
    const grid = document.getElementById('levelGridContainer');
    grid.innerHTML = '';
    const assets = window.PACKRAT_ASSETS;
    if (!assets || !assets.levels) return;

    assets.levels.forEach((lvl, i) => {
      const card = document.createElement('div');
      card.id = `lvlBtn_${i}`;
      card.className = `level-card ${i === currentLevelIdx ? 'current' : ''}`;
      card.innerHTML = `
        <span class="level-num">LVL ${i}</span>
        <span class="level-info">Start: (${lvl.startX}, ${lvl.startY})</span>
      `;
      card.addEventListener('click', () => {
        closeAllModals();
        startGame(i);
      });
      grid.appendChild(card);
    });
  }

  // --- High Scores UI ---
  function populateHighScores() {
    const listEl = document.getElementById('highScoresList');
    const scores = getHighScores();
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="color: var(--neon-cyan); border-bottom: 1px solid #333;"><th style="text-align: left; padding: 6px;">RANK</th><th style="text-align: left; padding: 6px;">NAME</th><th style="text-align: right; padding: 6px;">SCORE</th></tr>';
    scores.forEach((s, i) => {
      html += `<tr style="border-bottom: 1px solid #222;">
        <td style="padding: 6px; color: var(--neon-gold);">${i + 1}.</td>
        <td style="padding: 6px;">${s.name}</td>
        <td style="padding: 6px; text-align: right; color: var(--neon-gold);">${s.score}</td>
      </tr>`;
    });
    html += '</table>';
    listEl.innerHTML = html;
  }

  document.getElementById('btnResetScores')?.addEventListener('click', () => {
    localStorage.removeItem('packrat_highscores');
    populateHighScores();
  });

  // --- Built-in Level Editor ---
  let selectedEditorTile = 1;

  const TILE_NAMES = {
    0: 'Empty (Air)',
    1: 'Red Brick (Solid)',
    2: 'Mousetrap (Hazard)',
    3: 'Wood Block 1 (Movable)',
    4: 'Wood Block 2 (Movable)',
    5: 'Wood Block 3 (Movable)',
    10: 'Illusion Brick (Pass-through)',
    11: 'Water Pool (Hazard)',
    15: 'Mouse Hole (Level Exit Door)',
    16: 'Stone Wall (Solid)',
    17: 'Spikes (Hazard)',
    18: 'Electric Sparks (Hazard)',
    23: 'Pipe Entrance',
    25: 'Pipe Corner NW',
    26: 'Pipe Corner NE',
    27: 'Pipe Tube Horizontal',
    28: 'Pipe Tube Vertical',
    29: 'Pipe Corner SW',
    30: 'Pipe Corner SE',
    31: 'Button (+10 Pts)',
    32: 'Silver Coin (+25 Pts)',
    33: 'Gold Coin (+50 Pts)',
    34: 'Cookie (+100 Pts)',
    35: 'Cheese (+250 Pts)'
  };

  function setupEditor() {
    const paletteEl = document.getElementById('editorPalette');
    paletteEl.innerHTML = '';
    const assets = window.PACKRAT_ASSETS;
    if (!assets) return;

    // Add empty/air tile
    const airItem = document.createElement('div');
    airItem.className = `palette-item ${selectedEditorTile === 0 ? 'selected' : ''}`;
    airItem.title = 'Air (Erase)';
    airItem.innerHTML = '<span style="font-size: 16px;">❌</span>';
    airItem.addEventListener('click', () => selectTile(0, 'Air (Erase)', airItem));
    paletteEl.appendChild(airItem);

    // Add available tiles
    for (const [idStr, tile] of Object.entries(assets.tiles)) {
      const id = parseInt(idStr, 10);
      if (id > 35) continue; // skip internal character animation frames

      const item = document.createElement('div');
      item.className = `palette-item ${selectedEditorTile === id ? 'selected' : ''}`;
      item.title = TILE_NAMES[id] || `Tile ${id}`;

      const oc = tileBitmaps[id];
      if (oc) {
        const thumb = document.createElement('canvas');
        thumb.width = oc.width;
        thumb.height = oc.height;
        thumb.getContext('2d').drawImage(oc, 0, 0);
        item.appendChild(thumb);
      }

      item.addEventListener('click', () => selectTile(id, TILE_NAMES[id] || `Tile ${id}`, item));
      paletteEl.appendChild(item);
    }
  }

  function selectTile(id, name, element) {
    selectedEditorTile = id;
    document.getElementById('editorCurrentTileName').textContent = name;
    document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
  }

  // Draw on canvas during gameplay or editor mode
  canvas.addEventListener('pointerdown', (e) => {
    if (document.getElementById('modalEditor').classList.contains('active')) {
      paintTileAtPointer(e);
    }
  });

  function paintTileAtPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_W / rect.width;
    const scaleY = VIRTUAL_H / rect.height;

    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const tx = Math.floor((screenX + camera.x) / TILE_SIZE);
    const ty = Math.floor((screenY + camera.y) / TILE_SIZE);

    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      setTileAt(tx, ty, selectedEditorTile);
      if (selectedEditorTile === 15) {
        // Set mouse hole destination
        const dest = parseInt(document.getElementById('editorHoleDest').value, 10) || 1;
        currentDestMap[ty * MAP_W + tx] = dest;
      }
      sound.play(1);
    }
  }

  document.getElementById('btnEditorTest')?.addEventListener('click', () => {
    closeAllModals();
    currentState = GAME_STATE.PLAYING;
    player.reset(levelData.startX, levelData.startY);
  });

  document.getElementById('btnEditorExport')?.addEventListener('click', () => {
    const exportData = {
      id: 999,
      bg: parseInt(document.getElementById('editorBgColor').value, 10) || 3,
      startX: levelData.startX,
      startY: levelData.startY,
      tiles: currentTiles,
      destMap: currentDestMap
    };
    const jsonStr = JSON.stringify(exportData);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('Custom Level JSON copied to clipboard!');
    }).catch(() => {
      prompt('Copy your level JSON:', jsonStr);
    });
  });

  document.getElementById('btnEditorClear')?.addEventListener('click', () => {
    if (confirm('Clear the current level and fill with air?')) {
      currentTiles = new Array(MAP_W * MAP_H).fill(0);
      // Floor at bottom
      for (let x = 0; x < MAP_W; x++) {
        currentTiles[63 * MAP_W + x] = 1;
      }
    }
  });

  // --- Toolbar Button Handlers ---
  document.getElementById('btnPlay')?.addEventListener('click', () => {
    closeAllModals();
    startGame(0);
  });

  document.getElementById('btnLevels')?.addEventListener('click', () => {
    openModal('modalLevels');
  });

  document.getElementById('btnControls')?.addEventListener('click', () => {
    openModal('modalControls');
  });

  document.getElementById('btnEditor')?.addEventListener('click', () => {
    openModal('modalEditor');
  });

  document.getElementById('btnScores')?.addEventListener('click', () => {
    openModal('modalScores');
  });

  document.getElementById('btnHelp')?.addEventListener('click', () => {
    openModal('modalHelp');
  });

  document.getElementById('btnAbout')?.addEventListener('click', () => {
    openModal('modalAbout');
  });

  document.getElementById('btnSound')?.addEventListener('click', toggleSoundSetting);

  document.getElementById('btnZoom')?.addEventListener('click', toggleMinimap);

  document.getElementById('btnCrt')?.addEventListener('click', () => {
    const overlay = document.getElementById('crtOverlay');
    const btn = document.getElementById('btnCrt');
    const isHidden = overlay.classList.toggle('hidden');
    btn.classList.toggle('active', !isHidden);
    btn.querySelector('.lbl').textContent = `CRT: ${isHidden ? 'OFF' : 'ON'}`;
  });

  document.getElementById('btnFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.getElementById('crtFrame').requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // --- Initialization ---
  preRenderAssets();
  const scores = getHighScores();
  if (scores.length > 0) highScore = scores[0].score;
  loadLevel(0);
  // Expose engine API for level select and debugging
  window.PACKRAT = {
    startGame,
    loadLevel,
    player,
    getTileAt,
    setTileAt,
    get movableBlocks() { return movableBlocks; }
  };

  requestAnimationFrame(gameLoop);
})();
