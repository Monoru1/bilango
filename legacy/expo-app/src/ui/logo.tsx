import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

/**
 * Logo BilanGo (cahier §7) : carré arrondi vert #0F6E56, œil stylisé blanc,
 * petit graphique en barres montantes dans l'iris.
 */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="Logo BilanGo" accessibilityRole="image">
      <Rect width="96" height="96" rx="22" fill={colors.primary} />
      <Path d="M10 48 C 26 26, 70 26, 86 48 C 70 70, 26 70, 10 48 Z" fill="#FFFFFF" />
      <Circle cx="48" cy="48" r="16" fill={colors.primary} />
      <Rect x="39" y="49" width="5" height="7" rx="1" fill="#FFFFFF" />
      <Rect x="46" y="44" width="5" height="12" rx="1" fill="#FFFFFF" />
      <Rect x="53" y="39" width="5" height="17" rx="1" fill={colors.primaryLight} />
    </Svg>
  );
}
