# CLAUDE.md — บอร์ดเกม "7 มหาราช"

สื่อการสอนประวัติศาสตร์ไทยแบบบอร์ดเกมเดินช่อง (roll-and-move) + AR
ธีม: อุทยานราชภักดิ์ · กลุ่มเป้าหมาย: เด็ก 9–14 ปี · แพลตฟอร์ม: เว็บ (React+Vite PWA) บนแท็บเล็ต

> ⚠️ **`DESIGN.md` เป็นเอกสารเก่า (ไม่ตรงกับโค้ดแล้ว)** — อธิบายกติกาชนะแบบเดิม (เรียนครบ 3 ขั้น) ซึ่งถูกแทนที่ด้วยระบบ "เก็บเหรียญกษัตริย์" ไฟล์ CLAUDE.md นี้คือแหล่งอ้างอิงกติกาปัจจุบัน (อัปเดตล่าสุด 2026-07-05)

## คำสั่ง

```bash
npm run dev      # dev server (vite)
npm run dev:local # vite dev ที่ http://127.0.0.1:5174 พร้อม proxy /api
npm run api      # PHP dev server สำหรับ server/ ที่ http://127.0.0.1:8000
npm run build    # tsc && vite build  ← ใช้เช็ก type + bundle ก่อน commit เสมอ
npm run preview  # ดู build จริง
```

Stack: React 18 + TypeScript + Zustand (state) + Vite. ไม่มี test runner. Path alias `@/` = `src/`.

## สถาปัตยกรรมหลัก (กฎเหล็ก)

- **Logic ทั้งหมดอยู่ใน `src/core/`** — โดยเฉพาะ `store.ts` (Zustand). ไฟล์ layout/component **ห้ามฝัง game logic** ทำแค่ อ่าน state + เรียก action
- **แยก Layout ตามการหมุนจอ:** `screens/GameBoard/index.tsx` เลือก `GameBoard.portrait.tsx` หรือ `GameBoard.landscape.tsx` ตาม `useOrientation()`
  - **จอเล่นจริง = landscape.** portrait เป็นแค่หน้านัดให้ผู้ใช้หมุนแท็บเล็ตเป็นแนวนอน
- **เนื้อหาเกมมี seed จาก JSON + CMS sync** — `content.ts` seed จาก `cards.json`, hydrate จาก `localStorage['bg7_content']`, แล้ว sync จาก PHP API (`VITE_API_BASE`). ถ้า API ล่ม/ออฟไลน์ เกมยังเล่นจาก cache/seed ได้
- **Teacher CMS อยู่หลังบ้าน React + PHP/MySQL** — หน้า `src/screens/Admin/AdminPanel.tsx`, API ใน `server/`, config จริงคือ `server/config.php` (ไม่ commit)

## กติกาเกม (ปัจจุบัน)

- **ผู้เล่น 1–4 คน** (pass-and-play) เลือกจำนวน + เลือก "หมากกษัตริย์" ที่หน้า Home
- **ชนะเมื่อเก็บ "เหรียญกษัตริย์" ครบ 7 พระองค์** → `Player.kingCoins`
- เหรียญกษัตริย์ได้จาก **ช่องทอง (goldking) เท่านั้น** และต้อง **ตอบคำถาม AR ถูก**
- **เกมจบทางเดียว: มีผู้เล่นเก็บเหรียญกษัตริย์ครบ 7** (`finishTurn` ใน store.ts) — **ถอด `maxRounds`/ลิมิตรอบออกแล้ว** (round ยังนับไว้ภายในแต่ไม่ใช้จบเกม/ไม่โชว์)
- **ทอยได้ 6 = ส่งตาปกติ** (เอาโบนัสทอยซ้ำออกแล้ว — ทุกเลขจบเทิร์นแล้วส่งให้คนถัดไป)
- **ระบบหัวใจ:** ผู้เล่นเริ่ม `MAX_HEARTS = 3` (`Player.hearts`). ตอบคำถามฟ้าผิดหรือ AR ทองไม่สำเร็จ → เสีย 1 หัวใจ. ถ้าหัวใจเหลือ 0 → ตั้ง `skipNext` อย่างน้อย 1 เพื่อพักฟื้น 1 เทิร์น; เมื่อถูกข้ามจนพักครบ จะกลับมาพร้อม 1 หัวใจ

### ระบบเดียว = `kingCoins` (เก็บครบ 7 ชนะ)
- `kingCoins`: เหรียญจากช่องทอง — **เงื่อนไขชนะ** · ใช้กับ HUD, หน้าจบเกม, พิพิธภัณฑ์, `KingCollection` (ทุกหน้าจออิงเหรียญล้วน)
- **ระบบ `unlockedKings`/`lessonProgress`/ดาว/เรียนครบ 3 ขั้น ถูกลบทิ้งหมดแล้ว** (พร้อม mission/chance/เควส/บอส/AR stickers) — ดู "Card / เนื้อหา" ด้านล่าง

## กระดาน (Board Model)

กระดานเป็น **กราฟ** (ไม่ใช่วงกลม %loop ล้วน) — `board-layout.json`:
- **46 ช่องวงนอก (index 0–45) + 31 ช่องทางแยกวงใน 4 เส้น (index 46–76) = รวม 77 ช่อง**
- แต่ละช่องมี `next: number[]` — ปกติ 1 ทาง, จุดทางแยกมี 2 ทาง (ผู้เล่นเลือก)
- `Player.position` เป็น **number** (index) index-aligned กับ `board-points.json` (พิกัด %) และ `TILES[]` (77 ช่องเท่ากัน)
- `Player.kingTokenId` เป็น **id ของพระมหากษัตริย์** ที่ใช้เลือกภาพหมากบนกระดาน (ไม่เกี่ยวกับ `kingCoins`)
- `LOOP = 46` (loopSize) ใช้กับ `applyChance` (%LOOP) และ fallback ของ runMovement เท่านั้น

