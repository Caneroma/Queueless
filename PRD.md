# Queueless: Walk-In Queue

A digital token system for small clinics and shops. The owner opens a queue, customers scan a QR code to get a token, and everyone sees their live position and estimated wait on their phone. Customers who have no phone or cannot scan are added by the receptionist as a paper token, and the owner's phone buzzes when it is their turn.

Academic mini project. Never deployed. Built to be easy to explain.

Stack: React Native (Expo) + Node.js (Express + Socket.io) + MongoDB. JavaScript only.

---

## 1. Rules for the implementing agent

Read these before writing any code. They exist to keep the project small.

1. KISS wins every tie. If two designs work, build the one with fewer files and fewer moving parts.
2. Use only the libraries listed in section 9. Do not add others (no Redux, no TypeScript, no UI kits, no auth libraries, no Docker).
3. No user accounts. The owner is identified by a random `ownerKey` stored on their phone. The customer is identified by their ticket id stored on their phone.
4. One active queue per owner device. A customer device holds one ticket per queue, and can hold tickets in several queues at once.
5. Keep each source file under about 150 lines. If one grows, split it.
6. Follow section 7 exactly. Do not substitute default styles, default fonts, stock icons-in-circles, or generic card layouts. The ticket, the rolling number and the line dots are the design; build them properly before polishing anything else.
7. Build in the order of section 10. Do not start a step until the previous step's "Done when" check passes.
8. Comments should explain why, not what. The code will be read by a student presenting it.

---

## 2. Problem

Small clinics, repair shops, salons and counters run on a crowd standing around a door. People do not know how long they will wait, so they stay put. The owner has no clean way to call people in order, and no record of how long service takes.

Big queue-management systems exist, but they need hardware, accounts and setup. A small shop needs something it can start in ten seconds with a phone.

## 3. Product summary

| Who | What they do |
|---|---|
| Owner | Starts a queue, shows a QR code, calls the next person, skips no-shows, adds walk-ins, closes the queue |
| Receptionist (the owner or staff at the counter) | Adds a customer who cannot scan as a paper token, or as a digital ticket they link by QR |
| Customer | Scans the QR (or types a 6-character code), gets a token, watches their position and wait time update live, gets a buzz when it is their turn |

Everything the customer sees updates without refreshing, through Socket.io.

## 4. Goals and non-goals

Goals
- A working end-to-end demo with two phones (or one phone and one emulator).
- Live updates under about a second on the same Wi-Fi.
- An estimated wait time that visibly improves as the owner serves people.
- A codebase a student can walk through in a ten-minute viva.

Non-goals (do not build)
- Login, passwords, OTP, payments, SMS.
- Push notifications were first out of scope. They were added later as best-effort Expo push (see 5.2 and section 13).
- Multiple counters, staff roles, appointments, analytics dashboards.
- Deployment, HTTPS, rate limiting, cloud hosting.
- Dark mode, tablet layouts, internationalisation.

## 5. Features

### 5.1 Core (must ship)

1. Create a queue: owner enters a shop name and a rough service time per person (default 5 minutes). The server returns a join code and an `ownerKey`.
2. Show the QR: a large QR in a bottom sheet with the join code underneath, readable from a counter distance.
3. Join a queue: customer scans the QR inside the app or types the code. Optional first name. They receive the next token number.
4. Live ticket: customer sees their number, how many people are ahead, estimated wait, and which number is being served now.
5. Next: owner marks the person being served as done and calls the next waiting person.
6. Skip: owner marks the person being served as a no-show and calls the next waiting person.
7. Real-time: every change reaches every connected phone through Socket.io.
8. Estimated wait: computed from the average of recent real service times.

### 5.2 Small extensions (chosen because each is cheap and makes the demo better)

| Extension | Why it earns its place | Cost |
|---|---|---|
| Your turn moment | Phone buzzes and the whole screen changes colour when called. This is the emotional payoff of the app. | Haptics call plus a conditional style |
| Almost there alert | A single buzz when only 2 people are ahead, so people can walk back to the shop. | A few lines on the client |
| Leave queue | Customers who give up can tap "Leave queue" so the owner does not call a ghost. | One endpoint |
| Recall | A skipped person who shows up late can be put back at the end of the line. | One endpoint, one list |
| Pause | Owner pauses new joins during a break. Existing tickets stay valid. | One status value |
| Day summary | On closing, owner sees people served, people skipped, and average service time. | One endpoint, one screen section |
| Rolling numbers | The now-serving number rolls like a departure board, so every change is noticed. | One small component, no library |
| Line dots | The line is drawn as dots, one per person ahead, so people see it shrink. | About 40 lines |
| Resume where you left off | The app opens straight on the ticket or the dashboard, with no home screen in the way. | Three checks on launch |
| Rejoin on reopen | If the customer closes the app and comes back, their ticket is still there. | AsyncStorage |
| Walk-in desk | The receptionist adds a customer with no phone. A paper token is a number on a slip; a digital one is linked to the customer's phone by QR. Both take numbers from the same atomic counter, so the line stays fair. | One endpoint, one sheet |
| Buzzer | The owner's phone buzzes when a paper token is called or is next. Customers hear a buzz and see a "You are next" alert. The buzzer follows the phone's volume and silent switch. | `expo-audio` and `Vibration` |
| No-receptionist setting | When the shop has nobody at the counter, the phone customers directly before and after a paper token are asked to pass the word on. Each pair is asked once. | One flag, one push |
| Leave-in timer | The customer says how far away they are (5, 10, 20 or 30 min) and the ticket says when to set off. Alerts show while the app is open. | Client-side, no server state |
| Several tickets | One phone can hold one ticket in each of several queues, with a My tickets list. | AsyncStorage list |
| Server push | When a number is called or is next, the server pushes to a closed app using the Expo push service. Best effort, and it never blocks the queue. | `EXPO_PUSH_URL`, one token per ticket |

### 5.3 Stretch

- Built: a shop display web page at `/?display=CODE`, showing the serving number, the next five numbers and the join QR. Public, numbers only.
- Not built: owner can edit the default service time while the queue is open.

