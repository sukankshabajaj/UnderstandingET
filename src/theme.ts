// Design tokens from the Understanding ET handoff (design/README.md).

/** Converts an OKLCH colour (as used in the design files) to hex, since React Native has no oklch(). */
export function oklch(L: number, C: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    lin
      .map((x) => {
        const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export const tint = (h: number) => oklch(0.94, 0.035, h);
export const mid = (h: number) => oklch(0.68, 0.09, h);
export const deep = (h: number) => oklch(0.42, 0.08, h);

export const colors = {
  bg: '#FAF9F6',
  page: '#EEF0E8',
  card: '#FFFFFF',
  border: '#E4E0D7',
  inputBorder: '#D6D1C6',
  divider: '#EEEBE4',
  text: '#2E2A35',
  muted: '#6B665D',
  secondary: '#55514A',
  body: '#4A463F',
  disabled: '#B9B4AA',
  navInactive: '#8A857B',
  brand: '#9B85B5',
  primary: '#6E5893',
  sage: '#AFC69D',
  segment: '#EBE7DF',
  infoBox: '#EFECE5',
  future: '#F0EDE6',
  missed: '#DCD8CF',
  scrim: 'rgba(30,28,24,0.4)',
  alertBg: oklch(0.93, 0.04, 25),
  alertFg: oklch(0.42, 0.1, 25),
  pickBg: tint(300),
  pickBorder: deep(300),
  doneBg: tint(150),
  doneFg: deep(150),
  helpingDot: oklch(0.62, 0.11, 150),
};

/** "Did it help?" scale: index 0 = no, 1 = a little, 2 = yes. */
export const HELP = [oklch(0.68, 0.12, 25), oklch(0.78, 0.11, 75), oklch(0.68, 0.11, 150)];
export const HELP_HUE = [25, 75, 150];

export const fonts = {
  heading: 'Quicksand_700Bold',
  body: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  icon: 'MaterialSymbolsRounded_500Medium',
};
