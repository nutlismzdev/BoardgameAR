# CLAUDE.md — บอร์ดเกม "7 มหาราช"

สื่อการสอนประวัติศาสตร์ไทยแบบบอร์ดเกมเดินช่อง (roll-and-move) + AR
ธีม: อุทยานราชภักดิ์ · กลุ่มเป้าหมาย: เด็ก 9–14 ปี · แพลตฟอร์ม: เว็บ (React+Vite PWA) บนแท็บเล็ต

> ⚠️ **`DESIGN.md` เป็นเอกสารเก่า (ไม่ตรงกับโค้ดแล้ว)** — อธิบายกติกาชนะแบบเดิม (เรียนครบ 3 ขั้น) ซึ่งถูกแทนที่ด้วยระบบ "เก็บเหรียญกษัตริย์" เมื่อ 2026-07-04 ไฟล์ CLAUDE.md นี้คือแหล่งอ้างอิงกติกาปัจจุบัน

## คำสั่ง

```bash
npm run dev      # dev server (vite)
npm run build    # tsc && vite build  ← ใช้เช็ก type + bundle ก่อน commit เสมอ
npm run preview  # ดู build จริง
```

Stack: React 18 + TypeScript + Zustand (state) + Vite. ไม่มี test runner. Path alias `@/` = `src/`.

## สถาปัตยกรรมหลัก (กฎเหล็ก)

- **Logic ทั้งหมดอยู่ใน `src/core/`** — โดยเฉพาะ `store.ts` (Zustand). ไฟล์ layout/component **ห้ามฝัง game logic** ทำแค่ อ่าน state + เรียก action
- **แยก Layout ตามการหมุนจอ:** `screens/GameBoard/index.tsx` เลือก `GameBoard.portrait.tsx` หรือ `GameBoard.landscape.tsx` ตาม `useOrientation()`
  - **จอเล่นจริง = landscape.** portrait เป็นแค่หน้านัดให้ผู้ใช้หมุนแท็บเล็ตเป็นแนวนอน
- **เนื้อหาอยู่ในไฟล์ JSON** (`src/data/`) แก้ได้โดยไม่แตะโค้ด — `content.ts` เป็น layer เดียวที่อ่าน JSON เนื้อหา

## กติกาเกม (ปัจจุบัน)

- **ผู้เล่น 1–4 คน** (pass-and-play) เลือกจำนวน + เลือก "หมากกษัตริย์" ที่หน้า Home
- **ชนะเมื่อเก็บ "เหรียญกษัตริย์" ครบ 7 พระองค์** → `Player.kingCoins`
- เหรียญกษัตริย์ได้จาก **ช่องทอง (goldking) เท่านั้น** และต้อง **ตอบคำถามถูก**
- เกมจบด้วย 2 เงื่อนไข (`finishTurn` ใน store.ts): มีใครเก็บครบ 7 → ชนะทันที · หรือเล่นครบ `settings.maxRounds`
- ทอยได้ 6 = ทอยซ้ำ (bonus roll)

### ⚠️ `kingCoins` ≠ `unlockedKings` (คนละระบบ อย่าปนกัน)
- `kingCoins`: เหรียญจากช่องทอง — **เงื่อนไขชนะ**
- `unlockedKings` + `lessonProgress`: สถานะ "เรียนรู้ครบ 3 ขั้น (ความรู้+ควิซ+ภารกิจ)" ของแต่ละพระองค์ — ใช้กับ **พิพิธภัณฑ์/เควส/บอสทบทวน** เท่านั้น ไม่เกี่ยวกับการชนะ

## กระดาน (Board Model)

กระดานเป็น **กราฟ** (ไม่ใช่วงกลม %loop ล้วน) — `board-layout.json`:
- 46 ช่องวงนอก (index 0–45) + 3 ช่องทางแยกวงใน (46–48)
- แต่ละช่องมี `next: number[]` — ปกติ 1 ทาง, ช่องแยกมี 2 ทาง
- `Player.position` เป็น **number** (index) index-aligned กับ `board-points.json` (พิกัด %) และ `TILES[]`
- `Player.kingTokenId` เป็น **id ของพระมหากษัตริย์** ที่ใช้เลือกภาพหมากบนกระดาน (ไม่เกี่ยวกับ `kingCoins`)