Do not build anything else.

## 6. Key decisions and the reasoning (good viva material)

**Why in-app scanning instead of the phone's normal camera?** A QR opened by the system camera needs deep links and a published app. The project is never deployed, so the QR holds a short string and the app's own scanner reads it. A typed code is the fallback when the camera fails or permission is denied.

**Why no accounts?** The owner holds a random `ownerKey` that proves ownership. The customer holds a ticket id. This removes sign-up screens, password storage and session handling. Limitation: losing the phone loses the queue. That is acceptable for an academic scope and should be stated honestly in the report.

**Why does the server issue token numbers?** Two customers can scan at the same moment. The server increments a counter inside MongoDB with a single atomic operation (`$inc`), so two people can never get the same number.

**Why send only token numbers over the socket?** Names belong to the owner. The public update carries numbers only, so one customer never sees another's name. The owner screen fetches the named list separately, using the `ownerKey`.

**Why compute position on the phone?** The server sends one small shared snapshot to everyone. Each phone finds its own number in the waiting list. One broadcast serves all customers.

**How is the estimate calculated?**
```
avgServiceMin = average of the last 10 "done" tickets (finishedAt - calledAt)
                if fewer than 3 exist, use the owner's default service time
waitMin       = ceil( peopleAhead * avgServiceMin + (someoneBeingServed ? avgServiceMin / 2 : 0) )
```
Skipped and abandoned tickets are excluded from the average, because they did not take real service time. The half-service term accounts for the person currently at the counter being, on average, halfway done.

## 7. UI design

This is a phone app that does one job while a person stands in a corridor holding a bag. There is no landing page, no onboarding carousel and no marketing copy. The app opens on the thing the person needs. The craft goes into the number, the ticket and how the phone responds when something changes.

### 7.1 Design thesis and references

**The number is the interface.** A queue app has one question ("when is it my turn?") and one answer (a number). Every decision below makes that number readable from arm's length and makes its changes felt.

The look is borrowed from physical queue tickets. The behaviour is borrowed from the best live-status apps. What was taken from each reference, and what was left behind:

| Reference | What we borrow | What we leave |
|---|---|---|
| Airline boarding passes and wallet passes | One object holds the key facts. The most important fact is the largest. Notched edges and a tear line. | Barcodes, gradients, glossy finishes |
| Split-flap departure boards and live flight trackers | Numbers that physically roll when they change. Colour that changes with status so you can read the state from across a room. | Dense data tables, maps |
| Things 3 (task app) | Restraint. One accent colour. Generous row spacing. Completing something feels good through touch and sound-free feedback. | Its pastel palette |
| Cash apps and money-transfer apps | Huge numerals as the main visual. One idea per screen. Actions docked at the bottom. | Marketing-style hero cards |
| Utility hardware design (pocket synths, dot-matrix phone launchers) | Honest, tool-like feel. Hard edges. A dot as a unit of "one thing". | Retro cosplay, pixel fonts |
| Ride and delivery trackers | One plain sentence at the top that says what to do right now. | Animated vehicles, maps |
| Platform guidelines (iOS Human Interface, Material) | Safe areas, bottom sheets, native back gestures, 48 dp touch targets, respecting system font size | Platform-specific chrome. We keep one look on both |

### 7.2 Principles

1. **One hero per screen.** The customer screen's hero is the ticket number. The owner's hero is "Now serving". Everything else is smaller and quieter.
2. **State is colour.** Blue means waiting, yellow means go, paper means finished. A customer can glance at the phone from a metre away and know their state.
3. **Thumb first.** Anything pressed often sits in the bottom 40 percent of the screen. Titles and read-only information sit above.
4. **Every touch answers.** A tap gives a press state, a vibration pattern, and a visible result. No silent success.
5. **Nothing decorative.** Every element carries information or lets the person act. If removing it changes nothing, remove it.

### 7.3 Defaults deliberately avoided

| Default | Why rejected | Used instead |
|---|---|---|
| Cream background, serif, terracotta accent | Common generated look, says nothing about queues | Cool paper, cobalt ink, stub yellow |
| Near-black screens with a neon accent | Wrong mood for a clinic waiting room | Light screens, strong colour only at state changes |
| Identical rounded cards with soft shadows | Makes every screen look the same | One ticket shape, plain rows everywhere else |
| Small tracked-out all-caps labels over headings | Template chrome | Sentence-case labels only where they carry meaning |
| Gradient hero with a big stat and a sparkle icon | Not what a queue needs | The ticket, nothing competing with it |
| Icon in a coloured circle above every empty state | Filler | A row of empty dashed stubs (see 7.5) |
| Fade-and-slide entrance on every element | Reads as generated | One orchestrated moment: the number rolls |

### 7.4 Tokens

**Colour**

| Name | Hex | Role |
|---|---|---|
| Ink | `#14171F` | Text, owner's big number, ahead dots on paper |
| Ticket blue | `#1F3FBF` | Waiting state background, primary buttons |
| Ticket blue pressed | `#18309A` | Pressed state of blue buttons |
| Stub yellow | `#FFD23F` | Your-turn background, the "now serving" strip on owner screens |
| Paper | `#F2F4F7` | Owner screens and finished states background |
| White | `#FFFFFF` | Ticket body, sheets |
| Pencil | `#6B7280` | Secondary text, skipped rows |
| Hairline | `#D9DEE6` | 1 px dividers on paper |
| Called green | `#1E8E5A` | Served confirmation |
| Stamp red | `#C8321F` | Skip, errors, destructive confirmation |

Rules: only one saturated colour fills a screen at a time. Never place pencil text on blue. Stamp red text is only used on white or paper. Check contrast: ink on yellow, white on blue and ink on paper all pass AA.

**Type** (two widths of one family, loaded via `@expo-google-fonts`)

