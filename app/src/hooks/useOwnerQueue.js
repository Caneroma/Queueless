import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import * as haptics from '../lib/haptics';
import { animateLayout } from '../lib/motion';

const EMPTY = { serving: null, waiting: [], skipped: [] };

// Owner-only data and actions. The public snapshot has numbers; this adds the
// names, and runs the REST calls that change the line.
export default function useOwnerQueue(owner, snapshot, reduceMotion, onGone) {
  const [lists, setLists] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }

  // Any snapshot change means the line moved, so fetch the named lists again.
  useEffect(() => {
    let stale = false;
    api(`/queues/${owner.code}/owner`, { ownerKey: owner.ownerKey })
      .then((next) => {
        if (stale) return;
        animateLayout(reduceMotion);
        setLists(next);
      })
      .catch((e) => {
        // 403/404: this queue no longer exists for this key (database reset). Offline errors are
        // left alone: the banner says so, and the next snapshot retries.
        if (!stale && (e.status === 403 || e.status === 404)) onGone();
      });
    return () => {
      stale = true;
    };
  }, [snapshot, owner.code, owner.ownerKey, reduceMotion, onGone]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  // `done` turns the server's reply into the confirmation, named like the button.
  async function run(path, { body, done, haptic = haptics.confirm } = {}) {
    if (busy) return null;
    setBusy(true);
    try {
      const reply = await api(`/queues/${owner.code}/${path}`, { method: 'POST', body, ownerKey: owner.ownerKey });
      setMessage({ text: done ? done(reply) : '', error: false });
      haptic();
      return reply;
    } catch (e) {
      setMessage({ text: e.message, error: true });
      haptics.error();
      return null;
    } finally {
      setBusy(false);
    }
  }

  // `loaded` is false until the first fetch lands, so a screen can tell "empty" from "not here yet".
  return { lists, loaded: lists !== EMPTY, busy, message, run };
}
