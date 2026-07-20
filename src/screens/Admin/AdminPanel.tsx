import { useEffect, useMemo, useState } from 'react';
import {
  createCard,
  deleteCard,
  fetchContent,
  hasAdminToken,
  importCards,
  login,
  logout,
  resolveApiAssetUrl,
  updateCard,
  uploadGoldVideo,
  uploadQuestionImage,
  type ContentType,
} from '@/core/api';
import { KINGS, OVERVIEW_KING_ID, OVERVIEW_KING_LABEL, SUBJECTS, subjectLabel, syncContent } from '@/core/content';
import type { Difficulty, KnowledgeCard, QuizCard, QuizChoice, SubjectArea, SubjectQuizCard } from '@/core/types';
import { LESSON_VIDEO_POOL, shuffledVideoQueue } from '@/core/videoPool';
import { color, elevation, radius, tileIcon } from '@/theme/tokens';
import { ImportPanel } from './ImportPanel';
import {
  badge,
  dangerButton,
  Field,
  input,
  muted,
  primaryButton,
  secondaryButton,
  Status,
  textarea,
  uploadButton,
} from './adminStyles';

type TabType = ContentType;
type Card = QuizCard | KnowledgeCard | SubjectQuizCard;
type DraftMode = 'create' | 'edit';

const tabs: { type: TabType; label: string; helper: string; icon: string }[] = [
  { type: 'quiz', label: 'คำถามฟ้า', helper: 'คำถามตอบรับเหรียญในเกม', icon: tileIcon.question },
  { type: 'knowledge', label: 'ความรู้ชมพู', helper: 'เกร็ดความรู้สำหรับเก็บสะสม', icon: tileIcon.knowledge },
  { type: 'subject', label: 'กลุ่มสาระฯ', helper: 'คำถาม 6 วิชา ผูกกับมหาราชแต่ละพระองค์', icon: tileIcon.subject },
  { type: 'gold', label: 'AR ทอง', helper: 'คำถามหลังบทเรียน AR แยกจากช่องฟ้า', icon: tileIcon.goldking },
];

