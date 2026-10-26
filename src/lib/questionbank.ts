// Seeded question bank — "bank-v1".
//
// Every question cites an ANCHOR sentence that appears verbatim in the seeded
// notes chunk it points to (checked at seed time). Short-answer items carry a
// rubric: expected concepts, each with its own citation, so grading can show
// exactly which concept earned/lost credit and from which source line (§25.5).
import type { Citation, Difficulty, Question } from "@/lib/types";

const NOTES_DOC = { id: "doc_notes", title: "Physics 101 — Study notes (chapters 1–5)." };

type CiteSpec = { locator: string; quote: string };

export interface BankSpec {
  id: string;
  topicId: string;
  type: "mcq" | "short";
  difficulty: Difficulty;
  stem: string;
  options?: { id: string; label: string; whyWrong?: string }[];
  answer?: string;
  concepts?: { id: string; label: string; aliases: string[]; cite: CiteSpec }[];
  explain: string;
  cites: CiteSpec[];
}

// All quotes below exist verbatim in seedContent.ts SEED_NOTES text.
const B: BankSpec[] = [
  {
    id: "q_kin_1", topicId: "t_kin", type: "mcq", difficulty: "easy",
    stem: "A cyclist rides 2 km to the shops and later rides 2 km back home along the same straight road, ending where she started. What is her total displacement for the whole trip?",
    options: [
      { id: "o1", label: "4 km", whyWrong: "4 km is the total distance travelled, not displacement — distance ignores direction." },
      { id: "o2", label: "2 km", whyWrong: "Displacement is measured straight from start to finish, not along one leg of the trip." },
      { id: "o3", label: "0 km" },
      { id: "o4", label: "It cannot be determined, because speed was not given", whyWrong: "Displacement does not depend on speed at all." },
    ],
    answer: "o3",
    explain: "Displacement is change in position, straight from start to finish and including direction. She ends where she started, so displacement is 0 km; the 4 km she rode is distance.",
    cites: [
      { locator: "Kinematics — position, displacement, speed, velocity", quote: "If an object returns to its starting point, its total displacement is zero even though its distance is not." },
      { locator: "Kinematics — position, displacement, speed, velocity", quote: "Displacement is the change in position, in a straight line from start to finish, including direction." },
    ],
  },
  {
    id: "q_kin_2", topicId: "t_kin", type: "mcq", difficulty: "hard",
    stem: "A car moves along a straight road. Its velocity is −8 m/s at one moment and −8 m/s ten seconds later. What does the negative sign tell you?",
    options: [
      { id: "o1", label: "The car is slowing down", whyWrong: "A constant velocity means steady motion — slowing would require a changing velocity." },
      { id: "o2", label: "The car moves in the reverse direction relative to the chosen positive direction" },
      { id: "o3", label: "The car's speed must be zero half of the time", whyWrong: "Velocity is constant here, so the speed is 8 m/s at every instant." },
      { id: "o4", label: "The sign has no meaning; only magnitude matters", whyWrong: "Velocity is a directed quantity — the sign is meaningful." },
    ],
    answer: "o2",
    explain: "Velocity is speed in a specified direction, so it can be negative; a negative velocity means motion in the reverse direction.",
    cites: [{ locator: "Kinematics — position, displacement, speed, velocity", quote: "Velocity is speed in a specified direction, so it can be negative. A negative velocity means the object moves in the reverse direction." }],
  },
  {
    id: "q_kin_3", topicId: "t_kin", type: "short", difficulty: "medium",
    stem: "Using the definitions in your notes, explain the difference between distance and displacement, and describe one situation where displacement is zero but distance is not.",
    concepts: [
      { id: "c_kin_1", label: "Distance = total path length travelled", aliases: ["distance", "path length", "travell", "positive"], cite: { locator: "Kinematics — position, displacement, speed, velocity", quote: "Distance is the total path length travelled, always positive. Displacement can be zero or negative, because it depends on direction." } },
      { id: "c_kin_2", label: "Displacement = change in position, straight line, includes direction", aliases: ["displacement", "change in position", "direction"], cite: { locator: "Kinematics — position, displacement, speed, velocity", quote: "Displacement is the change in position, in a straight line from start to finish, including direction." } },
      { id: "c_kin_3", label: "Return to start ⇒ zero displacement, non-zero distance", aliases: ["return", "start", "zero", "distance"], cite: { locator: "Kinematics — position, displacement, speed, velocity", quote: "If an object returns to its starting point, its total displacement is zero even though its distance is not." } },
    ],
    explain: "Distance is total path length (always positive); displacement is change in position in a straight line including direction; returning to the start gives zero displacement with non-zero distance.",
    cites: [{ locator: "Kinematics — position, displacement, speed, velocity", quote: "Distance is the total path length travelled, always positive. Displacement can be zero or negative, because it depends on direction." }],
  },

  {
    id: "q_graph_1", topicId: "t_graph", type: "mcq", difficulty: "medium",
    stem: "A marble rolls so that its position–time graph is a horizontal line. What does this mean?",
    options: [
      { id: "o1", label: "The marble is stationary", whyWrong: undefined },
      { id: "o2", label: "The marble moves with constant, non-zero velocity", whyWrong: "A horizontal position–time line means position is constant, so velocity (the gradient) is zero." },
      { id: "o3", label: "The marble is accelerating", whyWrong: "A curved position–time line would show acceleration, not a straight horizontal one." },
      { id: "o4", label: "The graph is invalid — position–time lines are never horizontal", whyWrong: "A stationary object gives exactly this graph." },
    ],
    answer: "o1",
    explain: "A horizontal line on a position–time graph means the object is stationary, because position is not changing with time.",
    cites: [{ locator: "Motion graphs — position–time and velocity–time", quote: "A horizontal line on a position–time graph means the object is stationary, because position is not changing with time." }],
  },
  {
    id: "q_graph_2", topicId: "t_graph", type: "mcq", difficulty: "hard",
    stem: "For a cyclist's velocity–time graph between two times, what does the GRADIENT over that interval give, and what does the AREA UNDER THE LINE over the same interval give?",
    options: [
      { id: "o1", label: "Gradient → distance travelled; area → acceleration", whyWrong: "These two are swapped in your notes." },
      { id: "o2", label: "Gradient → acceleration; area → distance travelled" },
      { id: "o3", label: "Both give the acceleration", whyWrong: "Only the gradient is the acceleration; the area is distance." },
      { id: "o4", label: "Both give the distance travelled", whyWrong: "Only the area is distance; the gradient is the acceleration." },
    ],
    answer: "o2",
    explain: "On a velocity–time graph, the gradient gives the acceleration, and the area under the line gives the distance travelled between two times.",
    cites: [
      { locator: "Motion graphs — position–time and velocity–time", quote: "On a velocity–time graph, the gradient gives the acceleration." },
      { locator: "Motion graphs — position–time and velocity–time", quote: "The area under a velocity–time line gives the distance travelled between two times." },
    ],
  },
  {
    id: "q_graph_3", topicId: "t_graph", type: "short", difficulty: "medium",
    stem: "In your own words: on a position–time graph, what does a straight sloping line tell you about the object's velocity, and what different thing does a curved line tell you?",
    concepts: [
      { id: "c_graph_1", label: "Straight sloping line ⇒ constant velocity", aliases: ["straight", "gradient", "velocity", "constant"], cite: { locator: "Motion graphs — position–time and velocity–time", quote: "On a position–time graph, the gradient gives the object's velocity." } },
      { id: "c_graph_2", label: "Curved line ⇒ velocity is changing (accelerating / decelerating)", aliases: ["curved", "changing", "velocity", "accelerat"], cite: { locator: "Motion graphs — position–time and velocity–time", quote: "A curved position–time line means the velocity is changing, so the object is accelerating or decelerating." } },
    ],
    explain: "A straight sloping position–time line has a constant gradient, hence constant velocity; a curved line means the velocity is changing (accelerating or decelerating).",
    cites: [{ locator: "Motion graphs — position–time and velocity–time", quote: "A curved position–time line means the velocity is changing, so the object is accelerating or decelerating." }],
  },

  {
    id: "q_newton_1", topicId: "t_newton", type: "mcq", difficulty: "medium",
    stem: "An apple hangs motionless on a tree, even though Earth pulls it downward. According to Newton's first law, why does it stay at rest?",
    options: [
      { id: "o1", label: "The forces on it are balanced, so there is no resultant force and no change in motion" },
      { id: "o2", label: "No forces act on the apple at all", whyWrong: "Weight and the branch's tension both act; RESULTANT force is zero." },
      { id: "o3", label: "Newton's third law cancels the apple's weight with an equal upward reaction", whyWrong: "Action–reaction pairs act on DIFFERENT objects, so they never cancel on one object." },
      { id: "o4", label: "An object at rest needs a continuing applied force to remain at rest", whyWrong: "First law: rest (or constant velocity) is maintained WITHOUT a resultant force." },
    ],
    answer: "o1",
    explain: "Newton's first law: an object stays at rest, or keeps moving at constant velocity, unless a resultant force acts on it. The balanced forces give zero resultant force.",
    cites: [{ locator: "Newton's laws of motion", quote: "Newton's first law states that an object stays at rest, or keeps moving at constant velocity, unless a resultant force acts on it." }],
  },
  {
    id: "q_newton_2", topicId: "t_newton", type: "mcq", difficulty: "hard",
    stem: "The resultant force on a 2 kg cart is 4 N. If the resultant force on the same cart is increased to 8 N, its acceleration will:",
    options: [
      { id: "o1", label: "halve", whyWrong: "Halving happens if the force is halved, not doubled." },
      { id: "o2", label: "double" },
      { id: "o3", label: "stay the same", whyWrong: "Acceleration is directly proportional to the resultant force — it changes with the force." },
      { id: "o4", label: "become four times larger", whyWrong: "Four-fold would require four times the force." },
    ],
    answer: "o2",
    explain: "Newton's second law: acceleration is directly proportional to the resultant force. Doubling the force doubles the acceleration.",
    cites: [{ locator: "Newton's laws of motion", quote: "Newton's second law states that the acceleration of an object is directly proportional to the resultant force acting on it." }],
  },
  {
    id: "q_newton_3", topicId: "t_newton", type: "short", difficulty: "medium",
    stem: "A foot kicks a football. State what Newton's third law says about this interaction. Your notes make three specific claims about the force pair — include all three.",
    concepts: [
      { id: "c_newton_1", label: "Equal magnitude", aliases: ["equal", "same", "magnitude"], cite: { locator: "Newton's laws of motion", quote: "Newton's third law states that forces always occur in equal and opposite pairs acting on two different objects." } },
      { id: "c_newton_2", label: "Opposite direction", aliases: ["opposite", "direction"], cite: { locator: "Newton's laws of motion", quote: "Newton's third law states that forces always occur in equal and opposite pairs acting on two different objects." } },
      { id: "c_newton_3", label: "Acts on two DIFFERENT objects", aliases: ["different", "two", "objects"], cite: { locator: "Newton's laws of motion", quote: "Newton's third law states that forces always occur in equal and opposite pairs acting on two different objects." } },
    ],
    explain: "Third law: forces occur in equal, opposite pairs acting on two different objects — the foot pushes the ball; the ball pushes back on the foot equally in the opposite direction.",
    cites: [{ locator: "Newton's laws of motion", quote: "Newton's third law states that forces always occur in equal and opposite pairs acting on two different objects." }],
  },

  {
    id: "q_forces_1", topicId: "t_forces", type: "mcq", difficulty: "medium",
    stem: "A crate slides to the right across a floor and slows down. In which direction does the friction force act?",
    options: [
      { id: "o1", label: "To the right", whyWrong: "That's the direction of motion — friction acts against motion." },
      { id: "o2", label: "To the left" },
      { id: "o3", label: "Downward", whyWrong: "Friction is horizontal here; downward is weight." },
      { id: "o4", label: "No friction acts while the crate moves", whyWrong: "Friction acts on sliding objects, opposing their motion or attempted motion." },
    ],
    answer: "o2",
    explain: "Friction always opposes the motion, or attempted motion, of a sliding object relative to a surface. Moving right → friction left.",
    cites: [{ locator: "Forces, friction and free-body diagrams", quote: "Friction always opposes the motion, or attempted motion, of a sliding object relative to a surface." }],
  },
  {
    id: "q_forces_2", topicId: "t_forces", type: "mcq", difficulty: "hard",
    stem: "Four tugboats pull a barge in various directions. Physicists describe the single pull that would have the same effect as all four combined. What does your notes call that single pull?",
    options: [
      { id: "o1", label: "The resultant force" },
      { id: "o2", label: "The reaction force", whyWrong: "That term belongs to action–reaction pairs, not to combining forces on one object." },
      { id: "o3", label: "Work done", whyWrong: "Work involves force AND distance moved — a different concept from combining forces." },
      { id: "o4", label: "Friction", whyWrong: "Friction is a specific contact force, not the combined effect of all forces." },
    ],
    answer: "o1",
    explain: "The resultant force is the single force that has the same effect as all the forces acting on an object combined.",
    cites: [{ locator: "Forces, friction and free-body diagrams", quote: "The resultant force is the single force that has the same effect as all the forces acting on an object combined." }],
  },
  {
    id: "q_forces_3", topicId: "t_forces", type: "short", difficulty: "medium",
    stem: "Describe how your notes say to draw a free-body diagram: what does the object itself become on the page, and how is each force shown?",
    concepts: [
      { id: "c_forces_1", label: "Object drawn as a dot (or point)", aliases: ["dot", "point"], cite: { locator: "Forces, friction and free-body diagrams", quote: "In a free-body diagram you draw the object as a dot and every force on it as an arrow pointing away from it, labelled." } },
      { id: "c_forces_2", label: "Each force drawn as an arrow pointing AWAY from the dot", aliases: ["arrow", "away", "point"], cite: { locator: "Forces, friction and free-body diagrams", quote: "In a free-body diagram you draw the object as a dot and every force on it as an arrow pointing away from it, labelled." } },
      { id: "c_forces_3", label: "Arrows are labelled", aliases: ["label", "labelled", "labeled", "names", "name each", "label each force"], cite: { locator: "Forces, friction and free-body diagrams", quote: "In a free-body diagram you draw the object as a dot and every force on it as an arrow pointing away from it, labelled." } },
    ],
    explain: "Draw the object as a dot; draw every force on it as an arrow pointing away from it, labelled.",
    cites: [{ locator: "Forces, friction and free-body diagrams", quote: "In a free-body diagram you draw the object as a dot and every force on it as an arrow pointing away from it, labelled." }],
  },

  {
    id: "q_energy_1", topicId: "t_energy", type: "mcq", difficulty: "easy",
    stem: "A force of 10 N pulls a box 3 m in the direction of the force. How much work is done?",
    options: [
      { id: "o1", label: "30 J" }, { id: "o2", label: "3.3 J", whyWrong: "Work = F × d, not F ÷ d." },
      { id: "o3", label: "0 J", whyWrong: "Work is zero only if there is no movement in the direction of the force." },
      { id: "o4", label: "10 J", whyWrong: "10 J would be a movement of only 1 m with a 10 N force." },
    ],
    answer: "o1",
    explain: "Work = force × distance in the direction of the force: 10 N × 3 m = 30 J. One joule is one newton moving through one metre.",
    cites: [{ locator: "Work, energy and power", quote: "One joule is the work done when a force of one newton moves an object through one metre in the direction of the force." }],
  },
  {
    id: "q_energy_2", topicId: "t_energy", type: "mcq", difficulty: "hard",
    stem: "A worker pushes a heavy crate straight DOWN with 100 N while it slides 2 m horizontally. How much work does the worker's downward push do on the crate?",
    options: [
      { id: "o1", label: "200 J", whyWrong: "That would be 100 N × 2 m — but only if the push were along the movement." },
      { id: "o2", label: "0 J" },
      { id: "o3", label: "50 J", whyWrong: "There is no 'half' here: θ = 90° makes cos θ = 0, not 0.5." },
      { id: "o4", label: "It cannot be calculated without the crate's mass", whyWrong: "Work needs force, distance and angle — mass is not needed." },
    ],
    answer: "o2",
    explain: "W = Fd cosθ. Here the force is perpendicular to movement (θ = 90°, cos 90° = 0), and movement in the direction of the force is zero — so no work is done by that push.",
    cites: [
      { locator: "Work, energy and power", quote: "In physics, work is done when a force moves an object in the direction of the force. W = Fd cosθ." },
      { locator: "Work, energy and power", quote: "Here d is the distance moved in the direction of the force, and θ is the angle between the force and the movement." },
    ],
  },
  {
    id: "q_energy_3", topicId: "t_energy", type: "short", difficulty: "medium",
    stem: "Define kinetic energy in words using your notes, give its formula, and say what happens to it if an object's speed doubles (at the same mass).",
    concepts: [
      { id: "c_energy_1", label: "Energy an object has because it is moving", aliases: ["energy", "moving", "motion"], cite: { locator: "Work, energy and power", quote: "Kinetic energy is the energy an object has because it is moving, KE = ½mv²." } },
      { id: "c_energy_2", label: "Formula KE = ½mv²", aliases: ["ke", "mv", "square"], cite: { locator: "Work, energy and power", quote: "Kinetic energy is the energy an object has because it is moving, KE = ½mv²." } },
      { id: "c_energy_3", label: "Speed doubles ⇒ KE quadruples (× 4)", aliases: ["quadruple", "four", "×4", "x4", "4 times", "double"], cite: { locator: "Work, energy and power", quote: "Kinetic energy depends on the mass and on the square of the speed, so a small increase in speed gives a large increase in kinetic energy." } },
    ],
    explain: "Kinetic energy is the energy an object has because it is moving, KE = ½mv². Doubling v gives four times the KE, because KE depends on the square of speed.",
    cites: [{ locator: "Work, energy and power", quote: "Kinetic energy depends on the mass and on the square of the speed, so a small increase in speed gives a large increase in kinetic energy." }],
  },

  {
    id: "q_conserve_1", topicId: "t_conserve", type: "mcq", difficulty: "medium",
    stem: "A pendulum swings back and forth. At every moment during the swing (Ignoring air resistance), the sum of its kinetic energy and gravitational potential energy is:",
    options: [
      { id: "o1", label: "Constant — the same total at every moment" },
      { id: "o2", label: "Constantly decreasing", whyWrong: "Energy is conserved: GPE converts to KE and back; the total stays the same." },
      { id: "o3", label: "Constantly increasing", whyWrong: "Nothing adds energy to the pendulum, so the total does not increase." },
      { id: "o4", label: "Equal to the force of gravity", whyWrong: "Force and energy are different quantities." },
    ],
    answer: "o1",
    explain: "Energy cannot be created or destroyed, only transferred between stores: the pendulum's GPE and KE trade places, so the total stays constant in an isolated system.",
    cites: [{ locator: "Conservation of energy, dissipation and efficiency", quote: "The principle of conservation of energy states that energy cannot be created or destroyed, only transferred between stores." }],
  },
  {
    id: "q_conserve_2", topicId: "t_conserve", type: "mcq", difficulty: "hard",
    stem: "A motor uses 500 J of electrical energy to lift a load. The load gains 400 J of gravitational potential energy. What happened to the 'missing' 100 J?",
    options: [
      { id: "o1", label: "It was destroyed", whyWrong: "Energy cannot be created or destroyed — conservation rules this out." },
      { id: "o2", label: "Transferred to the surroundings, e.g. dissipated as heat through friction" },
      { id: "o3", label: "It is still in the motor as newly created energy", whyWrong: "New energy cannot appear — that would violate conservation." },
      { id: "o4", label: "It converted into gravity", whyWrong: "Gravity is a force field, not an energy store the load 'gains mass into'." },
    ],
    answer: "o2",
    explain: "In real machines some energy is dissipated, usually as heat through friction, to the surroundings — the input is 500 J, useful output 400 J, and 100 J is dissipated.",
    cites: [{ locator: "Conservation of energy, dissipation and efficiency", quote: "In real machines some energy is dissipated, usually as heat through friction, to the surroundings." }],
  },
  {
    id: "q_conserve_3", topicId: "t_conserve", type: "short", difficulty: "medium",
    stem: "Define efficiency in words exactly as your notes define it, and explain why real machines are always less than perfectly efficient.",
    concepts: [
      { id: "c_conserve_1", label: "Efficiency = useful energy output ÷ total energy input", aliases: ["useful", "output", "input", "divid"], cite: { locator: "Conservation of energy, dissipation and efficiency", quote: "Because some input energy always becomes unusable, the efficiency of a device is useful energy output divided by total energy input, and it is always less than one." } },
      { id: "c_conserve_2", label: "Always less than one / less than 100%", aliases: ["less", "than", "one", "100"], cite: { locator: "Conservation of energy, dissipation and efficiency", quote: "Because some input energy always becomes unusable, the efficiency of a device is useful energy output divided by total energy input, and it is always less than one." } },
      { id: "c_conserve_3", label: "Some energy is dissipated as heat through friction", aliases: ["dissipat", "heat", "friction"], cite: { locator: "Conservation of energy, dissipation and efficiency", quote: "In real machines some energy is dissipated, usually as heat through friction, to the surroundings." } },
    ],
    explain: "Efficiency = useful energy output ÷ total energy input; it is always < 1 because some energy is always dissipated (usually as heat through friction).",
    cites: [{ locator: "Conservation of energy, dissipation and efficiency", quote: "In real machines some energy is dissipated, usually as heat through friction, to the surroundings." }],
  },
];

