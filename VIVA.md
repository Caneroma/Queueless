# Queueless: Viva Guide

Walk-in queue for small shops. The owner opens a queue and shows a QR code. Customers scan it, get a token, and watch their position and wait time update live.

Stack: React Native (Expo) + Express + Socket.io + MongoDB, JavaScript only. The owner side also runs in a browser from the same code.

Core idea in one sentence: **you ask by REST, you are told by socket.**

```
Customer phone ─┐                          ┌─ REST: create, join, next, skip, ...
Owner phone ────┼── Node (Express + Socket.io) ── MongoDB
Owner browser ──┘                          └─ Socket: queue:update snapshot
```

## Split of work

| Part | Member | Area | Size |
|---|---|---|---|
| 1 | Member 1 | Server and database | `server/src` |
| 2 | Member 2 | Real-time and client foundation | sockets, data layer, navigation, web target |
| 3 | Member 3 | Customer experience | join flow and live ticket |
| 4 | Member 4 | Owner experience and shared UI | dashboard, sheets, design components |

Order of presentation: 1 → 2 → 3 → 4, which follows one request from the server to the customer's screen to the owner's tap.

---

## Part 1: Server and database (Member 1)

**Files:** `server/src/index.js`, `models/Queue.js`, `models/Ticket.js`, `routes/queues.js`, `routes/owner.js`, `routes/tickets.js`, `lib/code.js`, `lib/auth.js`, `lib/http.js`, `lib/snapshot.js`, `lib/push.js`

**Explain**

- **Two collections.**
  - `Queue`: `name`, `code` (unique), `ownerKey`, `status` (`open`, `paused`, `closed`), `defaultServiceMin`, `lastNumber`, `noReceptionist`.
  - `Ticket`: `queueId` (indexed), `number`, `sortKey`, `name`, `kind` (`digital` or `physical`), `relayed`, `status` (`waiting`, `serving`, `done`, `skipped`, `left`), `joinedAt`, `calledAt`, `finishedAt`.
- **Join code.** 6 characters from a 31-character alphabet with no `0 O 1 I L`, so it can be read off a counter without mistakes. `makeCode()` retries if the code exists. `ownerKey` is 24 hex characters from `crypto.randomBytes(12)`.
- **Token numbers are atomic.** `findOneAndUpdate({ code, status: 'open' }, { $inc: { lastNumber: 1 } }, { new: true })` returns the new number in one database operation. The `status: 'open'` filter also rejects paused and closed queues in the same step. If it returns `null`, a second lookup decides between 404 (unknown code) and 409 (paused or closed).
- **`advance(queue, finishedStatus)`** is shared by Next and Skip: the current `serving` ticket becomes `done` or `skipped` with `finishedAt`, then the lowest `sortKey` waiting ticket becomes `serving` with `calledAt`. Sharing it keeps the rule "one serving ticket per queue" in one place.
- **Walk-ins.** `POST /queues/:code/walkin` (owner) takes the number from the same atomic `$inc` as a scan, so phones and walk-ins share one fair line. `kind: 'physical'` is a paper token; `kind: 'digital'` is a ticket the customer later links to their phone. It works while joining is paused, because pausing stops strangers scanning, not the desk, and is refused with 409 once the queue is closed.
- **Snapshot additions.** `physical` lists which of the numbers in line are paper tokens, and `noReceptionist` carries the owner's setting. `waiting` stays a plain array of numbers, so older clients and the ETA code are untouched.
- **"You are next".** After `advance()` the server finds the new first waiting ticket and pushes "You are next" to it, in the same best-effort way as the call.
- **No receptionist.** When the owner turns `noReceptionist` on, every `publish()` checks the line: a phone ticket directly before or after a paper token gets one push asking it to pass the word on. "Once per pair" is made atomic with `updateOne({ _id, relayed: { $ne: n } }, { $addToSet: { relayed: n } })` and checking `modifiedCount`, so two quick updates cannot send two requests.
- **Recall** sets a skipped ticket back to `waiting` with `sortKey = highest + 1`, which puts it at the back without renumbering anyone.
- **Close** counts `served`, `skipped` and `left` first, then marks everyone still `waiting` or `serving` as `left`, then sets the queue to `closed`.
- **Owner auth.** `requireOwner` loads the queue by `:code` and compares the `x-owner-key` header with the stored key. Mismatch gives 403. The key is never returned by any public route.
- **Validation by hand.** Names are trimmed and length-capped (shop 40, customer 30). Empty shop name gives 400. `defaultServiceMin` is clamped to 1–60.
- **Errors.** `HttpError(status, message)` is thrown anywhere. Express 5 forwards errors from async handlers to one error middleware. A malformed ticket id (Mongoose `CastError`) becomes 404.
- **Status codes:** 400 bad input, 403 wrong key, 404 unknown code or ticket, 409 closed, paused or cannot leave now.
- **Push for a closed app.** A phone can register an Expo push token for its ticket (`POST /tickets/:id/notifications`, stored on the ticket; junk tokens get 400, finished tickets 409). When Next or Skip moves a ticket to `serving`, `lib/push.js` posts a message to the Expo push service (the URL comes from `EXPO_PUSH_URL`; unset means off). It is best effort and not awaited, so a push outage is logged and never delays the line. The message carries the number and shop name only, never the customer's name.

