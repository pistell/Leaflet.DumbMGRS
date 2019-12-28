// * GRID ZONE DESIGNATOR OBJECT * //
// letter = a band of latitude
const northingDict = {
  X: {
    letter: 'X',
    top: 84,
    bottom: 72,
  },
  W: {
    letter: 'W',
    top: 72,
    bottom: 64,
  },
  V: {
    letter: 'V',
    top: 64,
    bottom: 56,
  },
  U: {
    letter: 'U',
    top: 56,
    bottom: 48,
  },
  T: {
    letter: 'T',
    top: 48,
    bottom: 40,
  },
  S: {
    letter: 'S',
    top: 40,
    bottom: 32,
  },
  R: {
    letter: 'R',
    top: 32,
    bottom: 24,
  },
  Q: {
    letter: 'Q',
    top: 24,
    bottom: 16,
  },
  P: {
    letter: 'P',
    top: 16,
    bottom: 8,
  },
  N: {
    letter: 'N',
    top: 8,
    bottom: 0,
  },
  M: {
    letter: 'M',
    top: 0,
    bottom: -8,
  },
  L: {
    letter: 'L',
    top: -8,
    bottom: -16,
  },
  K: {
    letter: 'K',
    top: -16,
    bottom: -24,
  },
  J: {
    letter: 'J',
    top: -24,
    bottom: -32,
  },
  H: {
    letter: 'H',
    top: -32,
    bottom: -40,
  },
  G: {
    letter: 'G',
    top: -40,
    bottom: -48,
  },
  F: {
    letter: 'F',
    top: -48,
    bottom: -56,
  },
  E: {
    letter: 'E',
    top: -56,
    bottom: -64,
  },
  D: {
    letter: 'D',
    top: -64,
    bottom: -72,
  },
  C: {
    letter: 'C',
    top: -72,
    bottom: -80,
  },
};

// id = UTM zone
const eastingDict = {
  1: {
    id: '1',
    left: -180,
    right: -174,
  },
  2: {
    id: '2',
    left: -174,
    right: -168,
  },
  3: {
    id: '3',
    left: -168,
    right: -162,
  },
  4: {
    id: '4',
    left: -162,
    right: -156,
  },
  5: {
    id: '5',
    left: -156,
    right: -150,
  },
  6: {
    id: '6',
    left: -150,
    right: -144,
  },
  7: {
    id: '7',
    left: -144,
    right: -138,
  },
  8: {
    id: '8',
    left: -138,
    right: -132,
  },
  9: {
    id: '9',
    left: -132,
    right: -126,
  },
  10: {
    id: '10',
    left: -126,
    right: -120,
  },
  11: {
    id: '11',
    left: -120,
    right: -114,
  },
  12: {
    id: '12',
    left: -114,
    right: -108,
  },
  13: {
    id: '13',
    left: -108,
    right: -102,
  },
  14: {
    id: '14',
    left: -102,
    right: -96,
  },
  15: {
    id: '15',
    left: -96,
    right: -90,
  },
  16: {
    id: '16',
    left: -90,
    right: -84,
  },
  17: {
    id: '17',
    left: -84,
    right: -78,
  },
  18: {
    id: '18',
    left: -78,
    right: -72,
  },
  19: {
    id: '19',
    left: -72,
    right: -66,
  },
  20: {
    id: '20',
    left: -66,
    right: -60,
  },
  21: {
    id: '21',
    left: -60,
    right: -54,
  },
  22: {
    id: '22',
    left: -54,
    right: -48,
  },
  23: {
    id: '23',
    left: -48,
    right: -42,
  },
  24: {
    id: '24',
    left: -42,
    right: -36,
  },
  25: {
    id: '25',
    left: -36,
    right: -30,
  },
  26: {
    id: '26',
    left: -30,
    right: -24,
  },
  27: {
    id: '27',
    left: -24,
    right: -18,
  },
  28: {
    id: '28',
    left: -18,
    right: -12,
  },
  29: {
    id: '29',
    left: -12,
    right: -6,
  },
  30: {
    id: '30',
    left: -6,
    right: 0,
  },
  31: {
    id: '31',
    left: 0,
    right: 6,
  },
  32: {
    id: '32',
    left: 6,
    right: 12,
  },
  33: {
    id: '33',
    left: 12,
    right: 18,
  },
  34: {
    id: '34',
    left: 18,
    right: 24,
  },
  35: {
    id: '35',
    left: 24,
    right: 30,
  },
  36: {
    id: '36',
    left: 30,
    right: 36,
  },
  37: {
    id: '37',
    left: 36,
    right: 42,
  },
  38: {
    id: '38',
    left: 42,
    right: 48,
  },
  39: {
    id: '39',
    left: 48,
    right: 54,
  },
  40: {
    id: '40',
    left: 54,
    right: 60,
  },
  41: {
    id: '41',
    left: 60,
    right: 66,
  },
  42: {
    id: '42',
    left: 66,
    right: 72,
  },
  43: {
    id: '43',
    left: 72,
    right: 78,
  },
  44: {
    id: '44',
    left: 78,
    right: 84,
  },
  45: {
    id: '45',
    left: 84,
    right: 90,
  },
  46: {
    id: '46',
    left: 90,
    right: 96,
  },
  47: {
    id: '47',
    left: 96,
    right: 102,
  },
  48: {
    id: '48',
    left: 102,
    right: 108,
  },
  49: {
    id: '49',
    left: 108,
    right: 114,
  },
  50: {
    id: '50',
    left: 114,
    right: 120,
  },
  51: {
    id: '51',
    left: 120,
    right: 126,
  },
  52: {
    id: '52',
    left: 126,
    right: 132,
  },
  53: {
    id: '53',
    left: 132,
    right: 138,
  },
  54: {
    id: '54',
    left: 138,
    right: 144,
  },
  55: {
    id: '55',
    left: 144,
    right: 150,
  },
  56: {
    id: '56',
    left: 150,
    right: 156,
  },
  57: {
    id: '57',
    left: 156,
    right: 162,
  },
  58: {
    id: '58',
    left: 162,
    right: 168,
  },
  59: {
    id: '59',
    left: 168,
    right: 174,
  },
  60: {
    id: '60',
    left: 174,
    right: 180,
  },
};

export { northingDict, eastingDict };
