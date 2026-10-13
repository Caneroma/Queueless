import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import BigButton from './BigButton';
import EmptyStubs from './EmptyStubs';

// Plain rows with hairlines. "Guest" stands in for a ticket with no name.
export function Row({ number, name, kind, children }) {
  return (
    <View style={styles.row}>
      <Text style={[type.rowNumber, styles.number]}>{number}</Text>
      <Text style={[type.body, styles.name]} numberOfLines={1}>
        {name || 'Guest'}
      </Text>
      {kind === 'physical' && <Text style={[type.caption, styles.paper]}>Paper</Text>}
      {children}
    </View>
  );
}

export default function WaitingList({ waiting, skipped, onReview, onAddWalkIn }) {
  return (
    <View style={styles.list}>
      <View style={styles.heading}>
        <Text style={[type.section, styles.ink]}>Waiting</Text>
        <Text style={[type.caption, styles.count]}>{waiting.length} {waiting.length === 1 ? 'person' : 'people'}</Text>
      </View>
      <BigButton label="Add walk-in" variant="outline" height={48} onPress={onAddWalkIn} style={styles.walkIn} />
      {waiting.length === 0 ? (
        <EmptyStubs message="Nobody is waiting. Share the QR to get people in." />
      ) : (
        waiting.map((t) => <Row key={t.id} number={t.number} name={t.name} kind={t.kind} />)
      )}
      {skipped.length > 0 && (
        <View style={styles.skipped}>
          <Text style={[type.section, styles.ink]}>Skipped ({skipped.length})</Text>
          <BigButton label="Review" variant="text" height={48} onPress={onReview} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  ink: { color: colors.ink },
  heading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm },
  count: { color: colors.pencil },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  number: { width: 64, color: colors.ink },
  name: { flex: 1, color: colors.ink },
  walkIn: { marginBottom: space.sm },
  paper: {
    color: colors.ink,
    backgroundColor: colors.fog,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    marginLeft: space.sm,
    overflow: 'hidden',
  },
  skipped: { marginTop: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
