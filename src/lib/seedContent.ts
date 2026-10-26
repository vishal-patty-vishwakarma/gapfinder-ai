// Seeded demo course content — Physics 101: Motion & Energy.
// This file defines the canonical sample syllabus, study notes and practice
// paper. The seed question bank (questionbank.ts) cites ANCHOR sentences that
// appear VERBATIM here: `npm run eval:demo` verifies every citation resolves.

export const SEED_TOPICS: {
  id: string;
  title: string;
  keywords: string[];
  syllabusRef: string;
  parents: string[];
}[] = [
  {
    id: "t_kin",
    title: "Kinematics — position, displacement, speed, velocity",
    keywords: ["position", "displacement", "speed", "velocity", "distance", "scalar", "vector", "magnitude", "direction", "starting point"],
    syllabusRef: "Unit 1. Think like a physicist: modelling motion",
    parents: [],
  },
  {
    id: "t_graph",
    title: "Motion graphs — position–time and velocity–time",
    keywords: ["position–time", "position-time", "velocity-time", "graph", "gradient", "slope", "area under", "stationary", "curved", "axis"],
    syllabusRef: "Unit 2: Describing motion graphically",
    parents: ["t_kin"],
  },
  {
    id: "t_newton",
    title: "Newton's laws of motion",
    keywords: ["newton", "newton's", "law", "resultant force", "inertia", "proportional", "pairs", "constant velocity", "unbalanced"],
    syllabusRef: "Unit 3: Explaining motion with forces",
    parents: ["t_kin"],
  },
  {
    id: "t_forces",
    title: "Forces, friction and free-body diagrams",
    keywords: ["force", "friction", "free-body", "diagram", "weight", "normal", "reaction", "arrow", "magnitude", "direction"],
    syllabusRef: "Unit 3b: Drawing a free-body diagram",
    parents: ["t_newton"],
  },
  {
    id: "t_energy",
    title: "Work, energy and power",
    keywords: ["work", "joule", "kinetic", "potential", "power", "watt", "energy transfer", "rate", "formula", "output"],
    syllabusRef: "Unit 4: Energy, work and power",
    parents: ["t_forces"],
  },
  {
    id: "t_conserve",
    title: "Conservation of energy, dissipation and efficiency",
    keywords: ["conservation", "created or destroyed", "efficiency", "dissipated", "stores", "isolated", "total energy", "useful"],
    syllabusRef: "Unit 5: Conserving and wasting energy",
    parents: ["t_energy"],
  },
  {
    id: "t_ucm",
    title: "Uniform circular motion (syllabus only — no material yet)",
    keywords: ["uniform circular motion", "centripetal", "period", "angular"],
    syllabusRef: "Unit 6: Circular motion",
    parents: ["t_kin"],
  },
];

export const SEED_SYLLABUS: { fileName: string; title: string; text: string } = {
  fileName: "physics101-syllabus.txt",
  title: "Physics 101 — Syllabus",
  text: `PHYSICS 101 — SYLLABUS
Course: Motion & Energy. Final exam: written paper, 90 minutes.

Sessions summary. The exam covers the units below; weightings are indicative.

Unit 1. Think like a physicist: modelling motion
- Position, displacement, speed, velocity; scalars and vectors; descriptive language for changes in motion.

Unit 2: Describing motion graphically
- Reading and sketching position–time and velocity–time graphs; gradients and areas under lines.

Unit 3: Explaining motion with forces
- Newton's three laws; resultant force; free-body diagrams (drawing a dot and arrows); inertia and unbalanced forces.

Unit 4: Energy, work and power
- Work done by a force; joule; kinetic and potential energy; power as rate of energy transfer.

Unit 5: Conserving and wasting energy
- Principle of conservation of energy; dissipation; efficiency of real machines.

Unit 6: Circular motion
- Uniform circular motion basics. (Syllabus lists this unit; lecture notes are not yet provided for Unit 6.)

Exam guidance: past exam writers ask more formula- and definition-based questions in Units 4 and 5 than in Unit 1.`,
};