### ช่องพิเศษ (ตรงกับตำแหน่งบนกระดานจริง) — แต่ละชนิด "สีเดียว" (`tokens.ts`)
| ช่อง | type | สี/ไอคอน | ผล |
|---|---|---|---|
| 0, 10, 23, 37 | penalty | ⛓️ แดงเข้ม `#8E2020` | ทำโทษ: 0=หยุดพัก 1 ตา · 10=ถอย 2 ช่อง · 23=หยุดพัก 1 ตา · 37=ถอย 3 ช่อง (ดู `tile.penalty`) |
| 5, 14, 20, 27, 35, 43 | question | ❓ ฟ้า `#1565C0` | ควิซทั่วไป ก/ข/ค/ง (ได้เหรียญปกติ) |
| 3, 9, 17, 24, 29, 39 | knowledge | 💡 ชมพู `#E91E63` | อ่านเกร็ด → สะสมการ์ด (10/คน) **ไม่มีคำถามทบทวนแล้ว** + ปุ่มสุ่มใหม่ · ไม่มี AR |
| 2, 15, 21, 28, 34, 42 | subject | 📚 teal `#00897B` | ช่อง **กลุ่มสาระการเรียนรู้** — สุ่มคำถาม 6 วิชา (สังคม/คณิต/วิทย์/ศิลปะ/สุขศึกษาฯ/ภาษาต่างประเทศ) ของพระองค์ที่ผูกช่อง ใช้ UI ควิซเดียวกับช่องฟ้า (ได้เหรียญปกติ/ตอบผิดเสียหัวใจ) · **6 ช่อง** ผูก ราม/นเรศวร/ตากสิน/นารายณ์/ร.4/ร.5 (ร.1 มีในคลังแต่ไม่มีช่องผูก) |
| 8,16,26,33,40,45 (นอก) + 50,57,65,73 (ใน) | goldking | 👑 ทองเรืองแสง `#C9A227` | บทเรียน AR (คลิป 15 วิ + ลากคำตอบ) ชิงเหรียญกษัตริย์ — **10 ช่อง** ให้เก็บครบ 7 ได้ |
| 32 | bonus | 💚 เขียว `#2E9E44` | การ์ดโบนัส (เหรียญ+ไอเทม) **+ เป็นจุดทางแยก** |

- **4, 22, 38 = `shop` 🛒 น้ำตาล `#6D4C41`** — เปิด `ShopModal` ซื้อไอเทม **เฉพาะเมื่อหยุดช่องนี้** (ต้องลงพอดี) → จำกัดการเข้าถึงร้าน (ไม่ให้ซื้อได้ตลอด) · ปิดร้าน = จบเทิร์น
- ช่องที่เหลือ = `blank` (ช่องเดินเปล่า โชว์เลข index)
- **ช่อง 6, 12, 36 = `blank` แต่เป็นจุดทางแยก** (อย่าใส่ช่องพิเศษทับจุดแยก — คำถาม/ไอคอนจะโดน ForkOverlay บัง)
- **`TileType` = `question` / `knowledge` / `subject` / `goldking` / `bonus` / `penalty` / `shop` / `blank`** — type `start`/`mission`/`chance`/`coin`/`king`/`special` ถูกลบออกจาก type แล้ว (ช่อง 0 = penalty ไม่มี +100 ผ่าน START)
- **ช่อง subject:** ผูก `kingId` ต่อช่อง (เหมือนช่องฟ้า) แล้ว `getSubjectQuizForKing` สุ่มคละวิชาในคลังของพระองค์นั้น · `SubjectArea` 6 ค่า + meta (`SUBJECTS`/`subjectLabel`) อยู่ใน `content.ts` · การ์ด = `SubjectQuizCard` (QuizCard + `subject`)

### ทางแยก 4 จุด (fork) — เอนจิน generic ตาม `next.length > 1`
| จุดแยก | next | เส้นใน (label) | บรรจบ |
|---|---|---|---|
| 6 | [7, 61] | เส้น C = 61–69 (`7ก`–`7ฌ`) | 11 |
| 12 | [13, 70] | เส้น D = 70–76 (`13ก`–`13ช`) | 14 |
| 32 | [33, 46] | เส้น A = 46–54 (`33ก`–`33ฌ`) | 36 |
| 36 | [37, 55] | เส้น B = 55–60 (`37ก`–`37ฉ`) | 40 |

- **เลนใน = "สายรางวัล"** เดินยาวกว่าสายนอก 2–4 เท่า แต่มีโอกาส: แต่ละเส้นมี **โบนัส 1 + คำถาม + สาระ + ความรู้ + ช่องทอง 1 ช่อง** (ไม่มีช่องทำโทษ) → เดินอ้อมแล้วได้เหรียญ/ไอเทม/การ์ดสะสมเป็นผลตอบแทน · **ช่องทอง/win-condition ยังเท่าเดิม** (10 ช่อง เลนละ 1: 50/57/65/73) เพราะรางวัลที่เพิ่มเป็นเหรียญปกติ ไม่ใช่เหรียญกษัตริย์
- ช่อง question/subject ในเลนผูก `kingId` ตามโซนของแยก (A=นารายณ์ · B=ร.5 · C=รามคำแหง · D=นเรศวร) · ช่องที่ยัง `blank` โชว์ `label` เลขย่อย (`33ก`), ช่องพิเศษโชว์ไอคอนสีแทน label (BoardImage generic)
- เดินผ่านจุดแยก (แต้มเหลือ) → `phase: 'forking'` + `pendingFork` → เด้ง `ForkOverlay` (`FORK_INFO` มีป้าย "เส้นหลัก 🛣️" / "ทางลับ 🗺️") → `chooseBranch(dest)` เดินต่อ
- **ลงพอดี**จุดแยก → resolve ช่องนั้นก่อน (32=โบนัส · 6/12/36=blank ไม่มีการ์ด) แล้วทางแยกเด้งเทิร์นถัดไป (ก้าวแรก)
- `metadata` ใน JSON: `forkTiles`/`rejoinTiles` (เป็นคอมเมนต์ล้วน โค้ดไม่อ่าน อ่านแค่ `loopSize`)

