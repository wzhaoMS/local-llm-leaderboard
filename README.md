# Local LLM leaderboard

A static leaderboard of open-weight LLMs benchmarked on one desktop workstation.

| | |
|---|---|
| GPUs | NVIDIA RTX PRO 6000 Blackwell (96 GB) + GeForce RTX 5090 (32 GB) |
| CPU | AMD Ryzen 9 9950X3D2 (16 cores / 32 threads) |
| RAM | 128 GB |
| Storage | Two NVMe drives (4 TB + 512 GB) |
| Engine | llama.cpp with CUDA |

Every model answers the same private task set: daily work, coding, agents and long sessions. The answers are graded automatically. Models that don't fit in VRAM run with their experts in system RAM or streamed from the NVMe drives.

The site publishes aggregates only: scores with 95% intervals, speed and what worked on this hardware. Prompts, answers and task ids stay private.

## View it locally

Open `index.html` in a browser. There is no build step and no server, and the page makes no network requests.

`index.html?only=<section-id>` renders a single section. The screenshot tool uses it.

## Check it

```
uv run tools/smoke.py
powershell -File tools/shot.ps1 -Only heatmap -Width 390
```

`smoke.py` serves the repo over http, loads the page in headless Chrome at desktop and phone widths and clicks through every control. It fails on any script error, console error or sideways scroll. `shot.ps1` saves a screenshot of the page or of one section to `.shots/`.

## Layout

| Path | Contents |
|---|---|
| `index.html` | Page shell |
| `data/leaderboard.js` | Generated data (`window.LB_DATA`). `leaderboard.json` holds the same content. |
| `src/base.js`, `src/base.css` | Design system, shared helpers, header, hero and footer |
| `src/sections/*` | One JS and CSS pair per section, registered with `LB.register` |
| `assets/fonts/` | Geist font (SIL Open Font License 1.1) |
| `tools/shot.ps1` | Headless Chrome screenshot helper |
| `tools/smoke.py` | Headless Chrome smoke test: renders every section and exercises the controls |
| `docs/ARCHITECTURE.md` | Section contract and data schema |

## Update the data

The private benchmark harness exports the data:

```
uv run export_leaderboard.py --out <path to this repo>/data
```

Then commit `data/leaderboard.js` and `data/leaderboard.json`.

## Hosting

The site is served by GitHub Pages from the root of the `main` branch. `.nojekyll` makes Pages serve the files as they are. Any static host works.

## License

Code and data are under the MIT license (see `LICENSE`). The Geist font is under the SIL Open Font License 1.1 (see `assets/fonts/OFL.txt`).

The layout is inspired by [llmleaderboard.com](https://llmleaderboard.com/). No code or assets were copied from it.
