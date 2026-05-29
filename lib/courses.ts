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
    syllabus:
      "Course: Advanced Physics: Mechanics (SCI 514)\nYear: 2025-2026\nTeacher: Mr. Luis Luis Fayat (lluisfayat@ransomeverglades.org)\nRoom: STEM 105 (Office Hours: STEM 205)\n\nCourse Description: Equivalent to a first-semester, algebra-based college physics course. Covers Newtonian mechanics including kinematics, forces, energy, momentum, fluids, and waves with rigorous conceptual understanding and higher-level mathematics.\n\nAP Physics 1 Note: This course is NOT designed to prepare students for the AP Physics 1 exam. Students may register for the exam but should expect independent study.\n\nGRADING BREAKDOWN (90% of semester grade, EoS assessment is the other 10%):\n- Assessments: 50% (tests, including 1+ multi-unit project per semester counted as a test grade; reassessments available)\n- Labs: 20% (1-2 labs per unit, weekly hands-on work)\n- Quizzes: 20% (check-ins 1-2 times per unit)\n- Assignments: 10% (practice problems, review questions, group work)\n\nTwo semesters and their EoS assessments weigh equally for the final course grade.\n\nRequired Textbook: Physics, Advanced Edition w/WileyPLUS (11th Edition), Cutnell & Johnson (e-book only)\n\nCourse Tools: OneNote, Microsoft Teams, Pivot Interactives, WileyPlus, myCompass\n\nRequired Materials: Pencils/pens/stylus, physical notebook, scientific or graphing calculator, fully charged laptop\n\nPOLICIES:\n- Late assignments: 10% penalty; minimum grade of 50% for completed late work that meets basic expectations\n- Test reassessments: Available for grades below C (73). Must schedule within one week and bring evidence of extra preparation. Grade raised to 73 after instructor review.\n- Missed assessments: Planned absences require prior notification; unexpected absences need prompt communication\n- Cell phones: Collected and stored at start of class, returned at end\n- Flinn Scientific Student Safety Contract required for all labs\n\nAI POLICY (three-tier system):\n- Red (Human-Only Zone): No AI use permitted\n- Yellow (Guided Use Only): AI as assistant, specific components only as defined by instructor\n- Green (Open Use with Accountability): AI as collaborator with full transparency and acknowledgment\n\nCOURSE TOPICS: Conversions and Measurements, Vectors and Scalars, Forces and Newton's Laws, Kinematics (1-D and 2-D), Work and Energy, Momentum and Collisions, Simple Harmonic Motion, Circular Motion and Gravitation, Fluids, Waves and Sound\n\nCONDUCT PRINCIPLES: Be honest and forthright; be present and engaged; be empathetic and understanding; be respectful and considerate; be grateful and positive.",
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
    syllabus:
      "Course: Applied Data Science (2025-2026)\nTeacher: Mr. Eugene Cruz (ecruz@ransomeverglades.org)\nClassroom: STEM 319 (Period 7) or STEM 304 (Period 6)\nOffice: STEM 205\n\nCourse Description: Introduces the emerging interdisciplinary field of data science, using the scientific method and algorithms to extract knowledge, trends, and patterns from data. Covers statistics, information visualization, text analysis, machine learning, and social network analysis. Starts with introductory Python for data science, progresses through pandas and visualization libraries, and concludes Semester 2 with scikit-learn machine learning, Kaggle competitions, and a capstone project.\n\nCOURSE OUTLINE:\nSemester 1: Introduction to Data Science\n- Unit 1: Introduction to Data Science Principles\n- Unit 2: Data Analysis with Python\n- Unit 3: Applied Plotting, Charting and Data Representation in Python\n- Unit 4: Storytelling with Data: Concepts of Data Visualization\n- Unit 5: Interactive Python Dashboards\n\nSemester 2: Capstone Project\n- Unit 6: Applied Machine Learning in Python\n- Unit 7: RE Project (interdisciplinary project on Ransom Everglades)\n- Unit 8: Kaggle Competitions\n- Unit 9: Final Project\n\nGRADING (points-based):\n- Projects (Individual and Group): 100 points each\n- In-class work, homework, mini-quizzes, participation: 1-20 points each depending on scope\n- Each unit usually has a MiniQuiz\n\nKEY TEXTS (online and free, with print options):\n- Python Data Science Handbook (VanderPlas)\n- Hands-On Machine Learning with Scikit-Learn and TensorFlow (Geron)\n- Introduction to Machine Learning with Python\n- Python for Data Analysis (Pandas, NumPy, IPython)\n- Pandas for Everyone\n- Storytelling with Data\n- The Truthful Art\n\nWEB RESOURCES: GitHub, Stack Overflow, Kaggle, data.gov, Springboard public datasets\n\nPOLICIES:\n- Extra help: Most mornings (except Thurs/Fri), unscheduled periods 3/5/8, after school until 4:00 PM. Schedule a time if needed.\n- Assignments and due dates posted on MyCOMPASS. Major assessments posted 7+ days in advance, smaller tasks 48+ hours in advance.\n- Late work: 10% penalty per day without an extension. Minimum grade for completed late work is 50%. Zero only if no evidence of learning before the class moves on. Major assignments must be completed to earn credit.\n- Planned absences require prior communication; unexcused absences follow late work penalties.\n\nACADEMIC INTEGRITY: Honor Code applies. Unauthorized AI use is prohibited. AI use defined per assignment using the Red/Yellow/Green system:\n- Red: No AI\n- Yellow: Guided/cited AI use\n- Green: Open AI use with accountability\nAll AI use must be disclosed and cited.",
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
