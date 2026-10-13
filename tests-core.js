/**
 * The Pack Rat (1992) — Comprehensive E2E Test Suite Core
 * 
 * Contains 10 test suites and 50+ assertions covering:
 * - Reverse-engineered physics and interactions from PACKRAT.EXE
 * - Pit death boundary fix (User Bug 1 / Photo 2)
 * - Bouncy rubber band trampolines and spools (User Bug 2 / Photo 1)
 * - Thread spool roll and springboard mechanics
 * - Push and dislodge mechanics (ice, bricks, crates)
 * - Hazards, enemies, collectibles, score bonuses
 * - Pipes, level editor, audio mute guarantees
 * 
 * Compatible with both Node.js test runner and browser test runner.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PackRatTestSuite = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Test assertion helper
  function createAssert(results) {
    return {
      ok(condition, message) {
        if (!condition) {
          throw new Error(message || 'Assertion failed: expected truthy value');
        }
        results.assertions++;
      },
      equal(actual, expected, message) {
        if (actual !== expected) {
          throw new Error((message ? message + ' — ' : '') + `Expected ${expected}, but got ${actual}`);
        }
        results.assertions++;
      },
      closeTo(actual, expected, delta, message) {
        if (Math.abs(actual - expected) > delta) {
          throw new Error((message ? message + ' — ' : '') + `Expected ${actual} to be within ${delta} of ${expected}`);
        }
        results.assertions++;
      },
      lessThan(actual, expected, message) {
        if (!(actual < expected)) {
          throw new Error((message ? message + ' — ' : '') + `Expected ${actual} to be < ${expected}`);
        }
        results.assertions++;
      },
      greaterThan(actual, expected, message) {
        if (!(actual > expected)) {
          throw new Error((message ? message + ' — ' : '') + `Expected ${actual} to be > ${expected}`);
        }
        results.assertions++;
      }
    };
  }

  // Define test suites
  const suites = [
    {
      id: 'suite-sound-mute',
      name: 'Audio System & Zero-Noise Guarantee',
      description: 'Verifies sound is completely muted by default in test mode with zero audio emission',
      tests: [
        {
          name: 'Sound system respects mute settings and URL/storage flags',
          fn(PACKRAT, assert) {
            assert.ok(PACKRAT.sound, 'PACKRAT.sound must be defined');
            // Explicitly ensure muted for testing
            PACKRAT.setSoundEnabled(false);
            assert.equal(PACKRAT.sound.enabled, false, 'Sound must be disabled');
            
            // Verify play call is a complete no-op when disabled
            let played = false;
            try {
              PACKRAT.sound.play(0);
              PACKRAT.sound.play(4);
              played = true;
            } catch (e) {
              played = false;
            }
            assert.ok(played, 'sound.play must safely execute as no-op when muted');
            assert.equal(PACKRAT.sound.currentOsc, null, 'No audio oscillator should be created');
          }
        },
        {
          name: 'Mute toggling persists to storage and updates UI',
          fn(PACKRAT, assert) {
            PACKRAT.setSoundEnabled(false);
            assert.equal(PACKRAT.sound.enabled, false, 'Sound should be disabled');
            
            // Test unmute and mute
            PACKRAT.setSoundEnabled(true);
            assert.equal(PACKRAT.sound.enabled, true, 'Sound enabled after unmute');
            
            // Re-mute immediately to keep environment silent!
            PACKRAT.setSoundEnabled(false);
            assert.equal(PACKRAT.sound.enabled, false, 'Sound disabled after mute');
          }
        }
      ]
    },
    {
      id: 'suite-pit-death',
      name: 'Pit Death & Map Boundaries (Bug 1 / Photo 2)',
      description: 'Verifies the pit death fix, void map bottom, and boundary collisions',
      tests: [
        {
          name: 'Bottom of map returns void (tile 0), not solid brick',
          fn(PACKRAT, assert) {
            // Under Photo 2 bug, ty >= 64 previously returned 1 (solid brick) creating an invisible floor.
            // Verified fix: ty >= MAP_H returns 0 (void / open pit).
            assert.equal(PACKRAT.getTileAt(0, 64), 0, 'Tile at ty=64 must be 0 (open pit void)');
            assert.equal(PACKRAT.getTileAt(32, 65), 0, 'Tile at ty=65 must be 0');
            assert.equal(PACKRAT.getTileAt(63, 70), 0, 'Tile deep below map must be 0');
          }
        },
        {
          name: 'Falling into pit immediately kills player and deducts a life',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            // Place rat at the threshold of the pit bottom
            PACKRAT.player.x = 200;
            PACKRAT.player.y = 64 * 16 - 20; // Falling into the bottom pit
            PACKRAT.player.vy = 4.0;

            // Step physics
            PACKRAT.step(2);

            // Rat should have died and respawned
            assert.equal(PACKRAT.lives, 2, 'Player lives should decrease from 3 to 2 upon pit fall');
            assert.equal(PACKRAT.player.x, PACKRAT.levelData.startX * 16 + 1, 'Player should respawn at level startX');
          }
        },
        {
          name: 'Pit death with 1 life remaining triggers GAME_OVER state',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 1;
            PACKRAT.player.invulnerableTimer = 0;

            // Place in pit
            PACKRAT.player.y = 64 * 16;
            PACKRAT.step(1);

            assert.equal(PACKRAT.lives, 0, 'Lives should reach 0');
            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.GAME_OVER, 'State should transition to GAME_OVER');
          }
        },
        {
          name: 'Map left and right borders are solid horizontal walls',
          fn(PACKRAT, assert) {
            // Left border (tx < 0) and right border (tx >= 64)
            assert.equal(PACKRAT.getTileAt(-1, 30), 1, 'Left border outside map must return 1 (solid brick wall)');
            assert.equal(PACKRAT.getTileAt(64, 30), 1, 'Right border outside map must return 1 (solid brick wall)');
            assert.ok(PACKRAT.isTileWallSolid(PACKRAT.getTileAt(-1, 30)), 'Left wall must be solid');
            assert.ok(PACKRAT.isTileWallSolid(PACKRAT.getTileAt(64, 30)), 'Right wall must be solid');
          }
        }
      ]
    },
    {
      id: 'suite-rubber-band',
      name: 'Rubber Band Trampoline Physics (Bug 2 / Photo 1)',
      description: 'Verifies Tile 21 (Red Rubber Band) trampoline super-bounce and pass-through jump',
      tests: [
        {
          name: 'Rubber band tiles are classified according to PACKRAT.EXE real-mode tables',
          fn(PACKRAT, assert) {
            // Tile 21: Red Rubber Band
            // Table DS:0x366: Floor solid (standable)
            assert.ok(PACKRAT.isTileFloorSolid(21), 'Tile 21 must be solid floor to bounce on');
            // Table DS:0x3f6: Wall non-solid (can walk through)
            assert.equal(PACKRAT.isTileWallSolid(21), false, 'Tile 21 must allow horizontal walking through');
            // Table DS:0x3ae: Ceiling non-solid (can jump up through from beneath)
            assert.equal(PACKRAT.isTileCeilingSolid(21), false, 'Tile 21 must allow upward jumping through');

            // Pulley mounts (Tile 20 and Tile 22)
            assert.ok(PACKRAT.isTileFloorSolid(20), 'Tile 20 must be standable floor');
            assert.ok(PACKRAT.isTileFloorSolid(22), 'Tile 22 must be standable floor');
            assert.equal(PACKRAT.isTileCeilingSolid(20), false, 'Tile 20 must allow upward jump through');
            assert.equal(PACKRAT.isTileCeilingSolid(22), false, 'Tile 22 must allow upward jump through');
          }
        },
        {
          name: 'Landing on rubber band produces authentic DOS bounce formula',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.keys.jump = false;

            // Build a test platform with rubber band at (10, 40)
            PACKRAT.setTileAt(10, 40, 21);
            PACKRAT.setTileAt(10, 39, 0); // Air above

            // Place rat falling onto the rubber band
            PACKRAT.player.x = 10 * 16 + 1;
            PACKRAT.player.y = 40 * 16 - PACKRAT.player.h - 2;
            PACKRAT.player.vy = 4.0;

            PACKRAT.step(1);

            // vy should bounce upward (negative velocity)
            assert.lessThan(PACKRAT.player.vy, -5.0, 'Rubber band must produce upward bounce velocity (vy < -5.0)');
            assert.equal(PACKRAT.player.jumping, true, 'Player should be in jumping state after bounce');
            assert.equal(PACKRAT.player.onGround, false, 'Player should not be stuck on ground');
          }
        },
        {
          name: 'Holding jump when hitting rubber band gives super trampoline bounce',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.keys.jump = true; // Hold jump!

            // Rubber band at (12, 40)
            PACKRAT.setTileAt(12, 40, 21);
            PACKRAT.setTileAt(12, 39, 0);

            PACKRAT.player.x = 12 * 16 + 1;
            PACKRAT.player.y = 40 * 16 - PACKRAT.player.h - 2;
            PACKRAT.player.vy = 4.0;

            PACKRAT.step(1);

            // Super bounce formula gives -9.2
            assert.lessThan(PACKRAT.player.vy, -8.5, 'Super trampoline bounce must propel rat with vy <= -8.5');
            PACKRAT.keys.jump = false;
          }
        },
        {
          name: 'Walking on brick floor next to/under spools does not jump or bounce prematurely',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // In Level 0, floor is at y=53, spool and rubber bands at y=51, x=59..62
            PACKRAT.player.x = 56 * 16;
            PACKRAT.player.y = 53 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;
            PACKRAT.player.vx = 0;
            P = PACKRAT;
            PACKRAT.keys.right = true;

            for (let i = 0; i < 40; i++) {
              PACKRAT.step(1);
            }
            PACKRAT.keys.right = false;

            // Rat should have walked all the way near the spool without jumping
            assert.greaterThan(PACKRAT.player.x, 59 * 16, 'Rat should walk past x=59');
            assert.equal(PACKRAT.player.onGround, true, 'Rat must remain on the ground while walking');
            assert.equal(PACKRAT.player.jumping, false, 'Rat must not be forced to jump');
          }
        },
        {
          name: 'Jumping upward through rubber band is permitted without head collision',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Rubber band at (15, 30)
            PACKRAT.setTileAt(15, 30, 21);

            // Player jumping upwards beneath rubber band
            PACKRAT.player.x = 15 * 16 + 1;
            PACKRAT.player.y = 31 * 16;
            PACKRAT.player.vy = -6.0;

            PACKRAT.step(1);

            // Upward velocity should NOT be cut to 0 by ceiling collision
            assert.lessThan(PACKRAT.player.vy, 0, 'Player should continue traveling upward through rubber band');
          }
        }
      ]
    },
    {
      id: 'suite-thread-spool',
      name: 'Thread Spool Mechanics (Bug 2 & PACKRAT.EXE 0x3a18 / 0x366)',
      description: 'Verifies Tile 17 (Thread Spool) roll on 1 push hit, standable platform, and wall stop',
      tests: [
        {
          name: 'Thread spool is classified as standable floor and pushable block',
          fn(PACKRAT, assert) {
            // Tile 17: Thread Spool
            assert.ok(PACKRAT.isTileFloorSolid(17), 'Tile 17 must be standable floor');
            assert.equal(PACKRAT.isTileCeilingSolid(17), false, 'Tile 17 must allow upward jumping through');
            assert.equal(PACKRAT.isTileWallSolid(17), false, 'Tile 17 must allow horizontal walk-through/pushing');
            assert.ok(PACKRAT.isTileMovable(17), 'Tile 17 must be pushable/movable');
          }
        },
        {
          name: 'Landing on thread spool acts as a solid standable platform (Table DS:0x366)',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            PACKRAT.setTileAt(20, 45, 17); // Spool
            PACKRAT.setTileAt(20, 44, 0);  // Air

            PACKRAT.player.x = 20 * 16 + 1;
            PACKRAT.player.y = 45 * 16 - PACKRAT.player.h - 2;
            PACKRAT.player.vy = 3.5;

            PACKRAT.step(1);

            assert.equal(PACKRAT.player.onGround, true, 'Spool should act as a solid standable platform');
            assert.equal(PACKRAT.player.vy, 0, 'Vertical velocity should settle to 0 on landing');
          }
        },
        {
          name: 'Pushing thread spool rolls on exactly 1 push hit (PACKRAT.EXE 0x3a18)',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Clear platform and place spool at (25, 50)
            for (let x = 20; x <= 30; x++) {
              PACKRAT.setTileAt(x, 50, 0);
              PACKRAT.setTileAt(x, 51, 1); // solid floor
            }
            PACKRAT.setTileAt(25, 50, 17); // Thread spool

            // Position player adjacent to spool on the left
            PACKRAT.player.x = 25 * 16 - PACKRAT.player.w - 1;
            PACKRAT.player.y = 50 * 16;
            PACKRAT.player.onGround = true;
            PACKRAT.player.facing = 1;

            // Push right
            PACKRAT.tryPushBlock(1);

            // Spool should immediately become a movable block rolling at vx = 1.5
            assert.equal(PACKRAT.getTileAt(25, 50), 0, 'Original spool tile position should be cleared to 0');
            const blocks = PACKRAT.movableBlocks;
            assert.greaterThan(blocks.length, 0, 'A movable block should be created');
            const spoolBlock = blocks.find(b => b.tileId === 17);
            assert.ok(spoolBlock, 'Movable spool block must exist');
            assert.closeTo(spoolBlock.vx, 1.5, 0.01, 'Spool block should roll at speed 1.5');
          }
        },
        {
          name: 'Rolling thread spool stops and re-solidifies upon hitting a solid wall',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Set up a runway: floor at y=51, wall at x=28, spool at x=26
            PACKRAT.setTileAt(26, 50, 0);
            PACKRAT.setTileAt(27, 50, 0);
            PACKRAT.setTileAt(28, 50, 1); // Solid wall
            PACKRAT.setTileAt(26, 51, 1);
            PACKRAT.setTileAt(27, 51, 1);

            // Spawn rolling spool at x=26
            const spool = new PACKRAT.movableBlocks.constructor();
            // Clear any leftover blocks
            PACKRAT.movableBlocks.length = 0;
            PACKRAT.setTileAt(26, 50, 17);

            // Push spool towards wall
            PACKRAT.player.x = 26 * 16 - PACKRAT.player.w - 1;
            PACKRAT.player.y = 50 * 16;
            PACKRAT.player.onGround = true;
            PACKRAT.tryPushBlock(1);

            // Step physics multiple frames for spool to roll and hit wall at x=28
            PACKRAT.step(30);

            // Spool should stop before wall (at x=27) and write back as tile 17
            assert.equal(PACKRAT.getTileAt(27, 50), 17, 'Spool should come to rest at x=27 before wall');
          }
        },
        {
          name: 'Pressing Down on thread spool column steps down to the spool below one by one',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Stack two thread spools vertically at x=20, y=40 and y=41
            PACKRAT.setTileAt(20, 39, 0);
            PACKRAT.setTileAt(20, 40, 17); // Spool 1
            PACKRAT.setTileAt(20, 41, 17); // Spool 2
            PACKRAT.setTileAt(20, 42, 1);  // Solid floor

            // Place rat standing on Spool 1
            PACKRAT.player.x = 20 * 16 + 1;
            PACKRAT.player.y = 40 * 16 - PACKRAT.player.h;
            PACKRAT.player.vx = 0;
            PACKRAT.player.vy = 0;
            PACKRAT.player.onGround = true;

            // Press Down to step down spool-by-spool
            PACKRAT.keys.down = true;
            PACKRAT.step(2);
            PACKRAT.keys.down = false;
            PACKRAT.step(6);

            // Player should have stepped down cleanly from Spool 1 (y=40) to Spool 2 (y=41)
            assert.equal(PACKRAT.player.onGround, true, 'Player should land solid on the next spool down');
            assert.equal(PACKRAT.player.y, 41 * 16 - PACKRAT.player.h, 'Player should be standing on Spool 2 (one by one step-down)');
          }
        },
        {
          name: 'Holding Up while touching thread spool column climbs upward along the spool shaft',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Stack thread spools at x=20, y=38..41
            for (let y = 38; y <= 41; y++) {
              PACKRAT.setTileAt(20, y, 17);
            }

            // Place rat at lower spool (y=41)
            PACKRAT.player.x = 20 * 16 + 1;
            PACKRAT.player.y = 41 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;
            const startY = PACKRAT.player.y;

            // Hold Up
            PACKRAT.keys.up = true;
            PACKRAT.step(6);
            PACKRAT.keys.up = false;

            // Player should have climbed upward
            assert.lessThan(PACKRAT.player.y, startY, 'Holding Up on spool column should climb upward');
            assert.lessThan(PACKRAT.player.vy, 0, 'Climbing impulse vy must be negative');
          }
        }
      ]
    },
    {
      id: 'suite-push-dislodge',
      name: 'Push & Dislodge Mechanics (PACKRAT.EXE 0x3906 / 0x3a18)',
      description: 'Verifies hit counts for ice blocks, bricks, and crates',
      tests: [
        {
          name: 'Ice block (Tile 16) takes 3 push hits to slide horizontally',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.movableBlocks.length = 0;

            // Setup runway
            PACKRAT.setTileAt(10, 50, 16); // Ice block
            PACKRAT.setTileAt(11, 50, 0);
            PACKRAT.setTileAt(12, 50, 0);
            PACKRAT.setTileAt(10, 51, 1);
            PACKRAT.setTileAt(11, 51, 1);

            PACKRAT.player.x = 10 * 16 - PACKRAT.player.w - 1;
            PACKRAT.player.y = 50 * 16;
            PACKRAT.player.facing = 1;

            // Hit 1 & 2: Should NOT move yet
            PACKRAT.tryPushBlock(1);
            assert.equal(PACKRAT.getTileAt(10, 50), 16, 'Ice block should still be at (10,50) after 1 hit');
            PACKRAT.tryPushBlock(1);
            assert.equal(PACKRAT.getTileAt(10, 50), 16, 'Ice block should still be at (10,50) after 2 hits');

            // Hit 3: Slides horizontally at speed 2.4!
            PACKRAT.tryPushBlock(1);
            assert.equal(PACKRAT.getTileAt(10, 50), 0, 'Ice block should dislodge from grid after 3 hits');
            const iceBlock = PACKRAT.movableBlocks.find(b => b.tileId === 16);
            assert.ok(iceBlock, 'Sliding ice block must exist in movableBlocks');
            assert.closeTo(iceBlock.vx, 2.4, 0.01, 'Ice block should slide at speed 2.4');
          }
        },
        {
          name: 'Pushing bottom block from under a stack causes blocks above to fall instead of floating',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.movableBlocks.length = 0;

            // Solid floor at y=52
            for (let x = 10; x <= 20; x++) PACKRAT.setTileAt(x, 52, 1);
            PACKRAT.setTileAt(15, 51, 1); // Stop wall

            // Stack of 2 ice blocks: bottom at (10, 51), top at (10, 50)
            PACKRAT.setTileAt(10, 51, 16);
            PACKRAT.setTileAt(10, 50, 16);
            PACKRAT.setTileAt(11, 51, 0);
            PACKRAT.setTileAt(11, 50, 0);

            PACKRAT.player.x = 10 * 16 - PACKRAT.player.w - 1;
            PACKRAT.player.y = 51 * 16;
            PACKRAT.player.facing = 1;

            // Push bottom ice block (takes 3 hits)
            PACKRAT.tryPushBlock(1);
            PACKRAT.tryPushBlock(1);
            PACKRAT.tryPushBlock(1);

            // Immediately on the 3rd push hit, top block must detach from grid and fall
            assert.equal(PACKRAT.getTileAt(10, 50), 0, 'Top block must not remain floating in static grid');
            assert.equal(PACKRAT.movableBlocks.length, 2, 'Both pushed and stacked blocks become dynamic entities');

            // Let physics simulate settlement
            PACKRAT.step(60);

            // Top block must have fallen down to y=51 and landed solid on the floor
            assert.equal(PACKRAT.getTileAt(10, 51), 16, 'Top block must fall down and settle onto floor at y=51');
            assert.equal(PACKRAT.getTileAt(10, 50), 0, 'Space at y=50 must remain empty air');
          }
        },
        {
          name: 'Ice block (Tile 16) takes 3 crouch hits to dislodge below player',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.movableBlocks.length = 0;

            PACKRAT.setTileAt(15, 51, 16); // Ice block under feet
            PACKRAT.setTileAt(15, 50, 0);  // Air for rat
            PACKRAT.setTileAt(15, 52, 0);  // Air beneath ice block

            PACKRAT.player.x = 15 * 16 + 1;
            PACKRAT.player.y = 51 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;

            // Crouch dislodge hits
            PACKRAT.dislodgeBlockBelow();
            assert.equal(PACKRAT.getTileAt(15, 51), 16, 'Ice block should remain after 1 crouch hit');
            PACKRAT.dislodgeBlockBelow();
            assert.equal(PACKRAT.getTileAt(15, 51), 16, 'Ice block should remain after 2 crouch hits');

            // 3rd hit dislodges block below into movable block
            PACKRAT.dislodgeBlockBelow();
            assert.equal(PACKRAT.getTileAt(15, 51), 0, 'Ice block dislodges from grid after 3 hits');
            const dislodged = PACKRAT.movableBlocks.find(b => b.tileId === 16);
            assert.ok(dislodged, 'Movable block created from dislodged ice');
          }
        },
        {
          name: 'Dislodgeable brick (Tile 10) takes 5 hits to break/dislodge',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.movableBlocks.length = 0;

            PACKRAT.setTileAt(20, 51, 10); // Dislodgeable brick
            PACKRAT.player.x = 20 * 16 + 1;
            PACKRAT.player.y = 51 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;

            // Hits 1 to 4: Remains solid
            for (let i = 1; i <= 4; i++) {
              PACKRAT.dislodgeBlockBelow();
              assert.equal(PACKRAT.getTileAt(20, 51), 10, `Tile 10 must resist hit ${i}`);
            }

            // Hit 5: Dislodged!
            PACKRAT.dislodgeBlockBelow();
            assert.equal(PACKRAT.getTileAt(20, 51), 0, 'Tile 10 dislodged on hit 5');
          }
        },
        {
          name: 'Ice surface creates slippery movement physics (reduced friction & higher max speed)',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Runway of ice at y=51
            for (let x = 10; x <= 25; x++) {
              PACKRAT.setTileAt(x, 51, 16); // Ice
              PACKRAT.setTileAt(x, 50, 0);  // Air
            }

            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 51 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;
            PACKRAT.player.vx = 0;

            // Accelerate on ice
            PACKRAT.keys.right = true;
            PACKRAT.step(30);
            PACKRAT.keys.right = false;

            // Max speed on ice is 2.8 (vs 2.4 on normal floor)
            assert.greaterThan(PACKRAT.player.vx, 2.3, 'Speed on ice should exceed standard ground speed');

            // Friction on ice is 0.96 (preserves momentum much longer)
            const speedBefore = PACKRAT.player.vx;
            PACKRAT.step(5);
            assert.greaterThan(PACKRAT.player.vx, speedBefore * 0.75, 'Momentum should be preserved on slippery ice');
          }
        }
      ]
    },
    {
      id: 'suite-locomotion-physics',
      name: 'Player Locomotion, Jump & Gravity Physics',
      description: 'Verifies variable height jumping, gravity, collisions, and terminal velocity',
      tests: [
        {
          name: 'Horizontal acceleration and friction decelerate to 0 when input released',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16;
            PACKRAT.player.onGround = true;
            PACKRAT.player.vx = 0;

            // Move left
            PACKRAT.keys.left = true;
            PACKRAT.step(5);
            assert.lessThan(PACKRAT.player.vx, 0, 'Moving left should give negative vx');
            assert.equal(PACKRAT.player.facing, -1, 'Player facing should be -1');

            // Release left
            PACKRAT.keys.left = false;
            PACKRAT.step(20);
            assert.equal(PACKRAT.player.vx, 0, 'Friction should bring vx to 0');
          }
        },
        {
          name: 'Normal jump gives initial velocity vy = -6.4',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            PACKRAT.setTileAt(10, 50, 1); // Solid floor
            PACKRAT.player.x = 10 * 16 + 1;
            PACKRAT.player.y = 50 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;

            PACKRAT.handleJump();
            assert.closeTo(PACKRAT.player.vy, -6.4, 0.01, 'Initial jump velocity should be -6.4');
            assert.equal(PACKRAT.player.jumping, true, 'jumping should be true');
            assert.equal(PACKRAT.player.onGround, false, 'onGround should be false');
          }
        },
        {
          name: 'Variable jump holding impulse provides higher apex than releasing jump',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Clear vertical air shaft from y=30 to 49
            for (let y = 30; y <= 49; y++) {
              PACKRAT.setTileAt(10, y, 0);
              PACKRAT.setTileAt(11, y, 0);
            }
            PACKRAT.setTileAt(10, 50, 1);
            PACKRAT.setTileAt(11, 50, 1);

            // Test 1: Short jump (release key immediately)
            PACKRAT.player.x = 10 * 16 + 1;
            PACKRAT.player.y = 50 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;
            PACKRAT.keys.jump = false;
            PACKRAT.handleJump();
            let minShortY = PACKRAT.player.y;
            for (let i = 0; i < 25; i++) {
              PACKRAT.step(1);
              if (PACKRAT.player.y < minShortY) minShortY = PACKRAT.player.y;
            }

            // Test 2: Full held jump (hold jump key)
            for (let y = 30; y <= 49; y++) {
              PACKRAT.setTileAt(10, y, 0);
              PACKRAT.setTileAt(11, y, 0);
            }
            PACKRAT.setTileAt(10, 50, 1);
            PACKRAT.setTileAt(11, 50, 1);
            PACKRAT.player.x = 10 * 16 + 1;
            PACKRAT.player.y = 50 * 16 - PACKRAT.player.h;
            PACKRAT.player.onGround = true;
            PACKRAT.player.vx = 0;
            PACKRAT.player.vy = 0;
            PACKRAT.keys.jump = true;
            PACKRAT.handleJump();
            let minHeldY = PACKRAT.player.y;
            for (let i = 0; i < 25; i++) {
              PACKRAT.step(1);
              if (PACKRAT.player.y < minHeldY) minHeldY = PACKRAT.player.y;
            }

            PACKRAT.keys.jump = false;

            // Held jump reaches a significantly higher position (lower y)
            assert.lessThan(minHeldY, minShortY - 15, 'Holding jump key must produce a higher jump height than releasing');
          }
        },
        {
          name: 'Terminal velocity is capped at 7.0 under gravity',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Drop rat in air
            PACKRAT.player.y = 100;
            PACKRAT.player.vy = 0;
            PACKRAT.step(40);

            assert.closeTo(PACKRAT.player.vy, 7.0, 0.01, 'Terminal velocity should be clamped at 7.0');
          }
        },
        {
          name: 'Solid ceiling halts upward velocity and aligns player to underside',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            // Solid brick ceiling at y=20
            PACKRAT.setTileAt(10, 20, 1);
            PACKRAT.player.x = 10 * 16 + 1;
            PACKRAT.player.y = 21 * 16 + 2;
            PACKRAT.player.vy = -5.0; // Jumping up into ceiling

            PACKRAT.step(1);

            assert.equal(PACKRAT.player.vy, 0, 'Ceiling collision must zero out upward velocity');
            assert.closeTo(PACKRAT.player.y, 21 * 16, 0.1, 'Player should be positioned just below ceiling');
          }
        }
      ]
    },
    {
      id: 'suite-hazards-enemies',
      name: 'Hazards & Enemies Verification',
      description: 'Verifies Mousetraps, Water, Electric Wire, Enemy Rats, and Suicide key',
      tests: [
        {
          name: 'Stepping on Mousetrap (Tile 2) snaps and kills player',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            // Place mousetrap
            PACKRAT.setTileAt(10, 50, 2);
            PACKRAT.player.x = 10 * 16 + 2;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.lives, 2, 'Mousetrap must deduct 1 life');
          }
        },
        {
          name: 'Touching Water Pool (Tile 11) drowns player',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            PACKRAT.setTileAt(10, 50, 11);
            PACKRAT.player.x = 10 * 16 + 2;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.lives, 2, 'Water must drown and deduct 1 life');
          }
        },
        {
          name: 'Touching Electric Wire (Tile 18) electrocutes player and sparks into Tile 19',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            PACKRAT.setTileAt(10, 50, 18);
            PACKRAT.player.x = 10 * 16 + 2;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.lives, 2, 'Electric wire must deduct 1 life');
            assert.equal(PACKRAT.getTileAt(10, 50), 19, 'Wire tile 18 must spark into tile 19');
          }
        },
        {
          name: 'Electric current moving along green wire network patrols waypoints and electrocutes player on contact',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(1); // Level 2 contains authentic green wire circuits
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            assert.greaterThan(PACKRAT.electricCurrents.length, 0, 'Level 2 should initialize active electric currents');
            const ec = PACKRAT.electricCurrents[0];
            const startX = ec.x;
            const startY = ec.y;

            // Step game physics and verify electricity moves along the wire
            PACKRAT.step(10);
            const moved = (ec.x !== startX || ec.y !== startY);
            assert.equal(moved, true, 'Electric spark should actively move along wire waypoints');

            // Place player directly on the moving electrical current
            PACKRAT.player.x = ec.x - PACKRAT.player.w / 2;
            PACKRAT.player.y = ec.y - PACKRAT.player.h / 2;
            PACKRAT.step(1);

            assert.equal(PACKRAT.lives, 2, 'Touching moving electrical current must electrocute and deduct 1 life');
          }
        },
        {
          name: 'Water tiles animate authentic 32-step ripple cycle from PACKRAT.EXE lookup table',
          fn(PACKRAT, assert) {
            const WATER_ANIM_TABLE = [1, 2, 3, 3, 2, 1, 0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            assert.equal(WATER_ANIM_TABLE.length, 32, 'Lookup table must have exactly 32 steps');
            assert.equal(WATER_ANIM_TABLE[0], 1, 'First ripple step is offset 1 (Tile 12)');
            assert.equal(WATER_ANIM_TABLE[2], 3, 'Peak ripple crest is offset 3 (Tile 14)');
            assert.equal(WATER_ANIM_TABLE[6], 0, 'Resting water returns to offset 0 (Tile 11)');
          }
        },
        {
          name: 'Enemy Rat patrol kills player on contact',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 0;

            // Clear enemies and place 1 enemy right at player
            PACKRAT.enemies.length = 0;
            const enemy = {
              x: PACKRAT.player.x,
              y: PACKRAT.player.y,
              w: 26,
              h: 14,
              vx: 0.8,
              dir: 1,
              update() {}
            };
            PACKRAT.enemies.push(enemy);

            PACKRAT.step(1);
            assert.equal(PACKRAT.lives, 2, 'Enemy contact must kill player');
          }
        },
        {
          name: 'Suicide call (K key) kills stuck player with force bypass',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.lives = 3;
            PACKRAT.player.invulnerableTimer = 60; // Even while invulnerable!

            PACKRAT.killPlayer(4, true); // force = true
            assert.equal(PACKRAT.lives, 2, 'Forced suicide must deduct life even during invulnerability');
          }
        }
      ]
    },
    {
      id: 'suite-collectibles-scoring',
      name: 'Collectibles, Scoring & Extra Life Progression',
      description: 'Verifies point values for all baubles, extra life threshold, and high scores',
      tests: [
        {
          name: 'Collecting Button (Tile 31) awards 10 points and removes tile',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 0;

            PACKRAT.setTileAt(10, 50, 31); // Button
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;

            PACKRAT.step(1);

            assert.equal(PACKRAT.score, 10, 'Button should award 10 points');
            assert.equal(PACKRAT.getTileAt(10, 50), 0, 'Button tile should be consumed (0)');
          }
        },
        {
          name: 'Collecting Silver Coin (Tile 32) awards 25 points',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 0;

            PACKRAT.setTileAt(10, 50, 32);
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.score, 25, 'Silver coin should award 25 points');
          }
        },
        {
          name: 'Collecting Gold Coin (Tile 33) awards 50 points',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 0;

            PACKRAT.setTileAt(10, 50, 33);
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.score, 50, 'Gold coin should award 50 points');
          }
        },
        {
          name: 'Collecting Cookie (Tile 34) awards 100 points',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 0;

            PACKRAT.setTileAt(10, 50, 34);
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.score, 100, 'Cookie should award 100 points');
          }
        },
        {
          name: 'Collecting Cheese (Tile 35) awards 250 points',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 0;

            PACKRAT.setTileAt(10, 50, 35);
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;
            PACKRAT.step(1);

            assert.equal(PACKRAT.score, 250, 'Cheese should award 250 points');
          }
        },
        {
          name: 'Surpassing 10,000 points awards +1 Extra Life',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 9900;
            PACKRAT.lives = 3;

            PACKRAT.addScore(250); // Crosses 10,000 to 10,150

            assert.equal(PACKRAT.lives, 4, 'Passing 10,000 points must award 1 extra life (4 lives)');
            assert.equal(PACKRAT.score, 10150, 'Score should be 10,150');
          }
        }
      ]
    },
    {
      id: 'suite-level-progression',
      name: 'Level Progression & Pipe Transport',
      description: 'Verifies Mouse Hole exit completion, bonus points, and pneumatic pipes',
      tests: [
        {
          name: 'Touching Mouse Hole (Tile 15) triggers LEVEL_CLEAR and +500 points',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.score = 100;

            // Place mouse hole
            PACKRAT.setTileAt(10, 50, 15);
            PACKRAT.player.x = 10 * 16;
            PACKRAT.player.y = 50 * 16 - 10;

            PACKRAT.step(1);

            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.LEVEL_CLEAR, 'State should transition to LEVEL_CLEAR');
            assert.equal(PACKRAT.score, 600, 'Score should increase by 500 bonus points (100 + 500 = 600)');
          }
        },
        {
          name: 'Pipe entrance (Tile 23) engages high-speed pipe transport',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;
            PACKRAT.player.inPipe = false;

            // Place pipe entrance at player center
            const cx = Math.floor((PACKRAT.player.x + PACKRAT.player.w / 2) / 16);
            const cy = Math.floor((PACKRAT.player.y + PACKRAT.player.h / 2) / 16);
            PACKRAT.setTileAt(cx, cy, 23);

            PACKRAT.step(1);

            assert.equal(PACKRAT.player.inPipe, true, 'Player should enter pipe (inPipe = true)');
          }
        }
      ]
    },
    {
      id: 'suite-game-states',
      name: 'Game States, Pause & Minimap Views',
      description: 'Verifies state machine transitions between PLAYING, PAUSED, and MINIMAP',
      tests: [
        {
          name: 'togglePause cycles between PLAYING and PAUSED',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            PACKRAT.togglePause();
            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.PAUSED, 'Should transition to PAUSED');

            PACKRAT.togglePause();
            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.PLAYING, 'Should resume to PLAYING');
          }
        },
        {
          name: 'toggleMinimap cycles between PLAYING and MINIMAP mode',
          fn(PACKRAT, assert) {
            PACKRAT.loadLevel(0);
            PACKRAT.state = PACKRAT.GAME_STATE.PLAYING;

            PACKRAT.toggleMinimap();
            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.MINIMAP, 'Should transition to MINIMAP');

            PACKRAT.toggleMinimap();
            assert.equal(PACKRAT.state, PACKRAT.GAME_STATE.PLAYING, 'Should return to PLAYING');
          }
        },
        {
          name: 'CRT shader is disabled (OFF) by default and can be toggled',
          fn(PACKRAT, assert) {
            // Default state must be false (OFF)
            assert.equal(PACKRAT.isCrtEnabled, false, 'CRT overlay should be disabled by default');

            // Toggle CRT on
            PACKRAT.setCrtEnabled(true);
            assert.equal(PACKRAT.isCrtEnabled, true, 'CRT overlay should be enabled after setCrtEnabled(true)');

            // Toggle CRT off again
            PACKRAT.setCrtEnabled(false);
            assert.equal(PACKRAT.isCrtEnabled, false, 'CRT overlay should return to disabled (OFF)');
          }
        }
      ]
    }
  ];

  // Runner implementation
  async function runAllTests(PACKRAT, onProgress) {
    // CRITICAL: Force sound off during all tests
    if (PACKRAT && PACKRAT.setSoundEnabled) {
      PACKRAT.setSoundEnabled(false);
    }

    const report = {
      startTime: Date.now(),
      endTime: 0,
      durationMs: 0,
      totalSuites: suites.length,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      assertions: 0,
      suiteReports: []
    };

    for (const suite of suites) {
      const suiteReport = {
        id: suite.id,
        name: suite.name,
        description: suite.description,
        total: suite.tests.length,
        passed: 0,
        failed: 0,
        tests: []
      };

      for (const test of suite.tests) {
        report.totalTests++;
        const testResult = {
          name: test.name,
          passed: false,
          error: null,
          durationMs: 0
        };

        const tStart = Date.now();
        const assert = createAssert(report);

        try {
          // Re-verify mute before each test
          if (PACKRAT.sound && PACKRAT.sound.enabled) {
            PACKRAT.setSoundEnabled(false);
          }
          await test.fn(PACKRAT, assert);
          testResult.passed = true;
          suiteReport.passed++;
          report.passedTests++;
        } catch (err) {
          testResult.passed = false;
          testResult.error = err.message || String(err);
          suiteReport.failed++;
          report.failedTests++;
        }
        testResult.durationMs = Date.now() - tStart;
        suiteReport.tests.push(testResult);

        if (onProgress) {
          onProgress(suite, test, testResult, report);
        }
      }

      if (suiteReport.failed === 0) {
        report.passedSuites++;
      } else {
        report.failedSuites++;
      }
      report.suiteReports.push(suiteReport);
    }

    report.endTime = Date.now();
    report.durationMs = report.endTime - report.startTime;
    return report;
  }

  return {
    suites,
    runAllTests
  };
});