const emptyChoices: QuizChoice[] = [
  { text: '', correct: true },
  { text: '', correct: false },
  { text: '', correct: false },
  { text: '', correct: false },
];

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [authed, setAuthed] = useState(hasAdminToken());
  const [password, setPassword] = useState('');
  const [active, setActive] = useState<TabType>('quiz');
  const [kingFilter, setKingFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [cardsByType, setCardsByType] = useState<Record<TabType, Card[]>>({
    quiz: [],
    knowledge: [],
    subject: [],
    gold: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Card | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>('create');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const cards = cardsByType[active];
  const activeTab = tabs.find((tab) => tab.type === active) ?? tabs[0];
  const selected = cards.find((card) => card.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return cards.filter((card) => {
      const byKing = kingFilter === 'all' || card.kingId === kingFilter;
      const haystack = [cardTitle(card), 'question' in card ? card.question : '']
        .join(' ')
        .toLowerCase();
      return byKing && (!keyword || haystack.includes(keyword));
    });
  }, [cards, kingFilter, search]);

  async function load(type: TabType = active) {
    if (!authed) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetchContent(type);
      setCardsByType((current) => ({ ...current, [type]: res.data as Card[] }));
      setSelectedId((current) => current ?? res.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(active);
    setDraft(null);
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, authed]);

  useEffect(() => {
    if (filtered.length && !filtered.some((card) => card.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  async function submitLogin() {
    setBusy(true);
    setError('');
    try {
      await login(password);
      setAuthed(true);
      setPassword('');
      setNotice('เข้าสู่ระบบแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function save(card: Card) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (draftMode === 'create') {
        await createCard(active, card as never);
      } else {
        await updateCard(active, card as never);
      }
      setDraft(null);
      setSelectedId(card.id);
      await load(active);
      await syncContent();
      setNotice('บันทึกแล้ว เกมจะใช้ข้อมูลล่าสุดเมื่อ sync สำเร็จ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(card: Card) {
    if (!confirm(`ลบ "${cardTitle(card)}" ใช่ไหม?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteCard(active, card.id);
      await load(active);
      await syncContent();
      setSelectedId(null);
      setNotice('ลบแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // แจกคลิปจาก public/video/ วนสลับให้การ์ด AR ทองที่ยังไม่มีวิดีโอ — ยิงขึ้น DB ครั้งเดียวผ่าน import.php
  async function fillGoldVideos() {
    const targets = (cardsByType.gold as QuizCard[]).filter((card) => !card.videoUrl?.trim());
    if (!targets.length) {
      setError('');
      setNotice('การ์ด AR ทองมีวิดีโอครบทุกใบแล้ว');
      return;
    }
    if (!confirm(`แจกคลิป ${LESSON_VIDEO_POOL.length} ไฟล์วนสลับให้การ์ด AR ทอง ${targets.length} ใบที่ยังไม่มีวิดีโอ ใช่ไหม?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const queue = shuffledVideoQueue(targets.length);
      const rows = targets.map((card, i) => ({ ...card, videoUrl: queue[i] }));
      const summary = await importCards('gold', rows, 'upsert');
      await load('gold');
      await syncContent();
      setNotice(`แจกวิดีโอให้การ์ด AR ทอง ${summary.updated + summary.inserted} ใบแล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แจกวิดีโอไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  function startCreate() {
    setDraft(newCard(active));
    setDraftMode('create');
    setError('');
  }

  function startEdit(card: Card) {
    setDraft(cloneCard(card));
    setDraftMode('edit');
    setError('');
  }

  return (
    <div style={overlay}>
      <div style={shell}>
        <header style={topbar}>
          <div>
            <h2 style={title}>จัดการเนื้อหาการ์ด</h2>
            <p style={subtitle}>เพิ่ม แก้ไข และแยกคลังคำถามที่ครูใช้ในห้องเรียน</p>
          </div>
          <div style={topActions}>
            {authed && (
              <button
                onClick={() => {
                  logout();
                  setAuthed(false);
                  setDraft(null);
                  setCardsByType({ quiz: [], knowledge: [], subject: [], gold: [] });
                }}
                style={secondaryButton}
              >
                ออกจากระบบ
              </button>
            )}
            <button onClick={onClose} style={secondaryButton}>
              ปิด
            </button>
          </div>
        </header>

        {!authed ? (
          <form
            style={loginPanel}
            onSubmit={(e) => {
              e.preventDefault();
              void submitLogin();
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 24, color: color.primary }}>เข้าสู่ระบบครู</h3>
              <p style={{ margin: '8px 0 0', color: color.textMuted }}>ใช้รหัสครูที่ตั้งไว้ใน server/config.php</p>
            </div>
            <Field label="รหัสครู">
              <input
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                autoFocus
              />
            </Field>
            {error && <Status tone="error" text={error} />}
            <button disabled={busy || !password.trim()} style={primaryButton}>
              เข้าสู่ระบบ
            </button>
          </form>
        ) : (
          <div style={workspace}>
            <aside style={sidebar}>
              <div style={statGrid}>
                {tabs.map((tab) => (
                  <button
                    key={tab.type}
                    onClick={() => setActive(tab.type)}
                    style={active === tab.type ? activeStat : statButton}
                  >
                    <span style={statTopline}>
                      <span style={statIcon}>{tab.icon}</span>
                      <span style={{ fontSize: 22, fontWeight: 800 }}>{cardsByType[tab.type].length}</span>
                    </span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div style={filterPanel}>
                <Field label="ค้นหา">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={input}
                    placeholder="พิมพ์คำถามหรือชื่อการ์ด"
                  />
                </Field>
                <Field label="พระองค์">
                  <select value={kingFilter} onChange={(e) => setKingFilter(e.target.value)} style={input}>
                    <option value="all">ทุกพระองค์</option>
                    {KINGS.map((king) => (
                      <option key={king.id} value={king.id}>
                        {king.name}
                      </option>
                    ))}
                    <option value={OVERVIEW_KING_ID}>{OVERVIEW_KING_LABEL}</option>
                  </select>
                </Field>
                <button onClick={startCreate} style={primaryButton}>
                  เพิ่มการ์ดใหม่
                </button>
                <button onClick={() => setImportOpen(true)} style={secondaryButton}>
                  📥 นำเข้าจาก Excel
                </button>
                {active === 'gold' && (
                  <button onClick={() => void fillGoldVideos()} disabled={busy} style={secondaryButton}>
                    🎬 แจกวิดีโอให้การ์ดที่ยังว่าง
                  </button>
                )}
              </div>

              <div style={listHeader}>
                <strong>{activeTab.label}</strong>
                <span style={muted}>{filtered.length} รายการ</span>
              </div>
              <div style={cardList}>
                {filtered.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setSelectedId(card.id);
                      setDraft(null);
                    }}
                    style={card.id === selectedId ? activeListItem : listItem}
                  >
                    <span style={listTitle}>
                      <span aria-hidden="true">{contentIcon(active)}</span>
                      <span>{cardTitle(card)}</span>
                    </span>
                    <span style={listMeta}>{kingName(card.kingId)}</span>
                    {'difficulty' in card && <span style={badge}>{difficultyLabel(card.difficulty)}</span>}
                  </button>
                ))}
                {!busy && filtered.length === 0 && <div style={emptyState}>ไม่พบการ์ดที่ตรงกับตัวกรอง</div>}
              </div>
            </aside>

            <main style={detail}>
              <section style={sectionHeader}>
                <div>
                  <p style={eyebrow}>{activeTab.label}</p>
                  <h3 style={detailTitle}>{draft ? (draftMode === 'create' ? 'เพิ่มการ์ดใหม่' : 'แก้ไขการ์ด') : activeTab.helper}</h3>
                </div>
                {!draft && selected && (
                  <div style={detailActions}>
                    <button onClick={() => startEdit(selected)} style={primaryButton}>
                      แก้ไข
                    </button>
                    <button onClick={() => void remove(selected)} style={dangerButton}>
                      ลบ
                    </button>
                  </div>
                )}
              </section>

              {error && <Status tone="error" text={error} />}
              {notice && <Status tone="success" text={notice} />}
              {busy && <Status tone="neutral" text="กำลังทำงาน..." />}

              {draft ? (
                <CardEditor
                  type={active}
                  value={draft}
                  onChange={setDraft}
                  onCancel={() => setDraft(null)}
                  onSave={(card) => void save(card)}
                />
              ) : selected ? (
                <CardPreview card={selected} type={active} />
              ) : (
                <div style={emptyDetail}>เลือกการ์ดจากรายการด้านซ้าย หรือกดเพิ่มการ์ดใหม่</div>
              )}
            </main>
          </div>
        )}

        {importOpen && (
          <ImportPanel
            onClose={() => setImportOpen(false)}
            onImported={async (types) => {
              for (const type of types) {
                await load(type);
              }
              await syncContent();
              setNotice('นำเข้าการ์ดจาก Excel แล้ว');
            }}
          />
        )}
      </div>
    </div>
  );
}

function CardEditor({
  type,
  value,
  onChange,
  onCancel,
  onSave,
}: {
  type: TabType;
  value: Card;
  onChange: (card: Card) => void;
  onCancel: () => void;
  onSave: (card: Card) => void;
}) {
  const [localError, setLocalError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const isKnowledge = type === 'knowledge';
  const isGold = type === 'gold';
  const isSubject = type === 'subject';
  const choices = value.choices;

  function patch(patchValue: Partial<Card>) {
    onChange({ ...value, ...patchValue } as Card);
  }

  function patchChoice(index: number, choicePatch: Partial<QuizChoice>) {
    patch({
      choices: choices.map((choice, i) => (i === index ? { ...choice, ...choicePatch } : choice)),
    } as Partial<Card>);
  }

  function makeSingleCorrect(index: number) {
    patch({
      choices: choices.map((choice, i) => ({ ...choice, correct: i === index })),
    } as Partial<Card>);
  }

  function validateAndSave() {
    const cleanChoices = choices.map((choice) => ({ text: choice.text.trim(), correct: choice.correct }));
    if (!value.id.trim() || !value.kingId) {
      setLocalError('กรอกพระองค์ให้ครบ');
      return;
    }

    if (isKnowledge) {
      const card = value as KnowledgeCard;
      if (!card.title.trim() || !card.body.trim()) {
        setLocalError('กรอกชื่อการ์ดและเนื้อหาความรู้ให้ครบ');
        return;
      }
      // การ์ดความรู้ไม่มีคำถามทบทวนในเกมแล้ว — เว้นว่างได้ทั้งคำถามและตัวเลือก
      // แต่ถ้าเริ่มกรอกแล้วต้องกรอกให้ครบ ไม่งั้นได้การ์ดที่มีตัวเลือกแต่ไม่มีคำตอบถูก
      const filled = cleanChoices.filter((choice) => choice.text);
      const partial = card.question.trim() || filled.length;
      if (partial && (!card.question.trim() || filled.length < 2 || !filled.some((choice) => choice.correct))) {
        setLocalError('ถ้ากรอกคำถามทบทวน ต้องมีตัวเลือกอย่างน้อย 2 ข้อ และมีคำตอบถูก 1 ข้อ (หรือเว้นว่างทั้งหมด)');
        return;
      }
      onSave({
        ...card,
        id: card.id.trim(),
        title: card.title.trim(),
        body: card.body.trim(),
        question: card.question.trim(),
        choices: partial ? filled : [],
      });
      return;
    }

    if (!value.question.trim()) {
      setLocalError('กรอกคำถามให้ครบ');
      return;
    }
    if (cleanChoices.some((choice) => !choice.text) || !cleanChoices.some((choice) => choice.correct)) {
      setLocalError('ตัวเลือกต้องไม่ว่าง และต้องมีคำตอบถูกอย่างน้อย 1 ข้อ');
      return;
    }
    const card = value as QuizCard;
    // การ์ด AR ทอง: คำอธิบายเฉลยไม่บังคับ (เฉลยจริงอยู่ในคลิป/การลากคำตอบ)
    if (!isGold && !card.explanation.trim()) {
      setLocalError('กรอกคำอธิบายเฉลย');
      return;
    }
    onSave({
      ...card,
      id: card.id.trim(),
      question: card.question.trim(),
      reward: Number(card.reward) || 0,
      timeLimitSec: Number(card.timeLimitSec) || 20,
      explanation: card.explanation.trim(),
      choices: cleanChoices,
    });
  }

  return (
    <div style={editor}>
      {localError && <Status tone="error" text={localError} />}
      <div style={formGrid}>
        <Field label="พระองค์">
          <select value={value.kingId} onChange={(e) => patch({ kingId: e.target.value } as Partial<Card>)} style={input}>
            {KINGS.map((king) => (
              <option key={king.id} value={king.id}>
                {king.name}
              </option>
            ))}
            <option value={OVERVIEW_KING_ID}>{OVERVIEW_KING_LABEL}</option>
          </select>
        </Field>
        {isSubject && (
          <Field label="วิชา (กลุ่มสาระฯ)">
            <select
              value={(value as SubjectQuizCard).subject}
              onChange={(e) => patch({ subject: e.target.value as SubjectArea } as Partial<Card>)}
              style={input}
            >
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!isKnowledge && (
          <>
            <Field label="ระดับคำถาม">
              <select
                value={(value as QuizCard).difficulty}
                onChange={(e) => patch({ difficulty: e.target.value as Difficulty } as Partial<Card>)}
                style={input}
              >
                <option value="easy">ง่าย</option>
                <option value="medium">กลาง</option>
                <option value="hard">ยาก</option>
              </select>
            </Field>
            <Field label="เหรียญรางวัล">
              <input
                value={(value as QuizCard).reward}
                onChange={(e) => patch({ reward: Number(e.target.value) } as Partial<Card>)}
                inputMode="numeric"
                style={input}
              />
            </Field>
            <Field label="เวลา วินาที">
              <input
                value={(value as QuizCard).timeLimitSec}
                onChange={(e) => patch({ timeLimitSec: Number(e.target.value) } as Partial<Card>)}
                inputMode="numeric"
                style={input}
              />
            </Field>
          </>
        )}
      </div>

      {isKnowledge && (
        <>
          <Field label="ชื่อการ์ด">
            <input
              value={(value as KnowledgeCard).title}
              onChange={(e) => patch({ title: e.target.value } as Partial<Card>)}
              style={input}
            />
          </Field>
          <Field label="เนื้อหาความรู้">
            <textarea
              value={(value as KnowledgeCard).body}
              onChange={(e) => patch({ body: e.target.value } as Partial<Card>)}
              style={textarea}
            />
          </Field>
        </>
      )}

      <Field label={isKnowledge ? 'คำถามทบทวน (ไม่บังคับ — เกมไม่ได้ถามการ์ดความรู้แล้ว)' : 'คำถาม'}>
        <textarea value={value.question} onChange={(e) => patch({ question: e.target.value } as Partial<Card>)} style={textarea} />
      </Field>

      <div style={choicePanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <strong>ตัวเลือกคำตอบ</strong>
          <span style={muted}>เลือกวงกลมหน้าข้อที่ถูก</span>
        </div>
        {choices.map((choice, index) => (
          <label key={index} style={choiceRow}>
            <input
              type="radio"
              name="correct-choice"
              checked={choice.correct}
              onChange={() => makeSingleCorrect(index)}
              style={{ width: 20, height: 20 }}
            />
            <span style={choiceLetter}>{String.fromCharCode(65 + index)}</span>
            <input
              value={choice.text}
              onChange={(e) => patchChoice(index, { text: e.target.value })}
              placeholder={`ตัวเลือก ${index + 1}`}
              style={input}
            />
          </label>
        ))}
      </div>

      {!isKnowledge && (
        <Field label={isGold ? 'คำอธิบายเฉลย (ไม่บังคับ)' : 'คำอธิบายเฉลย'}>
          <textarea
            value={(value as QuizCard).explanation}
            onChange={(e) => patch({ explanation: e.target.value } as Partial<Card>)}
            style={textarea}
          />
        </Field>
      )}

      {!isKnowledge && (
        <div style={videoUploadPanel}>
          <div>
            <strong>รูปภาพประกอบคำถาม (ไม่บังคับ)</strong>
            <p style={{ ...muted, margin: '4px 0 0' }}>อัปโหลดไฟล์ภาพ — JPG, PNG, WebP, GIF ไม่เกิน 10 MB</p>
          </div>
          {(value as QuizCard).imageUrl?.trim() ? (
            <img
              src={resolveVideoUrl((value as QuizCard).imageUrl)}
              alt=""
              style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div style={videoEmpty}>ยังไม่มีรูป — คำถามจะเป็นข้อความล้วน</div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={uploadButton}>
              {imgUploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={imgUploading}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  setImgUploading(true);
                  setLocalError('');
                  uploadQuestionImage(file)
                    .then((url) => patch({ imageUrl: url } as Partial<Card>))
                    .catch((err) => setLocalError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ'))
                    .finally(() => setImgUploading(false));
                }}
              />
            </label>
            {(value as QuizCard).imageUrl?.trim() && (
              <button onClick={() => patch({ imageUrl: '' } as Partial<Card>)} style={secondaryButton}>
                ล้างรูป
              </button>
            )}
          </div>
        </div>
      )}

      {isGold && (
        <div style={videoUploadPanel}>
          <div>
            <strong>วิดีโอบทเรียน AR ทอง</strong>
            <p style={{ ...muted, margin: '4px 0 0' }}>รองรับ MP4, WebM, MOV ขนาดไม่เกิน 200 MB</p>
          </div>
          {(value as QuizCard).videoUrl ? (
            <video src={resolveVideoUrl((value as QuizCard).videoUrl)} controls style={adminVideoPreview} />
          ) : (
            <div style={videoEmpty}>ยังไม่มีวิดีโอ ระบบจะแสดงการ์ดบทเรียนตัวอย่างแทน</div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={uploadButton}>
              {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดวิดีโอ'}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                disabled={uploading}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!file) return;
                  setUploading(true);
                  setLocalError('');
                  uploadGoldVideo(file)
                    .then((url) => patch({ videoUrl: url } as Partial<Card>))
                    .catch((err) => setLocalError(err instanceof Error ? err.message : 'อัปโหลดวิดีโอไม่สำเร็จ'))
                    .finally(() => setUploading(false));
                }}
              />
            </label>
            {(value as QuizCard).videoUrl && (
              <button onClick={() => patch({ videoUrl: '' } as Partial<Card>)} style={secondaryButton}>
                ล้างวิดีโอ
              </button>
            )}
          </div>
        </div>
      )}

      <div style={stickyActions}>
        <button onClick={onCancel} style={secondaryButton}>
          ยกเลิก
        </button>
        <button onClick={validateAndSave} style={primaryButton}>
          บันทึกการ์ด
        </button>
      </div>
    </div>
  );
}

function CardPreview({ card, type }: { card: Card; type: TabType }) {
  const isKnowledge = type === 'knowledge';
  return (
    <article style={preview}>
      <div style={previewMeta}>
        <span style={badge}>
          {contentIcon(type)}{' '}
          {type === 'gold' ? 'AR ทอง' : type === 'subject' ? 'กลุ่มสาระฯ' : isKnowledge ? 'ความรู้' : 'คำถาม'}
        </span>
        <span style={muted}>{kingName(card.kingId)}</span>
        {'subject' in card && <span style={muted}>📚 {subjectLabel(card.subject)}</span>}
        {'difficulty' in card && <span style={muted}>{difficultyLabel(card.difficulty)}</span>}
      </div>
      {'title' in card && <h3 style={{ margin: '14px 0 8px', fontSize: 24 }}>{card.title}</h3>}
      {'body' in card && <p style={bodyText}>{card.body}</p>}
      {card.question && <h4 style={questionText}>{card.question}</h4>}
      {card.choices.length > 0 && (
        <div style={choicePreviewGrid}>
          {card.choices.map((choice, index) => (
            <div key={index} style={choice.correct ? correctChoicePreview : choicePreview}>
              <strong>{String.fromCharCode(65 + index)}.</strong> {choice.text}
            </div>
          ))}
        </div>
      )}
      {'explanation' in card && <p style={explanationBox}>{card.explanation}</p>}
      {type === 'gold' && 'videoUrl' in card && card.videoUrl && (
        <video src={resolveVideoUrl(card.videoUrl)} controls style={previewVideo} />
      )}
    </article>
  );
}

function newCard(type: TabType): Card {
  const id = `${type}_${Date.now()}`;
  const kingId = KINGS[0]?.id ?? '';
  if (type === 'knowledge') {
    return { id, kingId, title: '', body: '', question: '', choices: cloneChoices(emptyChoices) };
  }
  if (type === 'subject') {
    return {
      id,
      kingId,
      subject: 'social',
      difficulty: 'easy',
      reward: 50,
      timeLimitSec: 25,
      question: '',
      choices: cloneChoices(emptyChoices),
      explanation: '',
    };
  }
  return {
    id,
    kingId,
    difficulty: 'easy',
    reward: 50,
    timeLimitSec: 20,
    question: '',
    choices: cloneChoices(emptyChoices),
    explanation: '',
  };
}

function cloneCard(card: Card): Card {
  return { ...card, choices: cloneChoices(card.choices) } as Card;
}

function cloneChoices(choices: QuizChoice[]): QuizChoice[] {
  return choices.map((choice) => ({ ...choice }));
}

function cardTitle(card: Card): string {
  return 'title' in card && card.title.trim() ? card.title : card.question || card.id;
}

function kingName(kingId: string): string {
  if (kingId === OVERVIEW_KING_ID) return OVERVIEW_KING_LABEL;
  return KINGS.find((king) => king.id === kingId)?.name ?? kingId;
}

function difficultyLabel(difficulty: Difficulty): string {
  return difficulty === 'easy' ? 'ง่าย' : difficulty === 'medium' ? 'กลาง' : 'ยาก';
}

function contentIcon(type: TabType): string {
  return type === 'gold'
    ? tileIcon.goldking
    : type === 'knowledge'
    ? tileIcon.knowledge
    : type === 'subject'
    ? tileIcon.subject
    : tileIcon.question;
}

function resolveVideoUrl(url: string | undefined): string {
  return resolveApiAssetUrl(url);
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.62)',
  zIndex: 300,
  padding: 16,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const shell: React.CSSProperties = {
  width: 'min(1180px, 98vw)',
  height: 'min(760px, 94vh)',
  background: color.surface,
  borderRadius: radius.lg,
  boxShadow: elevation.modal,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  overflow: 'hidden',
};

const topbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '18px 22px',
  borderBottom: '1px solid #E7D8BF',
};

const title: React.CSSProperties = { margin: 0, color: color.primary, fontSize: 26 };
const subtitle: React.CSSProperties = { margin: '4px 0 0', color: color.textMuted, fontSize: 16 };
const topActions: React.CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' };

const workspace: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '360px 1fr',
  minHeight: 0,
};

const sidebar: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto auto 1fr',
  gap: 14,
  padding: 18,
  background: '#FBF7EF',
  borderRight: '1px solid #E7D8BF',
  minHeight: 0,
};

const statGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
const statTopline: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7 };
const statIcon: React.CSSProperties = { fontSize: 22, lineHeight: 1 };
const statButton: React.CSSProperties = {
  fontFamily: 'inherit',
  display: 'grid',
  gap: 2,
  justifyItems: 'start',
  border: '1px solid #E7D8BF',
  background: '#fff',
  color: color.text,
  borderRadius: radius.sm,
  padding: 10,
  minHeight: 72,
  cursor: 'pointer',
};
const activeStat: React.CSSProperties = { ...statButton, borderColor: color.primary, boxShadow: 'inset 0 0 0 2px rgba(139,0,0,.12)' };

const filterPanel: React.CSSProperties = { display: 'grid', gap: 10 };
const listHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const cardList: React.CSSProperties = { display: 'grid', gap: 8, overflow: 'auto', paddingRight: 4, minHeight: 0 };
const listItem: React.CSSProperties = {
  fontFamily: 'inherit',
  textAlign: 'left',
  display: 'grid',
  gap: 5,
  border: '1px solid #E7D8BF',
  background: '#fff',
  color: color.text,
  borderRadius: radius.sm,
  padding: 12,
  cursor: 'pointer',
};
const activeListItem: React.CSSProperties = { ...listItem, borderColor: color.secondary, background: '#FFF8E6' };
const listTitle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 16, fontWeight: 800, lineHeight: 1.35 };
const listMeta: React.CSSProperties = { fontSize: 14, color: color.textMuted };

const detail: React.CSSProperties = { padding: 22, overflow: 'auto', minWidth: 0 };
const sectionHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  marginBottom: 16,
};
const detailActions: React.CSSProperties = { display: 'flex', gap: 10 };
const eyebrow: React.CSSProperties = { margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: color.secondary };
const detailTitle: React.CSSProperties = { margin: 0, fontSize: 24, color: color.text };

const loginPanel: React.CSSProperties = {
  width: 'min(460px, 92vw)',
  margin: '72px auto',
  display: 'grid',
  gap: 16,
  border: '1px solid #E7D8BF',
  borderRadius: radius.md,
  padding: 22,
  background: '#FBF7EF',
};

const editor: React.CSSProperties = { display: 'grid', gap: 14 };
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 };
const choicePanel: React.CSSProperties = { display: 'grid', gap: 10, padding: 14, background: '#FBF7EF', borderRadius: radius.sm };
const choiceRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '24px 30px 1fr', gap: 10, alignItems: 'center' };
const choiceLetter: React.CSSProperties = { fontWeight: 900, color: color.primary };
const stickyActions: React.CSSProperties = {
  position: 'sticky',
  bottom: -22,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  background: color.surface,
  borderTop: '1px solid #E7D8BF',
  padding: '14px 0 0',
};

const videoUploadPanel: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  background: '#FFF8E6',
  border: '1px solid #E7D8BF',
  borderRadius: radius.sm,
};

const adminVideoPreview: React.CSSProperties = {
  width: '100%',
  maxHeight: 260,
  borderRadius: radius.sm,
  background: '#000',
};

const videoEmpty: React.CSSProperties = {
  padding: 16,
  color: color.textMuted,
  background: '#fff',
  border: '1px dashed #B8A98E',
  borderRadius: radius.sm,
};

const preview: React.CSSProperties = { display: 'grid', gap: 12, maxWidth: 760 };
const previewMeta: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
const bodyText: React.CSSProperties = { fontSize: 18, lineHeight: 1.7, color: color.text, margin: 0 };
const questionText: React.CSSProperties = { fontSize: 22, lineHeight: 1.45, margin: '8px 0 0' };
const choicePreviewGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 };
const choicePreview: React.CSSProperties = { padding: 12, borderRadius: radius.sm, background: '#F1ECE3', lineHeight: 1.5 };
const correctChoicePreview: React.CSSProperties = { ...choicePreview, background: '#E8F5E9', border: `1px solid ${color.success}` };
const explanationBox: React.CSSProperties = { padding: 14, background: '#E3F2FD', color: color.info, borderRadius: radius.sm, lineHeight: 1.6 };
const previewVideo: React.CSSProperties = { width: '100%', maxHeight: 360, borderRadius: radius.md, background: '#000' };

const emptyState: React.CSSProperties = { padding: 18, color: color.textMuted, textAlign: 'center' };
const emptyDetail: React.CSSProperties = { padding: 32, color: color.textMuted, background: '#FBF7EF', borderRadius: radius.md };