### การแสดงเลข/ไอคอน/หมาก (`BoardImage.tsx`)
- ช่องพิเศษ → **ป้ายสีเต็มวงตามชนิด** (ขอบขาว) + ไอคอน · **ช่องทอง 👑 เด่นสุด** (ทองไล่เฉด + เรืองแสง glow + ใหญ่กว่า)
- ช่องเดินเปล่าวงนอก → โชว์ **เลข index** · ช่องเลนแยก blank → โชว์ **label ทอง** (`33ก`)
- **zIndex:** เลข/label < ไอคอนช่อง (gold=2) < เงาหมาก(9) < **หมากผู้เล่น(10)** — หมากอยู่บนสุดเสมอ ไม่โดนไอคอนบัง
- โหมด `calibrate` (โหมดครู): ลากปรับพิกัดได้ (`Calibrator`) + ปุ่มคัดลอก JSON
- หมากผู้เล่น = `KingPawnToken` + `Player.kingTokenId` → standee `/assets/chess/{order}.png`
- `PawnToken` = ลูกเต๋า 3D สำหรับ `DiceButton` เท่านั้น — **ห้ามเปลี่ยนเป็นภาพกษัตริย์**

## Turn Loop & Movement (`store.ts`)

`GamePhase = 'setup' | 'idle' | 'rolling' | 'moving' | 'forking' | 'resolving' | 'gameover'`

```
roll() → rolling(หมุน) → moving → runMovement()
  runMovement: เดินทีละก้าวตาม TILES[cur].next
    - เจอ next.length > 1  → set phase 'forking' + pendingFork → return (รอ chooseBranch)
    - stepTo(): ก้าว 1 ช่อง + เสียง (tile 0 ไม่มี passReward แล้ว)
  ครบแต้ม → resolveLanding()
    - goldking  → หาพระองค์ถัดไปที่ยังไม่มีเหรียญ (KING_IDS.find) → pendingEvent kind 'goldking'
    - penalty/question/knowledge/bonus → makeTileEvent → pendingEvent (UI เปิด CardModal)
    - blank → finishTurn เลย
chooseBranch(dest): stepTo(dest) แล้ว runMovement(remaining-1)   ← นับก้าวผ่าน fork ถูกต้อง (verified)
finishTurn(): เช็กชนะ (kingCoins≥7) → ส่งเทิร์นให้ผู้เล่นถัดไปเสมอ (ไม่มีโบนัสทอย 6 แล้ว)
              โดย **ข้ามคนที่ skipNext>0** (ลด skipNext ลง 1) — ไม่มีเช็ก maxRounds แล้ว
```

- `resolveLanding`/`runMovement`/`stepTo`/`finishTurn` เป็น module functions ท้ายไฟล์ (hoisted)
- `applyChance` ย้ายหมากแบบ `%LOOP` — ปลอดภัยเพราะไม่มีช่องโชคแล้ว (เลิกถูกเรียก); ถ้าจะเพิ่มช่องโชคคืน **ห้ามวางในเลนแยก** (index≥46 จะคำนวณผิด)
- `applyPenalty(back, skip)`: ถอยหลัง N ช่องบนวงนอก (`(pos-back+LOOP)%LOOP`) และ/หรือสะสม `skipNext`

## Card / เนื้อหา (`CardModal.tsx`)

เปิดตาม `pendingEvent.kind`: **question / goldking / knowledge / bonus / penalty** (บล็อก king/mission/chance ลบออกจากโค้ดแล้ว)
- **🎴 ด่านจั่วการ์ด (`CardPicker.tsx`):** การ์ด 4 ชนิด (question/subject/knowledge/goldking) ต้อง "จั่วเลือกใบ" ก่อนเปิดเนื้อหา — แจกการ์ดคว่ำ 5 ใบเป็นรูปพัด (`getCardBack(kind)` = `/assets/cards/{kind}-back.png`, `pickDealIn` หน่วงทีละ 70ms) · **เป็น UI gate ล้วนใน CardModal (state `picked`) ไม่แตะ store** — เนื้อหายัง random เดิม (getXForKing) แค่ให้ฟีลว่าความสุ่มมาจากมือผู้เล่น · penalty/bonus ไม่ต้องจั่ว (เปิดตรง) · **รีเซ็ต `picked` แบบ sync ตอน render** (prevEventRef) เพราะ CardModal ไม่ unmount ระหว่างการ์ด · ตัวจับเวลาควิซถูก gate ให้เริ่มนับหลังจั่วเสร็จ
  - **พิธีเลือก 3 สเตจ (`stage`):** `idle` → แตะ → **`lift` (0–540ms)** ใบที่เลือกสไลด์ขึ้นออกจากพัด `translate(dx,-104px) scale(1.3)` + แสงกวาด (`pickShine`) + ขอบเรือง (`pickRingPulse`) ใบอื่นร่วงหาย → **`away` (540–920ms)** พลิกหนี `rotateY(-92deg)` → `CardFrame skipBackFlip` พลิกเข้ารับไม้ต่อ · `dx` ต้อง**วัดจริงตอนแตะ** (`getBoundingClientRect`) เพราะความกว้างการ์ดเป็น `clamp()`
  - **กับดัก: `pickDealIn` ต้องใช้ `fill-mode: backwards` ห้ามใช้ `both`** — `both` ทำให้อนิเมชันค้างคุม `transform` ต่อหลังเล่นจบ พอกดเลือกแล้วถอดอนิเมชัน + ตั้ง transform ใหม่ในเฟรมเดียวกัน Chrome จะ**ไม่เริ่ม transition** → การ์ดกระโดดขึ้นทันทีแทนที่จะสไลด์ (เคยเป็นบั๊กนี้จริง วัดได้ว่าถึงที่หมายใน 13ms แทน 520ms)
  - **กฎเหล็ก: picker โชว์แต่ "หลังการ์ด" ห้ามพลิกเผย `getCardFront`** — รูป `*-front.png` เป็น **เทมเพลตเปล่า** (ช่องคำถาม/ช่องคำตอบว่าง) ที่ออกแบบไว้ให้วางเนื้อหาทับ พลิกมาดูตอนยังไม่มีข้อความจึงเห็นแค่ฟอร์มเปล่า · เดิม picker พลิกเผย front แล้ว `CardFrame` ยังโชว์หลังการ์ด**ซ้ำอีกรอบ**แล้วพลิกเอง → ลำดับย้อนแย้ง หลัง→หน้าเปล่า→หลัง→เนื้อหา (~2.4 วิ) · ตอนนี้แบ่งหน้าที่: picker พลิกหนี + `CardFrame skipBackFlip` พลิกเข้า = **พลิกครั้งเดียว ~0.7 วิ**
  - **`{question,subject,ar}-front.png` ไม่ถูกใช้แล้ว** (เหลือแค่ `knowledge-front.png` ที่ `CardFrame` โหมด `art` ใช้เป็นพื้นจริง) → `preloadAllCardArt` โหลดตาม `FRONT_IN_USE` เท่านั้น **ประหยัด ~5.3 MB/เกม** · ถ้าวันหลังเปลี่ยนช่องฟ้า/สาระไปใช้โหมด `art` (เอาอาร์ตที่มีช่องคำตอบ 1–4 มาใช้จริง) ต้องเติม kind กลับใน `FRONT_IN_USE`
  - `preloadCardBack` gate เฉพาะหลังการ์ด (เดิม `preloadCardArt` await front ด้วยทั้งที่ไม่ได้ใช้ → สปินเนอร์ "เตรียมสำรับ" รอนานเท่าตัว)