### ช่องพิเศษ 15 ช่อง (ตรงกับหมายเลขบนกระดานจริง)
| ช่อง | type | สี/ไอคอน | ผล |
|---|---|---|---|
| 0 | start | 🏛️ ทอง | ผ่าน = +100 |
| 3, 29 | knowledge | 💡 ชมพู | อ่านเกร็ด → สะสมการ์ด (10/คน) + ควิซทวน ก/ข/ค/ง + ปุ่มสุ่มใหม่ (ไม่มี AR) |
| 6, 12, 20, 35, 43 | mission | 🎯 ฟ้า | โจทย์ปรนัย ก/ข/ค/ง |
| 10, 37 | question | ❓ เหลือง | ควิซทั่วไป (ได้เหรียญปกติ) |
| 23 | chance | 🌀 ม่วง | การ์ดโชคสุ่มดี/ร้าย + ไอเทม |
| 16, 26, 40 | goldking | 👑 ทอง | บทเรียน AR (คลิป 15 วิ + ลากคำตอบ) ชิงเหรียญกษัตริย์ |
| 32 | bonus | 💚 เขียว | การ์ดโบนัส **+ เป็นจุดทางแยก** |

ช่องที่เหลือ = `blank` (ช่องเดินเปล่า). ช่องแยก 46/48 = `coin`, 47 = `blank`

### ทางแยกที่ช่อง 32
- `32.next = [33, 46]` — 33 = "สายปัญญา" (ผ่านช่องภารกิจ 35), 46 = "สายทรัพย์" (ช่องเหรียญ 46,48)
- ทั้งสองเส้นมา **บรรจบที่ช่อง 36**
- เมื่อหมากเดินถึง 32 แล้วยังมีแต้มเหลือ → หยุด `phase: 'forking'` + `pendingFork` → เด้ง `ForkOverlay` ให้เลือก → `chooseBranch(dest)` เดินต่อ
- ถ้า **ลงพอดี**ช่อง 32 (แต้มเหลือ 0) → ได้การ์ดโบนัสก่อน แล้วทางแยกจะเด้งเทิร์นถัดไป (ก้าวแรก)

### การแสดงเลข/ไอคอนบนกระดาน (`BoardImage.tsx`)
- ช่องมีไอคอน (พิเศษ) → โชว์ **ไอคอน** (ไม่มีเลข)
- ช่องเดินเปล่า → โชว์ **เลข index**
- ช่องแยก (index ≥ 46) → ไม่โชว์เลข (เป็นทางลับ)
- **ไม่มี toggle `showNumbers` แล้ว** (ถอดออก) — เลขบนช่องเปล่าแสดงเสมอ
- โหมด `calibrate` (โหมดครู): โชว์เลขทุกช่อง + ลากปรับพิกัดได้ (`Calibrator`)
- หมากผู้เล่นบนกระดานใช้ `KingPawnToken` + `Player.kingTokenId` เพื่อแสดงภาพ standee กษัตริย์จาก `/assets/chess/{order}.png`
- `PawnToken` ยังเป็นลูกเต๋า 3D สำหรับ `DiceButton` เท่านั้น — **ห้ามเปลี่ยน `PawnToken` เป็นภาพกษัตริย์โดยตรง** เพราะจะทำให้ปุ่มทอยเสียความหมาย

## Turn Loop & Movement (`store.ts`)

`GamePhase = 'setup' | 'idle' | 'rolling' | 'moving' | 'forking' | 'resolving' | 'gameover'`

```
roll() → rolling(หมุน) → moving → runMovement()
  runMovement: เดินทีละก้าวตาม TILES[cur].next
    - เจอ next.length > 1  → set phase 'forking' + pendingFork → return (รอ chooseBranch)
    - stepTo(): ก้าว 1 ช่อง + เสียง + โบนัสผ่าน START (dest===0)
  ครบแต้ม → resolveLanding()
    - coin      → +เหรียญทันที → finishTurn
    - goldking  → หาพระองค์ถัดไปที่ยังไม่มีเหรียญ (KING_IDS.find) → pendingEvent kind 'goldking'
    - อื่น ๆ    → makeTileEvent → pendingEvent (UI เปิด CardModal)
    - blank/start → finishTurn เลย
chooseBranch(dest): stepTo(dest) แล้ว runMovement(remaining-1)
finishTurn(): เช็กชนะ (kingCoins≥7) → ถ้าทอย 6 เล่นต่อ ไม่งั้นส่งเทิร์น + เช็ก maxRounds
```

- `resolveLanding`/`runMovement`/`stepTo`/`finishTurn` เป็น module functions ท้ายไฟล์ (hoisted)
- `applyChance` ย้ายหมากแบบ `%LOOP` (teleport) — ใช้กับช่องโชควงนอกเท่านั้น (ไม่แตะช่องแยก)

