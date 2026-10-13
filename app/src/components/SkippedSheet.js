import { ScrollView } from 'react-native';
import BigButton from './BigButton';
import Sheet from './Sheet';
import { Row } from './WaitingList';

// Recall: a skipped person who turns up late goes back to the end of the line.
export default function SkippedSheet({ visible, onClose, skipped, busy, onRecall }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`Skipped (${skipped.length})`}>
      <ScrollView style={{ maxHeight: 320 }}>
        {skipped.map((t) => (
          <Row key={t.id} number={t.number} name={t.name} kind={t.kind}>
            <BigButton label="Put back" variant="text" height={48} busy={busy} onPress={() => onRecall(t)} />
          </Row>
        ))}
      </ScrollView>
    </Sheet>
  );
}