- **goldking = AR เท่านั้น** (`ARGoldChallenge.tsx` เต็มจอ): กล้อง → คลิป 15 วิ (ใช้ `quiz.videoUrl` จาก CMS ถ้ามี, fallback `King.arVideo`/placeholder) → **ลากคำตอบไปวางช่อง** (drag-to-slot) → ถูก = `answerKingCoin(correct, kingId)` (+เหรียญ 120) → สเตจ done โชว์ **ภาพเหรียญพระองค์นั้นหมุนเด้ง**
  - **คำใบ้ด้วยเหรียญ:** ปุ่ม "💡 ใช้คำใบ้ · จ่าย 🪙 60" (`buyHint`/`HINT_PRICE`) ตัดคำตอบผิด 2 ข้อ (ครั้งเดียว/คำถาม)
  - ผิด/ออกก่อนตอบใน AR → `answerKingCoin(false, kingId)` → เสียหัวใจผ่าน `damageCurrentPlayer`
  - `tile.kingId` เป็น null แต่ store คำนวณ "พระองค์ถัดไป" ใส่ event ตอน resolveLanding
- **question (ฟ้า)** = UI ควิซปกติ (`isQuizKind`) → `answerQuiz(...)` ได้เหรียญปกติ (ไม่ใช่เหรียญกษัตริย์) · รองรับ 50:50/ข้ามคำถาม/×2 · ตอบผิดเสียหัวใจ
  - **ฟีดแบ็กตอบถูก/ผิด:** เสียง (`sfx.correct/wrong`) + **`ResultStamp.tsx` เด้งกลางจอ** (แสงวาบ + ตรา ✓/✕ + ป้าย "ถูกต้อง!/ยังไม่ถูก" + รัศมี/ดาวกระจายตอนถูก · `position:fixed` z=130, `pointerEvents:none`, `STAMP_MS`=1400) + แบนเนอร์เขียว/แดง + คอนเฟตติ + `quizPop`/`quizShake` ที่ปุ่มคำตอบ
  - **ตราต้องเด้งทั้ง 2 โหมด:** โหมดตอบบน tablet เด้งจาก effect `[answered]` · **โหมด QR ไม่เคยเซ็ต `answered`** (มือถือเป็นคนตอบ) จึงต้องเรียก `showResult(ok)` เองใน `onResult` ของ `QrChallengePanel` **แล้วหน่วง `closeEvent` ด้วย `STAMP_MS`** (`qrCloseRef`) ไม่งั้น event=null → CardModal return null → ตราหายในเสี้ยววินาที · timer ต้องเคลียร์ใน effect `[event]` ไม่งั้นไปปิดการ์ดใบถัดไป
  - **กับดัก: `stamp` ต้องเก็บ `{id, kind}` + ใช้ `id` เป็น `key` ห้ามเก็บแค่ชนิด** — ตอบถูกสองใบติดกันจะ `setStamp('correct')` ทับค่าเดิม → React bail out ไม่ re-render → element ไม่ remount → **อนิเมชันไม่เล่นซ้ำ ตราไม่ขึ้นเลย** (เจอจริงตอนรีวิว วัดได้ opacity ค้าง 0) · และต้อง `setStamp(null)` ใน effect ของ `[event]` ด้วย เพราะถ้าผู้เล่นกด "เดินเกมต่อ" ภายใน 1.1 วิ `answered`→null จะทำให้ cleanup ยกเลิก timer ที่จะเคลียร์ตรา → ตราค้างข้ามการ์ด
  - **กฎเหล็ก: ตราประทับต้องอยู่นอกกล่องการ์ด** (fixed ทับทั้งจอ) เพราะเนื้อหาการ์ดอยู่ในกล่อง `maxHeight:88vh` + `overflow:auto` — ถ้าเอาไปไว้ในนั้นจะหายไปใต้ fold เหมือนที่ปุ่มเคยเป็น
  - **แบนเนอร์ผล + ปุ่มเดินเกมต่อถูกวางต่อท้ายปุ่มคำตอบ → เคยตกใต้ขอบกล่อง 164px** บนแท็บเล็ต 1024×640 (วัดจริง) และ `scrollTop` ค้างที่ 0 = เด็กตอบแล้วเกมเหมือนค้าง เพราะ **`answerQuiz` ถูกเรียกจากปุ่มนั้นปุ่มเดียว** → แก้ด้วย `resultRef.scrollIntoView({block:'end'})` + `scrollMarginBottom` · **ถ้าเพิ่มเนื้อหาในการ์ดควิซอีก ต้องวัด fold ซ้ำ**