| Role | Font | Size / line height | Notes |
|---|---|---|---|
| Customer token | Archivo Narrow Bold | 152 / 152 | letter spacing -2 |
| Owner now serving | Archivo Narrow Bold | 96 / 96 | |
| Screen title | Archivo SemiBold | 28 / 32 | |
| Section title | Archivo SemiBold | 20 / 26 | |
| Body | Archivo Regular | 16 / 24 | |
| Row number | Archivo Narrow Bold | 24 / 28 | |
| Caption | Archivo Regular | 14 / 20 | |
| Button | Archivo SemiBold | 17 / 22 | |

All numbers use `fontVariant: ['tabular-nums']` so digits do not shift while rolling. Text respects system font scale up to 1.3 (set `maxFontSizeMultiplier={1.3}` on the large numerals so they never overflow the ticket). Line length is short by nature on a phone, so no extra rule is needed. Sentence case everywhere. Left-align all text except the token, which is centred in the ticket.

**Shape, spacing, elevation**

- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Screen side padding 24.
- Radii: 4 (buttons, rows, inputs), 20 (ticket), 24 on the top corners of sheets. No other radii.
- Elevation: only the ticket has a shadow (offset 0 / 8, blur 24, ink at 18 percent). Sheets use a 40 percent ink scrim, no shadow.
- Dividers are 1 px Hairline. No borders around rows.
- Touch targets at least 48 dp. The Next button is 72 dp tall.

### 7.5 Signature components

These five components are where the design effort goes. Everything else is plain.

**A. Ticket**

```
 +------------------------------+
 |  Dr. Rao Clinic              |   shop name, Archivo SemiBold 20
 |                              |
 |  Your number                 |   caption, pencil
 |            14                |   token, 152sp, ink, centred
 |                              |
 (o) - - - - - - - - - - - - -(o)   notches + dashed line
 |  Now serving        12       |   rolling number, 28sp
 |  People ahead        1       |
 |  Wait about       6 min      |
 |                              |
 |  Code K7M2QX      Issued 10:42 |   foot, caption, pencil
 +------------------------------+
```

Build: a white `View` with radius 20. Two circles (diameter 24) are positioned at the vertical centre of the divider, half outside each edge, filled with the screen background colour so they read as notches. The divider is a `borderTopWidth: 1.5, borderStyle: 'dashed'` view between them. The foot shows the code and the issue time, as a real ticket would. The notch colour comes from a `bg` prop so it matches blue, yellow or paper.

**B. RollingNumber** (the memorable element)

Used for "Now serving" on both customer and owner screens. Each digit is a clipped column of 0 to 9; changing the digit slides the column. It looks like a departure board and it makes every change visible even if the person was looking at their bag.

```js
function Digit({ d, h, style }) {
  const y = useRef(new Animated.Value(-d * h)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: -d * h, duration: 450,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [d]);
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {[0,1,2,3,4,5,6,7,8,9].map(n => (
          <Text key={n} style={[style, { height: h, lineHeight: h }]}>{n}</Text>
        ))}
      </Animated.View>
    </View>
  );
}
```
Split the number into digits, render `Digit` per position keyed from the right so the units column stays mounted. Rolling from 9 to 0 scrolls backwards through the column. This is acceptable and looks like a real flap board. No library needed. When reduced motion is on, set duration to 0.

**C. LineDots** (the queue made visible)

A single row of dots under the token on the customer ticket. One dot per person ahead, then one larger dot for you.

- Ahead dots: 12 dp circles, white on blue. You: 20 dp circle, stub yellow with a 3 dp white ring.
- Show at most 8 ahead dots, then the text "+N" in caption style.
- On each Next, the first dot shrinks away and the rest slide left (`LayoutAnimation.easeInEaseOut()` called before the state update; enable it on Android with `UIManager.setLayoutAnimationEnabledExperimental`).
- With nobody ahead, only your yellow dot remains. When it is your turn the row is replaced by the status line.

It costs about 40 lines and gives the person a physical sense of the line shrinking, which a number alone does not.

**D. ActionDock**

A bottom-docked bar for the owner: hairline on top, safe-area padding below, Skip on the left (outlined, stamp red, 56 dp), Next on the right (filled blue, 72 dp, takes about two thirds of the width). Pressing Next vibrates with a medium impact on press-in and a success pattern when the server confirms. While a request is in flight the button shows its label dimmed and ignores taps; it does not show a spinner.

**E. Sheet**

A bottom sheet built from `Modal` (transparent, `animationType="slide"`) with a scrim. Used for: the QR (so it is one swipe from the dashboard, no extra screen), skip confirmation, close confirmation, recall list. Close with the scrim tap or the Android back button.

**F. ScanFrame**

The camera screen is full-bleed. Over it: a 60 percent ink mask with a square clear window made from four `View` strips, plus four 28 dp corner brackets (3 dp white lines drawn from two `View`s each). On a valid scan the brackets turn stub yellow and the phone gives a light tap before the screen changes.

**G. Empty stubs**

Empty states show three dashed ticket outlines (same notched shape, no fill) in Hairline colour, with one sentence below. For the owner: "Nobody is waiting. Share the QR to get people in." It is the same visual language as the ticket, so it is not a stock illustration.

### 7.6 Motion and haptics

Haptics use `expo-haptics`. Wrap them in `lib/haptics.js` with named functions (`tap`, `confirm`, `warn`, `turn`) so patterns can be tuned in one file.

| Event | Visual | Haptic |
|---|---|---|
| Any button press | Opacity 0.85, scale 0.98 for 80 ms | light impact |
| Owner taps Next, server confirms | Now serving number rolls (450 ms) | success notification |
| Customer's now serving changes | Number rolls | selection tick |
| Position reaches 2 or fewer ahead | Status line changes | medium impact, once |
| Customer's turn | Background cross-fades blue to yellow (400 ms), ticket scales 1.0 to 1.06 to 1.0, status line changes to "Go to the counter now." | success notification, then a second one 300 ms later |
| Dot leaves the line | LayoutAnimation (250 ms) | none |
| Skip confirmed | Row slides out | warning notification |
| Scan succeeds | Brackets turn yellow | light impact |
| Error | Field or banner appears in stamp red, text only | error notification |
| Reconnecting | Banner slides down from the top (200 ms) | none |

