import { Image, View } from 'react-native';

const logoSource = require('../assets/logos/logo_white.png');

export default function BrandLogo({ width, height, isDark, colors }) {
  if (isDark) {
    return (
      <Image
        source={logoSource}
        style={{ width, height }}
        resizeMode="cover"
        fadeDuration={0}
      />
    );
  }

  const accentLeft = width * 0.32;
  const accentWidth = width * 0.36;

  return (
    <View style={{ width, height, position: 'relative' }}>
      <Image
        source={logoSource}
        style={{ width, height, tintColor: colors.white }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: accentLeft,
          top: 0,
          width: accentWidth,
          height,
          overflow: 'hidden',
          backgroundColor: colors.dark,
        }}
      >
        <Image
          source={logoSource}
          style={{ position: 'absolute', left: -accentLeft, top: 0, width, height }}
          resizeMode="cover"
          fadeDuration={0}
        />
      </View>
    </View>
  );
}
