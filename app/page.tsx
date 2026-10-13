"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { Markdown } from "./Markdown";
import { AuthScreen, ConsentScreen } from "./AuthScreen";
import Link from "next/link";
import { LEGAL_VERSION } from "@/lib/legal";
import { HistoryPanel } from "./HistoryPanel";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { ThemeToggle } from "./ThemeToggle";
import { useDialog } from "./useDialog";
import { authHeaders, supabase } from "@/lib/supabase-browser";
import {
  fetchRemoteProgress,
  loadConversationMessages,
  saveRemoteProgress,
  type ConversationSummary,
} from "@/lib/cloud";
import {
  classes,
  getStarterPrompts,
  type CourseKey,
  type Unit,
} from "@/lib/courses";
import {
  type Progress,
  defaultProgress,
  loadProgress,
  saveProgress,
  takeLegacyProgress,
  clearProgress,
  rollWeekIfNeeded,
  getUnitStats,
  computeMastery,
  defaultUnitStats,
  todayKey,
  daysBetween,
  relativeTime,
  unitKey,
  nowMs,
} from "@/lib/progress";

// Shared motion presets for the refreshed UI.
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
const pageTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

// Staggered grid: container reveals children one after another.
const gridVariants = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const cardVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: pageTransition },
};

type View = "home" | "class" | "unit";
type Mode = "tutor" | "checker" | "teach";
type Difficulty = "warmup" | "standard" | "challenge";
type UnitView = "chat" | "practice";
type PracticeMode = "mcq" | "frq";
type QuizPhase = "idle" | "loading" | "active" | "grading";
type ChoiceLetter = "A" | "B" | "C" | "D";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string; // data URL (base64) for an attached image on a user turn
}

interface McqData {
  question: string;
  choices: Record<ChoiceLetter, string>;
  correct: ChoiceLetter;
  explanation: string;
}

interface QuestionRequest {
  course: CourseKey;
  unitId: string;
  mode: PracticeMode;
  difficulty: Difficulty;
}

interface PrefetchedQuestion {
  key: string;
  promise: Promise<McqData | string>;
  result?: McqData | string; // set once the promise resolves, so it can be served synchronously
}

function questionKey(q: QuestionRequest): string {
  return `${q.course}|${q.unitId}|${q.mode}|${q.difficulty}`;
}

// A study session = continuous time in one unit. Counts toward streak/weekly
// goal only once it has at least one attempted problem.
interface StudySession {
  courseKey: CourseKey;
  unitId: string;
  startedAt: number;
  problemsAttempted: number;
  problemsSolved: number;
  hintsUsed: number;
  startMastery: number;
  counted: boolean;
}

interface RecapData {
  unitTitle: string;
  courseTitle: string;
  minutes: number;
  attempted: number;
  solved: number;
  hints: number;
  delta: number;
  mastery: number;
}