Nothing animates by itself without a cause. If the system reports reduced motion: no scale pulse, rolling and fades become instant, haptics stay.

### 7.7 Screens

Navigation is a native stack with no tab bars and no drawer. The app resumes where the person left off:

1. If a ticket record exists on launch, open My ticket.
2. Else if an owner record exists, open the owner dashboard.
3. Else open Home.

Both resumed screens show a small "Home" text button in the top-left corner so the person can switch roles.

**S1. Home** (only seen when nothing is active)

The screen is two full-height panels. No logo block, no tagline.

```
+------------------------------+
|                              |
|  I'm waiting                 |   blue panel, tap anywhere
|  Join a queue                |   white text, 28sp
|                              |
+------------------------------+
|                              |
|  I run the queue             |   paper panel, ink text
|  Start a queue               |
|                              |
+------------------------------+
```
The top panel is roughly 55 percent of the height because customers are the more common user. Tapping a panel presses in (scale 0.99) and navigates. If an owner record exists, the bottom panel reads "Open my queue".

**S2. Start a queue**

Title "Start a queue" at the top, two fields below, one docked button.

```
+------------------------------+
|  Home                        |
|  Start a queue               |
|                              |
|  Shop or clinic name         |
|  [ Dr. Rao Clinic          ] |
|                              |
|  Minutes per person          |
|  [ - ]    5    [ + ]         |   stepper, 1 to 60
|  Used until you have served  |
|  three people.               |
|                              |
|  [      Open queue         ] |   docked, blue
+------------------------------+
```
The name field is focused on open and the keyboard pushes the dock up (`KeyboardAvoidingView`). Validation text appears under the field.

**S3. Owner dashboard**

```
+------------------------------+
|  Home                  Pause |
|  Dr. Rao Clinic              |
|  Code K7M2QX      [Show QR]  |
|+----------------------------+|
||  Now serving               ||   yellow strip, full width
||     12                     ||   rolling, 96sp
||  Asha                      ||
|+----------------------------+|
|  Waiting (4)                 |
|  13   Imran                  |   rows with hairlines
|  14   Meera                  |
|  15   Guest                  |
|  16   Dev                    |
|  Skipped (1)         Review  |
|------------------------------|
|  [ Skip ]     [    Next    ] |   ActionDock
+------------------------------+
```
Details: the waiting list scrolls under the dock; only the strip and dock are fixed. "Guest" is the label for a ticket with no name. "Review" opens a sheet listing skipped people, each with a "Put back" button (this is Recall). The overflow for "Close queue" is a long-press on the shop name, plus a visible "Close queue" text button at the bottom of the Pause sheet, so it cannot be hit by accident. A sheet asks "Close this queue?" with the consequences in one line. Nobody waiting: Next and Skip are disabled and the empty stubs appear. If nobody is being served and people are waiting, Next reads "Call first person".

The QR sheet shows the QR as large as the sheet allows, the shop name above, and the code below in 40sp Archivo Narrow. The screen stays awake while it is open. Copy: "Scan with Queueless, or enter this code."

**S4. Join a queue**

Full-bleed camera with ScanFrame. A sheet docked at the bottom holds "Or type the 6-character code" and the Join button. After a valid scan or code, the sheet content swaps to the optional name field with the button "Get my number". If camera permission is denied the camera area becomes a paper panel with the reason and the code field is the only path.

**S5. My ticket** (the hero screen)

Background colour follows state. The ticket sits upper-centre, the LineDots row and status line sit under it, the Leave button is docked at the bottom as a text button.

```
+------------------------------+
|  Home                        |
|                              |
|  Wait here.                  |   status line, 28sp, white
|  You are 2nd in line.        |
|                              |
|  +------------------------+  |
|  |  Ticket (see 7.5 A)    |  |
|  +------------------------+  |
|                              |
|   o  o  O                    |   LineDots, you = yellow
|                              |
|  [ Leave queue ]             |
+------------------------------+
```

Status line copy by state (the line is the first thing read, so it is a command):

| State | Background | Status line | Ticket and extras | Haptic |
|---|---|---|---|---|
| Waiting, 3 or more ahead | Blue | "Wait here." | Full ticket, LineDots | none |
| Almost, 2 or fewer ahead | Blue | "Head back to the shop." | Same | medium impact once |
| Your turn | Yellow | "Go to the counter now." | Ticket without wait info, LineDots hidden, ink text | double success |
| Done | Paper | "Thanks for waiting." | Plain text and "Back to home" button | none |
| Skipped | Paper | "You were skipped because you did not show up." | "Join again" button | none |
| Queue paused | Blue | status line unchanged | Small notice under the ticket: "Joining is paused. Your place is safe." | none |
| Queue closed | Paper | "This queue is closed." | "Back to home" button | none |
| Offline | same | unchanged | Thin banner at the top: "Reconnecting. Numbers may be out of date." | none |

The wait line on the ticket reads "Wait about 6 min", rounded up to whole minutes. It uses the same wording whether the average comes from real service times or the owner's starting guess.

**S6. Day summary**

Paper background. Four rows, each with a label on the left and a Narrow Bold number on the right: served, skipped, left on their own, minutes per person on average. One docked button: "Done".

### 7.8 Copy rules

- Describe what the user does, not what the system does. "Join a queue", not "Initialise session".
- A button keeps its name in the confirmation. "Next" produces "Called 13".
- Errors say what happened and what to do. No apologising, no vague wording.
- Sentence case everywhere. No exclamation marks.

| Situation | Text |
|---|---|
| Wrong code | "No queue has this code. Check the 6 characters and try again." |
| Queue closed on join | "This queue is closed. Ask the shop for a new code." |
| Queue paused on join | "Joining is paused for now. Try again in a few minutes." |
| Already holding a ticket | "You already have a ticket for Dr. Rao Clinic. Open it or leave it first." |
| No one waiting (owner) | "Nobody is waiting. Share the QR to get people in." |
| Camera denied | "Camera access is off. Type the code instead." |
| Network down | "Cannot reach the server. Check that both phones are on the same Wi-Fi." |
| Skip sheet | "Skip 12? They will move to the skipped list and you can put them back." |
| Close sheet | "Close this queue? Anyone still waiting will be removed." |
| Leave sheet | "Leave the queue? You will lose number 14." |