- **knowledge (ชมพู)** = การ์ดสะสม (ไม่มี AR, ไม่มีคำถามทบทวน) — อ่านเกร็ด → กด "เก็บ" ได้ 🪙 30 (เฉพาะใบใหม่) + ปุ่ม "🎲 สุ่มใหม่". `Player.knowledgeCards` ≤10 ใบ/คน สุ่มไม่ซ้ำ (`getRandomKnowledge`). `collectKnowledge(cardId, coins)`
- **penalty (แดง)** = การ์ด "ช่องทำโทษ" → กดรับ → `applyPenalty(...)` (ถอย/หยุดพัก)
- **bonus (เขียว)** = เหรียญ 80 + ไอเทมสุ่ม (`fiftyFifty`/`skip`/`double`/`heartPotion`) แล้วก้าวต่อได้เลือกทางแยก
- `content.ts`: `getQuizForKing` / `getGoldQuizForKing` / `getSubjectQuizForKing` / `getRandomKnowledge` (+ `KNOWLEDGE_CAP=10`) — `cards.json` เป็น seed ของ `quiz` + `knowledge` + `subject` (42 ใบ = 7×6); `gold` seed = copy quiz แต่ CMS/API แยกเป็น `gold_quiz`
- 7 พระองค์อยู่ใน `kings.json` (`KING_IDS` เรียงตามลำดับเวลา = ลำดับที่ต้องเก็บเหรียญ 1→7)

## Teacher CMS + PHP API

- หลังบ้านเข้าได้จาก Settings → "จัดการเนื้อหาการ์ด (หลังบ้าน)" (`AdminPanel.tsx`)
- Login ใช้ shared password: `POST server/auth.php` → HMAC token เก็บใน `localStorage['bg7_admin_token']`
- CRUD เนื้อหา: `server/content.php?type=quiz|knowledge|gold|subject`
  - public `GET` ใช้ sync เกม
  - `POST`/`PUT`/`DELETE` ต้องใช้ `Authorization: Bearer <token>`
- DB schema: `quiz`, `knowledge`, `gold_quiz`, `subject_quiz`, `app_config`; `gold_quiz` มี `video_url` สำหรับวิดีโอ AR ทอง · `subject_quiz` มีคอลัมน์ `subject` (ENUM 6 วิชา) — `content.php` auto-migrate ตารางนี้ให้ DB เดิม (`ensure_subject_table`)
- Upload วิดีโอ AR ทอง: `POST server/upload.php` multipart field `video`, รองรับ MP4/WebM/MOV ≤ 200 MB, save ไป `server/uploads/`, คืน URL แบบ `uploads/<file>`
- deploy จริงต้องให้ PHP เขียน `server/uploads/` ได้ และตั้ง `VITE_API_BASE`/CORS ให้ตรงโดเมน

## ระบบเสริม

- **คอมโบ:** ตอบถูกติดกัน → ตัวคูณเหรียญ (`comboMult`, `streak`)
- **ระบบหัวใจ:** `MAX_HEARTS=3`, `Player.hearts`; helper `damageCurrentPlayer` ลดหัวใจและตั้งพักฟื้นเมื่อเหลือ 0. HUD แสดงหัวใจผู้เล่นปัจจุบัน + แถบผู้เล่นหลายคนแสดงหัวใจแต่ละคน
- **ไอเทม:** `fiftyFifty` / `skip` / `double` / `heartPotion` (`items`, `ITEM_META`) — ได้จากช่องโบนัส **หรือซื้อในร้านค้า**
- **💰 ร้านค้าไอเทม (coin sink):** `ShopModal.tsx` เปิด **เฉพาะเมื่อหยุดที่ช่องร้านค้า `shop` (4/22/38)** — `pendingEvent.kind==='shop'` ใน `GameBoard.landscape.tsx` render โมดัล, ปิดร้าน = `closeEvent` (จบเทิร์น) · **ถอดปุ่ม 🛒 ที่โผล่ตลอดออกแล้ว** เพื่อจำกัดไม่ให้ซื้อได้ทุกเวลา · `buyItem(type)` หักเหรียญ (`ITEM_PRICE`: 50:50=80, skip=120, ×2=150, heartPotion=100). `heartPotion` ฟื้นหัวใจผู้เล่นปัจจุบัน 1 ดวงผ่าน `useItem('heartPotion')`; + คำใบ้ AR (`buyHint`, `HINT_PRICE=60`) เป็น coin sink ที่ผูกกับเงื่อนไขชนะ
- **~~เควส + บอสทบทวน~~ ถูกลบแล้ว** (`QuestPanel.tsx` + `dailyQuest`/`bossCleared`/`completeBossReview`/`QUESTS`/`DailyQuest`/`QuestKind` เอาออกหมด)
- **💾 บันทึกเกม + resume อัตโนมัติ:** `store.ts` ห่อด้วย `zustand/persist` → เซฟทั้ง slice ลง `localStorage['bg7_save']` ทุกครั้งที่ state เปลี่ยน (partialize: players/currentPlayerIndex/round/settings/streak/items/doubleNext/usedQuizIds + `savedAt`) · **`SAVE_TTL_MS = 15 นาที`** — เปิดแอปแล้ว `merge` เช็ก ถ้าเซฟยังไม่หมดอายุ + มีผู้เล่น → **resume เข้าเกมทันที** (ไม่ต้องมีปุ่ม), เกินเวลา → ทิ้งเซฟ เริ่มที่ Home
  - **กฎเหล็ก:** phase ชั่วคราว (`rolling`/`moving`/`forking`/`resolving`) resume ไม่ได้ (async closure หาย) → `savablePhase` เก็บเป็น `idle` เสมอ + `merge` เคลียร์ `pendingEvent`/`pendingFork`/`fx`/`lastRoll` → กลับมาที่ "รอผู้เล่นปัจจุบันทอย" (ยอมเสียการ์ด/เทิร์นที่ค้างครึ่ง)
  - **ออกจากเกมมี confirm:** ปุ่ม 🏠 + ปุ่ม back เบราว์เซอร์ → `requestExit()` → `exitPrompt` → `ExitConfirm.tsx`. back เบราว์เซอร์ดักด้วย `history.pushState`/`popstate` ใน `App.tsx` (SPA นี้ไม่มี router). ยืนยัน → `confirmExit`→`backToHome` (phase setup → ไม่ resume)
  - **หมายเหตุ:** `settings` ถูก persist ด้วย → `App.tsx` ต้อง `setSoundEnabled(soundEnabled)` sync เข้าโมดูล `sfx` (flag `enabled` ภายในไม่รู้เรื่อง persist)