**Estimate (in `lib/snapshot.js`)**

```
avgServiceMin = average of the last 10 "done" tickets (finishedAt − calledAt)
                if fewer than 3 exist, the owner's defaultServiceMin
```

Skipped and abandoned tickets are excluded because they took no real service time.

**Be ready to say honestly**

- Next and Skip are two separate writes, not a transaction. With one owner pressing one button this is safe. Two owners racing could in theory both advance.
- The key comparison is a plain `!==`, and there is no HTTPS or rate limiting. This is by scope, not oversight.

---

## Part 2: Real-time and client foundation (Member 2)

**Files:** `server/src/index.js` (socket handler), `lib/snapshot.js` (`publish`), `app/src/lib/socket.js`, `hooks/useLiveQueue.js`, `hooks/useTicketAlerts.js`, `lib/notify.js`, `components/AlertBanner.js`, `lib/buzzer.js`, `lib/walkins.js`, `lib/qr.js`, `lib/api.js`, `lib/storage.js`, `lib/eta.js`, `lib/nav.js`, `config.js`, `App.js`, `Navigator.js`, `Navigator.web.js`, `components/OfflineBanner.js`, `theme.js`

**Explain**

- **Two socket events only.**
  - `room:join` (client to server): payload is the code. The server runs `socket.join(code)` and replies with a fresh snapshot to that socket only.
  - `queue:update` (server to room): payload is the snapshot.
