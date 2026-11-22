// RONIN BAY: STREET KINGS — config.js (Session 1 foundation)
export const CFG = { world: 1320, roadEvery: 165, roadW: 30, dayLength: 240 };

export const DISTRICTS = [
  { id: 'port', name: 'Portside', x0: -660, z0: 0, x1: 0, z1: 660, ground: 0xa89a86, building: [0xcbb59a, 0xbfae94, 0xd8c6a8, 0xa89880], accent: 0xff8c42 },
  { id: 'beach', name: 'Coral Strip', x0: 0, z0: 0, x1: 660, z1: 660, ground: 0xf0d49a, building: [0xffe3c2, 0xfff3e2, 0xffd0ae, 0xffffff], accent: 0xff6b9d },
  { id: 'neon', name: 'Neon Mile', x0: 0, z0: -660, x1: 660, z1: 0, ground: 0x767e8d, building: [0x9aa6ba, 0x8b98ad, 0xaebdd1, 0x93a5bd], accent: 0x00f5d4 },
  { id: 'hill', name: 'Hoshino Heights', x0: -660, z0: -660, x1: 0, z1: 0, ground: 0x6f9a5e, building: [0xd9e2c8, 0xc4d4ae, 0xe8efdb, 0xb7c9a0], accent: 0xffb7d5 }
];

function style(o) { return o; }
function car(id, name, cls, topSpeed, accel, grip, drift, health, price, st, desc) {
  return { id, name, cls, topSpeed, accel, grip, drift, driftFactor: drift, health, price, style: st, desc };
}

