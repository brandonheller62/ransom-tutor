"use client";

import { useState } from "react";
import {
  classes,
  starterPromptsByUnit,
  type CourseKey,
  type Unit,
} from "@/lib/courses";

type View = "home" | "class" | "unit";
type Mode = "tutor" | "checker";
type Difficulty = "warmup" | "standard" | "challenge";
type UnitView = "chat" | "practice";
type PracticeMode = "mcq" | "frq";

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

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  // The AI behaviors aren't wired up yet — they need the Anthropic API backend.
  const SOON =
    "The AI tutor isn't connected yet — that's the next build step (Anthropic API + your RAG retrieval).";

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
    setView("unit");
  }

  function goBackToClass() {
    setView("class");
    setCurrentUnit(null);
  }

  const course = currentClass ? classes[currentClass] : null;

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

      {/* ===================== HOME ===================== */}
      {view === "home" && (
        <div className="page">
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
          <div className="cards-grid">
            {(Object.keys(classes) as CourseKey[]).map((key) => {
              const c = classes[key];
              return (
                <div className="card" key={key} onClick={() => openClass(key)}>
                  <div className="card-icon">{c.icon}</div>
                  <div className="card-title">{c.title}</div>
                  <div className="card-desc">{c.desc}</div>
                  <div className="card-meta">
                    <span>{c.units.length} units</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== CLASS ===================== */}
      {view === "class" && course && (
        <div className="page">
          <button className="back-btn" onClick={goHome}>
            ← Back to classes
          </button>
          <div className="page-header">
            <h2>{course.title}</h2>
            <p>{course.tagline}</p>
          </div>
          <div className="section-title">Units</div>
          <div className="cards-grid">
            {course.units.map((unit) => (
              <div className="card" key={unit.id} onClick={() => openUnit(unit)}>
                <div className="card-top">
                  <div className="card-text">
                    <div className="card-title">{unit.title}</div>
                    <div className="card-desc">{unit.desc}</div>
                  </div>
                  <Ring percent={0} />
                </div>
                <div className="last-visited">Not started yet</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== UNIT ===================== */}
      {view === "unit" && course && currentUnit && (
        <div className="page">
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
              <div className="chat-header">
                <div className="chat-header-info">
                  <h3>{currentUnit.title}</h3>
                  <p>{course.title}</p>
                </div>
                <div className="chat-header-actions">
                  <button className="reset-btn" onClick={() => showToast(SOON)}>
                    Export
                  </button>
                  <button className="reset-btn" onClick={() => showToast(SOON)}>
                    Reset
                  </button>
                </div>
              </div>

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
              </div>

              <div className="messages">
                <div className="message tutor">
                  <p>
                    Hi! I&apos;m your Socratic tutor for{" "}
                    <strong>{currentUnit.title}</strong>. I&apos;ll guide you
                    through problems with hints instead of handing over answers.
                  </p>
                  <p>
                    Pick a starter prompt below or type a question to begin.
                  </p>
                </div>
                <div className="notice">
                  ⚙️ Preview build: the interface is live, but the AI responses
                  aren&apos;t connected yet. That&apos;s the next step — an API
                  route that calls the Anthropic API and pulls grounding context
                  from your Supabase RAG store.
                </div>
              </div>

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

              <div className="hint-controls">
                <button className="hint-btn" onClick={() => showToast(SOON)}>
                  Smaller hint
                </button>
                <button className="hint-btn" onClick={() => showToast(SOON)}>
                  Bigger hint
                </button>
                <button className="hint-btn" disabled title="Try 2 hints first">
                  Show me the answer
                </button>
                <button className="hint-btn solved" onClick={() => showToast(SOON)}>
                  ✓ I solved it
                </button>
                <button className="hint-btn" onClick={() => showToast(SOON)}>
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
                      showToast(SOON);
                    }
                  }}
                />
                <button className="send-btn" onClick={() => showToast(SOON)}>
                  Send
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
        </div>
      )}

      {toast && <div className="session-toast">{toast}</div>}
    </div>
  );
}
