#!/usr/bin/env node
/**
 * The Pack Rat (1992) — Automated CLI E2E Test Suite
 * 
 * Runs all reverse-engineered physics tests, collision checks, boundary fixes,
 * and game mechanic validations.
 * 
 * STRICT REQUIREMENT: Sound is completely muted throughout execution.
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m'
};

// 1. Mock Browser Environment with Muted Sound
global.window = global;
global.__MUTE_AUDIO__ = true;

const elementCache = {};
global.document = {
  getElementById: (id) => {
    if (!elementCache[id]) {
      const classes = new Set(id === 'crtOverlay' ? ['hidden'] : []);
      elementCache[id] = {
        id,
        getContext: () => ({
          imageSmoothingEnabled: false,
          createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
          putImageData: () => {},
          drawImage: () => {},
          fillRect: () => {},
          fillText: () => {},
          clearRect: () => {},
          translate: () => {},
          scale: () => {}
        }),
        addEventListener: () => {},
        classList: {
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
          toggle: (c, force) => {
            if (typeof force === 'boolean') {
              if (force) classes.add(c); else classes.delete(c);
              return force;
            }
            if (classes.has(c)) { classes.delete(c); return false; }
            classes.add(c); return true;
          },
          contains: (c) => classes.has(c)
        },
        style: {},
        querySelector: () => ({ textContent: '', innerText: '' }),
        querySelectorAll: () => []
      };
    }
    return elementCache[id];
  },
  querySelectorAll: () => [],
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    width: 0,
    height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
      putImageData: () => {},
      drawImage: () => {},
      translate: () => {},
      scale: () => {}
    }),
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    addEventListener: () => {},
    appendChild: () => {},
    setAttribute: () => {}
  })
};

global.localStorage = {
  store: { packrat_sound: 'off' },
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

global.requestAnimationFrame = () => {};
global.addEventListener = () => {};
global.navigator = { getGamepads: () => [] };

// 2. Load Game Modules
require(path.join(__dirname, '../assets.js'));
require(path.join(__dirname, '../audio.js'));
require(path.join(__dirname, '../game.js'));
const { runAllTests } = require(path.join(__dirname, 'tests-core.js'));

async function main() {
  console.log(`\n${colors.cyan}${colors.bold}========================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}     THE PACK RAT (1992) — COMPREHENSIVE E2E VERIFICATION SUITE       ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}========================================================================${colors.reset}`);
  console.log(`${colors.dim}Environment: Node.js ${process.version} | Sound Status: 🔇 MUTED (No audio output)${colors.reset}\n`);

  const report = await runAllTests(window.PACKRAT, (suite, test, result) => {
    const symbol = result.passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    const duration = `${colors.dim}(${result.durationMs}ms)${colors.reset}`;
    console.log(`  ${symbol} ${colors.bold}${test.name}${colors.reset} ${duration}`);
    if (!result.passed) {
      console.log(`     ${colors.red}Error: ${result.error}${colors.reset}`);
    }
  });

  console.log(`\n${colors.cyan}${colors.bold}------------------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}TEST SUMMARY REPORT:${colors.reset}`);
  console.log(`  Suites:      ${report.passedSuites === report.totalSuites ? colors.green : colors.red}${report.passedSuites} / ${report.totalSuites} passed${colors.reset}`);
  console.log(`  Tests:       ${report.passedTests === report.totalTests ? colors.green : colors.red}${report.passedTests} / ${report.totalTests} passed${colors.reset}`);
  console.log(`  Assertions:  ${colors.cyan}${report.assertions} assertions verified${colors.reset}`);
  console.log(`  Duration:    ${colors.yellow}${report.durationMs}ms${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}------------------------------------------------------------------------${colors.reset}\n`);

  if (report.failedTests > 0) {
    console.log(`${colors.bgRed}${colors.bold} TEST SUITE FAILED: ${report.failedTests} tests failed ${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.bgGreen}${colors.bold} ALL TESTS PASSED SUCCESSFULLY! Everything is functioning authentically. ${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
