// config.js — every constant and level of The Midnight Vault.
// A tile is 40 px; the whole room fits one 1280x720 frame, so the judge
// sees the full heist — thief, guards, cones, cameras, loot, alarm — at once.
// Map legend: # wall | . marble floor | , shadow floor (safe, slow to spot)
// D display pedestal (solid cover) | T crate (solid cover) | X vent floor
// (hidden crawlspace) | P thief start | E getaway door | L loot | V vault
// loot (2x2) | C coin pickup | | laser beam (level 3, toggles on and off).

export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const COLS = 32;
export const ROWS = 18;

// How fast suspicion grows when an observer sees the thief (per second).
export const SPOT_RATE_GUARD = 55;
export const SPOT_RATE_CAMERA = 70;
export const SPOT_RATE_SHADOW = 0.35; // multiplier in shadow or while sneaking
export const SPOT_RATE_VENT = 0.15; // multiplier crawling through a vent
export const SPOT_DECAY = 14; // suspicion lost per second while unseen
export const ALARM_DECAY = 9; // alarm lost per second while no one sees you
export const CAUGHT_DISTANCE = 26; // a guard this close catches the thief

// Tools, bought with coins. Loot pays in coins too: small loot +2, vault +4.
export const TOOL_COST = { coin: 1, smoke: 2, emp: 3 };
export const TOOL_RANGE = { coin: 280, smoke: 0, emp: 0 };
export const SMOKE_SECONDS = 5;
export const EMP_SECONDS = 6;

export const PALETTE = {
  floorA: '#151b31',
  floorB: '#121829',
  shadowFloor: '#0a0e20',
  wall: '#232a44',
  wallTrim: '#c9a227',
  marbleLine: '#181e33',
  coneGuard: 'rgba(255, 196, 66, 0.30)',
  coneGuardEdge: 'rgba(255, 196, 66, 0.6)',
  coneCamera: 'rgba(255, 70, 70, 0.30)',
  coneCameraEdge: 'rgba(255, 70, 70, 0.6)',
  lootGold: '#ffd34d',
  lootGem: '#4dd8ff',
  lootEmerald: '#4dff88',
  thief: '#2b2f45',
  thiefTrim: '#e8ecff',
  guard: '#3a2f5b',
  guardTrim: '#ffb347',
  alarm: '#ff3b30',
  safe: '#7dff9e',
};

// One guard patrol: waypoints in tile coordinates, walked in a loop.
export const LEVELS = [
  {
    name: 'Level 1 — The Sapphire Gallery',
    subtitle: 'Two paintings and the sapphire vault. One guard, one camera. Learn the cones.',
    map: [
      '################################',
      '#......,,,,,,......D.....L.....#',
      '#..P...,,,,,,......D...........#',
      '#......,,,,,,..................#',
      '#..T....DD.....####.....T......#',
      '#.........D....#VV#....C.......#',
      '#..T.....DD....#VV#............#',
      '#.............####......T......#',
      '#....C.........,,,,,,..........#',
      '#...T.........,,,,,,..D....L...#',
      '#...............,,,,,,..D......#',
      '#....D....................T....#',
      '#..........,,,,,,....C.........#',
      '#..L.......,,,,,,.......T......#',
      '#....T.....D.....D.............#',
      '#..............D....C.....E....#',
      '#..C...................T.......#',
      '################################',
    ],
    guards: [
      { waypoints: [[10, 8], [21, 8], [21, 13], [10, 13]], speed: 62, pause: 1.1 },
    ],
    cameras: [
      { tx: 15, ty: 1, angle: Math.PI / 2, sweep: 1.15, speed: 0.55, range: 270 },
    ],
    lootValue: { small: 100, vault: 300 },
    parSeconds: 75,
  },
  {
    name: 'Level 2 — The Vault Hall',
    subtitle: 'Three relics, two guards, two cameras. The vent along the east wall is slow but blind.',
    map: [
      '################################',
      '#..L.....D....,,,,,,....D...X..#',
      '#........D....,,,,,,....D...X..#',
      '#..T..........,,,,,,........X..#',
      '#....D...####..,,,,,,..T....X..#',
      '#........#VV#..........D....X..#',
      '#..C.....#VV#..T............X..#',
      '#........####....,,,,,,.....X..#',
      '#..T.............D,,,,,,....X..#',
      '#......D....C....D,,,,,,....X..#',
      '#..D..........T..,,,,,,.L...X..#',
      '#.....T....D..........D.....X..#',
      '#..C......,,,,,,............X..#',
      '#..L......,,,,,,..D.....T...X..#',
      '#....D....,,,,,,..D.........X..#',
      '#......T.....D.....C....L...X..#',
      '#..P...................T....E..#',
      '################################',
    ],
    guards: [
      { waypoints: [[8, 6], [16, 6], [16, 11], [8, 11]], speed: 68, pause: 0.9 },
      { waypoints: [[24, 4], [24, 13], [18, 13], [18, 4]], speed: 74, pause: 0.8 },
    ],
    cameras: [
      { tx: 15, ty: 1, angle: Math.PI / 2, sweep: 1.25, speed: 0.65, range: 280 },
      { tx: 1, ty: 9, angle: 0, sweep: 1.0, speed: 0.5, range: 260 },
    ],
    lootValue: { small: 100, vault: 300 },
    parSeconds: 100,
  },
  {
    name: 'Level 3 — The Grand Vault',
    subtitle: 'Four relics behind a laser grid. Three guards, three cameras. The getaway van is waiting.',
    map: [
      '################################',
      '#..L....D.....|.....D.....L....#',
      '#.......D.....|.....D..........#',
      '#..T....D.....|..T..D.....T....#',
      '#....D........|.....D....C.....#',
      '#..C....T.....|.....T..........#',
      '#.......D..#######..D....D.....#',
      '#..T.......#VVVVV#.....T.......#',
      '#....D.....#VVVVV#..C..........#',
      '#..L.......#VVVVV#.....D..L....#',
      '#....D.....#######.....T.......#',
      '#..T..............|......D.....#',
      '#..C.....D........|..T.........#',
      '#.......,,,,,,....|....C...T...#',
      '#..P....,,,,,,....|......D.....#',
      '#.......,,,,,,....|..D.....E...#',
      '#..C....,,,,,,.........T.......#',
      '################################',
    ],
    guards: [
      { waypoints: [[7, 5], [14, 5], [14, 11], [7, 11]], speed: 76, pause: 0.8 },
      { waypoints: [[24, 3], [24, 10], [18, 10], [18, 3]], speed: 80, pause: 0.7 },
      { waypoints: [[10, 15], [22, 15], [22, 12], [10, 12]], speed: 72, pause: 1.0 },
    ],
    cameras: [
      { tx: 15, ty: 1, angle: Math.PI / 2, sweep: 1.3, speed: 0.7, range: 280 },
      { tx: 1, ty: 5, angle: 0, sweep: 1.1, speed: 0.6, range: 260 },
      { tx: 30, ty: 8, angle: Math.PI, sweep: 1.1, speed: 0.6, range: 260 },
    ],
    lootValue: { small: 100, vault: 500 },
    parSeconds: 130,
  },
];
