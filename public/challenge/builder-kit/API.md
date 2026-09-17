# $BITE APIs

Base: `https://www.bite.party`

All endpoints are CORS-friendly JSON. No auth.

## Race

```bash
curl -s https://www.bite.party/api/race | jq .
```

Progress, phase (`racing` / `core` / `rot`), deadline, burned supply, eaters snapshot.

## Leaderboard

```bash
curl -s https://www.bite.party/api/leaderboard | jq .
```

Live eater ranks + supply breakdown.

## Supply

```bash
curl -s https://www.bite.party/api/supply | jq .
```

## Circulating supply

```bash
curl -s https://www.bite.party/api/circulating-supply
```

Plain number or JSON depending on consumer — see site for live shape.

## Onchain

- Chain: Robinhood Chain `4663`
- See `addresses.json` for token + AppleKitchen
- Kitchen methods: `bite(uint256)`, `digest()`, views for `burned`, `coreTarget`, `deadline`, `phase`, `prizePool`

## Apple assets in this kit

| Path | Use |
| --- | --- |
| `stills/frame-00.png` … `frame-09.png` | 2D stop-motion / UI |
| `frames/0.glb` … `9.glb` | 3D bite stages (meshopt) |
| `frames/manifest.json` | Frame metadata |

Credit Eydeet (CC BY 4.0) — see `LICENSE-APPLE.txt`.