- **`publish(io, queue)`** builds the snapshot, emits it to the room, and returns it, so a route can emit and reply with the same data in one line.
- **The snapshot** is the single shared shape, sent over REST and the socket: `{ code, name, status, serving, waiting: [numbers], avgServiceMin }`. It holds numbers only, so one customer never sees another's name. The owner fetches names separately with the key.
- **`useLiveQueue(code)`** uses the one shared socket (connected once, kept open for the app's lifetime), emits `room:join` on every `connect` event, listens for `queue:update`, and tracks `online` from `connect`, `disconnect` and `connect_error`. Unmounting only removes its listeners. Re-joining on every connect is what repairs a Wi-Fi blip: the reply replaces whatever was missed.
- **`api.js`** is a small `fetch` wrapper. It throws an `Error` whose message is safe to show, with the HTTP `status` attached, and a fixed message for network failure.
- **`storage.js`** keeps two things in AsyncStorage: an `owner` record (`code`, `ownerKey`, `name`) and a list of `tickets`, one per queue joined (`ticketId`, `code`, `number`, `queueName`, `issuedAt`). A ticket saved by the earlier single-ticket version is migrated into the list once.
- **Resume.** `App.js` loads both and `pickStart` decides the first screen: one ticket opens it, several open the My tickets list, else the owner dashboard, else Home. `goHome` uses `navigation.reset` so no stale screen or socket stays mounted underneath.
- **Web target.** Metro picks `Navigator.web.js` for the browser, which registers only the owner screens, so the camera and ticket code are never bundled for web. `config.js` has no hardcoded address: it uses `EXPO_PUBLIC_API_URL` if set, the page's own host on web, and on a phone the host the Expo dev server reports (the laptop that served the app), with the server's port. `api.js` gives up after 10 seconds and the error names the address it tried, so a wrong network is obvious.
- **Stale records.** A ticket or queue the server no longer knows (for example after a database reset) returns 404 or 403. The screens treat that as "ended" so nobody is stuck.
- **`eta.js`:** `waitMinutes(ahead, avg, someoneServing) = ceil(ahead × avg + (someoneServing ? avg / 2 : 0))`. The half term is because the person at the counter is on average halfway done.

**Be ready to say honestly**

- The socket is one shared instance, so only one live screen can use it at a time. The navigation is arranged (reset, replace) so that is always true.
- Everything depends on one server on the same network. There is no offline mode: the banner says numbers may be out of date.

---

## Part 3: Customer experience (Member 3)

**Files:** `screens/Home.js`, `screens/JoinQueue.js`, `screens/MyTicket.js`, `screens/Tickets.js`, `lib/tickets.js`, `components/ScanFrame.js`, `JoinSheet.js`, `Ticket.js`, `TicketFace.js`, `LineDots.js`, `lib/ticketState.js`, `hooks/useTicketFeel.js`, `hooks/useReducedMotion.js`, `lib/haptics.js`, `lib/motion.js`

**Explain**

- **Join flow.** `JoinQueue` scans with `CameraView`. A QR is accepted only if it starts with `QUEUELESS:`, and repeat reads are ignored for 2 seconds. If camera permission is refused, the typed 6-character code is the only path. The code is checked (format, then `GET /api/queues/:code`) before the name step, and closed or paused queues are rejected early with the PRD's wording. Then `POST .../join` returns the token, the ticket record is saved, and `MyTicket` replaces the join screen.
- **Why in-app scanning.** A QR opened by the system camera needs deep links and a published app. This project is never deployed, so the QR holds a short string and the app's own scanner reads it.
- **The phone computes its own state.** `ticketState(snapshot, number, endStatus)`:
  - number equals `serving` → **turn**
  - number found in `waiting` → position is its index, so **almost** at 2 or fewer ahead, else **waiting**
  - in neither → the ticket has ended; `GET /api/tickets/:id` says whether it was `done`, `skipped` or `left` (`left` means the queue was closed)
- **State drives everything.** `LOOK` maps each state to background, text colour, status bar and the command line ("Wait here.", "Head back to the shop.", "Go to the counter now.", and so on). Blue means waiting, yellow means go, paper means finished. The text changes with the colour, so colour is never the only signal.
- **`useTicketFeel`:** background cross-fade over 400 ms from an interpolated `Animated.Value`; on turn a 1.0 → 1.06 → 1.0 pulse plus two success haptics 300 ms apart; one medium haptic when the state moves from waiting to almost; a tick when the serving number changes. Each fires once per change using refs, and not on first render. With reduced motion on, fades and pulse are instant and haptics stay.
- **`Ticket`** is a white card with two notch circles in the screen's own colour and a dashed tear line. The notches are `Animated.View` on purpose: giving an animated colour to a plain `View` made React Native freeze the `Animated.Value` in dev builds and crash the first fade (`Cannot add new property '_tracking'`). This was a real bug found and fixed.
- **`LineDots`:** one dot per person ahead (at most 8, then `+N`) and one larger yellow dot for you. Dots are keyed from the right so the leftmost one leaves when the line moves. `animateLayout()` runs just before the snapshot is applied, which is the only moment `LayoutAnimation` works.
- **"Your number is called" alerts.** `useTicketAlerts` runs above all screens (in `Navigator.js`). It joins the room of every held ticket on the one shared socket and watches each `queue:update`. When `serving` equals a held number, it alerts once per call:
  - **App open, on any other screen:** a yellow `AlertBanner` slides down ("Number 14 is being called. Go to the counter now.") with the double success haptic. Tapping it opens the ticket. It clears itself when the number moves on.
  - **App open on that ticket:** nothing extra, because the ticket screen already turns yellow and buzzes.
  - **App in the background:** a system notification ("It is your turn"), raised locally by `expo-notifications`. Separately, after joining, `registerForPushNotifications` gets an Expo push token and gives it to the server, so the server can reach a phone whose app is closed. Tapping it opens the ticket. Permission is requested right after joining. This part needs a development or production build: Expo Go on Android cannot load the library (it throws on import), so `lib/notify.js` detects Expo Go with `isRunningInExpoGo()` and skips it, leaving the banner as the only alert.
  - A call that arrived while the app was in the background shows as a banner when the app returns.
- **"Leave in X min" travel timer.** On a waiting ticket the customer says how many minutes away they are (Here, 5, 10, 20, 30). The app turns the wait estimate into a personal instruction:
  - `leaveIn = max(0, wait - travel - 2)`, where `wait` is the same `ceil(ahead * avg + serving ? avg / 2 : 0)` used everywhere and 2 minutes is a safety buffer (`lib/eta.js`).
  - It is anchored to when the latest snapshot arrived and counts down in real time (`useNow`, `useTravel`). Each new snapshot re-computes it, so it follows the line as it speeds up or slows down.
  - The distance is saved on the ticket in storage. `useLeaveAlerts`, running above all screens with the called-watcher, fires a banner and a buzz at the leave moment, once per choice. In a development or production build it also hands the same moment to the phone's own scheduler (`scheduleLeaveReminder`, with a fixed identifier per ticket so it is replaced, not duplicated), which can arrive even when the app is suspended.
  - It is entirely client-side: the server is not involved.
- **Several tickets per phone.** A phone can hold one ticket in each of several queues, but not two in the same queue: the join screen checks the code against held tickets and shows "You already have a ticket for X. Open it or leave it first." Home always offers "Join a queue", plus a "My tickets" panel when any are held. `Tickets.js` lists them with live status (Waiting, Your turn, Done, Skipped, Closed), opens one, removes one, or joins another queue.
- **"You are next" and the buzzer.** The same watcher notices when the held number is first in line while someone is being served and raises a calmer alert (banner, double beep and vibration, or a system notification in the background), once per ticket. When the number is called, `lib/buzzer.js` plays a short urgent sound and vibration through `expo-audio` and `Vibration`, even on the ticket screen where the banner would repeat the yellow background. It uses the phone's own volume and silent switch, so a silenced phone still vibrates.
- **Walk-in neighbours.** `lib/walkins.js` reads the snapshot: with `noReceptionist` on and a number in `physical` directly before or after the held one, the ticket screen shows "Paper token 4 is right behind you. Please tell them when they are called."
- **Linking a walk-in's ticket.** A walk-in added as digital gets a QR holding `QUEUELESS-TICKET:<ticketId>`. The scanner (`lib/qr.js` tells it from a queue QR) calls the existing `GET /tickets/:id`, checks it is still waiting or serving and not already held for that queue, saves it locally and registers for push. No new server route is needed, because a ticket id already identifies the ticket.
- **Leave or remove.** `leaveTicket()` calls `POST /tickets/:id/leave` (only allowed while `waiting`), then deletes the local copy. A 404 (server forgot it) or 409 (already ended) still removes it locally, since nothing is left to leave on the server. A network failure keeps the ticket and shows the error, so a ticket is never dropped on the phone while the owner would still call it.

**Be ready to say honestly**

- A customer who clears app data loses their tickets.
- The one-ticket-per-queue rule is enforced on the phone only. The server cannot tell two devices apart, so someone could join the same queue twice from two phones.
- The leave moment is a prediction from the last snapshot. If the line slows while the phone is asleep, a scheduled reminder cannot be updated, so it can be early.
- The in-app and local alerts need a live socket, so on their own they cannot reach a phone the system has fully put to sleep or an app that was swiped away. Server push covers that, but it only works in a development or production build with an EAS project id, and on Android it is delivered through Google's Firebase Cloud Messaging. In Expo Go neither exists, so only the banner works.
- Leaving needs the server. With no connection a ticket cannot be removed, which is what stops the owner calling a ghost.
- The wait shown is never below 1 minute, even for the first person in an idle queue.

---

## Part 4: Owner experience and shared UI (Member 4)

**Files:** `screens/StartQueue.js`, `OwnerDashboard.js`, `DaySummary.js`, `hooks/useOwnerQueue.js`, `components/ServingStrip.js`, `WaitingList.js`, `SkippedSheet.js`, `ActionDock.js`, `Sheet.js`, `ConfirmSheet.js`, `QueueOptionsSheet.js`, `QrSheet.js`, `QrCard.js`, `WalkInSheet.js`, `hooks/useOwnerBuzzer.js`, `RollingNumber.js`, `BigButton.js`, `Field.js`, `Screen.js`, `TopBar.js`, `DockButton.js`, `EmptyStubs.js`

**Explain**

- **Start a queue.** Name is validated on screen and again on the server; the stepper clamps minutes to 1–60. On success the owner record is saved and the dashboard replaces this screen.
- **Dashboard.** The big number and counts come from the live snapshot. The named lists (waiting, skipped) come from `GET .../owner` with the key, refetched whenever the snapshot changes. Names reach only the owner.
- **`useOwnerQueue.run()`** does every action: it ignores taps while one is in flight (the button dims, no spinner), calls the route, shows a confirmation named like the button ("Called 13", "Skipped 12", "Put 12 back") for 3 seconds, and plays the matching haptic. Errors appear as red text with an error haptic.
- **Sheets.** One `Sheet` (a transparent `Modal` with a scrim, closed by scrim tap, the x, or Android back) is reused for the QR, skip confirmation, skipped list and options. Close and Pause share one sheet that swaps its content, so two modals never open and close at the same moment. Close is hidden behind a long-press on the shop name and inside the Pause sheet so it cannot be hit by accident.
- **QR.** The QR value is `QUEUELESS:<CODE>` and the code is shown under it in large type. The screen stays awake while it is open. `QrCard` draws it on a rounded white card, whose margin doubles as the quiet zone, and the scanner's corner brackets use the same radius.
- **Walk-ins.** "Add walk-in" opens `WalkInSheet`: a name, and a choice of Paper token or Their phone. Paper shows the number large to write on a slip; Their phone shows a QR the customer scans with Queueless. Paper tokens carry a "Paper" tag in the waiting list.
- **Owner buzzer.** A paper token has no phone to ring, so `useOwnerBuzzer` rings the owner's: the urgent buzz when the number now being served is a paper token (the strip also says "Paper token. Call it out."), the calm one when a paper token is first in line. It fires on changes only, not when the screen opens.
- **No receptionist.** A switch in the queue settings sheet. It only changes what customers are told: neighbours of a paper token are asked to pass the word on.
- **Next and Skip.** Next reads "Call first person" when nobody is being served. Next stays enabled while someone is being served even if nobody waits, so the last person can be marked done and their time counted (a deliberate change from the PRD, which would leave them stuck as "serving"). Skip needs someone to be serving.
- **Close.** A `closing` ref marks that the owner closed it, so the closed snapshot that arrives before the reply is not mistaken for a stale queue. The summary shows served, skipped, left on their own and average minutes. The owner record is cleared only when "Done" is pressed.
- **`RollingNumber`:** each digit is a clipped column of 0–9 that slides by `translateY` over 450 ms. Digits are keyed from the right so the units column stays mounted when 9 becomes 10. Size follows the system font scale up to 1.3 so numerals never overflow.
- **Design system.** Tokens in `theme.js` (ink, blue, yellow, paper, one saturated colour per screen). Plain rows with hairlines instead of cards. Empty states are three dashed ticket outlines instead of an illustration. Buttons are at least 48 dp; Next is 72 dp.
- **Web.** The same screens render in a browser: `Screen` keeps a centred column up to 640 px wide, `Sheet` is capped to the same width, and `TopBar` hides the Home button because the web admin has no other role.
- **Shop display screen.** The web build also serves `/?display=CODE`: a full-screen page for a TV or wall monitor, with the number being served as large as the window allows (the same `RollingNumber`, so it rolls when it changes), the next five numbers, and the QR and code to join. It reads the public snapshot over the same socket, so it needs no key and, like all public data, shows numbers only, never names. A phone-width window stacks the same content. The owner reaches it from the admin dashboard ("Open display", plus the link to type into a TV). Putting the code in the query string means it works on any static host with no server routing.

**Be ready to say honestly**

- The owner key lives in one device's storage, so the phone and the web admin cannot share one queue, and a lost phone loses the queue. Login would fix this; it is out of scope.

---

## Viva questions

**1. Why Socket.io and not polling?**
The server pushes a change the moment it happens, so there are no wasted requests and the delay is tiny. Polling would trade freshness against load.

**2. Two people scan at the same moment. Can they get the same number?**
No. The number comes from one atomic `$inc` on the queue document, and the update returns the new value in the same operation. There is no read-then-write gap.

**3. How is the owner secured with no login?**
A random 24-character key is created with the queue, kept on the owner's device, and checked on every owner route (403 on mismatch). It stops strangers who guess a code. It is not an identity: it cannot be recovered or shared, there is no HTTPS, and the comparison is not timing-safe. This is a stated limitation.

**4. Why does the socket carry only numbers?**
So one customer never sees another's name. Names stay with the owner, who fetches them over REST with the key.

**5. How does a phone know its position if the server sends one shared message?**
Every phone gets the same snapshot and finds its own number in `waiting`. Index 0 means next. One broadcast serves every customer.

**6. How is the wait time estimated, and how accurate is it?**
`ceil(ahead × avg + (someone serving ? avg / 2 : 0))`. `avg` is the mean of the last 10 real service times, or the owner's guess until 3 exist. It is a good guess, not a promise, and it ignores that different services take different time.

**7. What happens if a phone loses Wi-Fi?**
The socket reconnects on its own. On every `connect` the app re-sends `room:join` and replaces its state with the fresh snapshot, so missed updates are repaired. A banner says "Reconnecting. Numbers may be out of date." until then.

**8. Why does the app scan the QR itself instead of the phone's camera app?**
A system-camera QR needs a deep link and a published app. The QR holds `QUEUELESS:<CODE>` (or `QUEUELESS-TICKET:<id>` for a walk-in's ticket) and the in-app scanner reads it; a typed code is the fallback when the camera is denied.

**9. Why REST for actions and sockets only for updates?**
Actions need a result, status codes and validation, which REST gives. Sockets are used for one thing: pushing the snapshot. "You ask by REST, you are told by socket" is easy to explain and to debug.

**10. What is stored on the phone, and how does "resume where you left off" work?**
AsyncStorage holds an `owner` record and a list of `tickets`. On launch the app opens the ticket if there is one, the My tickets list if there are several, else the owner dashboard, else Home. The ticket screen then asks the server for its current state, so a reopened app is never stale.

**11. How does Recall put someone at the back without renumbering?**
Each ticket has a `number` (what people see) and a `sortKey` (what orders the line). Recall sets the sortKey to the highest in the queue plus one, so the person's number stays the same but they move to the end.

**12. Why do Next and Skip not use a database transaction?**
One owner presses one button, so races are not a practical risk, and the "serving" slot is moved with two simple writes. With several owners or counters, a transaction or a version check would be needed.

**13. How can the same code run as a phone app and a web admin?**
Expo with React Native Web. Metro resolves `Navigator.web.js` for the browser and `Navigator.js` for phones, so the web build contains only the owner screens. Platform checks are limited to a few places: the API host, the Home button, and the native animation driver.

**14. What if the database is reset while a phone still holds an old ticket or queue?**
The server answers 404 (or 403 for a wrong key). The ticket screen shows the closed state with a way home, and the owner dashboard clears its record and returns to the start, so nobody is trapped.

**15. How does the customer find out their number was called, and where does it fail?**
Three layers. A watcher above all screens listens on the shared socket for every queue the phone holds a ticket in and shows a banner and a buzz if the app is open. If the app is in the background but connected, the phone raises a local system notification. And for a closed app, the server pushes through the Expo push service to the token the phone registered. The first layer works everywhere, including Expo Go. The other two need a development or production build, and the third also needs an EAS project id and, on Android, Firebase Cloud Messaging credentials, so it is optional and best effort: a push outage never stops the queue.

**16. How does the "Leave in X min" feature work, and why is it reliable?**
It subtracts the customer's travel time and a 2-minute buffer from the wait estimate (`max(0, wait - travel - 2)`) and counts down from the moment the latest snapshot arrived. Every snapshot recomputes it, so it tracks the real speed of the line. The same moment is also given to the phone's own notification scheduler in builds that support it. It is a prediction, not a promise: it is only as good as the wait estimate.

**17. What is the shop display screen, and does it expose customer data?**
It is a read-only page at `/?display=CODE` that shows the serving number, the next five numbers and the join QR, and updates live over the same Socket.io room as the phones. It uses the public snapshot, which holds numbers only, so no names are shown and no owner key is needed.

**18. How does a customer with no phone still get a place in the line?**
The receptionist adds them: the server issues the next number from the same atomic counter, so they queue fairly alongside phones. A paper token is handed over as a number on a slip, and the owner's phone buzzes when it is that number's turn so the receptionist calls it out. A digital walk-in gets a QR that links the ticket to the customer's own phone. If the shop has no receptionist, the owner turns on "No receptionist", and the phone customers sitting directly before and after a paper token are asked to tell them when they are called.

**19. What would you add with more time?**
Push that does not depend on a third-party service, owner accounts (so a queue survives a lost phone and works from phone and browser together), multiple counters, HTTPS and rate limiting, and deployment.
