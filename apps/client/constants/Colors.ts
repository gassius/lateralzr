/** App palette — primary background orange, supporting neutrals and accent blue */
export const Palette = {
  orange: '#f78d1e',
  lightGray: '#cdced0',
  darkBlue: '#135b77',
  offWhite: '#f5f5f2',
  black: '#111111',
} as const;

const tintColorLight = Palette.darkBlue;
const tintColorDark = '#fff';

export default {
  light: {
    text: Palette.black,
    background: Palette.offWhite,
    tint: tintColorLight,
    tabIconDefault: Palette.lightGray,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: Palette.black,
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