- **📱 โหมด QR ตอบบนมือถือ (privacy):** `settings.qrAnswerMode` (Teacher Mode) — ช่อง**ฟ้า/สาระ** พอจั่วใบเสร็จ tablet โชว์ **QR แทน UI ควิซ** (คำถามไม่โผล่บนจอกลาง = ผู้เล่นอื่นไม่เห็น) ผู้เล่นสแกนด้วยมือถือตัวเอง → เปิด `answer.html` (แยก entry โหลดเบา ~48KB ไม่ลาก MindAR) ตอบเห็นผลทันที
  - **ผลกลับ tablet 2 โหมด:** (1) **อัตโนมัติ** ถ้าตั้ง `VITE_API_BASE` — มือถือ POST ผลขึ้น `server/challenge.php` → tablet **poll ทุก ~1.3 วิ** (`core/challengeApi.ts`) → เดินเกมต่อเอง · (2) **fallback กดเอง** ถ้าไม่มี backend/เน็ตหลุด → ปุ่ม ตอบถูก/ตอบผิด บน tablet · `resolvedRef` กัน resolve ซ้ำ (poll+กดเองชนกัน)
  - คำถามฝังใน **URL#hash** (base64url UTF-8 รองรับไทย, `core/qrChallenge.ts` ใช้ร่วม 2 ฝั่ง — มี `i`=challenge id จับคู่ผล) · payload มี index เฉลย (โหมดเชื่อใจยอมรับได้) · gold AR/knowledge ยังไม่เข้าโหมดนี้
  - ไฟล์: `answer.html` (root) + `src/answer/` (entry มือถือ) · `QrChallengePanel.tsx` (tablet: วาด QR ด้วย `qrcode` + poll/ปุ่ม) · `core/challengeApi.ts` · `server/challenge.php` (+ ตาราง `qr_challenge` auto-migrate/schema.sql) · `vite.config.ts` multi-page (main+answer)
  - **📷 สแกนใบต่อไปบนมือถือ (`src/answer/QrRescanner.tsx`):** ตอบเสร็จ → **`AnswerPage` return คนละจอไปเลย: ตัดคำถาม/ตัวเลือก/ตัวจับเวลาทิ้ง เหลือ "ผล + กล้อง"** → เปิดกล้อง (jsqr) ค้างรอเล็ง QR ใบถัดไปบนจอกลางได้เลย ไม่ต้องออกไปเปิดแอปกล้องใหม่ทุกตา · เจอแล้ว `goToChallenge` พาไปการ์ดใหม่
    - **ตอบผิดต้องบอกเฉลยในแบนเนอร์** (`คำตอบที่ถูกคือ: …`) — เดิมดูจากตัวเลือกที่ไฮไลต์เขียว แต่ตอนนี้ซ่อนตัวเลือกไปแล้ว ถ้าไม่บอกตรงนี้เด็กตอบผิดจะไม่รู้คำตอบที่ถูก = เสียคุณค่าการเรียนรู้
    - ตัดคำถามทิ้งทำให้ทุกอย่างพอดี **1 จอ ไม่ต้องสกรอลล์** (วัดจริง 390×844: กล้อง 350–560 · `scrollHeight` ไม่เกินจอ)
    - **ต้อง `lazy()` เสมอ** — jsqr หนัก ~130KB ถ้า import ตรงจะไปถ่วง `answer.html` (148KB → 278KB) ที่มือถือเด็กโหลดใหม่**ทุกคำถาม**ผ่านไวไฟโรงเรียน · กล้องใช้หลังตอบเท่านั้น
    - **รับเฉพาะ QR ที่เป็น same-origin + path เดียวกัน + มี payload** (`sameAppUrl`) — QR เป็นข้อมูลจากภายนอก ถ้าพาไปตามทุกอันที่สแกนเจอ = พาเด็กออกไปเว็บมั่วได้
    - เปลี่ยนแค่ hash เบราว์เซอร์ **ไม่ reload เอง** → `goToChallenge` ต้องสั่ง `reload()` ไม่งั้น `AnswerPage` อ่าน challenge เดิม (payload อยู่ใน `useMemo([])`)
    - `scrollIntoView` เมื่อกล้องติดเป็น**ตาข่ายกันเหนียว**เผื่อคำอธิบายยาวผิดปกติ/จอเตี้ย (ปกติไม่ต้องเลื่อนเพราะพอดีจอแล้ว) · reticle อิง **ความสูง** ไม่ใช่ความกว้าง ไม่งั้นสูงเกินกล่องที่โดน `maxHeight` บีบ แล้วขอบบน/ล่างโดน `overflow:hidden` ตัดจนเหลือแค่เส้นตั้ง 2 ข้าง
  - **CORS:** มือถือโหลด `answer.html` จาก origin ของแอป แล้ว POST ไป `VITE_API_BASE` — ต้องมี origin ของแอปใน `config.php['allowed_origins']`
