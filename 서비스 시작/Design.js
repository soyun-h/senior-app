import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DATE_LABELS, dateOptions } from './onboarding';

export const WIDTH = 360;
export const HEIGHT = 780;
export const artwork = {
  intro: require('./assets/screens/intro.png'),
  outro: require('./assets/screens/outro.png'),
  profile: require('./assets/screens/96.png'),
  profileReady: require('./assets/screens/85.png'),
  date: require('./assets/screens/86.png'),
  family: require('./assets/screens/contacts.png'),
  familyReady: require('./assets/screens/88.png'),
  confirm: require('./assets/screens/95.png'),
  friends: require('./assets/screens/89.png'),
  progress: require('./assets/screens/94.png'),
  carouselBackground: require('./assets/screens/carousel-background.png'),
  wheelBackground: require('./assets/screens/wheel-background.png'),
  progressBackground: require('./assets/screens/progress-background.png'),
};

export const characters = [
  { id: 'char1', name: '나비', image: require('./assets/characters/char1.jpg') },
  { id: 'char2', name: '서윤', image: require('./assets/characters/char2.jpg') },
  { id: 'char3', name: '지은', image: require('./assets/characters/char3.jpg') },
  { id: 'char4', name: '준호', image: require('./assets/characters/char4.jpg') },
  { id: 'char5', name: '도윤', image: require('./assets/characters/char5.jpg') },
];

export const rect = (left, top, width, height) => ({
  position: 'absolute', left, top, width, height,
});

export function Art({ source, x = 0, y = 0, width = WIDTH, height = HEIGHT, onLoadEnd }) {
  return (
    <Image source={source} style={rect(x, y, width, height)} resizeMode="contain"
      resizeMethod="scale" fadeDuration={0} onLoadEnd={onLoadEnd} accessible={false} pointerEvents="none" />
  );
}

export function Slice({ source, x, y, width, height, top = y, left = x }) {
  return (
    <View pointerEvents="none" style={[rect(left, top, width, height), styles.clipped]}>
      <Art source={source} x={-x} y={-y} />
    </View>
  );
}

export function Tap({ label, x, y, width, height, onPress, disabled, selected, children }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      accessibilityState={{ disabled: !!disabled, selected }} onPress={onPress}
      style={rect(x, y, width, height)}>
      {children}
    </Pressable>
  );
}

export function EntryField({ y, label, value, onChangeText, onFocus, onBlur, phone, inputRef, onSubmit }) {
  return (
    <TextInput ref={inputRef} accessibilityLabel={label} value={value} onChangeText={onChangeText}
      onFocus={onFocus} onBlur={onBlur} onSubmitEditing={onSubmit} maxLength={phone ? undefined : 32}
      keyboardType={phone ? 'phone-pad' : 'default'} returnKeyType={onSubmit ? 'next' : 'done'}
      autoCorrect={false} autoCapitalize="none" allowFontScaling={false} underlineColorAndroid="transparent"
      style={[rect(37, y + 2, 286, 48), styles.entry, !!value && styles.paper]} />
  );
}

const dateBoxes = { year: 28, month: 134, day: 239 };
const dateWidths = { year: 93, month: 93, day: 93 };

export function BirthFields({ birth, openPart, onPress }) {
  const y = openPart ? 381 : 479;
  return Object.entries(dateBoxes).map(([part, x]) => {
    const active = openPart === part;
    const value = birth[part];
    return (
      <Tap key={part} x={x} y={y} width={dateWidths[part]} height={52}
        label={value ? `${DATE_LABELS[part]} ${value}` : DATE_LABELS[part]}
        selected={active} onPress={() => onPress(part)}>
        {openPart && <Slice source={artwork.profile} x={x} y={479} width={93} height={52} left={0} top={0} />}
        {active && <View pointerEvents="none" style={styles.activeDate} />}
        {!!value && <Text allowFontScaling={false} style={styles.dateValue}>{value}</Text>}
      </Tap>
    );
  });
}

const DATE_ROW = 56;
const DATE_WHEEL_HEIGHT = 280;