## Card / เนื้อหา

- `CardModal.tsx` เปิดตาม `pendingEvent.kind`: question / **goldking** / knowledge / mission / chance / **bonus** (บล็อก `king` เดิมถูกลบแล้ว — ไม่มีช่องประเภทนี้)
  - **goldking = AR เท่านั้น** (`ARGoldChallenge.tsx` เต็มจอ): ส่องกล้อง → คลิปวิดีโอ 15 วิ (placeholder, เสียบจริงผ่าน `King.arVideo`) → **ลากคำตอบที่ถูกไปวางช่อง** (drag-to-slot, pointer events) → ถูก = `answerKingCoin(correct, kingId)`. คำถามใช้ `getQuizForKing` แต่แสดงเป็นชิปลาก
  - goldking: `tile.kingId` เป็น null แต่ store คำนวณ "พระองค์ถัดไป" ใส่มาใน event ตอน resolveLanding
  - question (เหลือง) = UI ควิซปกติ (`isQuizKind`) → `answerQuiz(...)` (ได้เหรียญปกติ ไม่ใช่เหรียญกษัตริย์)
- **ช่องภารกิจ (ฟ้า) = โจทย์ปรนัย ก/ข/ค/ง** (ไม่ใช่ mini-game เรียง/จับคู่แล้ว — `MissionGame.tsx` ถูกลบ). `MissionCard = { question, choices[] }`
- **ช่องความรู้ (ชมพู) = การ์ดสะสม (ไม่มี AR)** — `Player.knowledgeCards` เก็บได้สูงสุด 10 ใบ/คน, สุ่มไม่ซ้ำจากทั้งคลัง (ไม่ผูกกับพระองค์ของช่อง) ผ่าน `getRandomKnowledge(excludeIds)`. แต่ละใบมีเกร็ด + คำถามทวน ก/ข/ค/ง ของตัวเอง + ปุ่ม **"🎲 สุ่มใหม่"** (re-roll การ์ดที่ยังไม่มี). action `collectKnowledge(cardId, kingId, coins)` (ให้เหรียญเฉพาะใบใหม่ + มาร์ก lessonProgress)
- **AR ใช้เฉพาะช่องทองเท่านั้น** (`ARGoldChallenge`). ถอด AR ออกจากการ์ดความรู้ + พิพิธภัณฑ์ (`KingDetailModal`) แล้ว และ **ลบ `ARLauncher.tsx` (poster maker) ทิ้ง**. `settings.arEnabled` ตอนนี้ = สวิตช์ "เปิดกล้องช่องทอง" (ปิดได้ในโหมดครู → บทเรียนเล่นบนพื้นหลังเข้มแทน ยังชนะได้)
- `content.ts`: `getQuizForKing` / `getMissionForKing` / `getRandomKnowledge` / `getRandomChance` (+ `KNOWLEDGE_CAP=10`) — `cards.json` มีควิซ ~2 ข้อ/พระองค์, ภารกิจ 1 ข้อ/พระองค์, ความรู้ 14 ใบ
- 7 พระองค์ + ข้อมูล AR อยู่ใน `kings.json` (`KING_IDS` เรียงตามลำดับเวลา = ลำดับที่ต้องเก็บเหรียญ 1→7)

## ระบบเสริม

- **คอมโบ:** ตอบถูกติดกัน → ตัวคูณเหรียญ (`comboMult`, `streak`)
- **ไอเทม:** `fiftyFifty` / `skip` / `double` (`items`, `ITEM_META`) ได้จากการ์ดโชค/โบนัส
- **เควสประจำเกม + บอสทบทวน:** `dailyQuest`, `bossCleared` (`QuestPanel.tsx`) — อิง `lessonProgress`
- **AR:** เหลือเฉพาะ**ช่องทอง** (`ARGoldChallenge.tsx`) — กล้อง + คลิป 15 วิ (placeholder) + ลากคำตอบ. `settings.arEnabled` = เปิด/ปิดกล้อง (ปิดแล้วยังเล่นชนะได้บนพื้นหลังเข้ม). วิดีโอจริงเสียบผ่าน `King.arVideo` (ดู `AR-IDEAS.md`). **`ARLauncher.tsx` (poster maker) ถูกลบแล้ว**
- **หมากกษัตริย์:** ภาพ PNG อยู่ที่ `public/assets/chess/1.png` ถึง `7.png`; mapping ใช้ `king.order` จาก `kings.json` ผ่าน `src/core/kingAssets.ts`
- **Multiplayer UI:** component อ่านผู้เล่นปัจจุบันด้วย `players[currentPlayerIndex]` (KingCollection, QuestPanel, CollectionMuseumModal, KingDetailModal, landscape). landscape มี "แถบผู้เล่น" ไฮไลต์คนที่ถึงตา + HUD `👑 x/7`
- **เอฟเฟกต์:** `fx` signal (id เปลี่ยน) → UI เฝ้าดูเพื่อเล่นคอนเฟตติ/เหรียญเด้ง/จอสั่น (`Confetti`, `Mascot`)