export const SEED_NOTES: { fileName: string; title: string; text: string } = {
  fileName: "physics101-notes-ch1-5.txt",
  title: "Physics 101 — Study notes (chapters 1–5)",
  text: `## About these notes
These summary notes follow the course sessions in order. Each section matches one syllabus unit.

## Kinematics — position, displacement, speed, velocity
- Position tells you where an object is, measured with respect to an origin.
- Displacement is the change in position, in a straight line from start to finish, including direction.
- If an object returns to its starting point, its total displacement is zero even though its distance is not.
- Distance is the total path length travelled, always positive. Displacement can be zero or negative, because it depends on direction.
- Speed is distance travelled per unit time, measured in metres per second in SI units.
- Velocity is speed in a specified direction, so it can be negative. A negative velocity means the object moves in the reverse direction.

## Motion graphs — position–time and velocity–time
- On a position–time graph, the gradient gives the object's velocity.
- A horizontal line on a position–time graph means the object is stationary, because position is not changing with time.
- A curved position–time line means the velocity is changing, so the object is accelerating or decelerating.
- On a velocity–time graph, the gradient gives the acceleration.
- The area under a velocity–time line gives the distance travelled between two times.

## Newton's laws of motion
- Newton's first law states that an object stays at rest, or keeps moving at constant velocity, unless a resultant force acts on it. This property is inertia.
- Newton's second law states that the acceleration of an object is directly proportional to the resultant force acting on it.
- The same law says the acceleration is inversely proportional to the mass of the object. Doubling the mass halves the acceleration for the same force.
- Newton's third law states that forces always occur in equal and opposite pairs acting on two different objects. When one object acts on another with a force, the second object reacts on the first with an equal magnitude and opposite direction force at the same time.

## Forces, friction and free-body diagrams
- A force is a vector: it has magnitude and direction, and is measured in newtons (N).
- The resultant force is the single force that has the same effect as all the forces acting on an object combined.
- Friction always opposes the motion, or attempted motion, of a sliding object relative to a surface.
- Weight is the gravitational force on an object, W = mg, where g is the gravitational field strength.
- In a free-body diagram you draw the object as a dot and every force on it as an arrow pointing away from it, labelled.

## Work, energy and power
- In physics, work is done when a force moves an object in the direction of the force. W = Fd cosθ.
- Here d is the distance moved in the direction of the force, and θ is the angle between the force and the movement.
- One joule is the work done when a force of one newton moves an object through one metre in the direction of the force.
- Kinetic energy is the energy an object has because it is moving, KE = ½mv².
- Kinetic energy depends on the mass and on the square of the speed, so a small increase in speed gives a large increase in kinetic energy.
- Gravitational potential energy is the energy an object stores because of its height, GPE = mgh.
- Power is the rate at which energy is transferred or work is done, measured in watts.

## Conservation of energy, dissipation and efficiency
- The principle of conservation of energy states that energy cannot be created or destroyed, only transferred between stores.
- In an isolated system, the total amount of energy before an event equals the total after it.
- In real machines some energy is dissipated, usually as heat through friction, to the surroundings.
- Because some input energy always becomes unusable, the efficiency of a device is useful energy output divided by total energy input, and it is always less than one.
- Energy stores include chemical, kinetic, gravitational, thermal and elastic stores; processes transfer energy between them.`,
};

export const SEED_PAST_PAPER: { fileName: string; title: string; text: string } = {
  fileName: "physics101-practice-paper1.txt",
  title: "Physics 101 — Practice paper 1 (no answers provided)",
  text: `## Practice paper — Motion & Energy (questions only)
Note: answer keys are not provided with paper questions. In GapFinder, past papers are used as a topic-importance signal (how often each topic appears), not as ground truth questions.

Q1. A cyclist travels 4 km east along a straight road, turns and rides 4 km west back to the start. State the distance travelled and the total displacement for the whole trip.

Q2. A tram moves so that its position–time graph is a straight line with constant gradient. Describe the tram's velocity.

Q3. State Newton's first law and name the property it describes.

Q4. A book slides to a stop on a desk. In which direction does the friction force act?

Q5. A rope pulls a sledge 8 m with a horizontal 50 N force. Calculate the work done by the rope.

Q6. A winch lifts a crate and transfers 600 J of energy in 5 s. Calculate the power of the winch.

Q7. A ball rolls to a stop on the grass, warming the grass slightly. Explain what happens to the kinetic energy of the ball.

Q8. A student pushes a trolley and it keeps moving with constant velocity after the push ends. What can you conclude about the resultant force on the trolley while it coasts?

Q9. Draw the free-body diagram for a sledge pulled at constant speed along ice, and name every force you drew.

How to read this paper: Q1 targets Unit 1, Q2 Unit 2, Q3 and Q8 Unit 3, Q4 and Q9 Unit 3b, Q5 and Q6 Unit 4, Q7 Unit 5. Unit 6 does not appear in this paper.`,
};