export const CARS = [
  car('sedan', 'City Sedan', 'sedan', 38, 18, .92, .4, 100, 0,
    style({ length: 4.5, width: 1.9, height: 1.42, hoodLen: 1.15, cabinBack: 0.15, cabinLen: 2.0, cabinH: .5, noseSlope: .25, tail: 'notch', wheelR: .36, wing: 'none' }),
    'Honest four-door. The bay runs on these.'),
  car('suv', 'Trail SUV', 'suv', 36, 16, .95, .3, 140, 0,
    style({ length: 4.9, width: 2.05, height: 1.95, hoodLen: .95, cabinBack: .35, cabinLen: 2.9, cabinH: .78, noseSlope: .1, tail: 'suv', wheelR: .44, wing: 'none' }),
    'Tall, tough, and in no particular hurry.'),
  car('truck', 'Cargo Truck', 'truck', 30, 12, .9, .2, 200, 0,
    style({ length: 7.6, width: 2.4, height: 2.9, hoodLen: 1.1, cabinBack: 0, cabinLen: 1.4, cabinH: .8, noseSlope: .05, tail: 'truck', wheelR: .5, wing: 'none' }),
    'Port muscle. Slow to start, hard to stop.'),
  car('taxi', 'Bay Taxi', 'taxi', 40, 20, .92, .4, 100, 0,
    style({ length: 4.5, width: 1.9, height: 1.42, hoodLen: 1.15, cabinBack: 0.15, cabinLen: 2.0, cabinH: .5, noseSlope: .25, tail: 'notch', wheelR: .36, wing: 'none', livery: 'taxi' }),
    'Knows every shortcut in Kairyu Bay. Allegedly.'),
  car('police', 'Interceptor', 'police', 52, 28, .94, .35, 160, 0,
    style({ length: 4.7, width: 2.0, height: 1.42, hoodLen: 1.3, cabinBack: .1, cabinLen: 1.9, cabinH: .5, noseSlope: .3, tail: 'notch', wheelR: .38, wing: 'small', livery: 'police' }),
    'RBPD pursuit unit. Do not test it.'),
  car('police-suv', 'Interceptor SUV', 'police', 50, 26, .95, .3, 190, 0,
    style({ length: 4.9, width: 2.05, height: 1.95, hoodLen: .95, cabinBack: .35, cabinLen: 2.9, cabinH: .78, noseSlope: .1, tail: 'suv', wheelR: .44, wing: 'none', livery: 'police' }),
    'RBPD heavy pursuit. Arrives at wanted level three.'),
  car('kei', 'Mame Kei', 'kei', 30, 16, .9, .3, 80, 0,
    style({ length: 3.3, width: 1.55, height: 1.75, hoodLen: .5, cabinBack: .1, cabinLen: 2.2, cabinH: .8, noseSlope: .05, tail: 'hatch', wheelR: .3, wing: 'none' }),
    'Tiny box, enormous heart.'),
  car('hatch', 'Pico Hatch', 'hatch', 36, 19, .92, .45, 90, 0,
    style({ length: 3.9, width: 1.75, height: 1.5, hoodLen: .85, cabinBack: .3, cabinLen: 2.1, cabinH: .55, noseSlope: .3, tail: 'hatch', wheelR: .34, wing: 'small' }),
    'Shopping trolley with racing ambitions.'),
  car('roadster', 'Kaze Roadster', 'roadster', 44, 24, .93, .5, 95, 0,
    style({ length: 4.1, width: 1.8, height: 1.12, hoodLen: 1.5, cabinBack: .55, cabinLen: 1.1, cabinH: .3, noseSlope: .5, tail: 'roadster', wheelR: .36, wing: 'none' }),
    'Open top, open throttle, Coral Strip royalty.'),
  car('hachi', 'HACHI GT-86 "Tofu Runner"', 'coupe', 42, 22, .9, .65, 110, 8000,
    style({ length: 4.25, width: 1.78, height: 1.32, hoodLen: 1.15, cabinBack: .3, cabinLen: 2.0, cabinH: .5, noseSlope: .15, tail: 'hatch', wheelR: .34, wing: 'small', popups: true, livery: 'panda' }),
    'Boxy eighties legend in panda two-tone. The touge teacher.'),
  car('sora15', 'SORA SL-15', 'coupe', 50, 27, .82, .95, 110, 22000,
    style({ length: 4.5, width: 1.78, height: 1.24, hoodLen: 1.35, cabinBack: .25, cabinLen: 1.85, cabinH: .46, noseSlope: .45, tail: 'notch', wheelR: .36, wing: 'ducktail' }),
    'Slim, sharp, sideways by religion. No big wing, ever.'),
  car('hoshi7', 'HOSHI RE-7', 'coupe', 54, 30, .93, .6, 105, 34000,
    style({ length: 4.3, width: 1.86, height: 1.16, hoodLen: 1.55, cabinBack: .3, cabinLen: 1.7, cabinH: .42, noseSlope: .7, tail: 'fastback', wheelR: .36, wing: 'small', popups: true, roundTail: true }),
    'The lowest wedge in the bay. Smooth, round, rotary-hearted.'),
  car('taiyo', 'TAIYO JZ-400', 'coupe', 60, 32, .92, .55, 120, 48000,
    style({ length: 4.55, width: 1.92, height: 1.26, hoodLen: 1.7, cabinBack: .35, cabinLen: 1.8, cabinH: .44, noseSlope: .55, tail: 'fastback', wheelR: .38, wing: 'curved', roundTail: true }),
    'Long hood, teardrop cabin, that tall curved wing.'),
  car('kaze', 'KAZE GT-X', 'coupe', 62, 36, .98, .45, 130, 72000,
    style({ length: 4.7, width: 2.0, height: 1.34, hoodLen: 1.35, cabinBack: .2, cabinLen: 1.9, cabinH: .5, noseSlope: .2, tail: 'notch', wheelR: .39, wing: 'big', quadTail: true }),
    'Squared muscle, quad round tails, godzilla posture.'),
  car('hero-supra', 'TAIYO JZ-400 "TEN-SECOND"', 'coupe', 64, 42, .92, .6, 130, 0,
    style({ length: 4.55, width: 1.92, height: 1.26, hoodLen: 1.7, cabinBack: .35, cabinLen: 1.8, cabinH: .44, noseSlope: .55, tail: 'fastback', wheelR: .38, wing: 'curved', roundTail: true, livery: 'hero-supra' }),
    "Chief Ako's ten-second Taiyo. Win it, don't buy it."),
  car('hero-gtr', 'KAZE GT-X "BAYSIDE GHOST"', 'coupe', 66, 40, .99, .45, 140, 0,
    style({ length: 4.7, width: 2.0, height: 1.34, hoodLen: 1.35, cabinBack: .2, cabinLen: 1.9, cabinH: .5, noseSlope: .2, tail: 'notch', wheelR: .39, wing: 'big', quadTail: true, livery: 'hero-gtr' }),
    "Dante's Bayside Ghost. The whole city is the stake.")
];

export const CLUB_RANKS = [
  { name: 'Nobody', rep: 0 }, { name: 'Prospect', rep: 100 }, { name: 'Runner', rep: 300 },
  { name: 'Drifter', rep: 600 }, { name: 'Street Ace', rep: 1000 }, { name: 'Touge King', rep: 1500 },
  { name: 'Street King', rep: 2200 }
];