### 7.9 App icon, splash and system chrome

- Icon: a white ticket silhouette with two side notches, centred on a Ticket blue square. No text, no gradient.
- Splash: solid Ticket blue, the same ticket silhouette centred at 120 dp. Nothing else.
- Status bar: light icons on blue screens, dark icons on yellow and paper screens. Switch with `StatusBar` per state.
- Android navigation bar colour matches the docked bar background.
- Portrait only (`orientation: "portrait"` in `app.json`).

### 7.10 Quality floor and design acceptance checklist

Build to these without announcing them. Every item must pass before the project is considered finished.

- Squint test: blur your eyes at the ticket screen from arm's length. You can still read the token number and tell blue from yellow.
- One-hand test: every frequent action is reachable with a thumb on a 6-inch phone.
- Small phone: layouts hold at 360 x 640 dp with no overlap or clipping.
- Large text: set the system font size to the largest setting, token and strip numbers still fit and no button label truncates.
- Sunlight test: ink on yellow and white on blue are readable at full brightness outdoors. Do not use light grey text on any coloured background.
- Every button has an `accessibilityLabel`. The token, now serving number and status line have `accessibilityLiveRegion="polite"`.
- Colour is never the only signal: the status line text changes with the colour.
- Keyboard never hides the field being typed in.
- Both iOS and Android: back gesture and hardware back button behave sensibly; the app never traps the user.
- Reduced motion respected as described in 7.6.
- No lorem ipsum, no placeholder shop names left in the app, no console warnings.

---

## 8. Architecture

```
 Customer phone            Owner phone
 (React Native)            (React Native)
      |   REST + socket        |   REST + socket
      +-----------+------------+
                  |
          Node.js server (Express + Socket.io)
                  |
              MongoDB
```

Flow of one update:
1. Owner taps Next. App calls `POST /api/queues/:code/next` with the `ownerKey`.
2. Server updates two tickets in MongoDB, builds a snapshot, and emits `queue:update` to the Socket.io room named after the code.
3. Every phone in that room receives the snapshot and re-renders. The owner's phone also refetches its named list.

REST is used for actions (create, join, next, skip). Sockets are used only for pushing snapshots. This split is simple to explain: *you ask by REST, you are told by socket*.

### 8.1 Data models (Mongoose)

**Queue**
| Field | Type | Notes |
|---|---|---|
| `name` | String | Shop name |
| `code` | String | 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L), unique |
| `ownerKey` | String | 24 random hex characters, never sent in public responses |
| `status` | String | `open`, `paused`, `closed` |
| `defaultServiceMin` | Number | Owner's starting guess |
| `noReceptionist` | Boolean | Default `false`. When true, phone customers beside a paper token are asked to pass the word on |
| `lastNumber` | Number | Counter for token numbers, starts at 0 |
| `createdAt`, `closedAt` | Date | |

**Ticket**
| Field | Type | Notes |
|---|---|---|
| `queueId` | ObjectId | Index |
| `number` | Number | Token shown to people |
| `sortKey` | Number | Equals `number` at creation. Recall sets it to the current max plus 1, which puts the person at the back |
| `name` | String | Optional, owner-only |
| `kind` | String | `digital` (a phone ticket, or a walk-in linked by QR) or `physical` (a paper token). Default `digital` |
| `relayed` | [Number] | Paper-token numbers this phone ticket has already been asked to pass on. Stops a repeat request |
| `expoPushToken` | String | Optional. Registered by the phone for server push. Owner-only and never sent to other customers |
| `status` | String | `waiting`, `serving`, `done`, `skipped`, `left` |
| `joinedAt`, `calledAt`, `finishedAt` | Date | `calledAt` to `finishedAt` is the service time |

Only one ticket per queue may be `serving` at a time. The Next and Skip handlers guarantee this.

### 8.2 REST API

All responses are JSON. Owner routes require header `x-owner-key`.

| Method and path | Who | Body | Returns |
|---|---|---|---|
| `POST /api/queues` | owner | `{ name, defaultServiceMin }` | `{ code, ownerKey, snapshot }` |
| `GET /api/queues/:code` | anyone | | `snapshot` |
| `POST /api/queues/:code/join` | customer | `{ name? }` | `{ ticketId, number, snapshot }` |
| `GET /api/tickets/:id` | customer | | `{ number, status, queueName, queueCode }` |
| `POST /api/tickets/:id/leave` | customer | | `{ ok: true }` |
| `GET /api/queues/:code/owner` | owner | | `{ serving, waiting[], skipped[] }` with names |
| `POST /api/queues/:code/next` | owner | | `snapshot` |
| `POST /api/queues/:code/skip` | owner | | `snapshot` |
| `POST /api/queues/:code/recall/:ticketId` | owner | | `snapshot` |
| `POST /api/queues/:code/walkin` | owner | `{ name?, kind: 'physical' or 'digital' }` | `{ ticketId, number, kind, snapshot }` |
| `POST /api/queues/:code/settings` | owner | `{ noReceptionist: bool }` | `snapshot` |
| `POST /api/tickets/:id/notifications` | customer | `{ token }` | `{ ok: true }` |
| `POST /api/queues/:code/pause` | owner | `{ paused: bool }` | `snapshot` |
| `POST /api/queues/:code/close` | owner | | `{ summary }` |

Status codes: 400 invalid input, 403 wrong owner key, 404 unknown code or ticket, 409 queue closed, paused (for joining) or duplicate join. Walk-ins are still accepted while joining is paused, because pausing stops strangers scanning, not the desk.

**Snapshot** (the one shared shape, sent by REST and socket):
```json
{
  "code": "K7M2QX",
  "name": "Dr. Rao Clinic",
  "status": "open",
  "noReceptionist": false,
  "serving": 12,
  "waiting": [13, 14, 15, 16],
  "physical": [14],
  "avgServiceMin": 4.5
}
```

