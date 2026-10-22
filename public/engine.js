export const fresh = () => ({
  version: 1,
  stage: "welcome",
  initial: null,
  priorities: [],
  people: [],
  experts: [],
  active: null,
  conversation: [],
  pressure: null,
  reflection: null,
  final: null,
  benefits: [],
  mitigationResolved: false,
  frozen: false,
  feedback: [],
  notes: [],
});
export const benefitQuestions = [
  "Who do you think benefits most from your decision?",
  "Who might carry more of its costs?",
  "Is there anything you would do to reduce those impacts without abandoning your main decision?",
];
export const feedbackQuestions = [
  "After seeing Blue Hill Avenue five years later, would you make the same decision again? Why or why not?",
  "How much did you enjoy the game? 1 — Not at all through 10 — A lot",
  "If you could change one thing about the game, what would you change?",
  "Was there a person or perspective you wanted to hear from that was missing?",
];
export function validPackage(p) {
  return (
    p &&
    ["A", "B", "C"].includes(p.option) &&
    Array.isArray(p.amendments) &&
    p.amendments.length <= 2 &&
    new Set(p.amendments).size === p.amendments.length &&
    p.amendments.every((n) => Number.isInteger(n) && n >= 1 && n <= 13)
  );
}
export function canFreeze(s) {
  return (
    ["A", "B", "C"].includes(s.initial) &&
    s.people.length === 3 &&
    new Set(s.people.map((p) => p.name)).size === 3 &&
    s.people.every((p) => p.question && p.answer && p.resolved) &&
    s.experts.length <= 3 &&
    new Set(s.experts.map((p) => p.name)).size === s.experts.length &&
    s.experts.every((p) => p.question && p.answer && p.resolved) &&
    s.priorities.length === 2 &&
    s.priorities.every((n) => Number.isInteger(n) && n >= 0 && n < 13) &&
    new Set(s.priorities).size === 2 &&
    !!s.pressure?.response &&
    !!s.pressure?.reason &&
    !!s.reflection &&
    validPackage(s.final) &&
    s.final.confirmed === true &&
    s.benefits.length === 3 &&
    s.benefits.every((x) => typeof x === "string" && x.trim()) &&
    s.mitigationResolved === true
  );
}
export function freeze(s) {
  if (!canFreeze(s))
    throw Error(
      "Complete the pending questions and resolve the recommendation before implementation.",
    );
  s.frozen = true;
  return structuredClone(s.final);
}
export function addAmendment(ids, id) {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= 2)
    throw Error("Choose up to two amendments. Remove one to choose another.");
  return [...ids, id];
}
