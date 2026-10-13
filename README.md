# The Pack Rat (1992) — Web Edition

> **Converted from the original .exe by Justin Bogner, October 2026**  
> Original MS-DOS game © 1992 by Steve Blanding.

---

## 🕹️ Overview

**The Pack Rat** is a four-way scrolling 256-color platform arcade game originally developed for MS-DOS in 1992. 

This repository contains a zero-install, pixel-perfect web preservation that runs directly in any modern desktop or mobile browser. It was reverse-engineered directly from the original 16-bit binaries:

- **Decompressed Levels:** All 16 authentic 64×64 levels, mouse hole destination maps, and palette setups were reconstructed from `PACKRAT.001` via adaptive binary arithmetic decompression.
- **Extracted Graphics:** The 256-color VGA DAC palette, 52 tiles, 17 Pack Rat animation frames, 4 Enemy Rat frames, animated water, electric hazards, and traps were extracted directly from `PACKRAT.EXE`.
- **Audio Synthesizer:** Authentic PC speaker frequency and duration tables extracted from the executable are accurately synthesized in real-time via the Web Audio API.

---

## 🚀 How to Deploy on GitHub Pages

This web game is built entirely with vanilla HTML5, CSS3, and modern JavaScript—requiring **no installation, build steps, or server dependencies**:

1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** → **Pages**.
3. Under **Build and deployment** > **Source**, select **Deploy from a branch**.
4. Choose the `main` (or `master`) branch and the `/ (root)` folder, then click **Save**.
5. Your game will be live in seconds at `https://<your-username>.github.io/the-pack-rat/`!

---

## 🎮 Controls (Fully Customizable)

Controls can be remapped at any time by clicking the **🎮 CONTROLS** button on the toolbar.

| Action | Default Keyboard Keys | Virtual Mobile / Gamepad |
| :--- | :--- | :--- |
| **Move Left** | `←` or `A` | D-Pad Left / Analog Stick |
| **Move Right** | `→` or `D` | D-Pad Right / Analog Stick |
| **Look Up** | `↑` or `W` | D-Pad Up / Analog Stick |
| **Look Down / Dislodge** | `↓` or `S` | D-Pad Down / Analog Stick |
| **Jump** | `Space`, `Ctrl`, or `Z` | `JUMP` Button / Button A |
| **Push Objects** | `Alt`, `Shift`, or `X` | `PUSH` Button / Button X/B |
| **Minimap / Zoom View** | `M` | `ZOOM` Button |
| **Suicide (if stuck)** | `K` | — |
| **Pause Game** | `Esc` or `F3` | Header Menu / Start Button |
| **Sound Toggle** | `F2` | Header Audio Button |
| **Toggle HUD** | `F10` | — |
| **Help Manual** | `F1` | `HOW TO PLAY` Button |

---

## 💎 Scoring & Collectibles

- **Buttons:** 10 points
- **Silver Coins:** 25 points
- **Gold Coins:** 50 points
- **Cookies:** 100 points
- **Cheeses:** 250 points
- **Level Completion:** 500 bonus points
- **Extra Life:** Awarded every 10,000 points!

---

## 🛠 Features

- **All 16 Original Levels:** Jump to any level with the built-in Level Select.
- **Built-in Level Editor:** Design custom levels on a 64×64 grid, place tiles, set background colors and mouse hole warp destinations, test play instantly, and export JSON.
- **CRT Simulation:** Optional arcade CRT scanline and curvature filter.
- **Hall of Fame:** Persistent local high-score tracking with Steve Blanding's original 1992 leaderboard.
- **Responsive & Accessible:** Touch controls for phones/tablets, keyboard controls, and USB/Bluetooth gamepad support.

---

## 📜 Credits

- **Original Game (1992):** Steve Blanding (Redmond, WA)
- **Web Port & Binary Deconstruction (2026):** Justin Bogner