export function DateWheel({ part, birth, onValue, onPick }) {
  const values = dateOptions(part, birth);
  const initialValue = birth[part] ?? { year: 1968, month: 1, day: 1 }[part];
  const initialIndex = Math.max(0, values.indexOf(initialValue));
  const offset = useRef(new Animated.Value(initialIndex * DATE_ROW)).current;
  const update = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / DATE_ROW);
    onValue(values[Math.max(0, Math.min(values.length - 1, index))]);
  };
  return (
    <View style={rect(0, 446, WIDTH, DATE_WHEEL_HEIGHT)}>
      <Animated.ScrollView
        accessibilityLabel={DATE_LABELS[part]}
        contentOffset={{ x: 0, y: initialIndex * DATE_ROW }}
        contentContainerStyle={{ paddingVertical: DATE_ROW * 2 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={DATE_ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], { useNativeDriver: true })}
        onScrollEndDrag={update}
        onMomentumScrollEnd={update}>
        {values.map((value, index) => {
          const position = index * DATE_ROW;
          const inputRange = [position - 2 * DATE_ROW, position - DATE_ROW, position, position + DATE_ROW, position + 2 * DATE_ROW];
          return (
            <Pressable key={value} accessibilityRole="button" onPress={() => onPick(value)} style={styles.wheelRow}>
              <Animated.Text allowFontScaling={false} style={[styles.wheelNumber, {
                opacity: offset.interpolate({ inputRange, outputRange: [0.16, 0.52, 1, 0.52, 0.16], extrapolate: 'clamp' }),
                transform: [{ scale: offset.interpolate({ inputRange, outputRange: [0.67, 0.8, 1, 0.8, 0.67], extrapolate: 'clamp' }) }],
              }]}>{value}</Animated.Text>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const CARD_WIDTH = 208;
const CARD_HEIGHT = 298;
const CARD_STEP = 229;
const LAST_CARD = characters.length - 1;

export function FriendCarousel({ initial, onSelect, carouselRef, selected }) {
  const offset = useRef(new Animated.Value(initial * CARD_STEP)).current;
  const positionFrom = (event) => Math.max(0, Math.min(LAST_CARD,
    Math.round(event.nativeEvent.contentOffset.x / CARD_STEP)));
  const select = (index) => {
    carouselRef.current?.scrollTo({ x: index * CARD_STEP, animated: true });
    onSelect(index);
  };
  return (
    <View style={rect(0, 244, WIDTH, 366)}>
      <Art source={artwork.carouselBackground} width={360} height={366} />
      <Animated.ScrollView horizontal ref={carouselRef}
        accessibilityLabel="함께할 친구를 골라주세요"
        contentOffset={{ x: initial * CARD_STEP, y: 0 }}
        contentContainerStyle={styles.cards}
        decelerationRate="fast" snapToInterval={CARD_STEP} disableIntervalMomentum
        showsHorizontalScrollIndicator={false} bounces={false} overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: offset } } }], { useNativeDriver: true })}
        onScrollEndDrag={(event) => onSelect(positionFrom(event))}
        onMomentumScrollEnd={(event) => onSelect(positionFrom(event))}>
        {characters.map((character, index) => {
          const center = index * CARD_STEP;
          const inputRange = [center - CARD_STEP, center, center + CARD_STEP];
          const scaleY = offset.interpolate({ inputRange, outputRange: [246 / CARD_HEIGHT, 1, 246 / CARD_HEIGHT], extrapolate: 'clamp' });
          return (
            <Pressable key={character.id} onPress={() => select(index)} accessibilityRole="button"
              accessibilityLabel={character.name} accessibilityState={{ selected: selected === index }}
              style={[styles.cardSlot, index === LAST_CARD && styles.lastCard]}>
              <Animated.View style={[styles.card, { transform: [{ scaleY }] }]}>
                <Animated.Image source={character.image} resizeMode="cover" fadeDuration={0}
                  style={[styles.portrait, { transform: [{ scaleY: Animated.divide(1, scaleY) }] }]} />
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  clipped: { overflow: 'hidden' },
  paper: { backgroundColor: '#fff' },
  entry: { paddingHorizontal: 5, paddingVertical: 0, fontSize: 16, fontWeight: '600', color: '#797979' },
  activeDate: { height: 52, borderWidth: 1, borderColor: '#46a26e', borderRadius: 10 },
  dateValue: {
    position: 'absolute', left: 13, top: 15, width: 47, height: 23,
    paddingLeft: 2, fontSize: 16, fontWeight: '600', color: '#797979', backgroundColor: '#fff',
  },
  wheelRow: { height: DATE_ROW, alignItems: 'center', justifyContent: 'center' },
  wheelNumber: { fontSize: 45, color: '#000', fontWeight: '500', includeFontPadding: false },
  cards: { paddingHorizontal: 76, paddingTop: 18, paddingBottom: 50, height: 366 },
  cardSlot: { width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: CARD_STEP - CARD_WIDTH },
  lastCard: { marginRight: 0 },
  card: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff' },
  portrait: { width: CARD_WIDTH, height: CARD_HEIGHT },
});
