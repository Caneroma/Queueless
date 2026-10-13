import { useCallback, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';
import * as haptics from '../lib/haptics';
import { ticketRoute } from '../lib/nav';
import { loadOwner, loadTickets } from '../lib/storage';

// Two full-height panels, each a single tap. Text sits low, near the thumb.
function Panel({ grow, bg, color, caption, title, detail, onPress, icon }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caption}. ${title}`}
      onPressIn={haptics.tap}
      onPress={onPress}
      style={({ pressed }) => [
        styles.panel,
        { flex: grow, backgroundColor: bg, paddingTop: space.xl },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.panelTop}>
        <Text style={[type.caption, styles.caption, { color }]}>{caption}</Text>
        <Feather name={icon} size={22} color={color} />
      </View>
      <Text style={[type.title, { color }]}>{title}</Text>
      {detail ? <Text style={[type.caption, styles.detail, { color }]}>{detail}</Text> : null}
    </Pressable>
  );
}

export default function Home({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState([]);
  const [owner, setOwner] = useState(null);

  // Re-read on focus: a ticket or queue may have been created or cleared since last visit.
  useFocusEffect(
    useCallback(() => {
      loadTickets().then(setTickets);
      loadOwner().then(setOwner);
    }, [])
  );

  const held = tickets.length > 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <Text accessibilityRole="header" style={[type.section, styles.brand]}>
          Queueless
        </Text>
      </View>
      <Panel
        grow={held ? 40 : 55}
        bg={colors.blue}
        color={colors.white}
        caption="I'm waiting"
        title="Join a queue"
        detail="Scan a code. Keep your place."
        icon="arrow-up-right"
        onPress={() => navigation.navigate('JoinQueue')}
      />
      {held && (
        <Panel
          grow={25}
          bg={colors.white}
          color={colors.ink}
          caption="Already in line"
          title={tickets.length === 1 ? 'My ticket' : `My tickets (${tickets.length})`}
          detail="Pick up where you left off."
          icon="bookmark"
          onPress={() => {
            const { name, params } = ticketRoute(tickets);
            navigation.navigate(name, params);
          }}
        />
      )}
      <Panel
        grow={held ? 35 : 45}
        bg={colors.paper}
        color={colors.ink}
        caption="I run the queue"
        title={owner ? 'Open my queue' : 'Start a queue'}
        detail={owner ? 'Your line is ready.' : 'Set up a line in under a minute.'}
        icon="sliders"
        onPress={() => (owner ? navigation.navigate('OwnerDashboard', { owner }) : navigation.navigate('StartQueue'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingBottom: space.lg, backgroundColor: colors.blue },
  brand: { color: colors.white, letterSpacing: -0.2 },
  panel: { padding: space.xl, paddingBottom: space.xxl, justifyContent: 'flex-end' },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  caption: { opacity: 0.72 },
  detail: { opacity: 0.68, marginTop: space.sm },
  pressed: { opacity: 0.9, transform: [{ scale: 0.992 }] },
});
