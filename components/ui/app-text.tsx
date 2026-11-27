import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type Text as NativeTextInstance,
  type TextInput as NativeTextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';

import { colors, fontFamilies, typography } from '@/src/view/theme/tokens';

function fontFamilyForWeight(style: StyleProp<TextStyle>): string {
  const weight = StyleSheet.flatten(style)?.fontWeight;

  switch (weight) {
    case '400':
      return fontFamilies.regular;
    case '500':
      return fontFamilies.medium;
    case '600':
      return fontFamilies.semibold;
    case '700':
    case 'bold':
      return fontFamilies.bold;
    case '800':
      return fontFamilies.extraBold;
    case '900':
      return fontFamilies.black;
    default:
      return fontFamilies.regular;
  }
}

function resolvedTextStyle(style: StyleProp<TextStyle>): TextStyle {
  const flattened = StyleSheet.flatten(style);
  const fontSize = flattened?.fontSize ?? typography.size.body;

  return {
    fontFamily: fontFamilyForWeight(style),
    fontSize,
    lineHeight: flattened?.lineHeight ?? Math.round(fontSize * 1.4),
  };
}

/** Text that applies the shared Inter family while preserving intentional component sizes. */
export const AppText = forwardRef<NativeTextInstance, TextProps>(
  ({ style, ...props }, ref) => (
    <NativeText
      {...props}
      ref={ref}
      style={[styles.textBase, style, resolvedTextStyle(style)]}
    />
  ),
);
AppText.displayName = 'AppText';

/** TextInput counterpart so entered text matches the app typography. */
export const AppTextInput = forwardRef<NativeTextInputInstance, TextInputProps>(
  ({ style, ...props }, ref) => {
    const flattened = StyleSheet.flatten(style);
    const fontSize = flattened?.fontSize ?? typography.size.body;

    return (
      <NativeTextInput
        {...props}
        ref={ref}
        style={[
          styles.inputBase,
          style,
          {
            fontFamily: fontFamilyForWeight(style),
            fontSize,
            lineHeight: flattened?.lineHeight ?? typography.lineHeight.body,
          },
        ]}
      />
    );
  },
);
AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  textBase: {
    color: colors.text.primary,
  },
  inputBase: {
    color: colors.text.primary,
  },
});
