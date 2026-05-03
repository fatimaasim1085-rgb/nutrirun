# 🥦 NutriRun — Gamified Nutrition Science Learning

> **Run. Answer. Master Nutrition Science.**  
> A side-scrolling auto-runner quiz game covering Foods, Nutrition & Diet Therapy.

![NutriRun Banner](https://img.shields.io/badge/NutriRun-Play%20Now-39ff7a?style=for-the-badge&logo=github)
![Questions](https://img.shields.io/badge/Questions-20+-blue?style=for-the-badge)
![Difficulty](https://img.shields.io/badge/Difficulty-Easy%20→%20Hard-orange?style=for-the-badge)
![No Framework](https://img.shields.io/badge/Stack-Vanilla%20JS-yellow?style=for-the-badge)

---

## 🎮 How to Play

| Action | Control |
|--------|---------|
| Jump   | `SPACE` / `↑` / Click / Tap |
| Pause  | `ESC` or ⏸ button |
| Use Power-up | Click the icon in the HUD |

1. **Your runner auto-sprints** — no movement needed
2. **Food obstacles appear** carrying nutrition MCQs
3. **Answer correctly** → smash through, earn points + streak bonus
4. **Wrong / timeout** → lose 1 of your 3 ❤️ lives
5. **Distance unlocks harder questions** (Easy → Medium → Hard)
6. **Collect glowing power-ups** on the track, activate via HUD

### ⚡ Power-Ups
| Icon | Name | Effect |
|------|------|--------|
| ⚡ | Metabolism Boost | Slow-motion for 5 seconds |
| 🛡️ | Nutrition Shield | Absorbs one wrong answer |
| 2× | Double Points | 2× score for 10 seconds |

### 🏆 Ranks
| Score | Rank |
|-------|------|
| 5000+ | 🧬 Dietician Supreme |
| 3000+ | 🩺 Clinical Nutritionist |
| 2000+ | 🔬 Biochemistry Expert |
| 1500+ | 💊 Diet Therapist |
| 1000+ | 🥗 Nutrition Specialist |
| 700+  | 🍎 Health Educator |
| 400+  | 🥦 Dietetics Student |
| 200+  | 🌱 Nutrition Learner |
| 0+    | 🏃 Nutrition Novice |

---

## 📁 Project Structure

```
nutrirun/
├── index.html       ← All screens (landing, auth, game, leaderboard, dashboard)
├── style.css        ← Neon arcade styles, animations, responsive layout
├── script.js        ← Full game engine, auth, canvas, questions logic
├── questions.json   ← 20 MCQ questions (Easy / Medium / Hard)
└── README.md        ← This file
```

---

## 🚀 GitHub Pages Deployment — Step by Step

### Prerequisites
- A free [GitHub account](https://github.com/signup)
- [Git installed](https://git-scm.com/downloads) on your machine
- (Optional) [GitHub Desktop](https://desktop.github.com/) for a GUI approach

---

### Method A — Command Line (Recommended)

#### Step 1 — Create a new GitHub repository

1. Go to **https://github.com/new**
2. Fill in:
   - **Repository name:** `nutrirun` (or any name you like)
   - **Description:** `Gamified Nutrition Science Learning Game`
   - **Visibility:** ✅ Public ← *required for free GitHub Pages*
   - Leave **"Add README"** unchecked (we have our own)
3. Click **"Create repository"**

#### Step 2 — Push your files

Open a terminal in your project folder and run:

```bash
# Initialise git (skip if already done)
git init

# Stage all files
git add .

# First commit
git commit -m "🥦 Initial NutriRun release"

# Connect to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/nutrirun.git

# Push to GitHub
git branch -M main
git push -u origin main
```

#### Step 3 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top tab)
3. In the left sidebar click **Pages**
4. Under **"Source"** select:
   - Branch: **`main`**
   - Folder: **`/ (root)`**
5. Click **Save**

#### Step 4 — Get your live URL

After ~60 seconds, GitHub will show:

```
✅ Your site is live at:
https://YOUR_USERNAME.github.io/nutrirun/
```

Share this link with anyone — no server needed!

---

### Method B — GitHub Desktop (No terminal)

1. Open **GitHub Desktop** → File → **New Repository**
2. Set **Local Path** to your `nutrirun/` folder
3. Click **Publish Repository** → uncheck "Keep private" → Publish
4. Go to **GitHub.com → your repo → Settings → Pages**
5. Source: `main` branch, root folder → **Save**
6. Wait 60s → your live URL appears ✅

---

### Method C — Upload via GitHub Website (Easiest)

1. Create a new repository at **github.com/new** (Public)
2. Click **"uploading an existing file"** link
3. Drag and drop all 4 files:
   - `index.html`
   - `style.css`  
   - `script.js`
   - `questions.json`
4. Click **Commit changes**
5. Go to **Settings → Pages → Source: main → Save**
6. Done! ✅

---

## 🔧 Customisation Guide

### Adding New Questions

Edit `questions.json` — each question follows this structure:

```json
{
  "id": 21,
  "difficulty": "MEDIUM",
  "question": "Your question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "explanation": "Explanation shown after answering (supports learning)."
}
```

- `difficulty`: `"EASY"` | `"MEDIUM"` | `"HARD"`
- `correct`: index of the correct option (0 = first, 3 = fourth)
- Add as many questions as you like — they cycle randomly

### Adjusting Game Difficulty

In `script.js`, find the `CONFIG` object at the top:

```js
const CONFIG = {
  LIVES: 3,              // ← change lives (e.g. 5 for easier)
  Q_TIME: 15,            // ← seconds to answer each question
  BASE_SPEED: 4,         // ← starting run speed
  MAX_SPEED: 11,         // ← maximum run speed
  SPEED_INC: 0.0008,     // ← how fast speed ramps up
  SCORE_PER_CORRECT: 100,// ← points per correct answer
  EASY_THRESHOLD: 800,   // ← distance (m) to switch to MEDIUM
  HARD_THRESHOLD: 2000,  // ← distance (m) to switch to HARD
};
```

### Changing Colors / Theme

All design tokens are CSS variables at the top of `style.css`:

```css
:root {
  --green:  #39ff7a;  /* primary accent */
  --purple: #9d3bff;  /* secondary */
  --pink:   #ff2d78;  /* danger / hard */
  --cyan:   #00e5ff;  /* info */
  --orange: #ff8c00;  /* medium difficulty */
}
```

### Adding More Badges

In `script.js`, find `ALL_BADGES` array and add:

```js
{
  id: 'new_badge',
  icon: '🎓',
  name: 'Badge Name',
  desc: 'What the player must do',
  check: u => (u.bestScore || 0) >= 10000
}
```

---

## 🧠 Topics Covered (Question Bank)

| Category | Examples |
|----------|---------|
| **Macronutrients** | Carbs, Proteins, Fats — sources, functions, RDAs |
| **Micronutrients** | Fat-soluble & water-soluble vitamins, minerals |
| **Deficiency Diseases** | Scurvy, Beriberi, Pellagra, Rickets, Xerophthalmia |
| **Clinical Nutrition** | BMI, ORS, therapeutic diets, hepatic encephalopathy |
| **Biochemistry** | TCA cycle, lipoproteins (HDL/LDL), protein digestion |
| **Diet Therapy** | Diabetes, CRF, kwashiorkor, drug-nutrient interactions |

---

## 🛠️ Technical Notes

| Feature | Implementation |
|---------|---------------|
| Game Engine | HTML5 Canvas API (vanilla JS) |
| Authentication | localStorage (simulated, no backend) |
| Leaderboard | localStorage (persists across sessions) |
| Questions | `questions.json` (fetched at load, with inline fallback) |
| Styling | Pure CSS with custom properties, no frameworks |
| Fonts | Google Fonts — Exo 2 + Space Mono |
| Responsiveness | Mobile-first, touch controls supported |
| Deployment | Static files — works on GitHub Pages, Netlify, Vercel |

> **Note:** All data (accounts, scores) is stored in the browser's localStorage.  
> Clearing browser data will reset everything. For production, connect a backend.

---

## 📱 Mobile Support

- Touch anywhere on the canvas to **jump**
- Power-ups are tap-friendly (large hit targets)
- Layout adapts for screens from 320px wide
- Works in Chrome, Safari, Firefox on iOS & Android

---

## 🐛 Troubleshooting

**Questions not loading?**  
If opening `index.html` directly from your file system (not a server), the `fetch('questions.json')` call may be blocked. The game includes 10 fallback questions automatically. For full 20 questions, use a local server:
```bash
# Python 3
python -m http.server 8080
# Then open: http://localhost:8080
```
On GitHub Pages, all 20 questions load correctly.

**Canvas not showing?**  
Make sure `script.js` is in the same folder as `index.html`. Check browser console for errors (`F12`).

**Scores not saving?**  
localStorage requires a browser environment. Private/Incognito mode may limit storage in some browsers.

---

## 📜 License

MIT License — free to use, modify, and share.  
Built for educational purposes based on *Fundamentals of Foods, Nutrition and Diet Therapy* (Mudambi & Rajagopal).

---

## 🙏 Credits

- **Question content:** Fundamentals of Foods, Nutrition and Diet Therapy — Mudambi & Rajagopal (5th Ed.)
- **Game design:** Original concept
- **Fonts:** Google Fonts (Exo 2, Space Mono)
- **No external JS libraries used**

---

*Happy Running! 🥦🏃‍♂️*
