// Small building blocks that match the Understanding ET design tokens.
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { GLYPHS } from './glyphs';

// --- Text ---------------------------------------------------------------------

interface TProps {
  children?: React.ReactNode;
  size?: number;
  bold?: boolean;
  heading?: boolean;
  color?: string;
  lh?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  upper?: boolean;
}

export function T({ children, size = 16, bold, heading, color = colors.text, lh, align, style, numberOfLines, upper }: TProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: heading ? fonts.heading : bold ? fonts.bold : fonts.body,
          fontSize: size,
          color,
          lineHeight: lh ? Math.round(size * lh) : undefined,
          textAlign: align,
        },
        upper && { textTransform: 'uppercase', letterSpacing: size * 0.06 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// --- Icons (Material Symbols Rounded, weight 500) ----------------------------------

export function Icon({ name, size = 24, color = colors.text, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const glyph = GLYPHS[name];
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      style={[{ fontFamily: fonts.icon, fontSize: size, lineHeight: size, width: size, height: size, color, textAlign: 'center' }, style]}
    >
      {glyph ?? ''}
    </Text>
  );
}

// --- Buttons --------------------------------------------------------------------

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'dashed';
type BtnSize = 'lg' | 'md' | 'sm';

interface BtnProps {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  a11yLabel?: string;
}

const SIZES: Record<BtnSize, { pad: number; font: number; radius: number; minH: number }> = {
  lg: { pad: 18, font: 18, radius: 18, minH: 56 },
  md: { pad: 15, font: 16, radius: 16, minH: 52 },
  sm: { pad: 8, font: 14, radius: 10, minH: 36 },
};

export function Btn({ label, onPress, variant = 'primary', size = 'lg', disabled, icon, style, color, a11yLabel }: BtnProps) {
  const sz = SIZES[size];
  const fg = variant === 'primary' ? '#fff' : color ?? (variant === 'ghost' ? colors.secondary : colors.text);
  const base: ViewStyle = {
    minHeight: sz.minH,
    borderRadius: sz.radius,
    paddingVertical: size === 'sm' ? sz.pad : sz.pad - 2,
    paddingHorizontal: size === 'sm' ? 14 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };
  const look: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: disabled ? colors.disabled : colors.primary }
      : variant === 'secondary'
        ? { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary }
        : variant === 'dashed'
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.disabled }
          : { backgroundColor: 'transparent' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [base, look, pressed && { opacity: 0.85 }, style]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <T bold size={sz.font} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** A round 44px icon-only button (back arrows, speaker, settings). */
export function IconBtn({ icon, onPress, label, bg = 'transparent', color = colors.text, size = 24, style }: { icon: string; onPress: () => void; label: string; bg?: string; color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }, style]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function BackLink({ label = 'Back', onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: 'flex-start', paddingVertical: 8, minHeight: 44, justifyContent: 'center' }}>
      <T bold size={16}>
        ← {label}
      </T>
    </Pressable>
  );
}

// --- Containers -------------------------------------------------------------------

export function Card({ children, style, gap = 12, pad = 16, radius = 20 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; pad?: number; radius?: number }) {
  return <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: pad, gap }, style]}>{children}</View>;
}

export function Col({ children, gap = 0, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({ children, gap = 0, style, align = 'center', justify }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap }, style]}>{children}</View>;
}

