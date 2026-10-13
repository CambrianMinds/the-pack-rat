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

  // Intro Screen Memorial House Background & Foreground Tree Layer
  const houseImg = (typeof Image !== 'undefined') ? new Image() : null;
  let houseImgLoaded = false;
  const treeOverlayImg = (typeof Image !== 'undefined') ? new Image() : null;
  let treeOverlayLoaded = false;
  let treeOverlayCanvas = null;

  function buildTreeOverlay() {
    if (!houseImg || typeof document === 'undefined') return;
    try {
      const oc = document.createElement('canvas');
      oc.width = 1200;
      oc.height = 896;
      const octx = oc.getContext('2d');
      if (!octx) return;

      const tmp = document.createElement('canvas');
      tmp.width = 1200;
      tmp.height = 896;
      const tctx = tmp.getContext('2d');
      if (!tctx) return;
      tctx.drawImage(houseImg, 0, 0);

      // Foreground tree covering the sidewalk (canopy: x in 160..480, trunk: x in 305..355 down to roots)
      const minX = 160, maxX = 480;
      const minY = 120, maxY = 840;
      const w = maxX - minX;
      const h = maxY - minY;

      const srcData = tctx.getImageData(minX, minY, w, h);
      const outData = octx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        const absY = minY + y;
        for (let x = 0; x < w; x++) {
          const absX = minX + x;
          const idx = (y * w + x) * 4;

          // Below the canopy (y >= 630), restrict to trunk column
          if (absY >= 630 && (absX < 305 || absX > 355)) {
            outData.data[idx + 3] = 0;
            continue;
          }

          const r = srcData.data[idx];
          const g = srcData.data[idx + 1];
          const b = srcData.data[idx + 2];

          const isSky = (r > 170 && g > 190 && b > 200);
          const isHouse = (r > 160 && g > 130 && b < 130 && r > b + 40);
          const isSidewalk = (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && r > 115);
          const isLawn = (Math.abs(r - 35) < 12 && Math.abs(g - 84) < 12 && Math.abs(b - 24) < 12);

          let isTree = false;
          if (absY >= 630) {
            isTree = (!isSidewalk && !isLawn);
          } else {
            isTree = (!isSky && !isHouse && !isSidewalk);
          }

          if (isTree) {
            outData.data[idx] = r;
            outData.data[idx + 1] = g;
            outData.data[idx + 2] = b;
            outData.data[idx + 3] = 255;
          } else {
            outData.data[idx + 3] = 0;
          }
        }
      }

      octx.putImageData(outData, minX, minY);
      treeOverlayCanvas = oc;
    } catch (e) {
      console.warn('Could not build tree overlay:', e);
    }
  }

  if (houseImg) {
    houseImg.onload = () => {
      houseImgLoaded = true;
      if (!treeOverlayLoaded) {
        buildTreeOverlay();
      }
    };
    houseImg.src = 'house.jpg';
  }

  if (treeOverlayImg) {
    treeOverlayImg.onload = () => {
      treeOverlayLoaded = true;
      treeOverlayCanvas = treeOverlayImg;
    };
    treeOverlayImg.src = 'tree_overlay.png';
  }
  let titleRatX = 30;
  let titleRatDir = 1;

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

      const hasFloor = isTileFloorSolid(getTileAt(checkTileX, floorTileY));
      const hitsWall = isTileWallSolid(getTileAt(checkTileX, wallTileY));

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
      // Horizontal sliding/rolling (ice cubes, thread spools, crates)
      if (Math.abs(this.vx) > 0.05) {
        this.x += this.vx;
        this.vx *= 0.90;
        const checkTx = Math.floor((this.vx > 0 ? this.x + 15 : this.x) / TILE_SIZE);
        const checkTy = Math.floor((this.y + 8) / TILE_SIZE);
        if (isTileWallSolid(getTileAt(checkTx, checkTy))) {
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

      if (!isTileFloorSolid(tileBelow)) {
        this.falling = true;
        this.vy += 0.35;
        if (this.vy > 6.0) this.vy = 6.0;
        this.y += this.vy;

        // Snap to grid when landing
        const landTileY = Math.floor((this.y + 16) / TILE_SIZE);
        const landTile = getTileAt(centerTx, landTileY);
        if (isTileFloorSolid(landTile)) {
          // If falling block lands on electric wire (Tile 18)
          if (landTile === 18) {
            setTileAt(centerTx, landTileY, 19); // Sparks into 19!
            sound.play(7); // Zap sound!
          }
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

  // --- Unsupported Block Gravity (Authentic to PACKRAT.EXE 0x4182) ---
  // When an underlying block is pushed or dislodged, any blocks stacked above it fall down instead of floating in air.
  function dropStackedBlocksAbove(baseTx, baseTy) {
    let checkTy = baseTy - 1;
    while (checkTy >= 0) {
      const tidAbove = getTileAt(baseTx, checkTy);
      // Movable blocks: ice cubes (16), dislodgeable bricks (10), crates (3..9)
      // Note: Thread spools (17) in climbing columns are anchor shafts and do not drop
      if (tidAbove === 16 || tidAbove === 10 || (tidAbove >= 3 && tidAbove <= 9)) {
        setTileAt(baseTx, checkTy, 0); // Remove from static grid
        const blk = new MovableBlock(baseTx, checkTy, tidAbove);
        blk.falling = true;
        blk.vy = 0.8;
        movableBlocks.push(blk);
        checkTy--;
      } else {
        break;
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
    h: 28,
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
    jumpTimer: 0,
    invulnerableTimer: 0,
    dislodgeTimer: 0,
    ignoreSpoolY: -1,
    spoolDropCooldown: 0,

    reset(startX, startY) {
      this.x = startX * TILE_SIZE + 1;
      this.y = (startY + 1) * TILE_SIZE - this.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.jumping = false;
      this.pushing = false;
      this.lookingUp = false;
      this.lookingDown = false;
      this.inPipe = false;
      this.jumpTimer = 0;
      this.animFrame = 0;
      this.animTimer = 0;
      this.invulnerableTimer = 60; // 1 second immunity
      this.ignoreSpoolY = -1;
      this.spoolDropCooldown = 0;
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
        killPlayer(4, true);
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
      case 'KeyC':
        if (!e.ctrlKey && !e.altKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
          toggleCrt();
          e.preventDefault();
        }
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

  // --- Authentic Tile Classification (Extracted directly from PACKRAT.EXE) ---
  function getTileAt(tx, ty) {
    if (tx < 0 || tx >= MAP_W) return 1; // Left & right screen borders are solid brick walls
    if (ty < 0) return 0; // Sky above map is open
    if (ty >= MAP_H) return 0; // Bottom of map is an open pit / void (Photo 2)! NOT solid brick!
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

  // Table DS:0x366 from PACKRAT.EXE (vertical floor / standable)
  function isTileFloorSolid(id) {
    if (id >= 36) return false; // Illusionary pass-through tiles
    // 1 = Brick, 10 = Dislodgeable Brick, 16 = Ice Cube/Stone, 17 = Thread Spool
    // 20 = Left Spool/Pulley, 21 = Red Rubber Band, 22 = Right Spool/Pulley
    // 3..9 = Movable Crates
    if (id === 1 || id === 10 || id === 16 || id === 17) return true;
    if (id === 20 || id === 21 || id === 22) return true;
    if (id >= 3 && id <= 9) return true;
    return false;
  }

  // Table DS:0x3f6 from PACKRAT.EXE (horizontal wall collision)
  function isTileWallSolid(id) {
    if (id >= 36) return false; // Illusionary pass-through
    // Only bricks (1, 10), ice blocks (16), and crates (3..9) block horizontal movement.
    // Thread spools (17), pulleys (20, 22), and rubber bands (21) do NOT block walking through horizontally!
    if (id === 1 || id === 10 || id === 16) return true;
    if (id >= 3 && id <= 9) return true;
    return false;
  }

  // Table DS:0x3ae from PACKRAT.EXE (ceiling upward jump collision)
  function isTileCeilingSolid(id) {
    if (id >= 36) return false; // Illusionary pass-through
    // Only bricks (1, 10), ice blocks (16), and crates (3..9) block upward jumping.
    // Thread spools (17), pulleys (20, 22), and rubber bands (21) allow jumping up through them!
    if (id === 1 || id === 10 || id === 16) return true;
    if (id >= 3 && id <= 9) return true;
    return false;
  }

  function isTileSolid(id) {
    return isTileFloorSolid(id);
  }

  function isTileMovable(id) {
    if (id >= 36) return false;
    // Crates (3..9), Brick 10, Ice Cubes (16), Thread Spool (17)
    return (id >= 3 && id <= 10) || id === 16 || id === 17;
  }

  function isTileHazard(id) {
    if (id >= 36) return false; // Illusionary decoy tiles are non-lethal
    // Tile 2: Mousetrap, Tile 11..14: Water, Tile 18: Electric Wire, Tile 19: Sparked Wire
    return id === 2 || (id >= 11 && id <= 14) || id === 18 || id === 19;
  }

  function isTileBauble(id) {
    if (id >= 36) return false;
    return id >= 31 && id <= 35;
  }

  // --- Electric Currents on Green Wires ---
  let electricCurrents = [];

  class ElectricCurrent {
    constructor(points, isLoop = false, initialProgress = 0) {
      this.points = points;
      this.isLoop = isLoop;
      this.speed = 1.6;
      this.dir = 1;
      this.progress = initialProgress;
      this.x = points[0] ? points[0].x : 0;
      this.y = points[0] ? points[0].y : 0;

      this.cumDist = [0];
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        this.cumDist.push(this.cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
      }
      this.totalDist = this.cumDist[this.cumDist.length - 1] || 1;
      this.progress = (initialProgress % this.totalDist + this.totalDist) % this.totalDist;
      this.updatePos();
    }

    updatePos() {
      if (this.points.length <= 1) return;
      let d = this.progress;
      if (d < 0) d = 0;
      if (d > this.totalDist) d = this.totalDist;

      let seg = 0;
      while (seg < this.cumDist.length - 1 && this.cumDist[seg + 1] < d) {
        seg++;
      }
      const segStart = this.cumDist[seg];
      const segLen = this.cumDist[seg + 1] - segStart;
      const t = (segLen > 0) ? (d - segStart) / segLen : 0;
      const p1 = this.points[seg];
      const p2 = this.points[seg + 1] || p1;

      this.x = p1.x + (p2.x - p1.x) * t;
      this.y = p1.y + (p2.y - p1.y) * t;
    }

    update() {
      if (this.points.length <= 1) return;

      this.progress += this.dir * this.speed;

      if (this.isLoop) {
        if (this.progress >= this.totalDist) {
          this.progress -= this.totalDist;
        } else if (this.progress < 0) {
          this.progress += this.totalDist;
        }
      } else {
        if (this.progress >= this.totalDist) {
          this.progress = this.totalDist;
          this.dir = -1; // Reverse along the wire!
        } else if (this.progress <= 0) {
          this.progress = 0;
          this.dir = 1; // Reverse forward!
        }
      }

      this.updatePos();

      // Emit subtle electric sparks
      if (Math.random() < 0.2) {
        addSparkles(this.x, this.y, '#00e5ff', 1);
      }

      // Check collision with player (lethal electrocution hazard)
      if (currentState === GAME_STATE.PLAYING && player.invulnerableTimer <= 0) {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dx = Math.abs(this.x - px);
        const dy = Math.abs(this.y - py);
        if (dx < (player.w / 2 + 5) && dy < (player.h / 2 + 5)) {
          sound.play(4); // Electric shock sound
          addSparkles(this.x, this.y, '#ffd028', 12);
          addSparkles(this.x, this.y, '#00e5ff', 10);
          addSparkles(this.x, this.y, '#ffffff', 8);
          killPlayer();
        }
      }
    }

    draw(camX, camY) {
      const sx = this.x - camX;
      const sy = this.y - camY;

      if (sx < -32 || sx > VIRTUAL_W + 32 || sy < -32 || sy > VIRTUAL_H + 32) return;

      // Authentic electrical spark sprite from PACKRAT.EXE (Tile 18/19)
      const sparkSprite = (Math.floor(gameTicks / 4) % 2 === 0) ? tileBitmaps[18] : tileBitmaps[19];
      if (sparkSprite) {
        ctx.drawImage(sparkSprite, Math.floor(sx - 16), Math.floor(sy - 4));
      }

      // Dynamic electrical corona & crackle lightning arc
      ctx.save();
      const glowR = 5 + Math.sin(gameTicks * 0.4) * 2;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.fill();

      // Bright white core
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Electric arc spark
      ctx.strokeStyle = '#ffd028';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const angle = (gameTicks * 0.8) % (Math.PI * 2);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * 7 + (Math.random() - 0.5) * 3, sy + Math.sin(angle) * 7 + (Math.random() - 0.5) * 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  function findElectricCircuits() {
    electricCurrents = [];
    const isWire = (t) => (t >= 23 && t <= 30);
    const visited = new Set();
    const dirs = [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }
    ];

    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const tid = getTileAt(x, y);
          const isStart = (pass === 0) ? (tid === 23) : (isWire(tid) && !visited.has(y * MAP_W + x));
          if (!isStart || visited.has(y * MAP_W + x)) continue;

          visited.add(y * MAP_W + x);
          const path = [{ x: x * TILE_SIZE + 7, y: y * TILE_SIZE + 7 }];
          let cx = x, cy = y, prevX = -1, prevY = -1;
          let isLoop = false;

          let searching = true;
          while (searching && path.length < 250) {
            searching = false;
            for (const d of dirs) {
              const nx = cx + d.dx;
              const ny = cy + d.dy;
              if (nx === prevX && ny === prevY) continue;
              if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
              const nTid = getTileAt(nx, ny);
              if (isWire(nTid)) {
                if (nx === x && ny === y) {
                  isLoop = true;
                  path.push({ x: nx * TILE_SIZE + 7, y: ny * TILE_SIZE + 7 });
                  break;
                }
                visited.add(ny * MAP_W + nx);
                prevX = cx; prevY = cy;
                cx = nx; cy = ny;
                path.push({ x: cx * TILE_SIZE + 7, y: cy * TILE_SIZE + 7 });
                searching = (nTid !== 24);
                break;
              }
            }
          }

          if (path.length >= 2) {
            const initialOffset = electricCurrents.length * 40;
            electricCurrents.push(new ElectricCurrent(path, isLoop, initialOffset));
          }
        }
      }
    }
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

    // Initialize Movable Blocks, Enemies, and Electric Currents
    movableBlocks = [];
    enemies = [];
    particles = [];
    electricCurrents = [];
    findElectricCircuits();

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
    document.getElementById('hudLevel').textContent = String(currentLevelIdx + 1);
    
    let lifeIcons = '';
    for (let i = 0; i < lives; i++) {
      lifeIcons += '🐀 ';
    }
    document.getElementById('hudLives').textContent = lifeIcons || '💀';
  }

  // --- Player Actions & Physics ---
  function handleJump() {
    if (player.onGround && !player.inPipe) {
      // Check surface under feet (rubber band 21 or thread spool 17 gives extra bounce!)
      const feetY = Math.floor((player.y + player.h + 1) / TILE_SIZE);
      const curLeftTile = Math.floor((player.x + 2) / TILE_SIZE);
      const curRightTile = Math.floor((player.x + player.w - 2) / TILE_SIZE);
      const footTile = getTileAt(curLeftTile, feetY) || getTileAt(curRightTile, feetY);

      if (footTile === 21) {
        player.vy = -9.2; // Rubber band trampoline super jump!
        addSparkles(player.x + player.w / 2, player.y + player.h, '#ff2a7a', 10);
      } else {
        player.vy = -6.4; // Normal jump
        addSparkles(player.x + player.w / 2, player.y + player.h, '#ffffff', 4);
      }
      player.onGround = false;
      player.jumping = true;
      player.jumpTimer = 4; // up to 4 frames of variable jump height
      sound.play(0); // Jump/spring sound
    }
  }

  function killPlayer(soundId = 4, force = false) {
    if (!force && player.invulnerableTimer > 0) return;

    lives--;
    updateHud();
    sound.play(soundId);
    addSparkles(player.x + player.w / 2, player.y + player.h / 2, '#ff2a7a', 20);

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

  // Dislodge block beneath player or in front of feet when crouching
  // Tile 10 (dislodgeable brick) takes 5 hits; Tile 16 (ice block) takes 3 hits (PACKRAT.EXE 0x3906)
  const dislodgeHitMap = {};
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
      if (t === 10 || t === 16 || (t >= 3 && t <= 9)) {
        targetTx = testTx;
        tid = t;
        break;
      }
    }

    if (targetTx >= 0) {
      const key = `${targetTx},${feetY}`;
      dislodgeHitMap[key] = (dislodgeHitMap[key] || 0) + 1;
      const reqHits = (tid === 10) ? 5 : (tid === 16 ? 3 : 2);

      if (dislodgeHitMap[key] >= reqHits) {
        delete dislodgeHitMap[key];
        setTileAt(targetTx, feetY, 0); // Dislodged! Removed from grid
        sound.play(5); // Bump / dislodge sound
        const pColor = (tid === 16) ? '#00e5ff' : '#ffd028';
        addSparkles(targetTx * TILE_SIZE + 8, feetY * TILE_SIZE + 8, pColor, 12);
        movableBlocks.push(new MovableBlock(targetTx, feetY, tid));
        dropStackedBlocksAbove(targetTx, feetY);
      } else {
        sound.play(5); // Warning bump
        addSparkles(targetTx * TILE_SIZE + 8, feetY * TILE_SIZE + 4, '#8b2020', 3);
      }
    }
  }

  // Push movable block (Thread spools 17 roll on 1 hit; ice cubes 16 push on 3 hits; bricks 10 on 5 hits)
  const pushHitMap = {};
  function tryPushBlock(dir) {
    const checkX = player.x + (dir > 0 ? player.w + 4 : -4);
    const tx = Math.floor(checkX / TILE_SIZE);

    let ty = Math.floor((player.y + player.h / 2) / TILE_SIZE);
    let tid = getTileAt(tx, ty);
    if (!isTileMovable(tid)) {
      ty = Math.floor((player.y + player.h - 4) / TILE_SIZE);
      tid = getTileAt(tx, ty);
    }

    if (isTileMovable(tid)) {
      const key = `${tx},${ty}`;
      pushHitMap[key] = (pushHitMap[key] || 0) + 1;
      const reqPushes = (tid === 17) ? 1 : ((tid === 16) ? 3 : ((tid === 10) ? 5 : 2));

      if (pushHitMap[key] >= reqPushes) {
        delete pushHitMap[key];
        const destTx = tx + dir;
        const targetTile = getTileAt(destTx, ty);

        // Can only push into empty air / non-solid spaces (cannot push into solid walls, traps, or rubber bands)
        if (!isTileWallSolid(targetTile) && targetTile !== 2 && targetTile !== 17 && targetTile !== 20 && targetTile !== 21 && targetTile !== 22) {
          setTileAt(tx, ty, 0);
          sound.play(6); // Push block sound
          const blk = new MovableBlock(destTx, ty, tid);
          if (tid === 16) {
            blk.vx = dir * 2.4; // Ice cube slides horizontally!
            addSparkles(destTx * TILE_SIZE + 8, ty * TILE_SIZE + 8, '#00e5ff', 6);
          } else if (tid === 17) {
            blk.vx = dir * 1.5; // Thread spool rolls!
            addSparkles(destTx * TILE_SIZE + 8, ty * TILE_SIZE + 8, '#ffd028', 6);
          }
          movableBlocks.push(blk);
          player.pushing = true;
          dropStackedBlocksAbove(tx, ty);
        }
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

    // Update Moving Electric Currents on Green Wires
    for (const ec of electricCurrents) {
      ec.update();
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

    if (player.spoolDropCooldown > 0) {
      player.spoolDropCooldown--;
    }

    // Slippery physics when on Ice Cubes (Tile 16)
    const feetCheckY = Math.floor((player.y + player.h + 1) / TILE_SIZE);
    const feetCheckX1 = Math.floor((player.x + 2) / TILE_SIZE);
    const feetCheckX2 = Math.floor((player.x + player.w - 2) / TILE_SIZE);
    const onIce = player.onGround && (getTileAt(feetCheckX1, feetCheckY) === 16 || getTileAt(feetCheckX2, feetCheckY) === 16);

    // Thread Spool (Tile 17) Column Traversal & Step-Down
    const midTy = Math.floor((player.y + player.h / 2) / TILE_SIZE);
    const onSpool = player.onGround && (getTileAt(feetCheckX1, feetCheckY) === 17 || getTileAt(feetCheckX2, feetCheckY) === 17);
    const touchingSpool = (getTileAt(centerTx, midTy) === 17) || (getTileAt(centerTx, feetCheckY) === 17);

    // Stepping down spool-by-spool when Down key is held/pressed on a thread spool
    if (onSpool && keys.down) {
      if (player.spoolDropCooldown <= 0) {
        player.ignoreSpoolY = feetCheckY;
        player.spoolDropCooldown = 18; // Controlled 18-frame (~300ms) cadence for traversing down one by one
        player.y += 3;
        player.vy = 2.2;
        player.onGround = false;
      }
    }

    // Climbing up thread spool column with Up key
    if (touchingSpool && keys.up && !keys.jump) {
      player.vy = -1.8; // Controlled vertical climbing up the spool shaft
      player.onGround = false;
    }

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

    // Variable height jumping while jump key is held (authentic DOS feel from PACKRAT.EXE 0x0e23)
    if (keys.jump && player.jumpTimer > 0 && player.vy < 0) {
      player.vy -= 0.35;
      player.jumpTimer--;
    } else {
      player.jumpTimer = 0;
    }


    // --- Horizontal Collision ---
    player.x += player.vx;
    const leftTile = Math.floor(player.x / TILE_SIZE);
    const rightTile = Math.floor((player.x + player.w) / TILE_SIZE);
    const topTile = Math.floor(player.y / TILE_SIZE);
    const bottomTile = Math.floor((player.y + player.h - 1) / TILE_SIZE);

    if (player.vx > 0) {
      for (let ty = topTile; ty <= bottomTile; ty++) {
        if (isTileWallSolid(getTileAt(rightTile, ty))) {
          player.x = rightTile * TILE_SIZE - player.w - 0.01;
          player.vx = 0;
          break;
        }
      }
    } else if (player.vx < 0) {
      for (let ty = topTile; ty <= bottomTile; ty++) {
        if (isTileWallSolid(getTileAt(leftTile, ty))) {
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
    const curLeftTile = Math.floor((player.x + 1) / TILE_SIZE);
    const curRightTile = Math.floor((player.x + player.w - 1) / TILE_SIZE);

    player.onGround = false;

    if (player.vy > 0) {
      for (let tx = curLeftTile; tx <= curRightTile; tx++) {
        const tid = getTileAt(tx, newBottomTile);
        if (isTileFloorSolid(tid)) {
          // If traversing down through a thread spool column, ignore the current spool being passed
          if (tid === 17 && newBottomTile <= player.ignoreSpoolY) {
            continue;
          }
          if (tid === 21) {
            // Authentic rubber band trampoline bounce from PACKRAT.EXE (0x1a78: vy = (4 - vy) * 0.8)
            const incoming = Math.max(player.vy, 3.2);
            const bounceImpulse = keys.jump ? -9.2 : Math.min(-6.8, (4 - incoming) * 0.85);
            player.y = newBottomTile * TILE_SIZE - player.h;
            player.vy = bounceImpulse;
            player.onGround = false;
            player.jumping = true;
            sound.play(0); // Jump/spring sound
            addSparkles(player.x + player.w / 2, newBottomTile * TILE_SIZE, '#ff2a7a', 8);
            addSparkles(player.x + player.w / 2, newBottomTile * TILE_SIZE, '#ffffff', 6);
            break;
          } else {
            // Solid floor landing (Bricks 1/10, Ice 16, Thread Spool 17, Pulleys 20/22, Crates 3..9)
            player.y = newBottomTile * TILE_SIZE - player.h;
            player.vy = 0;
            player.onGround = true;
            player.jumping = false;
            if (tid !== 17 || newBottomTile > player.ignoreSpoolY) {
              player.ignoreSpoolY = -1;
            }
            break;
          }
        }
      }
    } else if (player.vy < 0) {
      for (let tx = curLeftTile; tx <= curRightTile; tx++) {
        if (isTileCeilingSolid(getTileAt(tx, newTopTile))) {
          player.y = (newTopTile + 1) * TILE_SIZE;
          player.vy = 0;
          break;
        }
      }
    }

    // --- Out of Bounds / Pit Fall Death (Photo 2) ---
    if (player.y + player.h >= MAP_H * TILE_SIZE) {
      killPlayer(4, true); // Instant pit death with sad jingle! (force = true ignores invulnerability)
      return;
    }
    if (player.y > camera.y + VIRTUAL_H + 20 && player.vy > 0) {
      killPlayer(4, true); // Fell off bottom of visible screen
      return;
    }

    // --- Tile Interactions & Pickups ---
    const checkTiles = [
      { tx: Math.floor((player.x + 2) / TILE_SIZE), ty: Math.floor((player.y + 4) / TILE_SIZE) },
      { tx: Math.floor((player.x + player.w - 2) / TILE_SIZE), ty: Math.floor((player.y + 4) / TILE_SIZE) },
      { tx: Math.floor((player.x + player.w / 2) / TILE_SIZE), ty: Math.floor((player.y + player.h / 2) / TILE_SIZE) },
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
        if (tid === 2) {
          killPlayer(8); // Mousetrap snap!
        } else if (tid >= 11 && tid <= 14) {
          killPlayer(10); // Water splash!
        } else if (tid === 18 || tid === 19) {
          if (tid === 18) setTileAt(pt.tx, pt.ty, 19); // Sparks into shorted wire!
          killPlayer(7); // Electric zap!
        } else {
          killPlayer(4);
        }
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
        killPlayer(9); // Enemy rat bite sound!
        return;
      }
    }

    // --- Moving Electric Currents on Green Wires ---
    for (const ec of electricCurrents) {
      ec.update();
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

        // Animated water (Authentic 32-step lookup table from PACKRAT.EXE at DS:0x346)
        if (tid >= 11 && tid <= 14) {
          const WATER_ANIM_TABLE = [1, 2, 3, 3, 2, 1, 0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          const animOffset = WATER_ANIM_TABLE[(Math.floor(gameTicks / 2)) % 32];
          tid = 11 + animOffset;
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

          // Dynamic liquid water surface wave ripple and light glints
          if (rawTid % 36 >= 11 && rawTid % 36 <= 14) {
            const ripplePhase = (gameTicks * 0.18) % (Math.PI * 2);
            const waveH = 2 + Math.sin(ripplePhase) * 1.5;
            ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
            ctx.fillRect(screenX + 4, screenY + 4, 24, waveH);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            const glintX = screenX + 5 + ((gameTicks * 1.6) % 22);
            ctx.fillRect(glintX, screenY + 4, 3, 1.5);
          }
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

    // 4. Draw Moving Electric Currents on Green Wires
    for (const ec of electricCurrents) {
      ec.draw(camX, camY);
    }

    // 5. Draw Player (The Pack Rat)
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
        else if (tid === 17) ctx.fillStyle = '#ffd028'; // Thread Spool
        else if (tid === 20 || tid === 22) ctx.fillStyle = '#64748b'; // Pulley / Spool
        else if (tid === 21) ctx.fillStyle = '#ff2a7a'; // Red Rubber Band
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
    ctx.fillText(`LEVEL ${currentLevelIdx + 1} — ZOOM VIEW (M to return)`, VIRTUAL_W / 2, 14);
  }

  function renderTitleScreen() {
    if (houseImgLoaded && houseImg) {
      // Draw memorial house background without squishing (exact 1.6 aspect ratio crop)
      // Source image is 1200x896; cropping 1200x750 from y=120 frames the house roof apex, garage, driveway, and sidewalk perfectly
      ctx.drawImage(houseImg, 0, 120, 1200, 750, 0, 0, VIRTUAL_W, VIRTUAL_H);
    } else {
      // Fallback retro grid
      ctx.fillStyle = '#0c101a';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
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
    }

    // The Pack Rat walking back and forth along the sidewalk!
    titleRatX += titleRatDir * 0.9;
    if (titleRatX >= 285) {
      titleRatX = 285;
      titleRatDir = -1;
    } else if (titleRatX <= 15) {
      titleRatX = 15;
      titleRatDir = 1;
    }

    const set = titleRatDir > 0 ? ratBitmaps.right : ratBitmaps.left;
    const frames = (set && set.walk && set.walk.length > 0) ? set.walk : [set?.idle];
    const walkIdx = Math.floor(gameTicks / 4) % (frames ? frames.length : 1);
    const sprite = frames ? frames[walkIdx] : null;

    if (sprite) {
      // Sidewalk walking line is at y ≈ 166..185 on 320x200 canvas
      // Sprite height is ~31px, so drawing at y = 144 places feet right on the sidewalk!
      const ratY = 144;
      ctx.drawImage(sprite, Math.floor(titleRatX), ratY);
    }

    // Foreground tree layer: rat walks BEHIND the tree trunk!
    if (treeOverlayCanvas) {
      ctx.drawImage(treeOverlayCanvas, 0, 120, 1200, 750, 0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    // Flashing "PRESS ENTER TO PLAY" beneath the sidewalk under the rat
    if (Math.floor(gameTicks / 20) % 2 === 0) {
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('PRESS ENTER TO PLAY', VIRTUAL_W / 2, 194);
      ctx.fillStyle = '#ffd028';
      ctx.fillText('PRESS ENTER TO PLAY', VIRTUAL_W / 2, 194);
    }
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
    ctx.fillText('PRESS ENTER TO RETRY', VIRTUAL_W / 2, VIRTUAL_H / 2 + 30);
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

  function updateSoundButton() {
    const btn = document.getElementById('btnSound');
    if (btn) {
      const lbl = btn.querySelector('.lbl');
      if (lbl) lbl.textContent = `SOUND: ${sound.enabled ? 'ON' : 'OFF'}`;
      const icon = btn.querySelector('.icon');
      if (icon) icon.textContent = sound.enabled ? '🔊' : '🔇';
    }
  }

  function toggleSoundSetting() {
    const isEnabled = sound.toggleSound();
    updateSoundButton();
    return isEnabled;
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
        <span class="level-num">LVL ${i + 1}</span>
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

  function toggleCrt(forceState) {
    const overlay = document.getElementById('crtOverlay');
    const btn = document.getElementById('btnCrt');
    if (!overlay || !btn) return false;
    const isHidden = (typeof forceState === 'boolean') 
      ? !forceState 
      : overlay.classList.toggle('hidden');
    overlay.classList.toggle('hidden', isHidden);
    btn.classList.toggle('active', !isHidden);
    const lbl = btn.querySelector('.lbl');
    if (lbl) lbl.textContent = `CRT: ${isHidden ? 'OFF' : 'ON'}`;
    try {
      localStorage.setItem('packrat_crt', isHidden ? '0' : '1');
    } catch (e) {}
    return !isHidden;
  }

  document.getElementById('btnCrt')?.addEventListener('click', () => toggleCrt());

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
  updateSoundButton();

  // CRT Shader: OFF by default unless user explicitly saved ON (1)
  try {
    const savedCrt = localStorage.getItem('packrat_crt');
    if (savedCrt === '1') {
      toggleCrt(true);
    } else {
      toggleCrt(false);
    }
  } catch (e) {
    toggleCrt(false);
  }

  loadLevel(0);

  // Expose comprehensive engine API for level select, testing, and debugging
  window.PACKRAT = {
    // Sound control
    sound,
    setSoundEnabled(val) {
      if (val) sound.unmute(); else sound.mute();
      updateSoundButton();
      return sound.enabled;
    },
    // CRT Shader control
    toggleCrt,
    setCrtEnabled(val) { return toggleCrt(!!val); },
    get isCrtEnabled() {
      const overlay = document.getElementById('crtOverlay');
      return overlay ? !overlay.classList.contains('hidden') : false;
    },
    // Game lifecycle & state
    GAME_STATE,
    get state() { return currentState; },
    set state(s) { currentState = s; },
    get score() { return score; },
    set score(s) { score = s; updateHud(); },
    get lives() { return lives; },
    set lives(l) { lives = l; updateHud(); },
    get highScore() { return highScore; },
    get currentLevelIdx() { return currentLevelIdx; },
    get levelData() { return levelData; },
    startGame,
    loadLevel,
    completeLevel,
    killPlayer,
    gameOver,
    togglePause,
    toggleMinimap,
    // Entities & input
    player,
    camera,
    keys,
    get enemies() { return enemies; },
    set enemies(e) { enemies = e; },
    get movableBlocks() { return movableBlocks; },
    get particles() { return particles; },
    get electricCurrents() { return electricCurrents; },
    // Tiles & collisions
    getTileAt,
    setTileAt,
    getDestAt,
    isTileFloorSolid,
    isTileWallSolid,
    isTileCeilingSolid,
    isTileMovable,
    isTileHazard,
    isTileBauble,
    // Mechanics
    handleJump,
    tryPushBlock,
    dislodgeBlockBelow,
    addScore,
    updateHud,
    // Stepping & physics simulation
    update,
    render,
    get treeOverlayCanvas() { return treeOverlayCanvas; },
    get houseImgLoaded() { return houseImgLoaded; },
    get titleRatX() { return titleRatX; },
    set titleRatX(v) { titleRatX = v; },
    step(frames = 1) {
      for (let i = 0; i < frames; i++) {
        update();
      }
    }
  };

  requestAnimationFrame(gameLoop);
})();