// Mastery ring shown on unit cards. Static (0%) until the progress engine is wired.
function Ring({ percent }: { percent: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const complete = percent >= 100;
  // Spans, not divs: the ring sits inside a unit card, which is a <button>.
  return (
    <span className="ring-wrap" role="img" aria-label={`Mastery ${percent} out of 100`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="ring-track" cx="22" cy="22" r={r} />
        <circle
          className="ring-fill"
          cx="22"
          cy="22"
          r={r}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className={"ring-label" + (complete ? " complete" : "")} aria-hidden="true">
        {complete ? "✓" : percent}
      </span>
    </span>
  );
}

// Signed-in gate: the tutor only renders with a session. Keyed by user id so
// switching accounts on a shared device starts from a clean slate.
export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const auth = supabase().auth;
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="auth-wrap" aria-busy="true" />;
  if (!session) return <AuthScreen notice={notice} />;
  const agreedVersion = session.user.user_metadata?.terms_version as string | undefined;
  if (agreedVersion !== LEGAL_VERSION) {
    return <ConsentScreen email={session.user.email ?? ""} updated={!!agreedVersion} />;
  }
  return (
    <TutorApp
      key={session.user.id}
      userId={session.user.id}
      email={session.user.email ?? ""}
      onAccountDeleted={() => setNotice("Your account and everything in it were deleted.")}
    />
  );
}

function TutorApp({
  userId,
  email,
  onAccountDeleted,
}: {
  userId: string;
  email: string;
  onAccountDeleted: () => void;
}) {
  const [view, setView] = useState<View>("home");
  const [currentClass, setCurrentClass] = useState<CourseKey | null>(null);
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(null);

  const [mode, setMode] = useState<Mode>("tutor");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [unitView, setUnitView] = useState<UnitView>("chat");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("mcq");
  const [practiceDiff, setPracticeDiff] = useState<Difficulty>("standard");

  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Chat state (Milestone 1).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Practice-quiz state (Milestone 2).
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("idle");
  const [quizNum, setQuizNum] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [mcq, setMcq] = useState<McqData | null>(null);
  const [mcqPicked, setMcqPicked] = useState<ChoiceLetter | null>(null);
  const [frqQuestion, setFrqQuestion] = useState("");
  const [frqAnswer, setFrqAnswer] = useState("");
  const [frqFeedback, setFrqFeedback] = useState("");
  const [frqImage, setFrqImage] = useState<string | null>(null);
  const frqFileInputRef = useRef<HTMLInputElement | null>(null);
  // One-slot buffer holding the NEXT question, generated in the background while
  // the student works the current one. Keyed by (course, unit, mode, difficulty)
  // so a settings change never serves a stale question.
  const prefetchRef = useRef<PrefetchedQuestion | null>(null);
  // Bumped by resetQuiz so a response that lands after a unit/mode switch is dropped.
  const quizEpochRef = useRef(0);
  // Questions shown this practice session (oldest first), sent with each generate
  // request so the model doesn't serve near-duplicates. A ref, not state, because
  // the prefetch fires in the same tick the question is recorded.
  const recentQuestionsRef = useRef<string[]>([]);

  // Saved chats: the id of the conversation on screen (null until the first reply
  // creates it). chatEpochRef is bumped whenever the chat on screen is replaced,
  // so a reply still streaming into the old chat is dropped.
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEpochRef = useRef(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Progress engine (Milestone 3), synced to the student's account. progressRef
  // mirrors the latest value for the sign-out flush.
  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const progressRef = useRef<Progress>(progress);
  const [progressSynced, setProgressSynced] = useState(false);
  const sessionRef = useRef<StudySession | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState(3);
  const [recap, setRecap] = useState<RecapData | null>(null);

  // Hydrate after mount: this device's copy first (instant), then the account's.
  // Whichever was changed last wins, and the winner is written back to both.
  // A device's pre-account progress is handed to the first account that signs in.
  useEffect(() => {
    let cancelled = false;
    const local = loadProgress(userId) ?? takeLegacyProgress();
    if (local) {
      rollWeekIfNeeded(local);
      progressRef.current = local;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage hydration
      setProgress(local);
    }
    fetchRemoteProgress().then(
      (remote) => {
        if (cancelled) return;
        // progressRef, not local: it includes anything practiced while this loaded.
        const device = local || progressRef.current.updatedAt ? progressRef.current : null;
        const useDevice = device && (!remote || (device.updatedAt ?? 0) > (remote.updatedAt ?? 0));
        // Cloned: rollWeekIfNeeded mutates, and device may be the current state object.
        const p: Progress = structuredClone(useDevice ? device : (remote ?? defaultProgress()));
        rollWeekIfNeeded(p);
        saveProgress(p, userId);
        progressRef.current = p;
        setProgress(p);
        setProgressSynced(true); // the effect below pushes p to the account
      },
      (err) => {
        // Offline or Supabase paused: keep working from the device copy. Not
        // syncing up here avoids overwriting newer progress from another device.
        console.warn("progress sync unavailable:", err);
        if (local) saveProgress(local, userId);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Push changes to the account, debounced so a burst of quiz answers is one write.
  useEffect(() => {
    if (!progressSynced) return;
    const t = window.setTimeout(() => {
      saveRemoteProgress(userId, progress).catch((err) => console.warn("progress sync failed:", err));
    }, 800);
    return () => window.clearTimeout(t);
  }, [progress, progressSynced, userId]);

  // Apply a mutation to a fresh copy of progress, persist it, and re-render.
  function mutateProgress(fn: (p: Progress) => void) {
    setProgress((prev) => {
      const next: Progress = JSON.parse(JSON.stringify(prev));
      fn(next);
      next.updatedAt = nowMs();
      saveProgress(next, userId);
      progressRef.current = next;
      return next;
    });
  }

  // Our API routes require a signed-in student. A 401 means the session is gone
  // (expired, or signed out in another tab), so return to the sign-in screen.
  async function apiPost(url: string, body: unknown): Promise<Response> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      showToast("Your session expired. Please sign in again.");
      void supabase().auth.signOut();
    }
    return res;
  }

  async function signOut() {
    endSession(false);
    // Let React apply endSession's progress update, then flush it to the account.
    await new Promise((r) => window.setTimeout(r, 0));
    if (progressSynced) {
      await saveRemoteProgress(userId, progressRef.current).catch((err) =>
        console.warn("progress sync failed:", err),
      );
    }
    await supabase().auth.signOut();
  }

  // The account is already gone server-side: skip the progress flush (there's
  // nothing to save it to) and only clear this device's session and cache.
  async function finishAccountDeletion() {
    sessionRef.current = null;
    setProgressSynced(false);
    clearProgress(userId);
    onAccountDeleted();
    await supabase().auth.signOut({ scope: "local" });
  }

  // Begin a study session for the given unit (idempotent for the active unit).
  function startSession(courseKey: CourseKey, unit: Unit) {
    const cur = sessionRef.current;
    if (cur && cur.courseKey === courseKey && cur.unitId === unit.id) return;
    sessionRef.current = {
      courseKey,
      unitId: unit.id,
      startedAt: nowMs(),
      problemsAttempted: 0,
      problemsSolved: 0,
      hintsUsed: 0,
      startMastery: getUnitStats(progress, courseKey, unit.id).masteryScore,
      counted: false,
    };
  }

  // Record one attempted problem (from chat "I solved it", or a quiz answer).
  function recordProblem(solved: boolean) {
    const sess = sessionRef.current;
    if (!sess) return;
    sess.problemsAttempted += 1;
    if (solved) sess.problemsSolved += 1;
    mutateProgress((p) => {
      const k = unitKey(sess.courseKey, sess.unitId);
      const stats = p.units[k] ?? defaultUnitStats();
      stats.problemsAttempted += 1;
      if (solved) stats.problemsSolved += 1;
      stats.lastVisited = nowMs();
      stats.masteryScore = computeMastery(stats);
      p.units[k] = stats;
      p.totalProblems += 1;
    });
  }

  // Record one hint used (lightly lowers mastery; tracked per session for recap).
  function recordHintProgress() {
    const sess = sessionRef.current;
    if (!sess) return;
    sess.hintsUsed += 1;
    mutateProgress((p) => {
      const k = unitKey(sess.courseKey, sess.unitId);
      const stats = p.units[k] ?? defaultUnitStats();
      stats.hintsUsed += 1;
      stats.lastVisited = nowMs();
      stats.masteryScore = computeMastery(stats);
      p.units[k] = stats;
    });
  }

  // End the active session. Counts it toward streak + weekly goal (once) if at
  // least one problem was attempted, and optionally surfaces a recap modal.
  function endSession(showRecap: boolean) {
    const sess = sessionRef.current;
    sessionRef.current = null;
    if (!sess || sess.problemsAttempted < 1) return;

    // Decide counting + mutate the (local) session flag OUTSIDE the state updater
    // so the updater stays pure (React StrictMode double-invokes updaters in dev).
    const shouldCount = !sess.counted;
    sess.counted = true;

    if (shouldCount) {
      mutateProgress((p) => {
        const today = todayKey();
        const s = p.streak;
        if (s.lastStudyDate !== today) {
          if (s.lastStudyDate) {
            const gap = daysBetween(s.lastStudyDate, nowMs());
            if (gap === 1) s.currentStreak += 1;
            else if (gap > 1) s.currentStreak = 1;
          } else {
            s.currentStreak = 1;
          }
          s.lastStudyDate = today;
          if (s.currentStreak > s.longestStreak) s.longestStreak = s.currentStreak;
        }
        rollWeekIfNeeded(p);
        p.weeklyGoal.sessionsThisWeek += 1;
      });
    }

    if (showRecap) {
      // endSession does not change unit mastery, so reading current state is correct.
      const cls = classes[sess.courseKey];
      const unit = cls.units.find((u) => u.id === sess.unitId);
      const stats = getUnitStats(progress, sess.courseKey, sess.unitId);
      setRecap({
        unitTitle: unit?.title ?? "",
        courseTitle: cls.title,
        minutes: Math.max(1, Math.round((nowMs() - sess.startedAt) / 60000)),
        attempted: sess.problemsAttempted,
        solved: sess.problemsSolved,
        hints: sess.hintsUsed,
        delta: stats.masteryScore - sess.startMastery,
        mastery: stats.masteryScore,
      });
    }
  }

  function saveGoal() {
    const v = Math.round(goalDraft);
    if (v >= 1 && v <= 14) {
      mutateProgress((p) => {
        p.weeklyGoal.target = v;
      });
    }
    setGoalModalOpen(false);
  }

  // Screen-reader announcements. The live region is always mounted (a region that
  // appears together with its text is often not read); clearing first makes a
  // repeated message count as a change.
  const [announcement, setAnnouncement] = useState("");
  function announce(msg: string) {
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(msg), 60);
  }

  function showToast(msg: string) {
    setToast(msg);
    announce(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  const goalDialogRef = useDialog(goalModalOpen, () => setGoalModalOpen(false));
  const recapDialogRef = useDialog(recap !== null, () => setRecap(null));

  // Chat tabs: arrow keys move between them, per the ARIA tabs pattern.
  function onUnitTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: UnitView = unitView === "chat" ? "practice" : "chat";
    setUnitView(next);
    document.getElementById(`unit-tab-${next}`)?.focus();
  }

  useEffect(() => {
    // Smooth-scrolling on every streamed chunk stacks overlapping scroll animations,
    // so jump while streaming (and for reduced-motion users) and glide otherwise.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: isStreaming || reduceMotion ? "instant" : "smooth",
    });
  }, [messages, isStreaming]);

  // useState navigation (no router) keeps the scroll position, so without this a
  // tap on a card lands the next view mid-page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, unitView]);

  function goHome() {
    endSession(true);
    setView("home");
    setCurrentClass(null);
    setCurrentUnit(null);
  }

  function openClass(key: CourseKey) {
    setCurrentClass(key);
    setView("class");
  }

  function openUnit(unit: Unit) {
    if (!currentClass) return;
    endSession(false); // close any stale session before switching units
    setCurrentUnit(unit);
    setUnitView("chat");
    setInput("");
    resetChat();
    resetQuiz();
    startSession(currentClass, unit);
    setView("unit");
  }

  // Clear the practice session (score + current question). Called on unit change
  // and when toggling between MCQ and FRQ so scores don't mix across modes.
  function resetQuiz() {
    quizEpochRef.current += 1;
    prefetchRef.current = null;
    recentQuestionsRef.current = [];
    setQuizPhase("idle");
    setQuizNum(0);
    setQuizCorrect(0);
    setQuizTotal(0);
    setQuizError(null);
    setMcq(null);
    setMcqPicked(null);
    setFrqQuestion("");
    setFrqAnswer("");
    setFrqFeedback("");
    setFrqImage(null);
  }

  function switchPracticeMode(pm: PracticeMode) {
    if (pm === practiceMode) return;
    setPracticeMode(pm);
    resetQuiz();
  }

  // Difficulty changes keep the current question but re-aim the prefetch buffer
  // so "Next" serves a question at the new level.
  function switchPracticeDiff(d: Difficulty) {
    if (d === practiceDiff) return;
    setPracticeDiff(d);
    prefetchRef.current = null;
    if (quizPhase === "active" && currentClass && currentUnit) {
      prefetchQuestion({ course: currentClass, unitId: currentUnit.id, mode: practiceMode, difficulty: d });
    }
  }

  function goBackToClass() {
    endSession(true);
    setView("class");
    setCurrentUnit(null);
  }

  // Clears the screen and starts a fresh saved chat on the next message. The old
  // chat stays in history.
  function resetChat() {
    chatEpochRef.current += 1;
    setConversationId(null);
    setMessages([]);
    setHintsUsed(0);
    setIsStreaming(false);
    setPendingImage(null);
  }

  // Reopen a saved chat exactly as it was left: same unit, mode, and difficulty.
  // Sets mode directly rather than via handleModeChange, which would clear it.
  async function resumeConversation(c: ConversationSummary) {
    const key = c.course as CourseKey;
    const unit = classes[key]?.units.find((u) => u.id === c.unit_id);
    if (!unit) {
      showToast("That chat's unit is no longer in the course.");
      return;
    }
    let saved: ChatMessage[];
    try {
      saved = await loadConversationMessages(c.id);
    } catch {
      showToast("Could not open that chat. Try again.");
      return;
    }
    endSession(false);
    resetChat();
    resetQuiz();
    setConversationId(c.id);
    setMessages(saved);
    setMode(c.mode);
    setDifficulty(c.difficulty);
    setInput("");
    setCurrentClass(key);
    setCurrentUnit(unit);
    setUnitView("chat");
    startSession(key, unit);
    setView("unit");
    setHistoryOpen(false);
    announce(`Opened chat: ${c.title}`);
  }

  // A deleted chat that's still on screen keeps showing, but its next message
  // starts a new saved chat.
  function onChatDeleted(id: string) {
    if (id === conversationId) setConversationId(null);
  }

  // Switching chat modes clears the conversation: a Socratic hint trail makes
  // no sense once you jump into Solution Checker or role-reverse into Teach.
  function handleModeChange(newMode: Mode) {
    if (newMode === mode) return;
    setMode(newMode);
    resetChat();
  }

  const course = currentClass ? classes[currentClass] : null;

  // Send a turn to the tutor and stream the reply into the last assistant bubble.
  async function callTutor(history: ChatMessage[]) {
    if (!currentClass || !currentUnit) return;
    const epoch = chatEpochRef.current;
    const current = () => chatEpochRef.current === epoch; // false once the chat is replaced
    setIsStreaming(true);
    // Add an empty assistant message we'll fill as tokens stream in.
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await apiPost("/api/chat", {
        messages: history,
        course: currentClass,
        unitId: currentUnit.id,
        mode,
        difficulty,
        conversationId,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Request failed (${res.status})`);
      }
      // The first reply of a new chat carries the id the server saved it under.
      const savedId = res.headers.get("X-Conversation-Id");
      if (savedId && current()) setConversationId(savedId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (current()) setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (err) {
      if (!current()) return;
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages([
        ...history,
        { role: "assistant", content: `Sorry, the tutor could not respond. ${msg}` },
      ]);
      showToast(msg);
    } finally {
      if (current()) setIsStreaming(false);
    }
  }

  function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    const history = [...messages, { role: "user" as const, content: trimmed }];
    setInput("");
    void callTutor(history);
  }

  function onSend() {
    if (isStreaming) return;
    const trimmed = input.trim();
    // Allow sending an image with no text (e.g. "check my handwritten work").
    if (!trimmed && !pendingImage) return;
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    if (pendingImage) userMsg.image = pendingImage;
    const history = [...messages, userMsg];
    setInput("");
    setPendingImage(null);
    void callTutor(history);
  }

  // Validate, downscale, and read a chosen image file into a base64 data URL,
  // then hand it to the given setter. Shared by the chat tutor and the FRQ
  // grader. Phone photos are large (often 3-8 MB); raw base64 inflates them by
  // ~33% and blows past Vercel's 4.5 MB request-body limit (HTTP 413). We
  // re-encode to a JPEG capped at 1568px (Claude's vision sweet spot), which
  // keeps payloads small while preserving enough detail for handwritten work.
  function readImageFile(
    e: React.ChangeEvent<HTMLInputElement>,
    set: (url: string) => void,
  ) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast("Image is too large (max 25 MB).");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => showToast("Could not read that image.");
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const original = reader.result;
      const img = new Image();
      img.onerror = () => showToast("Could not read that image.");
      img.onload = () => {
        const MAX = 1568;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          set(original); // canvas unsupported; fall back to the raw image
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        set(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  }

  // Hint buttons send canned requests and count toward the "show answer" gate.
  function requestHint(kind: "smaller" | "bigger") {
    if (isStreaming) return;
    setHintsUsed((n) => n + 1);
    recordHintProgress();
    sendUserText(
      kind === "smaller"
        ? "Can I have a smaller hint?"
        : "Can I have a bigger hint?",
    );
  }

  function showAnswer() {
    if (isStreaming) return;
    sendUserText("Show me the answer, with a clear step-by-step explanation.");
  }

  function markSolved() {
    if (isStreaming) return;
    setHintsUsed(0);
    recordProblem(true);
    sendUserText("I solved it! Can you confirm my approach was right and give me a quick takeaway?");
  }

  function newProblem() {
    if (isStreaming) return;
    setHintsUsed(0);
    sendUserText("Give me a new problem for this unit at the current difficulty.");
  }

  function exportTranscript() {
    if (!currentUnit || !course) return;
    if (messages.length === 0) {
      showToast("Nothing to export yet. Start a conversation first.");
      return;
    }
    let md = `# ${course.title} — ${currentUnit.title}\n\n`;
    const modeLabel =
      mode === "tutor" ? "Socratic Tutor" : mode === "checker" ? "Solution Checker" : "Teach the Tutor";
    md += `**Mode:** ${modeLabel}  \n`;
    md += `**Difficulty:** ${difficulty}\n\n---\n\n`;
    const youLabel = mode === "teach" ? "You (teaching)" : "You";
    const botLabel = mode === "teach" ? "Student" : "Tutor";
    for (const m of messages) {
      md += `**${m.role === "user" ? youLabel : botLabel}:** ${m.content}\n\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentUnit.id}-transcript.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Practice quizzes (Milestone 2) ----------

  // Generate one question. Resolves to the MCQ object or the FRQ prompt text.
  async function requestQuestion(q: QuestionRequest): Promise<McqData | string> {
    const res = await apiPost("/api/quiz", {
      action: q.mode,
      course: q.course,
      unitId: q.unitId,
      difficulty: q.difficulty,
      recent: recentQuestionsRef.current,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
    return q.mode === "mcq" ? (data.mcq as McqData) : (data.frq as string);
  }

  // Start generating the next question in the background (no-op if the buffer
  // already holds one for these settings). Failures are silent: fetchQuestion
  // just falls back to a live request.
  function prefetchQuestion(q: QuestionRequest) {
    const key = questionKey(q);
    if (prefetchRef.current?.key === key) return;
    const entry: PrefetchedQuestion = { key, promise: requestQuestion(q) };
    entry.promise.then(
      (result) => (entry.result = result),
      () => {
        if (prefetchRef.current === entry) prefetchRef.current = null;
      },
    );
    prefetchRef.current = entry;
  }

  // Show the next question for the current settings. Used by both "Start
  // Practice" and "Next question". Serves from the prefetch buffer when it has a
  // match (instantly if it has already resolved), otherwise fetches live.
  async function fetchQuestion() {
    if (!currentClass || !currentUnit) return;
    const q: QuestionRequest = {
      course: currentClass,
      unitId: currentUnit.id,
      mode: practiceMode,
      difficulty: practiceDiff,
    };
    const epoch = quizEpochRef.current;
    setQuizError(null);
    setMcq(null);
    setMcqPicked(null);
    setFrqQuestion("");
    setFrqAnswer("");
    setFrqFeedback("");
    setFrqImage(null);

    const buffered = prefetchRef.current?.key === questionKey(q) ? prefetchRef.current : null;
    prefetchRef.current = null;
    if (!buffered?.result) setQuizPhase("loading");

    try {
      let result: McqData | string;
      if (buffered?.result) {
        result = buffered.result;
      } else if (buffered) {
        // Still generating: wait for it, but retry live if the background call failed.
        result = await buffered.promise.catch(() => requestQuestion(q));
      } else {
        result = await requestQuestion(q);
      }
      if (quizEpochRef.current !== epoch) return; // unit or mode changed while waiting

      setQuizNum((n) => n + 1);
      if (q.mode === "mcq") {
        setMcq(result as McqData);
      } else {
        setFrqQuestion(result as string);
      }
      setQuizPhase("active");
      announce("New question ready.");
      // Record before prefetching so the next question is generated knowing this one.
      const shown = typeof result === "string" ? result : result.question;
      recentQuestionsRef.current = [...recentQuestionsRef.current, shown].slice(-6);
      prefetchQuestion(q);
    } catch (err) {
      if (quizEpochRef.current !== epoch) return;
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setQuizError(msg);
      setQuizPhase("idle");
      showToast(msg);
    }
  }

  function handleMcqChoice(letter: ChoiceLetter) {
    if (!mcq || mcqPicked) return; // lock after first pick
    setMcqPicked(letter);
    setQuizTotal((t) => t + 1);
    const correct = letter === mcq.correct;
    if (correct) setQuizCorrect((c) => c + 1);
    announce(correct ? "Correct." : `Incorrect. The answer was ${mcq.correct}.`);
    recordProblem(correct); // counts toward mastery + this study session
  }

  async function submitFrq() {
    if (!currentClass || !currentUnit) return;
    // Accept a typed answer, a photo of handwritten work, or both.
    if (!frqAnswer.trim() && !frqImage) {
      showToast("Write your response or attach a photo before submitting.");
      return;
    }
    setQuizPhase("grading");
    setQuizError(null);
    try {
      const res = await apiPost("/api/quiz", {
        action: "grade",
        course: currentClass,
        unitId: currentUnit.id,
        difficulty: practiceDiff,
        question: frqQuestion,
        answer: frqAnswer,
        image: frqImage || undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setFrqFeedback(data.feedback as string);
      announce("Grading complete. Your feedback is below the question.");
      setQuizTotal((t) => t + 1);
      recordProblem(true); // a completed + graded FRQ counts as a solved problem
      setQuizPhase("active");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setQuizError(msg);
      setQuizPhase("active");
      showToast(msg);
    }
  }

  // Score label + progress bar width, computed per mode.
  const quizScoreLabel =
    practiceMode === "mcq"
      ? `${quizCorrect} / ${quizTotal} correct`
      : `${quizTotal} completed`;
  const quizScorePct =
    practiceMode === "mcq"
      ? quizTotal > 0
        ? Math.round((quizCorrect / quizTotal) * 100)
        : 0
      : Math.min(100, quizTotal * 20);

  const onHome = view === "home";
  const onClass = view === "class";

  return (
    <MotionConfig reducedMotion="user">
    <div className="container">
      {/* Always mounted so screen readers pick up each new message. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header>
        <div className="header-inner">
          <button type="button" className="logo" onClick={goHome} aria-label="Ransom Tutor, go home">
            <span className="logo-mark" aria-hidden="true">
              <span className="r-letter">R</span>
              <span className="e-letter">E</span>
            </span>
            <span className="logo-name">Ransom Tutor</span>
          </button>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {onHome ? (
              <span aria-current="page">Home</span>
            ) : (
              <button type="button" className="crumb" onClick={goHome}>
                Home
              </button>
            )}
            {course && (
              <>
                <span className="sep" aria-hidden="true">/</span>
                {onClass ? (
                  <span aria-current="page">{course.title}</span>
                ) : (
                  <button type="button" className="crumb" onClick={() => openClass(currentClass!)}>
                    {course.title}
                  </button>
                )}
              </>
            )}
            {view === "unit" && currentUnit && (
              <>
                <span className="sep" aria-hidden="true">/</span>
                <span aria-current="page">{currentUnit.title}</span>
              </>
            )}
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="header-text-btn"
              onClick={() => setHistoryOpen(true)}
              aria-haspopup="dialog"
              aria-label="Your chats"
            >
              <span aria-hidden="true">🕘</span>
              <span className="header-btn-label">Chats</span>
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="header-text-btn"
              onClick={() => void signOut()}
              title={`Signed in as ${email}`}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
      {/* ===================== HOME ===================== */}
      {view === "home" && (
        <motion.div
          className="page"
          key="home"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
        >
          <div className="hero">
            <h1>Learn by asking better questions.</h1>
            <p>
              Pick a class to start a guided practice session. The tutor leads
              you through problems with hints, never just answers.
            </p>
          </div>

          <div className="stats-bar">
            <div
              className="stat"
              title={`Longest streak: ${progress.streak.longestStreak} days`}
            >
              <div className="stat-icon flame">🔥</div>
              <div className="stat-body">
                <div className="stat-value">
                  {progress.streak.currentStreak}{" "}
                  {progress.streak.currentStreak === 1 ? "day" : "days"}
                </div>
                <div className="stat-label">Streak</div>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat" style={{ flex: 1, minWidth: 200 }}>
              <div className="stat-icon">🎯</div>
              <div className="stat-body" style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="stat-value">
                    {progress.weeklyGoal.sessionsThisWeek} / {progress.weeklyGoal.target}{" "}
                    sessions
                  </span>
                  <button
                    type="button"
                    className="goal-edit-btn"
                    aria-label="Edit weekly goal"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setGoalDraft(progress.weeklyGoal.target);
                      setGoalModalOpen(true);
                    }}
                  >
                    edit
                  </button>
                </div>
                <div className="goal-bar-track">
                  <div
                    className="goal-bar-fill"
                    style={{
                      transform: `translateX(${
                        Math.min(
                          100,
                          Math.round(
                            (progress.weeklyGoal.sessionsThisWeek /
                              progress.weeklyGoal.target) *
                              100,
                          ),
                        ) - 100
                      }%)`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-icon">📚</div>
              <div className="stat-body">
                <div className="stat-value">{progress.totalProblems}</div>
                <div className="stat-label">Problems all-time</div>
              </div>
            </div>
          </div>

          <div className="section-title">Classes</div>
          <motion.div
            className="cards-grid"
            variants={gridVariants}
            initial="initial"
            animate="animate"
          >
            {(Object.keys(classes) as CourseKey[]).map((key) => {
              const c = classes[key];
              return (
                <motion.button
                  type="button"
                  className="card"
                  key={key}
                  onClick={() => openClass(key)}
                  variants={cardVariants}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {/* Spans throughout: a <button> may only contain phrasing content. */}
                  <span className="card-icon" aria-hidden="true">{c.icon}</span>
                  <span className="card-title">{c.title}</span>
                  <span className="card-desc">{c.desc}</span>
                  <span className="card-meta">
                    <span>{c.units.length} units</span>
                    <span aria-hidden="true">→</span>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* ===================== CLASS ===================== */}
      {view === "class" && course && (
        <motion.div
          className="page"
          key="class"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
        >
          <button className="back-btn" onClick={goHome}>
            ← Back to classes
          </button>
          <div className="page-header">
            <h2>{course.title}</h2>
            <p>{course.tagline}</p>
          </div>
          <div className="section-title">Units</div>
          <motion.div
            className="cards-grid"
            variants={gridVariants}
            initial="initial"
            animate="animate"
          >
            {course.units.map((unit) => {
              const stats = currentClass
                ? getUnitStats(progress, currentClass, unit.id)
                : defaultUnitStats();
              return (
                <motion.button
                  type="button"
                  className="card"
                  key={unit.id}
                  onClick={() => openUnit(unit)}
                  variants={cardVariants}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="card-top">
                    <span className="card-text">
                      <span className="card-title">{unit.title}</span>
                      <span className="card-desc">{unit.desc}</span>
                    </span>
                    <Ring percent={stats.masteryScore} />
                  </span>
                  <span className="last-visited">
                    {stats.lastVisited
                      ? `Last practiced ${relativeTime(stats.lastVisited)}`
                      : "Not started yet"}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* ===================== UNIT ===================== */}
      {view === "unit" && course && currentUnit && (
        <motion.div
          className="page"
          key="unit"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
        >
          <div className="unit-view-header">
            <button className="back-btn" onClick={goBackToClass}>
              ← Back to units
            </button>
            <div className="unit-tab-bar" role="tablist" aria-label="Study mode">
              {(["chat", "practice"] as UnitView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  id={`unit-tab-${v}`}
                  aria-selected={unitView === v}
                  aria-controls={`unit-panel-${v}`}
                  tabIndex={unitView === v ? 0 : -1}
                  className={"unit-tab" + (unitView === v ? " active" : "")}
                  onClick={() => setUnitView(v)}
                  onKeyDown={onUnitTabKeyDown}
                >
                  {v === "chat" ? "Chat Tutor" : "Practice Quiz"}
                </button>
              ))}
            </div>
          </div>

          {/* ---------- Chat view ---------- */}
          {unitView === "chat" && (
            <div
              className="chat-container"
              role="tabpanel"
              id="unit-panel-chat"
              aria-labelledby="unit-tab-chat"
            >
              <div className="mode-controls">
                <div className="mode-group" role="group" aria-label="Tutor mode">
                  <span className="control-label" aria-hidden="true">Mode:</span>
                  {(
                    [
                      ["tutor", "Socratic Tutor"],
                      ["checker", "Solution Checker"],
                      ["teach", "Teach the Tutor"],
                    ] as [Mode, string][]
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      className={"mode-btn" + (mode === m ? " active" : "")}
                      onClick={() => handleModeChange(m)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mode-group" role="group" aria-label="Difficulty">
                  <span className="control-label" aria-hidden="true">Difficulty:</span>
                  {(["warmup", "standard", "challenge"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={difficulty === d}
                      className={"diff-btn" + (difficulty === d ? " active" : "")}
                      onClick={() => setDifficulty(d)}
                    >
                      {d === "warmup" ? "Warm-up" : d === "standard" ? "Standard" : "Challenge"}
                    </button>
                  ))}
                </div>
                <div className="chat-header-actions">
                  <button className="reset-btn" onClick={exportTranscript}>
                    Export
                  </button>
                  <button className="reset-btn" onClick={resetChat}>
                    New chat
                  </button>
                </div>
              </div>

              {/* aria-busy holds the announcement until the streamed reply is complete,
                  instead of reading it out chunk by chunk. */}
              <div
                className="messages"
                role="log"
                aria-live="polite"
                aria-label="Conversation with the tutor"
                aria-busy={isStreaming}
              >
                <div className="message tutor">
                  {mode === "teach" ? (
                    <>
                      <p>
                        Your turn to teach! I&apos;m a curious student learning{" "}
                        <strong>{currentUnit.title}</strong>. Explain a concept and
                        I&apos;ll ask questions, poke at the fuzzy parts, and
                        (sometimes) get it a little wrong so you can set me straight.
                      </p>
                      <p>Start by explaining something, then I&apos;ll dig in.</p>
                    </>
                  ) : (
                    <>
                      <p>
                        Hi! I&apos;m your Socratic tutor for{" "}
                        <strong>{currentUnit.title}</strong>. I&apos;ll guide you
                        through problems with hints instead of handing over answers.
                      </p>
                      <p>Pick a starter prompt below or type a question to begin.</p>
                    </>
                  )}
                </div>

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={"message " + (m.role === "user" ? "user" : "tutor")}
                  >
                    {m.role === "assistant" ? (
                      m.content ? (
                        <Markdown className="md">{m.content}</Markdown>
                      ) : isStreaming && i === messages.length - 1 ? (
                        <div className="typing-dots">
                          <span aria-hidden="true"></span>
                          <span aria-hidden="true"></span>
                          <span aria-hidden="true"></span>
                          <span className="sr-only">Tutor is thinking</span>
                        </div>
                      ) : (
                        <p></p>
                      )
                    ) : (
                      <>
                        {m.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- user-supplied base64 data URL, not a static asset
                          <img className="message-image" src={m.image} alt="Attached work" />
                        )}
                        {m.content && (
                          <p style={{ whiteSpace: "pre-wrap" }}>{m.content}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 0 && (
                <div className="starter-prompts">
                  {getStarterPrompts(mode, currentUnit).map((p) => (
                    <button
                      key={p}
                      className="starter-chip"
                      onClick={() => setInput(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <div className="hint-controls">
                <button
                  className="hint-btn"
                  onClick={() => requestHint("smaller")}
                  disabled={isStreaming}
                >
                  Smaller hint
                </button>
                <button
                  className="hint-btn"
                  onClick={() => requestHint("bigger")}
                  disabled={isStreaming}
                >
                  Bigger hint
                </button>
                <button
                  className="hint-btn"
                  onClick={showAnswer}
                  disabled={isStreaming || hintsUsed < 2}
                  title={hintsUsed < 2 ? "Try 2 hints first" : "Show the full answer"}
                >
                  Show me the answer
                </button>
                <button
                  className="hint-btn solved"
                  onClick={markSolved}
                  disabled={isStreaming}
                >
                  ✓ I solved it
                </button>
                <button
                  className="hint-btn"
                  onClick={newProblem}
                  disabled={isStreaming}
                >
                  New problem
                </button>
              </div>

              {pendingImage && (
                <div className="attach-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local base64 preview */}
                  <img src={pendingImage} alt="Attachment preview" />
                  <button
                    className="attach-remove"
                    onClick={() => setPendingImage(null)}
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="input-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => readImageFile(e, setPendingImage)}
                />
                <button
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  title="Attach an image (e.g. your handwritten work)"
                  aria-label="Attach an image"
                >
                  📎
                </button>
                <textarea
                  aria-label="Message the tutor"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <button
                  className="send-btn"
                  onClick={onSend}
                  disabled={isStreaming || (!input.trim() && !pendingImage)}
                  aria-label={isStreaming ? "Tutor is replying" : "Send"}
                >
                  {isStreaming ? "…" : "Send"}
                </button>
              </div>
            </div>
          )}

          {/* ---------- Practice view ---------- */}
          {unitView === "practice" && (
            <div role="tabpanel" id="unit-panel-practice" aria-labelledby="unit-tab-practice">
              <div className="quiz-topbar">
                <div className="quiz-pill-group" role="group" aria-label="Question type">
                  {(["mcq", "frq"] as PracticeMode[]).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      aria-pressed={practiceMode === pm}
                      aria-label={pm === "mcq" ? "Multiple choice" : "Free response"}
                      className={"quiz-pill-btn" + (practiceMode === pm ? " active" : "")}
                      onClick={() => switchPracticeMode(pm)}
                    >
                      {pm.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="quiz-pill-group" role="group" aria-label="Difficulty">
                  {(["warmup", "standard", "challenge"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={practiceDiff === d}
                      className={"quiz-pill-btn" + (practiceDiff === d ? " active" : "")}
                      onClick={() => switchPracticeDiff(d)}
                    >
                      {d === "warmup" ? "Warm-up" : d === "standard" ? "Standard" : "Challenge"}
                    </button>
                  ))}
                </div>
                <div className="quiz-score-area">
                  <span className="quiz-score-label">{quizScoreLabel}</span>
                  <div className="quiz-score-track">
                    <div
                      className="quiz-score-fill"
                      style={{ transform: `translateX(${quizScorePct - 100}%)` }}
                    />
                  </div>
                </div>
              </div>

              {/* Start card — shown before the first question of a session. */}
              {quizPhase === "idle" && (
                <div className="quiz-start-card">
                  <h2>Ready to practice?</h2>
                  <p>
                    Test your knowledge with AI-generated {practiceMode.toUpperCase()}{" "}
                    questions unique to this unit, grounded in your syllabus.
                  </p>
                  <button className="quiz-begin-btn" onClick={fetchQuestion}>
                    Start Practice →
                  </button>
                  {quizError && <p className="quiz-error">{quizError}</p>}
                </div>
              )}

              {/* Loading a new question. */}
              {quizPhase === "loading" && (
                <div className="quiz-loading-state">
                  <span className="quiz-spinner" />
                  <p>Generating your {practiceMode.toUpperCase()} question...</p>
                </div>
              )}

              {/* MCQ card. */}
              {practiceMode === "mcq" && mcq && quizPhase !== "loading" && (
                <div className="quiz-card">
                  <div className="quiz-q-meta">
                    <span className="quiz-q-num">Q{quizNum}</span>
                    <span className="quiz-q-dot" />
                    <span className="quiz-q-topic">{currentUnit.title}</span>
                  </div>
                  <Markdown className="quiz-question">{mcq.question}</Markdown>
                  <div className="quiz-choices">
                    {(["A", "B", "C", "D"] as ChoiceLetter[]).map((letter) => {
                      let cls = "quiz-choice";
                      if (mcqPicked) {
                        if (letter === mcq.correct) cls += " correct";
                        else if (letter === mcqPicked) cls += " incorrect";
                      }
                      return (
                        <button
                          key={letter}
                          className={cls}
                          disabled={!!mcqPicked}
                          onClick={() => handleMcqChoice(letter)}
                        >
                          <span className="quiz-choice-ltr">{letter}</span>
                          <Markdown inline className="quiz-choice-text">
                            {mcq.choices[letter]}
                          </Markdown>
                        </button>
                      );
                    })}
                  </div>

                  {mcqPicked && (
                    <div
                      className={
                        "quiz-feedback " +
                        (mcqPicked === mcq.correct ? "correct" : "incorrect")
                      }
                    >
                      <div className="quiz-feedback-verdict">
                        {mcqPicked === mcq.correct
                          ? "✓ Correct!"
                          : `✗ Incorrect. The answer was ${mcq.correct}.`}
                      </div>
                      {mcq.explanation && <Markdown>{mcq.explanation}</Markdown>}
                    </div>
                  )}

                  {mcqPicked && (
                    <div className="quiz-action-row">
                      <button className="quiz-next-btn" onClick={fetchQuestion}>
                        Next question →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FRQ card. */}
              {practiceMode === "frq" && frqQuestion && quizPhase !== "loading" && (
                <div className="quiz-card">
                  <div className="quiz-q-meta">
                    <span className="quiz-q-num">Q{quizNum}</span>
                    <span className="quiz-q-dot" />
                    <span className="quiz-q-topic">{currentUnit.title}</span>
                  </div>
                  <Markdown className="quiz-question">{frqQuestion}</Markdown>

                  {!frqFeedback && (
                    <>
                      <label className="quiz-frq-label" htmlFor="frq-answer">
                        Your Response
                      </label>
                      <textarea
                        id="frq-answer"
                        className="quiz-frq-textarea"
                        value={frqAnswer}
                        onChange={(e) => setFrqAnswer(e.target.value)}
                        placeholder="Show all work. Include equations, steps, and units... or attach a photo of your handwritten work."
                        disabled={quizPhase === "grading"}
                      />

                      <input
                        ref={frqFileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => readImageFile(e, setFrqImage)}
                      />
                      {frqImage && (
                        <div className="attach-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element -- local base64 preview */}
                          <img src={frqImage} alt="Attached work preview" />
                          <button
                            className="attach-remove"
                            onClick={() => setFrqImage(null)}
                            title="Remove image"
                            aria-label="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className="quiz-action-row">
                        <button
                          className="attach-btn"
                          onClick={() => frqFileInputRef.current?.click()}
                          disabled={quizPhase === "grading"}
                          title="Attach a photo of your handwritten work"
                          aria-label="Attach an image"
                        >
                          📎
                        </button>
                        <button
                          className="quiz-submit-btn"
                          onClick={submitFrq}
                          disabled={quizPhase === "grading"}
                        >
                          {quizPhase === "grading" ? "Grading..." : "Submit for Grading"}
                        </button>
                      </div>
                    </>
                  )}

                  {frqFeedback && (
                    <>
                      {frqImage && (
                        // eslint-disable-next-line @next/next/no-img-element -- user-supplied base64 data URL
                        <img className="message-image" src={frqImage} alt="Your submitted work" />
                      )}
                      <Markdown className="quiz-frq-feedback">{frqFeedback}</Markdown>
                      <div className="quiz-action-row">
                        <button className="quiz-next-btn" onClick={fetchQuestion}>
                          Next question →
                        </button>
                      </div>
                    </>
                  )}
                  {quizError && <p className="quiz-error">{quizError}</p>}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="session-toast"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={{ duration: 0.25 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="app-footer">
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Terms</Link>
        <span aria-hidden="true">·</span>
        <button type="button" className="footer-link-btn" onClick={() => setDeleteOpen(true)} aria-haspopup="dialog">
          Delete account
        </button>
      </footer>

      <DeleteAccountDialog
        open={deleteOpen}
        email={email}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void finishAccountDeletion()}
      />

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        email={email}
        activeId={conversationId}
        onOpenChat={resumeConversation}
        onDeleted={onChatDeleted}
      />

      {/* Weekly-goal editor (Milestone 3). */}
      <AnimatePresence>
        {goalModalOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setGoalModalOpen(false);
            }}
          >
            <motion.div
              ref={goalDialogRef}
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="goal-dialog-title"
              aria-describedby="goal-dialog-desc"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <h3 id="goal-dialog-title">Weekly goal</h3>
              <p className="modal-sub" id="goal-dialog-desc">
                How many study sessions per week are you aiming for? (A session = 1+
                problems attempted.)
              </p>
              <input
                type="number"
                aria-label="Sessions per week"
                className="goal-input"
                min={1}
                max={14}
                value={goalDraft}
                onChange={(e) => setGoalDraft(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGoal();
                }}
              />
              <div className="modal-actions">
                <button className="modal-btn" onClick={() => setGoalModalOpen(false)}>
                  Cancel
                </button>
                <button className="modal-btn primary" onClick={saveGoal}>
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session recap (Milestone 3) — shown when leaving a unit you practiced in. */}
      <AnimatePresence>
        {recap && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setRecap(null);
            }}
          >
            <motion.div
              ref={recapDialogRef}
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recap-dialog-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <h3 id="recap-dialog-title">Session recap</h3>
              <p className="modal-sub">
                {recap.unitTitle} · {recap.courseTitle}
              </p>
              <div className="recap-grid">
                <div className="recap-tile">
                  <div className="recap-tile-value">{recap.minutes} min</div>
                  <div className="recap-tile-label">Time</div>
                </div>
                <div className="recap-tile">
                  <div className="recap-tile-value">{recap.attempted}</div>
                  <div className="recap-tile-label">
                    Problem{recap.attempted === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="recap-tile">
                  <div className="recap-tile-value">{recap.solved}</div>
                  <div className="recap-tile-label">Solved</div>
                </div>
                <div className="recap-tile">
                  <div className="recap-tile-value">{recap.hints}</div>
                  <div className="recap-tile-label">Hints used</div>
                </div>
              </div>
              <div className="recap-mastery-row">
                <div className="recap-mastery-delta">
                  {recap.delta >= 0 ? "+" : ""}
                  {recap.delta}
                </div>
                <div className="recap-mastery-text">
                  Mastery now <strong>{recap.mastery}</strong> / 100
                  {recap.delta > 0 ? ". Keep it up." : ""}
                </div>
              </div>
              <div className="modal-actions">
                <button className="modal-btn primary" onClick={() => setRecap(null)}>
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