## แผนผังไฟล์

```
src/
  core/
    store.ts        ← state + กติกาทั้งหมด (Zustand) · export TILES, LOOP, useGame
    types.ts        ← Tile, King, Player, Card types
    content.ts      ← อ่าน JSON เนื้อหา (คัด/สุ่มการ์ด)
    kingAssets.ts   ← mapping id พระมหากษัตริย์ → ภาพหมาก `/assets/chess/{order}.png`
    diceLogic.ts    ← rollDie, isBonusRoll
    sfx.ts          ← เสียง
  data/
    board-layout.json  ← ผังช่อง + next[] (กราฟ)
    board-points.json  ← พิกัด % ของแต่ละช่อง (index-aligned)
    kings.json         ← 7 พระองค์
    cards.json         ← ควิซ/ภารกิจ/ความรู้/โชค
  components/
    BoardImage.tsx  ← กระดาน (ภาพ + ไอคอน/เลข/หมากกษัตริย์/calibrate)
    CardModal.tsx   ← การ์ดทุกชนิด (question/knowledge/mission/chance/bonus + launcher ช่องทอง)
    ARGoldChallenge.tsx ← บทเรียน AR ช่องทอง (กล้อง + คลิป 15 วิ + ลากคำตอบ)
    KingPawnToken.tsx ← ภาพหมาก standee กษัตริย์สำหรับผู้เล่น
    PawnToken.tsx   ← ลูกเต๋า 3D สำหรับ DiceButton (โชว์แต้มที่ทอยได้บนหน้าเด่น)
    KingCollection.tsx, QuestPanel.tsx, ItemBar.tsx, DiceButton.tsx, ...
  screens/
    Home/           ← เลือกจำนวนผู้เล่น + เริ่ม
    GameBoard/      ← index (เลือก layout) + portrait + landscape (มี ForkOverlay)
    GameOver/       ← จัดอันดับด้วย kingCoins
    Settings/       ← Teacher Mode
  theme/tokens.ts   ← สี/ไอคอน/ป้ายของแต่ละ tile type
public/assets/board.png  ← ภาพกระดานจริง (ไม่มีเลขพิมพ์ — เลขคือ index ที่โค้ดใส่)
public/assets/chess/1.png..7.png  ← ภาพหมากกษัตริย์ 7 พระองค์ (ลำดับตาม `kings.json.order`)
```

## ข้อควรระวัง

- แก้ `Player` ต้องอัปเดตทุกที่ที่สร้าง player (มีที่เดียว: `setupGame` ใน store.ts); ตอนนี้มี `kingTokenId` เพิ่มสำหรับภาพหมาก
- ถ้าเปลี่ยนชื่อ/ลำดับไฟล์หมากใน `public/assets/chess/` ต้องเช็ก `kings.json.order` และ `kingAssets.ts` พร้อมกัน
- โฟลเดอร์ root `Chess/` เป็นแหล่งไฟล์ต้นฉบับที่ผู้ใช้วางไว้; runtime/deploy ใช้ไฟล์ใน `public/assets/chess/`
- ตำแหน่งช่องพิเศษ 10/23/37 ถูกกำหนดสี (question/chance) โดยยังปรับได้ง่ายใน `board-layout.json`
- พิกัดช่องแยก 46–48 ใน `board-points.json` เป็นค่าชั่วคราว → ปรับในโหมด calibrate ให้ตรงทางแยกวงในบนภาพ
- เนื้อหาประวัติศาสตร์/ปีศักราชทั้งหมดเป็นตัวอย่าง ต้องให้ครู/ผู้เชี่ยวชาญตรวจก่อนเผยแพร่ · โมเดล/ภาพพระบรมราชานุสาวรีย์ต้องทำอย่างสมพระเกียรติ