- **📴 PWA + ล็อกจอกันซูม (`core/viewportLock.ts`):** แท็บเล็ตซูมแล้ว layout เพี้ยน เพราะ `useViewportSize`/`useOrientation` คำนวณจาก `window.innerWidth/innerHeight` · `user-scalable=no` ใน meta viewport **ใช้ไม่ได้อีกแล้ว** (iOS Safari 10+/Chrome 61+ เมินเพื่อ accessibility) จึงต้องกัน 3 ชั้น:
  1. **event** — `lockViewport()` (เรียกใน `main.tsx`) ดัก `gesture*` (pinch บน iOS), `touchmove` ที่มี >1 นิ้ว, double-tap, `ctrl+wheel`/`ctrl±` (เดสก์ท็อป)
  2. **CSS** (`styles.css`) — กฎล็อกผูกกับคลาส **`.vp-locked`** (ไม่ใช่ `html,body` ตรง ๆ): `position:fixed` + `overflow:hidden` + `touch-action: pan-x pan-y` (**ห้ามใช้ `none`** จะทำให้ลิสต์ที่เลื่อนได้ตาย) · `input` บังคับ `font-size: max(16px,1em)` กัน iOS ซูมค้างตอนโฟกัสช่องกรอกชื่อ
     - **`lockViewport()` เป็นคนใส่คลาสนี้ → CSS กับ JS เปิด/ปิดพร้อมกันเสมอ** · จำเป็นเพราะ `styles.css` ถูก import โดย `ar-mobile/main.tsx` (ar.html บนมือถือ) ด้วย ซึ่งไม่ได้เรียก `lockViewport()` และยังใช้ `minHeight:100dvh` สกรอลล์ระดับหน้าอยู่ — ถ้าล็อก `html,body` ตรง ๆ เนื้อหาบนมือถือจะโดนตัดหาย
  3. **PWA** — `public/manifest.webmanifest` (`display: fullscreen` + `orientation: landscape`) + `public/sw.js` + meta ของ Apple ใน `index.html` → ติดตั้งลง home screen แล้วไม่มีแถบ URL ให้ซูมตั้งแต่แรก
  - **กฎเหล็ก:** body ถูกล็อกแล้ว **สกรอลล์ระดับหน้าไม่ได้อีก** — หน้าที่เนื้อหายาว (เช่น `Home`) ต้องใช้ `height` (ไม่ใช่ `minHeight`) + `overflowY:auto` เพื่อสกรอลล์ในกล่องตัวเอง ไม่งั้นเนื้อหาส่วนเกิน**โดนตัดหาย**
  - `enterFullscreen()` ต้องเรียกจาก **user gesture** เท่านั้น → เรียกในปุ่ม "เริ่มเล่น" (`Home.tsx`) + toggle ใน Settings (ซ่อนถ้า `isStandalone()`/iOS ที่ไม่รองรับ) · iOS ไม่รองรับ `requestFullscreen` ต้องใช้ "เพิ่มไปยังหน้าจอโฮม"
  - `sw.js` = navigate → network-first · asset same-origin → stale-while-revalidate (ภาพกระดาน/การ์ดไม่มี hash ในชื่อ) · **ไม่แตะ `/api` และ origin ข้ามโดเมน** · ลงทะเบียนเฉพาะ PROD · เปลี่ยน `VERSION` เมื่อต้องล้างแคชเก่า
  - ไอคอน `public/icons/` สร้างจากภาพเหรียญบนพื้นแดงชาด `#8B0000` (192/512/maskable-512/apple-touch)
- **AR:** เฉพาะ**ช่องทอง** (`ARGoldChallenge.tsx`). `settings.arEnabled` = เปิด/ปิดกล้อง (ปิดแล้วเล่นบนพื้นหลังเข้ม ยังชนะได้). วิดีโอจริงมาจาก `QuizCard.videoUrl`/CMS ถ้ามี. **`ARLauncher.tsx` (poster maker) ถูกลบแล้ว**
- **หมากกษัตริย์:** PNG `public/assets/chess/1.png..7.png` (ลำดับตาม `king.order`) ผ่าน `getKingPawnImage`
- **เหรียญกษัตริย์ (ภาพ):** PNG `public/assets/coins/{king.id}.png` ผ่าน `getKingCoinImage` (source ไทยอยู่ root `Coin/`) — โชว์ผ่าน `KingCoinRow.tsx` (ช่องเก็บเหรียญ ได้แล้ว=ทองเรือง/ยังไม่ได้=จางเส้นประ) ที่ **HUD (มุมขวาบน) · GameOver · พิพิธภัณฑ์ · การ์ด AR · KingDetailModal**
- **HUD (landscape):** แถวเหรียญ 7 พระองค์ (`KingCoinRow`, ขนาด responsive) + "👑 x/7" มุมขวาบน · **ถอดตัวนับเทิร์นออกแล้ว** (เหลือ ⚙️/🏠)
- **พิพิธภัณฑ์ (`CollectionMuseumModal`):** อิง **เหรียญล้วน** (ไม่มีดาว/เรียนรู้แล้ว) — ชั้นโชว์เหรียญ 7 พระองค์ + การ์ดที่เหรียญเป็นพระเอก (ได้แล้ว=เปิดดูข้อมูล/ยังไม่ได้=จาง). `KingDetailModal` timeline ก็อิง kingCoins
- **เอฟเฟกต์:** `fx` signal (`{id, kind, coins, kingId?}`) → UI เฝ้าดู: คอนเฟตติ/เหรียญเด้ง/จอสั่น · **`fx.kingId`** = เด้งเหรียญพระองค์นั้นฉลองกลางจอตอนชนะเหรียญกษัตริย์ (`Confetti`, `Mascot`)

## แผนผังไฟล์

