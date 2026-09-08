# Apple stop-motion frames (Eydeet, CC BY 4.0)

Source: [Apple Stop Motion Animation](https://sketchfab.com/3d-models/apple-stop-motion-animation-a3e40e1540ed41fc95a9d6278b06c06b) by **Eydeet**.

## Layout

```text
public/apple/
  apple_stop_motion_animation.zip   # original Sketchfab download
  source/                           # unpacked scene.gltf (dev only, gitignored)
  frames/0.glb … 9.glb              # web-ready bite stages (meshopt)
  frames/manifest.json
  LICENSE.txt
```

## Mapping (burn progress → bite)

Sketchfab animation starts at `frame_0` (whole apple) and bites toward `frame_10`.

| UI frame | Sketchfab | Meaning     |
| -------- | --------- | ----------- |
| 0        | frame_0   | whole apple |
| 1…8      | frame_1…8 | bite stages |
| 9        | frame_9   | mostly core |

`progressToFrame()` in `src/lib/race.ts` maps 0…1 burn progress → frames 0…9.

```bash
npm run bake-apple
```
