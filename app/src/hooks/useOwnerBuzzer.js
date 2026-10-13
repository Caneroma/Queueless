import { useEffect, useRef } from 'react';
import { buzz } from '../lib/buzzer';

// A paper token has no phone to ring, so the owner's phone rings for it: the urgent buzz when
// the number being served is a paper token (call it out), the calm one when a paper token is
// first in line (get ready). Only a change buzzes; opening the screen on a state does not.
export default function useOwnerBuzzer(lists, loaded) {
  const seen = useRef(null); // { serving, head } ids from the previous lists

  useEffect(() => {
    if (!loaded) return;
    const serving = lists.serving;
    const head = lists.waiting[0] || null;
    const now = { serving: serving ? serving.id : null, head: head ? head.id : null };
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    if (serving && now.serving !== before.serving && serving.kind === 'physical') buzz('turn');
    else if (head && now.head !== before.head && head.kind === 'physical') buzz('next');
  }, [lists, loaded]);
}
