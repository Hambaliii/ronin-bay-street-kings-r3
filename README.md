# RONIN BAY: Street Kings

A 3D open-world JDM street-racing crime game set in a sun-soaked coastal city. Join the RONIN KAI club, rise from Nobody to Street King, and take the city district by district from the VANTA syndicate — one race, one chase, and one pink slip at a time.

## Story

You are Ren, a newcomer with nothing but nerve. Under Chief Ako you earn a place in RONIN KAI: Mika keeps the club's heart beating, Jun the mechanic keeps its cars alive, and rivals Ryo and Dante of VANTA are determined to keep the bay theirs. Prove yourself and you will be handed the keys to the TEN-SECOND Taiyo, won from the chief — and in the final pink-slip showdown, the legendary BAYSIDE GHOST GT-X is on the line.

## Features

- 4 districts plus a mountain touge, in one drivable coastal city
- 16 car models with distinct silhouettes, including 5 JDM cars, 2 hero cars and 2 police variants
- 12 chained story missions
- Territory war with district income
- 1–5 star police system with roadblocks, spike strips and a helicopter
- Dynamic events around the city
- Garage customization
- Full day/night cycle
- Pedestrians and a named NPC cast with varied bodies and outfits
- On-foot mode — get out and walk the streets you race
- Styled neon HUD

## Controls

- **WASD / Arrow keys** — drive (and move on foot)
- **F** — enter / exit car
- **Shift** — NOS
- **Space** — handbrake
- **E** — garage at HQ
- **M** — mute
- **P / Esc** — pause

## Running locally

No build step is needed. Serve the repository root with any static file server, then open `game/index.html` in a browser.

For example:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/game/index.html
```

## Tech

- [three.js](https://threejs.org/), vendored minified — no build step
- Seeded, deterministic world generation
- WebAudio-synthesized sound — no audio assets