export function bankCount(): number {
  return B.length;
}

/** Build validated Question records. `resolve` maps (docId, locator) → chunk text. */
export function buildBankQuestions(
  resolve: (docId: string, locator: string) => { chunkId: string; text: string } | null
): Question[] {
  const out: Question[] = [];
  for (const spec of B) {
    const citations: Citation[] = [];
    const issues: string[] = [];
    for (const c of spec.cites) {
      const hit = resolve("doc_notes", c.locator);
      if (!hit) {
        issues.push(`citation locator not found: ${c.locator}`);
        continue;
      }
      if (!hit.text.includes(c.quote)) {
        issues.push(`anchor quote drifted from source chunk (${c.locator})`);
        continue;
      }
      citations.push({
        chunkId: hit.chunkId,
        documentId: "doc_notes",
        documentTitle: "Physics 101 — Study notes (chapters 1–5)",
        locator: c.locator,
        quote: c.quote,
      });
    }
    const expectedConcepts = (spec.concepts ?? []).map((cn) => ({
      id: cn.id,
      label: cn.label,
      aliases: cn.aliases,
      citationRef: 0,
    }));
    const validationStatus = issues.length === 0 ? "validated" : "invalid";
    out.push({
      id: spec.id,
      version: 1,
      topicId: spec.topicId,
      type: spec.type,
      difficulty: spec.difficulty,
      source: "bank",
      stem: spec.stem,
      options: (spec.options ?? []).map((o) => ({ id: o.id, label: o.label, whyWrong: o.whyWrong ?? undefined })),
      answerOptionId: spec.answer ?? null,
      expectedConcepts,
      explanationRight: spec.explain,
      citations,
      validationStatus,
      validationIssues: issues,
      generationVersion: "bank-v1",
    });
  }
  return out as unknown as Question[];
}