export const CAST = [
  { id: 'ren', name: 'Ren', role: 'mc', shirt: 0xff7a1a, pants: 0x22242c, skin: 0xe8b08a, hat: 'cap', hatColor: 0x181818, hair: 0x1a1a1a, height: 1.0, build: 1.0, outfit: 'jacket' },
  { id: 'ako', name: 'Chief Ako', role: 'chief', shirt: 0x181818, pants: 0x2c2f38, skin: 0xd9a075, hat: 'none', hair: 0xbbbbbb, height: 1.06, build: 1.25, outfit: 'jacket' },
  { id: 'mika', name: 'Mika', role: 'lieutenant', shirt: 0xff2e88, pants: 0x23232e, skin: 0xf0c09a, hat: 'none', hair: 0x3a2318, height: 0.94, build: 0.85, outfit: 'dress', hairStyle: 'long' },
  { id: 'jun', name: 'Jun', role: 'mechanic', shirt: 0x3a6ea8, pants: 0x5a4632, skin: 0xc98e62, hat: 'cap', hatColor: 0x3a6ea8, hair: 0x14100c, height: 0.97, build: 1.1, outfit: 'overalls' },
  { id: 'ryo', name: 'Ryo', role: 'rival', shirt: 0x6a1fb0, pants: 0x1c1c22, skin: 0xe0aa7e, hat: 'none', hair: 0x0e0e12, height: 1.0, build: 0.9, outfit: 'hoodie' },
  { id: 'dante', name: 'Dante', role: 'boss', shirt: 0xb02020, pants: 0x191920, skin: 0xb87f52, hat: 'none', hair: 0x050505, height: 1.08, build: 1.2, outfit: 'jacket' },
  { id: 'cop', name: 'Officer', role: 'cop', shirt: 0x1c2f5e, pants: 0x141c30, skin: 0xe0aa7e, hat: 'cap', hatColor: 0x1c2f5e, hair: 0x222222, height: 1.02, build: 1.05, outfit: 'jacket' }
];

export const MISSIONS = [
  { id: 'm1', name: 'First Keys', giver: 'Mika', type: 'meet', brief: 'Mika: Welcome to RONIN KAI, Ren. Take the Hachi and meet me at the lot.\nMika: No heroics. Just prove you can find us.' },
  { id: 'm2', name: 'Strip Run', giver: 'Mika', type: 'sprint', params: { time: 75 }, brief: 'Mika: Coral Strip, point to point, traffic and all.\nMika: Beat the clock and the club starts taking you seriously.' },
  { id: 'm3', name: 'Parts Runner', giver: 'Jun', type: 'delivery', params: { time: 90 }, brief: 'Jun: Turbo kit needs to reach Neon Mile before the shop closes.\nJun: Timed delivery. Do not dent the box, do not be late.' },
  { id: 'm4', name: 'Drift School', giver: 'Ako', type: 'drift', params: { score: 1200 }, brief: 'Ako: Anyone can go fast straight. Drift School is sideways.\nAko: Chain your slides and hit the score I set.' },
  { id: 'm5', name: 'Vanta Warning', giver: 'Mika', type: 'disable', brief: 'Mika: A VANTA scout is watching the port. Disable their car.\nMika: Ram it, box it, make them limp home.' },
  { id: 'm6', name: 'Convoy Jack', giver: 'Jun', type: 'jack', brief: 'Jun: VANTA money truck rolls through Portside at dusk.\nJun: Stop it, take the cut, lose the heat.' },
  { id: 'm7', name: 'Touge Trial', giver: 'Ako', type: 'timetrial', params: { time: 110 }, brief: 'Ako: Hoshino touge. One run, guardrails unforgiving.\nAko: Beat my time and the hill is yours.' },
  { id: 'm8', name: 'Neon Takeover', giver: 'Mika', type: 'hold', params: { time: 60 }, brief: 'Mika: Hold Neon Mile. VANTA will come in waves.\nMika: Territory is respect you can park on.' },
  { id: 'm9', name: 'Pink Slip SL-15', giver: 'Ryo (Vanta)', type: 'pinkslip', params: { winCar: 'sora15' }, brief: 'Ryo: My SORA SL-15 against your pride, Ren.\nRyo: Lose and walk home. Win and she is yours.' },
  { id: 'm10', name: "Chief's Challenge", giver: 'Chief Ako', type: 'race', params: { winCar: 'hero-supra' }, brief: 'Ako: You beat my drivers. Now beat me.\nAko: Win and my TEN-SECOND Taiyo changes hands.' },
  { id: 'm11', name: 'Portside Push', giver: 'Mika', type: 'hold', params: { time: 75 }, brief: 'Mika: Final push. Take Portside and VANTA lose the docks.\nMika: Everything we built rides on this night.' },
  { id: 'm12', name: 'Bayside Ghost', giver: 'Dante (Vanta)', type: 'pinkslip', params: { winCar: 'hero-gtr', ending: true }, brief: 'Dante: One race for Kairyu Bay, Ghost against you.\nDante: Winner takes the city. Loser is a story.' }
];

export const TOUGE_POINTS = [[-620, -40], [-520, -120], [-580, -220], [-440, -300], [-500, -420], [-360, -500], [-260, -560], [-140, -600]];