/** Lays children out in an equal-width grid (CSS grid-template-columns: repeat(n, 1fr)). */
export function Grid({ children, cols, gap = 6 }: { children: React.ReactNode; cols: number; gap?: number }) {
  const items = React.Children.toArray(children);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {r.map((c, j) => (
            <View key={j} style={{ flex: 1, minWidth: 0 }}>
              {c}
            </View>
          ))}
          {Array.from({ length: cols - r.length }).map((_, j) => (
            <View key={`pad${j}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function InfoBox({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <Row gap={10} align="flex-start" style={{ backgroundColor: colors.infoBox, borderRadius: 16, padding: 14 }}>
      {icon ? <Icon name={icon} size={22} color={colors.secondary} /> : null}
      <T size={14} lh={1.5} color={colors.body} style={{ flex: 1 }}>
        {children}
      </T>
    </Row>
  );
}

// --- Selectable tiles ---------------------------------------------------------------

export function Choice({ selected, onPress, children, style, a11yLabel, border, bg }: { selected: boolean; onPress: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; a11yLabel?: string; border?: string; bg?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        { borderWidth: 2, borderColor: selected ? (border ?? colors.pickBorder) : colors.border, backgroundColor: selected ? (bg ?? colors.pickBg) : '#fff', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? colors.pickBorder : '#CFCAC0', padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', ...shadow }} />
    </View>
  );
}

export function Checkbox({ on, label, onPress }: { on: boolean; label: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 6 }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? colors.primary : colors.inputBorder, backgroundColor: on ? colors.primary : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon name="check" size={18} color="#fff" /> : null}
      </View>
      <T size={15} lh={1.45} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

export const shadow: ViewStyle = { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 };

/** Two-option segmented control (Week | Month). */
export function Segmented<K extends string>({ options, value, onChange }: { options: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <Row gap={4} style={{ padding: 4, backgroundColor: colors.segment, borderRadius: 12 }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)} style={[{ flex: 1, borderRadius: 9, padding: 10, alignItems: 'center', backgroundColor: on ? '#fff' : 'transparent' }, on && shadow]}>
            <T bold size={15} color={on ? colors.primary : colors.muted}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </Row>
  );
}

// --- Inputs ---------------------------------------------------------------------------

export const inputStyle: TextStyle = {
  borderWidth: 1,
  borderColor: colors.inputBorder,
  backgroundColor: '#fff',
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  fontFamily: fonts.body,
  color: colors.text,
};

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#8A857B" {...props} style={[inputStyle, props.style]} />;
}

export function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <Col gap={6}>
      <Row gap={6} align="baseline">
        <T bold size={14}>
          {label}
        </T>
        {optional ? (
          <T size={13} color={colors.muted}>
            optional
          </T>
        ) : null}
      </Row>
      {children}
    </Col>
  );
}

export function Heading({ title, sub, size = 26 }: { title: string; sub?: string; size?: number }) {
  return (
    <Col gap={6}>
      <T heading size={size} lh={1.2}>
        {title}
      </T>
      {sub ? (
        <T size={15} color={colors.muted} lh={1.45}>
          {sub}
        </T>
      ) : null}
    </Col>
  );
}

/** Back arrow + 5-step progress bar used in the opening screens. */
export function StepHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <Row gap={12} style={{ paddingTop: 4 }}>
      <IconBtn icon="arrow_back" label="Back" onPress={onBack} />
      <Row gap={4} style={{ flex: 1 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.border }} />
        ))}
      </Row>
      <View style={{ width: 44 }} />
    </Row>
  );
}

// --- Bottom sheet ------------------------------------------------------------------------

export function Sheet({ visible, onClose, children, reduceMotion, scroll }: { visible: boolean; onClose: () => void; children: React.ReactNode; reduceMotion?: boolean; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(visible ? 0 : 1)).current;
  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      y.setValue(0);
      return;
    }
    y.setValue(1);
    Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, reduceMotion, y]);
  if (!visible) return null;
  const body = (
    <View style={{ gap: 14 }}>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.inputBorder, alignSelf: 'center' }} />
      {children}
    </View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]} accessibilityViewIsModal>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, minHeight: 40 }} />
        <Animated.View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: scroll ? '88%' : undefined,
            transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 600] }) }],
          }}
        >
          {scroll ? (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 + Math.max(14, insets.bottom) }} keyboardShouldPersistTaps="handled">
              {body}
            </ScrollView>
          ) : (
            <View style={{ padding: 20, paddingBottom: 20 + Math.max(14, insets.bottom) }}>{body}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
