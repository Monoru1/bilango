import { Image } from 'react-native';

/**
 * Asset officiel client mission 05, affiché sans recoloration ni déformation.
 */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Image source={require('../../assets/images/logo.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Logo BilanGo" accessibilityRole="image" />
  );
}
