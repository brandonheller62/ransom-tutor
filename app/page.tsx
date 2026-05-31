"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  classes,
  starterPromptsByUnit,
  type CourseKey,
  type Unit,
} from "@/lib/courses";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  // Practice quizzes (Milestone 2) and progress (Milestone 3) aren't wired yet.
  const SOON =
    "Practice quizzes are the next build step. The chat tutor below is fully working.";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function goHome() {
    setView("home");
    setCurrentClass(null);
    setCurrentUnit(null);
  }

  function openClass(key: CourseKey) {
    setCurrentClass(key);
    setView("class");
  }

  function openUnit(unit: Unit) {
    setCurrentUnit(unit);
    setUnitView("chat");
    setInput("");
    resetChat();
    setView("unit");
  }

  function goBackToClass() {
    setView("class");
    setCurrentUnit(null);
  }

  function resetChat() {
    setMessages([]);
    setHintsUsed(0);
    setIsStreaming(false);
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
    sendUserText(input);
  }

  // Hint buttons send canned requests and count toward the "show answer" gate.
  function requestHint(kind: "smaller" | "bigger") {
    if (isStreaming) return;
    setHintsUsed((n) => n + 1);
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
            <div className="stat" title="Longest streak: 0 days">
              <div className="stat-icon flame">🔥</div>
              <div className="stat-body">
                <div className="stat-value">0 days</div>
                <div className="stat-label">Streak</div>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat" style={{ flex: 1, minWidth: 200 }}>
              <div className="stat-icon">🎯</div>
              <div className="stat-body" style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="stat-value">0 / 3 sessions</span>
                </div>
                <div className="goal-bar-track">
                  <div className="goal-bar-fill" style={{ width: "0%" }} />
                </div>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-icon">📚</div>
              <div className="stat-body">
                <div className="stat-value">0</div>
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
            {course.units.map((unit) => (
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
                  <Ring percent={0} />
                </div>
                <div className="last-visited">Not started yet</div>
              </motion.div>
            ))}
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
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {m.content ||
                        (isStreaming && i === messages.length - 1 ? "…" : "")}
                    </p>
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

              <div className="input-area">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer or thought..."
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
                  disabled={isStreaming || !input.trim()}
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
                      onClick={() => setPracticeMode(pm)}
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
                  <span className="quiz-score-label">0 / 0</span>
                  <div className="quiz-score-track">
                    <div className="quiz-score-fill" style={{ width: "0%" }} />
                  </div>
                </div>
              </div>

              <div className="quiz-start-card">
                <h2>Ready to practice?</h2>
                <p>
                  Test your knowledge with AI-generated {practiceMode.toUpperCase()}{" "}
                  questions unique to this unit.
                </p>
                <button className="quiz-begin-btn" onClick={() => showToast(SOON)}>
                  Start Practice →
                </button>
              </div>
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
    </div>
  );
}