### 8.3 Socket events

| Event | Direction | Payload |
|---|---|---|
| `room:join` | client to server | `code` string. Server calls `socket.join(code)` and replies with a fresh snapshot |
| `queue:update` | server to room | `snapshot` |

Two events are enough. Clients use `socket.io-client` default reconnection. On every `connect` event the client emits `room:join` again and replaces its state with the snapshot it gets back. This single rule handles missed updates after a Wi-Fi blip.

### 8.4 Core server logic

Issue a token (atomic):
```js
const q = await Queue.findOneAndUpdate(
  { code, status: 'open' },
  { $inc: { lastNumber: 1 } },
  { new: true }
);
// if q is null: queue is missing, paused or closed, decide which and return 404/409
const ticket = await Ticket.create({
  queueId: q._id, number: q.lastNumber, sortKey: q.lastNumber, name
});
```

Advance the line (used by both Next and Skip):
```js
async function advance(queue, finishedStatus) {
  const now = new Date();
  await Ticket.updateOne(
    { queueId: queue._id, status: 'serving' },
    { status: finishedStatus, finishedAt: now }       // 'done' or 'skipped'
  );
  await Ticket.findOneAndUpdate(
    { queueId: queue._id, status: 'waiting' },
    { status: 'serving', calledAt: now },
    { sort: { sortKey: 1 } }
  );
}
```
After `advance`, call `buildSnapshot(queue)` then `io.to(queue.code).emit('queue:update', snapshot)`. The same step also sends the best-effort pushes: "It is your turn" to the ticket being called, and "You are next" to the new first person in line.

Average service time:
```js
const recent = await Ticket.find({ queueId, status: 'done' })
  .sort({ finishedAt: -1 }).limit(10);
const avg = recent.length >= 3
  ? recent.reduce((s, t) => s + (t.finishedAt - t.calledAt), 0) / recent.length / 60000
  : queue.defaultServiceMin;
```

Client estimate, in one small pure function in `app/src/lib/eta.js`:
```js
export function waitMinutes(ahead, avg, someoneServing) {
  return Math.ceil(ahead * avg + (someoneServing ? avg / 2 : 0));
}
```

---

## 9. Tech and folder layout

### 9.1 Libraries (the full list)

Server: `express`, `mongoose`, `socket.io`, `cors`, `dotenv`, `nodemon` (dev).

