/**
 * lib/courses.ts
 *
 * Course content for the Socratic Tutor, ported from the HTML prototype's
 * `classes` and `starterPromptsByUnit` objects. Syllabus text is not kept in
 * the repo: the tutor gets it from the RAG chunks in Supabase (see lib/retrieve.ts).
 */

import type { Mode } from "./prompts";

export interface Unit {
  id: string;
  title: string;
  desc: string;
}

export interface Course {
  title: string;
  icon: string;
  desc: string;
  tagline: string;
  units: Unit[];
}

export type CourseKey =
  | "physics"
  | "datascience"
  | "quantfinance"
  | "digitalnarrative"
  | "advancedml";

export const classes: Record<CourseKey, Course> = {
  physics: {
    title: "Advanced Physics: Mechanics",
    icon: "⚛︎",
    desc: "Algebra-based mechanics covering kinematics, forces, energy, momentum, fluids, and waves.",
    tagline:
      "Newtonian mechanics with rigorous problem-solving and real-world applications.",
    units: [
      { id: "p1", title: "Conversions & Measurements", desc: "Units, dimensional analysis, significant figures, and uncertainty." },
      { id: "p2", title: "Vectors and Scalars", desc: "Vector components, addition, and decomposition in 2D." },
      { id: "p3", title: "Kinematics (1-D & 2-D)", desc: "Motion with constant acceleration, projectile motion, and relative velocity." },
      { id: "p4", title: "Forces and Newton's Laws", desc: "Free-body diagrams, friction, tension, and inclined planes." },
      { id: "p5", title: "Work & Energy", desc: "Work-energy theorem, conservation of energy, and power." },
      { id: "p6", title: "Momentum & Collisions", desc: "Impulse, conservation of momentum, elastic and inelastic collisions." },
      { id: "p7", title: "Circular Motion & Gravitation", desc: "Centripetal acceleration, orbits, and Newton's law of gravitation." },
      { id: "p8", title: "Simple Harmonic Motion", desc: "Springs, pendulums, and oscillatory motion." },
      { id: "p9", title: "Fluids", desc: "Pressure, buoyancy, Bernoulli's equation, and fluid dynamics." },
      { id: "p10", title: "Waves & Sound", desc: "Wave properties, superposition, standing waves, and the Doppler effect." },
    ],
  },
  datascience: {
    title: "Applied Data Science",
    icon: "◎",
    desc: "Python-based data analysis, visualization, and machine learning with real-world datasets.",
    tagline: "From pandas and plotting to scikit-learn and capstone projects.",
    units: [
      { id: "d1", title: "Unit 1: Intro to Data Science Principles", desc: "Foundational concepts, the data science workflow, and Python basics." },
      { id: "d2", title: "Unit 2: Data Analysis with Python", desc: "Pandas, NumPy, data cleaning, and exploratory analysis." },
      { id: "d3", title: "Unit 3: Plotting, Charting & Data Representation", desc: "Matplotlib, Seaborn, and effective chart construction in Python." },
      { id: "d4", title: "Unit 4: Storytelling with Data", desc: "Visualization principles, narrative structure, and communicating insights." },
      { id: "d5", title: "Unit 5: Interactive Python Dashboards", desc: "Building interactive visualizations and dashboards." },
      { id: "d6", title: "Unit 6: Applied Machine Learning in Python", desc: "scikit-learn, supervised learning, model evaluation, and tuning." },
      { id: "d7", title: "Unit 7: RE Project", desc: "Interdisciplinary data project focused on Ransom Everglades." },
      { id: "d8", title: "Unit 8: Kaggle Competitions", desc: "Competitive ML, feature engineering, and collaborative problem-solving." },
      { id: "d9", title: "Unit 9: Final Project", desc: "Semester-long capstone on a topic of your choice." },
    ],
  },
  quantfinance: {
    title: "Quantitative Finance & AI",
    icon: "↗",
    desc: "How markets convert uncertainty into prices: portfolio theory, valuation, derivatives, and machine learning on financial data.",
    tagline: "Finance as an applied mathematical discipline, from DCF models to AI trading strategies.",
    units: [
      { id: "q1", title: "Financial Instruments & Markets", desc: "The language of finance: markets, market sectors, trading, and reporting." },
      { id: "q2", title: "Funding a Business", desc: "Equity, bonds, loans, venture capital, and private equity; cost of capital, dilution, seniority, and leverage." },
      { id: "q3", title: "How a Business Makes Money", desc: "Financial statements: revenue, margins, operating leverage, cash flow, working capital, and macro forces." },
      { id: "q4", title: "Valuation & the DCF Model", desc: "Discounted cash flow, discount rates, terminal value, scenario analysis, and portfolio return attribution." },
      { id: "q5", title: "Bonds, Credit & Interest Rates", desc: "Yield math, duration, convexity, credit spreads, default risk, and building a bond pricing model." },
      { id: "q6", title: "Derivatives & Options Pricing", desc: "Calls, puts, futures, volatility, the Greeks, dynamic hedging, and Black-Scholes." },
      { id: "q7", title: "Quant Investing & AI", desc: "Factor investing, regression and classification signals, NLP sentiment, LLMs, backtesting, and model risk." },
    ],
  },
  digitalnarrative: {
    title: "Digital Narrative",
    icon: "✎",
    desc: "Critical analysis of video games and interactive storytelling, from game studies theory to building your own Twine fiction.",
    tagline: "How the affordances of digital media reshape the spectrum of narrative expression.",
    units: [
      { id: "n1", title: "Game Studies", desc: "Close-reading interactive media: affordances, critical frameworks from Murray, Bogost, and Anthropy, and the video essay." },
      { id: "n2", title: "Interactive Fiction", desc: "Designing and building a branching Twine story: worldbuilding, player agency, immersion, and scope." },
    ],
  },
  advancedml: {
    title: "Advanced Machine Learning",
    icon: "⟡",
    desc: "From reproducible data pipelines and supervised learning to ensembles, NLP, LLM internals, and a human-centered capstone.",
    tagline: "Hands-on ML and generative AI: build, tune, explain, and ship portfolio-ready projects.",
    units: [
      { id: "m1", title: "Unit 1: ML Primer & Data Pipeline", desc: "Reproducible data workflows, EDA, pandas/NumPy, and scikit-learn pipelines." },
      { id: "m2", title: "Unit 2: Core Supervised Algorithms", desc: "Linear and logistic regression, kNN, decision trees, cross-validation, and evaluation metrics." },
      { id: "m3", title: "Unit 3: Tabular ML Power-Ups", desc: "Ensembles, feature engineering, hyperparameter optimization, and SHAP interpretability + EOS project." },
      { id: "m4", title: "Unit 4: NLP Foundations", desc: "Tokenization, TF-IDF vs. embeddings, text classification metrics, and ethics." },
      { id: "m5", title: "Unit 5: Inside Generative AI", desc: "Neural nets, backpropagation, attention, LLM internals, and informed prompt engineering." },
      { id: "m6", title: "Unit 6: Capstone & Portfolio", desc: "Human-centered stakeholder ML project: scope, build, validate, explain, and present." },
    ],
  },
};

