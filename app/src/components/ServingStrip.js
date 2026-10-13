import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme';
import RollingNumber from './RollingNumber';

// The owner's hero: a full-width yellow strip with the rolling number. `paper` is set when the
// number belongs to someone with no phone, so it has to be said aloud.
export default function ServingStrip({ number, name, paper, reduceMotion }) {
  return (
    <View style={styles.strip}>
      <Text style={[type.body, styles.ink]}>Now serving</Text>
      {number === null ? (
        <Text style={[type.serving, styles.ink]}>{'–'}</Text>
      ) : (
        <RollingNumber value={number} style={type.serving} color={colors.ink} reduceMotion={reduceMotion} />
      )}
      <Text style={[type.body, styles.ink]}>{number === null ? 'Nobody yet' : name || 'Guest'}</Text>
      {paper && <Text style={[type.section, styles.ink]}>Paper token. Call it out.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: space.xl, marginTop: space.sm, padding: space.xl, borderRadius: 18, backgroundColor: colors.yellow },
  ink: { color: colors.ink },
});