```
src/
  core/
    store.ts        ← state + กติกาทั้งหมด (Zustand) · export TILES, LOOP, useGame, ITEM_META, ITEM_PRICE, HINT_PRICE
    types.ts        ← Tile, King, Player, Card, PenaltyConfig types
    content.ts      ← อ่าน JSON เนื้อหา (คัด/สุ่มการ์ด)
    api.ts          ← client สำหรับ PHP API + upload video + resolve asset URL
    kingAssets.ts   ← id พระองค์ → หมาก `/assets/chess/{order}.png` + เหรียญ `/assets/coins/{id}.png`
    diceLogic.ts    ← rollDie
    sfx.ts          ← เสียง (Web Audio) + เพลงพื้นหลัง (startBackgroundMusic ใน App.tsx)
  data/
    board-layout.json  ← ผังช่อง 0–76 + next[] (กราฟ) + penalty/label
    board-points.json  ← พิกัด % ของ 77 ช่อง (index-aligned)
    kings.json         ← 7 พระองค์
    cards.json         ← ควิซ (quiz) + ความรู้ (knowledge) เท่านั้น
  components/
    BoardImage.tsx  ← กระดาน (ภาพ + ไอคอนสีเต็มวง/เลข/label/หมาก/calibrate)
    CardModal.tsx   ← การ์ด question/knowledge/penalty/bonus + launcher ช่องทอง
    ARGoldChallenge.tsx ← บทเรียน AR ช่องทอง (กล้อง + คลิป 15 วิ + ลากคำตอบ + คำใบ้เหรียญ)
    ShopModal.tsx   ← ร้านค้าไอเทม (ใช้เหรียญซื้อ)
    KingCoinRow.tsx ← แถวช่องเก็บเหรียญ 7 พระองค์ (ใช้ซ้ำ HUD/GameOver/museum)
    KingPawnToken.tsx / PawnToken.tsx / KingCollection.tsx / CollectionMuseumModal.tsx /
    KingDetailModal.tsx / ItemBar.tsx / DiceButton.tsx / Confetti.tsx / Mascot.tsx ...
  screens/
    Home/        ← เลือกจำนวนผู้เล่น + เริ่ม
    GameBoard/   ← index (เลือก layout) + portrait + landscape (มี ForkOverlay + ShopModal)
    GameOver/    ← จัดอันดับด้วย kingCoins + แถวเหรียญ
    Settings/    ← Teacher Mode (ไม่มี maxRounds แล้ว)
    Admin/       ← Teacher CMS UI (login + CRUD + upload video AR ทอง)
  theme/tokens.ts   ← สี/ไอคอน/ป้ายของแต่ละ tile type
server/                         ← PHP REST API + MySQL schema/seed + upload endpoint
server/uploads/                 ← วิดีโอ AR ทองที่อัปโหลด (ignore ไฟล์จริง)
public/assets/board.png            ← ภาพกระดาน (เลข/ไอคอนคือ overlay ที่โค้ดใส่)
public/assets/chess/1.png..7.png   ← หมากกษัตริย์ 7 พระองค์ (ลำดับตาม king.order)
public/assets/coins/{king.id}.png  ← เหรียญกษัตริย์ 7 พระองค์
```

## ข้อควรระวัง

- แก้ `Player` ต้องอัปเดตที่สร้าง player (ที่เดียว: `setupGame` ใน store.ts); ฟิลด์ปัจจุบัน: `id`, `name`, `token`, `kingTokenId`, `position`, `coins`, `hearts`, `kingCoins`, `skipNext`, `knowledgeCards`
- ถ้าเพิ่ม/แก้ `ItemType` ต้องอัปเดต `ITEM_META`, `ITEM_PRICE`, initial `items`, `ShopModal`, `ItemBar`, และ logic `useItem`
- ถ้าเปลี่ยน schema DB ให้ใส่ทั้ง `server/schema.sql` และ migration แบบ runtime/README สำหรับฐานข้อมูลเดิม (เช่น `gold_quiz.video_url`)
- **ตำแหน่งช่องพิเศษ/ทางแยกปรับใน `board-layout.json`** — อย่าวางช่องพิเศษ (question/knowledge/goldking) ทับจุดแยก 6/12/32/36 (จะโดน ForkOverlay บัง)
- **`board-points.json` มี 77 จุด** (0–45 วงนอก, 46–76 เลนแยก 4 เส้น) ต้องเท่ากับจำนวน tiles เสมอ · พิกัดเลนแยกปรับในโหมด calibrate
- ถ้าเปลี่ยนชื่อ/ลำดับไฟล์หมากใน `public/assets/chess/` ต้องเช็ก `kings.json.order` + `kingAssets.ts`; เหรียญใน `public/assets/coins/` ตั้งชื่อตาม `king.id` (source ไทยอยู่ root `Coin/`)
- **ล้าง dead code รอบใหญ่ (2026-07-05):** ลบ `lessonProgress`/`unlockedKings`/`markLessonStep`/`completeLessonStep` · `mission`/`chance` (tile types + card blocks + `getMissionForKing`/`getRandomChance`/`applyChance` + `MissionCard`/`ChanceCard` + ข้อมูลใน cards.json) · `arStickers`/`arPosters`/`saveArPoster`/`collectArSticker`/`ArPoster` · tile types `start`/`coin`/`king`/`special` · เควส/บอส (รอบก่อน). `KingCollection` + พิพิธภัณฑ์เปลี่ยนเป็นอิงเหรียญล้วน. ถ้าจะเพิ่มระบบเรียนรู้/ภารกิจกลับมา ต้องสร้างใหม่ทั้ง type + action + UI
- เนื้อหาประวัติศาสตร์/ปีศักราชทั้งหมดเป็นตัวอย่าง ต้องให้ครู/ผู้เชี่ยวชาญตรวจก่อนเผยแพร่ · โมเดล/ภาพพระบรมราชานุสาวรีย์ต้องทำอย่างสมพระเกียรติ