export const starterPromptsByUnit: Record<string, string[]> = {
  p1: ["Give me a unit conversion problem", "Quiz me on significant figures", "Explain dimensional analysis", "Why do we use SI units?"],
  p2: ["Give me a vector addition problem", "How do I decompose a vector into components?", "Practice problem with vector subtraction", "What is the difference between a scalar and vector?"],
  p3: ["Give me a kinematics problem", "Quiz me on projectile motion", "Practice with the kinematic equations", "Explain relative velocity"],
  p4: ["Give me a free-body diagram problem", "Practice with friction", "Inclined plane problem please", "Explain Newton's third law"],
  p5: ["Give me a work-energy problem", "Quiz me on conservation of energy", "Practice with the work-energy theorem", "Explain the difference between work and power"],
  p6: ["Give me a momentum problem", "Practice with elastic collisions", "Quiz me on impulse", "Explain conservation of momentum"],
  p7: ["Give me a circular motion problem", "Practice with centripetal force", "Orbital mechanics problem please", "Derive the formula for centripetal acceleration"],
  p8: ["Give me a SHM problem", "Practice with springs and Hooke's law", "Quiz me on pendulum motion", "Explain why SHM happens"],
  p9: ["Give me a buoyancy problem", "Practice with Bernoulli's equation", "Pressure problem please", "Explain Pascal's principle"],
  p10: ["Give me a wave problem", "Practice with the Doppler effect", "Quiz me on standing waves", "Explain superposition"],
  d1: ["What is the data science workflow?", "Explain the difference between supervised and unsupervised learning", "Give me a Python practice problem", "What is the role of statistics in DS?"],
  d2: ["Give me a pandas DataFrame problem", "Practice with groupby operations", "How do I handle missing data?", "Quiz me on NumPy basics"],
  d3: ["Give me a matplotlib challenge", "When should I use a bar chart vs line chart?", "Practice with seaborn", "Explain figure vs axes in matplotlib"],
  d4: ["What makes a chart misleading?", "Critique a visualization for me", "Practice telling a story with data", "Explain the principles of good viz design"],
  d5: ["Help me think through a dashboard design", "Plotly vs Dash, what is the difference?", "Give me an interactive viz challenge", "Practice with widget callbacks"],
  d6: ["Give me a classification problem", "Practice with train/test splits", "Quiz me on overfitting", "How do I choose a model?"],
  d7: ["Help me brainstorm a project on RE data", "What questions could I ask about RE?", "How do I scope a data project?", "Practice with project planning"],
  d8: ["Give me Kaggle competition strategy tips", "Practice with feature engineering", "How do I avoid leakage?", "Explain ensemble methods"],
  d9: ["Help me scope my final project", "How do I present data findings?", "Practice with project planning", "What makes a good capstone?"],
  q1: ["Quiz me on types of financial instruments", "Explain how a stock trade actually settles", "What are the major market sectors?", "Why does quantitative finance matter in a digital world?"],
  q2: ["Compare debt vs. equity financing for me", "Quiz me on dilution and seniority", "Explain how venture capital differs from private equity", "Give me a cost of capital problem"],
  q3: ["Give me a break-even analysis problem", "Explain operating leverage vs. financial leverage", "Quiz me on the three financial statements", "How does central bank policy move markets?"],
  q4: ["Walk me through building a DCF", "Give me a present value problem", "Quiz me on discount rates and terminal value", "Explain return attribution"],
  q5: ["Give me a bond pricing problem", "Explain duration and convexity", "Quiz me on credit spreads", "How do lenders price default risk?"],
  q6: ["Give me an options payoff problem", "Explain the Greeks one by one", "Quiz me on Black-Scholes inputs", "How does dynamic hedging work?"],
  q7: ["Explain factor investing", "Give me a regression-based signal problem", "Quiz me on backtesting pitfalls", "How can LLMs extract trading signals from text?"],
  n1: ["What are the affordances of digital media?", "Help me close-read a game I'm playing", "Quiz me on Murray's ideas in Hamlet on the Holodeck", "How do I structure a video essay argument?"],
  n2: ["Help me brainstorm my Twine story", "How do branching narratives create agency?", "Practice scoping my interactive fiction", "What makes player choices feel meaningful?"],
  m1: ["Give me a data cleaning challenge", "Explain scikit-learn pipelines", "Quiz me on EDA techniques", "Why do reproducible workflows matter?"],
  m2: ["Give me a bias-variance question", "Practice choosing evaluation metrics", "Quiz me on cross-validation", "When does logistic regression beat a decision tree?"],
  m3: ["Explain why ensembles win on tabular data", "Give me a feature engineering challenge", "Quiz me on SHAP values", "Practice hyperparameter tuning strategy"],
  m4: ["Explain TF-IDF vs. embeddings", "Give me a text classification problem", "Quiz me on tokenization", "When is a simple NLP model good enough?"],
  m5: ["Explain backpropagation step by step", "Quiz me on attention and context windows", "Where do hallucinations come from?", "Practice designing a few-shot prompt"],
  m6: ["Help me scope my capstone project", "How do I communicate model limitations?", "Quiz me on what makes work portfolio-ready", "Practice explaining my model to a stakeholder"],
};

/** Unit title without the data-science "Unit N:" prefix, for splicing into sentences. */
function unitTopic(unit: Unit): string {
  return unit.title.replace(/^Unit \d+:\s*/, "");
}

/**
 * Starter chips for the chat view. Tutor mode keeps the hand-written per-unit
 * questions in `starterPromptsByUnit`; checker and teach get mode-generic
 * openers spliced with the unit topic, because student-phrased "Give me a
 * problem" chips read wrong when the student is submitting work to be checked
 * or playing the teacher.
 */
export function getStarterPrompts(mode: Mode, unit: Unit): string[] {
  const topic = unitTopic(unit);
  if (mode === "checker") {
    return [
      `Can you check my solution to a ${topic} problem?`,
      "I'll paste my work, tell me if each step is right",
      "I got a different answer than expected, help me find my mistake",
      `What mistakes are most common in ${topic}?`,
    ];
  }
  if (mode === "teach") {
    return [
      `Let me explain ${topic} to you`,
      `I'll walk you through solving a ${topic} problem`,
      `Ask me a question about ${topic} and I'll answer as your teacher`,
      `I'll teach you the trickiest part of ${topic}`,
    ];
  }
  return starterPromptsByUnit[unit.id] ?? [];
}