App (Expo, JavaScript template): `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `socket.io-client`, `@react-native-async-storage/async-storage`, `expo-camera`, `react-native-qrcode-svg`, `react-native-svg`, `expo-haptics`, `expo-keep-awake`, `expo-font`, `@expo-google-fonts/archivo`, `@expo-google-fonts/archivo-narrow`, `@expo/vector-icons` (ships with Expo; use only the Feather set, and only 4 icons: x, chevron-left, pause, play).

Added after the first build: `expo-notifications` (system notifications and the push token), `expo-audio` (the buzzer sound), `expo-constants` (finds the dev server's address), `react-native-web` and `react-dom` (the owner console and shop display). The server still uses no extra libraries beyond the list above; push uses the built-in `fetch`.

Use the built-in `fetch` for REST. Use built-in `Animated`, `LayoutAnimation` and `Modal` for all motion and sheets.

### 9.2 Folder layout

```
JAVA_MiniProject/
  PRD.md
  server/
    package.json
    .env                  PORT=4000, MONGO_URI=mongodb://127.0.0.1:27017/queueless
    src/
      index.js            create http server, attach Socket.io, connect Mongo
      models/Queue.js
      models/Ticket.js
      routes/queues.js    all queue routes
      routes/tickets.js   ticket routes
      lib/snapshot.js     buildSnapshot, avgServiceMin
      lib/code.js         makeCode, makeOwnerKey
      lib/auth.js         requireOwner middleware
  app/
    App.js                fonts, navigation container
    src/
      config.js           API_URL = 'http://<your-laptop-LAN-IP>:4000'
      theme.js            colours, type, spacing tokens from section 7
      lib/api.js          small fetch wrapper that throws readable errors
      lib/socket.js       one shared socket instance
      lib/storage.js      save/load/clear 'owner' and 'ticket' records
      lib/eta.js
      lib/haptics.js        named patterns: tap, confirm, warn, turn
      hooks/useLiveQueue.js   connects, joins room, returns snapshot + connection state
      components/Ticket.js    the ticket shape with notches
      components/BigButton.js
      components/Field.js
      components/OfflineBanner.js
      components/RollingNumber.js
      components/LineDots.js
      components/ActionDock.js
      components/Sheet.js
      components/ScanFrame.js
      components/EmptyStubs.js
      components/QrCard.js        rounded white card for every QR (its margin is the scanner's quiet zone)
      components/WalkInSheet.js   the receptionist's walk-in form and result
      components/AlertBanner.js   the yellow banner for called, next and leave alerts
      lib/buzzer.js               urgent and calm buzzer sounds with vibration; off on web
      lib/qr.js                   QUEUELESS:<CODE> and QUEUELESS-TICKET:<id>, and the parser
      lib/walkins.js              the paper tokens beside a held ticket
      hooks/useOwnerBuzzer.js     rings the owner's phone for paper tokens
      hooks/useTicketAlerts.js    watches every held queue for called, next and leave alerts
      screens/Home.js
      screens/StartQueue.js
      screens/OwnerDashboard.js
      screens/JoinQueue.js
      screens/MyTicket.js
      screens/DaySummary.js
```

Local data saved on the phone (AsyncStorage):
- `owner`: `{ code, ownerKey, name }` while a queue is open
- `ticket`: `{ ticketId, code, number, queueName }` while holding a ticket

---

## 10. Step-by-step implementation plan

Each step lists what to build and a check that must pass before moving on. Steps 1 to 3 are the backend, 4 to 9 the app.

### Step 0. Prerequisites
- Node 18 or newer, MongoDB running locally (or a free Atlas connection string), Expo Go on a phone.
- Laptop and phone on the same Wi-Fi. Note the laptop's LAN IP (for example `192.168.1.20`).

Done when: `node -v`, `mongosh` and `npx expo --version` all work.

### Step 1. Server skeleton and models
1. Create `server/`, run `npm init -y`, install the server libraries.
2. `src/index.js`: Express with `cors` and `express.json()`, a `GET /health` route returning `{ ok: true }`, connect to Mongo, `listen` on `PORT`.
3. Create the `Queue` and `Ticket` models from section 8.1 with an index on `Ticket.queueId` and a unique index on `Queue.code`.
4. `lib/code.js`: `makeCode()` returns 6 characters from the allowed alphabet, retrying if the code already exists. `makeOwnerKey()` returns `crypto.randomBytes(12).toString('hex')`.

Done when: `curl localhost:4000/health` returns `{"ok":true}` and the server logs a Mongo connection.

### Step 2. REST routes
1. `lib/snapshot.js`: `buildSnapshot(queue)` returns the shape in section 8.2 (serving number, ordered waiting numbers, average service time).
2. `lib/auth.js`: `requireOwner` loads the queue by `:code`, compares `x-owner-key`, returns 403 on mismatch, attaches the queue to `req`.
3. `routes/queues.js`: implement create, get, join, owner list, next, skip, recall, pause, close, in that order.
   - Join rejects with 409 when the queue is paused or closed.
   - Close sets `status: 'closed'`, marks any remaining `waiting` and `serving` tickets as `left`, and returns the summary counts.
4. `routes/tickets.js`: get ticket status (include the queue name and code), leave (only allowed while `waiting`).
5. Validate input by hand: trim the name, reject empty shop names, clamp `defaultServiceMin` to 1 to 60.

Done when this curl script works, in order:
```
create queue -> join x3 -> next -> next -> skip -> owner list -> close
```
and the numbers come out as 1, 2, 3 with correct statuses at each step.

### Step 3. Socket.io
1. In `index.js`, wrap Express in `http.createServer`, attach `new Server(httpServer, { cors: { origin: '*' } })`.
2. Handle `room:join`: `socket.join(code)`, then load the queue and emit its snapshot back to that socket only.
3. Export a small `broadcast(queue)` helper (or attach `io` to `app`) and call it after every route that changes state: join, leave, next, skip, recall, pause, close.

Done when: a throwaway Node script that connects with `socket.io-client`, emits `room:join`, receives `queue:update` after a curl `next` call.

### Step 4. App scaffold, theme and fonts
1. `npx create-expo-app app` (blank JavaScript template). Install the app libraries with `npx expo install`.
2. `src/theme.js`: export colours (7 tokens), spacing, radii, font names, type scale exactly as in section 7.
3. `App.js`: load fonts with `useFonts`, show nothing until loaded, then render `NavigationContainer` with a native stack containing the 6 screens (Home, StartQueue, OwnerDashboard, JoinQueue, MyTicket, DaySummary). On launch, apply the resume rules from section 7.7. Hide the default header, each screen draws its own title.
4. Build shared components: `BigButton` (primary, outline, danger variants), `Field`, `OfflineBanner`.
5. Build `Ticket.js`: a white rounded view with two circles overlapping its left and right edges at the divider, coloured with a `bg` prop so they match the screen behind, and a dashed `borderTopWidth` line between the circles. Accept children for the upper and lower parts.

6. Build `RollingNumber.js` (section 7.5 B) and a temporary screen with a button that increments it. Build `LineDots.js` (7.5 C), `Sheet.js` (7.5 E), `ActionDock.js` (7.5 D), `EmptyStubs.js` (7.5 G) and `lib/haptics.js` (7.6).
7. Set `orientation: "portrait"` and the icon and splash from section 7.9 in `app.json`.

Done when: Home renders with the real fonts and colours, the Ticket shows correctly on blue, yellow and paper backgrounds (notches match each), and the rolling number rolls smoothly from 9 to 10 and from 41 to 42 on the test button.

### Step 5. App data layer
1. `config.js`: set `API_URL` with the laptop's LAN IP.
2. `lib/api.js`: `api(path, { method, body, ownerKey })`. On a non-OK response, throw an `Error` whose message is the server's `error` field. On a network failure, throw the "Cannot reach the server" message from section 7.8.
3. `lib/storage.js`: `saveOwner/loadOwner/clearOwner`, `saveTicket/loadTicket/clearTicket`.
4. `lib/socket.js`: a single `io(API_URL, { autoConnect: false })`.
5. `hooks/useLiveQueue.js(code)`: connects the socket, on every `connect` emits `room:join`, listens for `queue:update`, returns `{ snapshot, online }`. Disconnects on unmount.

Done when: a temporary screen prints the snapshot, and running a curl `next` changes it on the phone without touching the phone.

### Step 6. Owner flow
1. `StartQueue.js`: validate, call create, save the owner record, navigate to the dashboard.
2. `OwnerDashboard.js`:
   - Use `useLiveQueue` for the big number and counts. Render the number with `RollingNumber` inside the yellow strip, and the actions with `ActionDock`.
   - On snapshot change, also fetch `/owner` for the named lists.
   - Next and Skip call their routes. Disable the pressed button until the request ends to prevent double taps.
   - Skipped list shows each person with a "Recall" button.
   - Pause toggle, Show QR button, and an overflow action "Close queue" with a confirm dialog.
3. QR sheet inside `OwnerDashboard.js`: `QRCode` value is the string `QUEUELESS:<CODE>`. Use `Sheet` and `useKeepAwake` while it is open. Skip, Close and Skipped-review are also sheets.
4. `DaySummary.js`: shown after closing. Clear the owner record on "Done".
5. `Home.js`: the two-panel layout from section 7.7. If an owner record exists, the bottom panel reads "Open my queue". `App.js` skips Home entirely when a ticket or owner record exists.

Done when: two simulated actions (create, next, skip, pause, close) all work from the phone and update the database.

### Step 7. Customer flow
1. `JoinQueue.js`: `CameraView` wrapped in `ScanFrame`, with the code input in a docked sheet, and `onBarcodeScanned`, accept only values starting with `QUEUELESS:`. Ignore repeat scans for 2 seconds. Handle permission denied by showing only the code input. Typed codes are uppercased and trimmed.
2. After a valid code, call `GET /api/queues/:code` to confirm it exists, ask for an optional name, then call join. Save the ticket record and navigate to `MyTicket` replacing the join screen.
3. `MyTicket.js`:
   - Use `useLiveQueue(code)`.
   - Derive state: `mine === serving` means turn. `waiting.indexOf(mine)` gives position. If neither, call `GET /api/tickets/:id` once to learn whether it is done, skipped, left or the queue is closed.
   - Render the state table in section 7.7 with `Ticket`, `RollingNumber` for now serving, and `LineDots` under the ticket.
   - The status line sits above the ticket and changes with state. Set `StatusBar` style per state (7.9).
   - "Leave queue" asks for confirmation, calls leave, clears the stored ticket, goes home.
4. Home shows "Back to my ticket" when a ticket record exists. If the ticket is finished, clear it when the person leaves the end-state screen.

Done when: with the owner on one device and customer on another, join, watch the number move, and see the position change on each Next.

### Step 8. Feel and edge cases
1. Haptics: `Haptics.notificationAsync(Success)` on turn, `Haptics.impactAsync(Medium)` once when ahead becomes 2 or fewer. Store a ref so each fires only once per state change.
2. Motion: implement every row of the table in section 7.6. The background cross-fade uses an interpolated `Animated.Value`; the turn pulse uses `Animated.sequence`. Read `AccessibilityInfo.isReduceMotionEnabled` once in a shared hook and pass it to `RollingNumber`, the pulse and `LayoutAnimation` calls.
3. Offline banner appears when `online` is false.
4. Kill and reopen the app: the ticket and the owner dashboard must both restore.
5. Pause and close messages for customers match the copy table.

Done when: every row of the section 7.7 state table can be triggered and looks right.

### Step 9. Test, tidy, demo prep
Manual test script (run top to bottom, tick each):
- [ ] Create queue, QR shows, code matches
- [ ] Two customers scan and get numbers 1 and 2
- [ ] Join with a wrong code shows the error text
- [ ] Next serves 1, customer 1 phone turns yellow and buzzes
- [ ] Skip on 2 moves them to Skipped, Recall puts them back at the end
- [ ] Wait time starts from the default, and changes after at least 3 completed services
- [ ] Customer leaves, owner list updates without refresh
- [ ] Turn Wi-Fi off on a customer phone, back on, state catches up
- [ ] Pause blocks new joins but keeps existing tickets
- [ ] Close shows the summary and customers see "This queue is closed"

Design review: run every item in section 7.10 on a real phone, at the largest system font size, and on a small-screen emulator (360 x 640). Fix failures before the demo.

Tidy: remove console logs, make sure `README` section below is accurate, confirm no file exceeds roughly 150 lines.

Add a short `README.md` in the root with: how to start Mongo, `cd server && npm run dev`, set `API_URL`, `cd app && npx expo start`.

---

## 11. Demo script (about 5 minutes)

1. Show Home on both phones. Start a queue on phone A ("Campus Photocopy Shop").
2. Open the QR sheet. Scan from phone B. Show phone B's ticket.
3. Add a third person using the code on an emulator or a second tab.
4. Press Next on A. B and C update at once. Point out the estimate is the default guess.
5. Serve three people quickly. Show the estimate change to match real speed.
6. Skip someone, recall them, show the "Your turn" colour change and buzz.
7. Close the queue and show the summary.
8. Walk-in: on the owner's phone add a paper token for someone without a phone. Show the number on the slip, and the "Paper" tag in the list.
9. Turn on "No receptionist". Show the phone customer beside the paper token receive the request to pass the word on.
10. Call the paper token. The owner's phone buzzes and says "Paper token. Call it out."
11. Open the shop display on a TV-sized window to show the same line.

## 12. Questions a viva examiner may ask

| Question | Short answer |
|---|---|
| Why does the number roll instead of just changing? | A change that was missed on a quick glance is a failed update in a queue. The roll catches the eye and the haptic catches the hand. |
| Why Socket.io and not polling? | The server pushes a change when it happens, so there are no wasted requests and the delay is tiny. |
| What if two people scan together? | Token numbers come from one atomic MongoDB increment, so they cannot clash. |
| How does the owner stay secure with no login? | A random key is created at queue creation and checked on every owner action. |
| What if the phone loses connection? | The socket reconnects on its own and the app asks for a fresh snapshot, so it catches up. |
| How accurate is the wait time? | It uses the last 10 real service times. It is a good guess, not a promise, and improves as people are served. |
| How does a customer with no phone join? | The receptionist adds them as a walk-in. A paper token gets a number on a slip, and the owner's phone buzzes when it is their turn. The number comes from the same atomic counter, so the line stays fair. |
| How does the app help when there is no receptionist? | The owner turns on "No receptionist". Each phone customer right before or after a paper token gets one push asking them to pass the word on. |
| Why does a Mongo update decide who gets a push? | The update that marks a request as sent uses a filter (`relayed` does not contain the number) and `modifiedCount`, so two quick snapshots cannot send the same request twice. |
| What would you add with more time? | Owner accounts, multiple counters, HTTPS and rate limiting, automated tests, deployment. |

## 13. Known limitations (state them honestly in the report)

- Losing the owner's phone loses control of the queue.
- A customer who clears app data loses their ticket.
- Only works on a local network, with no HTTPS or authentication beyond the owner key.
- The estimate ignores the fact that different services take different amounts of time.
- Server push only reaches a development or production build with an EAS project id (on Android it also needs Firebase Cloud Messaging). Expo Go cannot receive it.
- A paper token's holder is called out by the receptionist. The app can ring the owner and ask a neighbour, but it cannot reach someone with no phone.
- Scheduled leave-in reminders are off, so the leave-in alert only shows while the app is open.
- No automated test suite is committed yet. The flows were checked with scripted end-to-end runs.
