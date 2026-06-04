"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Markdown } from "./Markdown";
import {
  classes,
  starterPromptsByUnit,
  type CourseKey,
  type Unit,
} from "@/lib/courses";
import {
  type Progress,
  defaultProgress,
  loadProgress,
  saveProgress,
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
type Mode = "tutor" | "checker";
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
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 44 44">
        <circle className="ring-track" cx="22" cy="22" r={r} />
        <circle
          className="ring-fill"
          cx="22"
          cy="22"
          r={r}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className={"ring-label" + (complete ? " complete" : "")}>
        {complete ? "✓" : percent}
      </div>
    </div>
  );
}

export default function Home() {
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

  // Progress engine (Milestone 3) — local to this device via localStorage.
  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const sessionRef = useRef<StudySession | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState(3);
  const [recap, setRecap] = useState<RecapData | null>(null);

  // Hydrate from localStorage after mount. This MUST be an effect (not a lazy
  // initializer): localStorage is unavailable during SSR, so reading it at init
  // would desync server/client HTML. Setting state once on mount is the correct
  // pattern here, hence the targeted lint suppression.
  useEffect(() => {
    const p = loadProgress();
    rollWeekIfNeeded(p);
    saveProgress(p);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage hydration
    setProgress(p);
  }, []);

  // Apply a mutation to a fresh copy of progress, persist it, and re-render.
  function mutateProgress(fn: (p: Progress) => void) {
    setProgress((prev) => {
      const next: Progress = JSON.parse(JSON.stringify(prev));
      fn(next);
      saveProgress(next);
      return next;
    });
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

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  function goBackToClass() {
    endSession(true);
    setView("class");
    setCurrentUnit(null);
  }

  function resetChat() {
    setMessages([]);
    setHintsUsed(0);
    setIsStreaming(false);
    setPendingImage(null);
  }

  const course = currentClass ? classes[currentClass] : null;

  // Send a turn to the tutor and stream the reply into the last assistant bubble.
  async function callTutor(history: ChatMessage[]) {
    if (!currentClass || !currentUnit) return;
    setIsStreaming(true);
    // Add an empty assistant message we'll fill as tokens stream in.
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          course: currentClass,
          unitId: currentUnit.id,
          mode,
          difficulty,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages([
        ...history,
        { role: "assistant", content: `Sorry, the tutor could not respond. ${msg}` },
      ]);
      showToast(msg);
    } finally {
      setIsStreaming(false);
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
    md += `**Mode:** ${mode === "tutor" ? "Socratic Tutor" : "Solution Checker"}  \n`;
    md += `**Difficulty:** ${difficulty}\n\n---\n\n`;
    for (const m of messages) {
      md += `**${m.role === "user" ? "You" : "Tutor"}:** ${m.content}\n\n`;
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

  // Fetch the next question for the current mode. Used by both "Start Practice"
  // and "Next question".
  async function fetchQuestion() {
    if (!currentClass || !currentUnit) return;
    setQuizError(null);
    setMcq(null);
    setMcqPicked(null);
    setFrqQuestion("");
    setFrqAnswer("");
    setFrqFeedback("");
    setFrqImage(null);
    setQuizPhase("loading");

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: practiceMode,
          course: currentClass,
          unitId: currentUnit.id,
          difficulty: practiceDiff,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);

      setQuizNum((n) => n + 1);
      if (practiceMode === "mcq") {
        setMcq(data.mcq as McqData);
      } else {
        setFrqQuestion(data.frq as string);
      }
      setQuizPhase("active");
    } catch (err) {
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
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grade",
          course: currentClass,
          unitId: currentUnit.id,
          difficulty: practiceDiff,
          question: frqQuestion,
          answer: frqAnswer,
          image: frqImage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setFrqFeedback(data.feedback as string);
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

  return (
    <div className="container">
      <header>
        <div className="header-inner">
          <div className="logo" onClick={goHome}>
            <div className="logo-mark">
              <span className="r-letter">R</span>
              <span className="e-letter">E</span>
            </div>
            <span>Socratic Tutor</span>
          </div>
          <div className="breadcrumbs">
            <a onClick={goHome}>Home</a>
            {course && (
              <>
                <span className="sep">/</span>
                <a onClick={() => openClass(currentClass!)}>{course.title}</a>
              </>
            )}
            {view === "unit" && currentUnit && (
              <>
                <span className="sep">/</span>
                <span>{currentUnit.title}</span>
              </>
            )}
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
                    className="goal-edit-btn"
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
                      width: `${Math.min(
                        100,
                        Math.round(
                          (progress.weeklyGoal.sessionsThisWeek /
                            progress.weeklyGoal.target) *
                            100,
                        ),
                      )}%`,
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
                <motion.div
                  className="card"
                  key={key}
                  onClick={() => openClass(key)}
                  variants={cardVariants}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="card-icon">{c.icon}</div>
                  <div className="card-title">{c.title}</div>
                  <div className="card-desc">{c.desc}</div>
                  <div className="card-meta">
                    <span>{c.units.length} units</span>
                    <span>→</span>
                  </div>
                </motion.div>
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
                <motion.div
                  className="card"
                  key={unit.id}
                  onClick={() => openUnit(unit)}
                  variants={cardVariants}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="card-top">
                    <div className="card-text">
                      <div className="card-title">{unit.title}</div>
                      <div className="card-desc">{unit.desc}</div>
                    </div>
                    <Ring percent={stats.masteryScore} />
                  </div>
                  <div className="last-visited">
                    {stats.lastVisited
                      ? `Last practiced ${relativeTime(stats.lastVisited)}`
                      : "Not started yet"}
                  </div>
                </motion.div>
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
            <div className="unit-tab-bar">
              <button
                className={"unit-tab" + (unitView === "chat" ? " active" : "")}
                onClick={() => setUnitView("chat")}
              >
                Chat Tutor
              </button>
              <button
                className={"unit-tab" + (unitView === "practice" ? " active" : "")}
                onClick={() => setUnitView("practice")}
              >
                Practice Quiz
              </button>
            </div>
          </div>

          {/* ---------- Chat view ---------- */}
          {unitView === "chat" && (
            <div className="chat-container">
              <div className="mode-controls">
                <div className="mode-group">
                  <span className="control-label">Mode:</span>
                  <button
                    className={"mode-btn" + (mode === "tutor" ? " active" : "")}
                    onClick={() => setMode("tutor")}
                  >
                    Socratic Tutor
                  </button>
                  <button
                    className={"mode-btn" + (mode === "checker" ? " active" : "")}
                    onClick={() => setMode("checker")}
                  >
                    Solution Checker
                  </button>
                </div>
                <div className="mode-group">
                  <span className="control-label">Difficulty:</span>
                  {(["warmup", "standard", "challenge"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
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
                    Reset
                  </button>
                </div>
              </div>

              <div className="messages">
                <div className="message tutor">
                  <p>
                    Hi! I&apos;m your Socratic tutor for{" "}
                    <strong>{currentUnit.title}</strong>. I&apos;ll guide you
                    through problems with hints instead of handing over answers.
                  </p>
                  <p>Pick a starter prompt below or type a question to begin.</p>
                </div>

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={"message " + (m.role === "user" ? "user" : "tutor")}
                  >
                    {m.role === "assistant" ? (
                      m.content ? (
                        <Markdown className="md">{m.content}</Markdown>
                      ) : (
                        <p>{isStreaming && i === messages.length - 1 ? "…" : ""}</p>
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
                  {(starterPromptsByUnit[currentUnit.id] ?? []).map((p) => (
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
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer, or attach a photo of your work..."
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
                >
                  {isStreaming ? "…" : "Send"}
                </button>
              </div>
            </div>
          )}

          {/* ---------- Practice view ---------- */}
          {unitView === "practice" && (
            <div>
              <div className="quiz-topbar">
                <div className="quiz-pill-group">
                  {(["mcq", "frq"] as PracticeMode[]).map((pm) => (
                    <button
                      key={pm}
                      className={"quiz-pill-btn" + (practiceMode === pm ? " active" : "")}
                      onClick={() => switchPracticeMode(pm)}
                    >
                      {pm.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="quiz-pill-group">
                  {(["warmup", "standard", "challenge"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      className={"quiz-pill-btn" + (practiceDiff === d ? " active" : "")}
                      onClick={() => setPracticeDiff(d)}
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
                      style={{ width: `${quizScorePct}%` }}
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
                          : `✗ Incorrect — the answer was ${mcq.correct})`}
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
                      <label className="quiz-frq-label">Your Response</label>
                      <textarea
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
              className="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <h3>Weekly goal</h3>
              <p className="modal-sub">
                How many study sessions per week are you aiming for? (A session = 1+
                problems attempted.)
              </p>
              <input
                type="number"
                className="goal-input"
                min={1}
                max={14}
                value={goalDraft}
                onChange={(e) => setGoalDraft(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGoal();
                }}
                autoFocus
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
              className="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
              <h3>Session recap</h3>
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
  );
}
