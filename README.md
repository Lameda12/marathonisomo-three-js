# Marathon Runner 3D 🏃‍♂️🏁

A web-based animated marathon race game built with [Three.js](https://threejs.org/).

Race 42.2 km (compressed to a ~5 minute sprint of strategy) against 7 AI runners
through a city course with cheering crowds, km markers, and aid stations.

## Play

No build step — it's plain ES modules with Three.js loaded from a CDN.
Serve the folder with any static server and open it in a browser:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

| Input | Action |
|---|---|
| `W` / `↑` | Run at cruise pace |
| `Shift` / `Space` | Sprint (drains stamina fast) |
| `A` `D` / `←` `→` | Move sideways across the road |

On touch devices, on-screen buttons appear automatically.

## Gameplay

- **Stamina**: sprinting burns it fast, and even cruising drains it slowly over
  the full distance. Ease off to recover.
- **Hitting the wall**: run your stamina to zero and you're reduced to a shuffle
  until you recover enough for a second wind.
- **Aid stations**: every ~5 km there are water tables on both sides of the road —
  swing wide and pass close to one for +40 stamina.
- **AI runners** have individual pacing strategies, a mid-race rough patch, and a
  finishing kick. Watch the progress bar up top to track the field.

## Tech notes

- Procedurally animated low-poly runners (articulated hips/knees/shoulders/elbows,
  stride frequency tied to speed).
- Scenery (trees, buildings, crowds, road markings) is built in 100 m chunks that
  are recycled ahead of the player as the race progresses.
- Cheering spectators are instanced meshes with per-instance bob phases.
- Confetti particle burst at the finish line.
