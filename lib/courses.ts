/**
 * lib/courses.ts
 *
 * Course content for the Socratic Tutor, ported from the HTML prototype's
 * `classes` and `starterPromptsByUnit` objects. The `syllabus` text is kept
 * because it feeds the tutor's system prompt later (and overlaps with the RAG
 * content in Supabase).
 */

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
  syllabus: string;
  units: Unit[];
}

export type CourseKey = "physics" | "datascience";

export const classes: Record<CourseKey, Course> = {
  physics: {
    title: "Advanced Physics: Mechanics",
    icon: "⚛︎",
    desc: "Algebra-based mechanics covering kinematics, forces, energy, momentum, fluids, and waves.",
    tagline:
      "Newtonian mechanics with rigorous problem-solving and real-world applications.",
    syllabus: "(Syllabus text removed from the public repo.)",
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
    syllabus: "(Syllabus text removed from the public repo.)",
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
};
