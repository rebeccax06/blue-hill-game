import { feedbackQuestions } from "./engine.js";

export const endingTransition =
  "The City moves forward with your recommendation. Construction begins. Blue Hill Avenue changes. Five years pass.";

// The ending prose and the form have separate owners. Filter the exact
// UI-owned question even if the model wraps it in Markdown or across lines.
export function endingNarrative(value) {
  const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const uiText = (text) => {
    const pattern = text.split(/\s+/).map(escape).join("[\\s*_]+");
    return new RegExp(
      `(?:^[\\t ]*(?:#{1,6}\\s+|>\\s*|[-*+]\\s+)?[*_]*[\\t ]*)?${pattern}[*_]*[\\t ]*`,
      "gim",
    );
  };
  const original = String(value ?? "");
  const prose = original
    .replace(uiText(feedbackQuestions[0]), "")
    .replace(uiText(endingTransition), "");
  if (prose === original) return original;
  return prose
    .replace(
      /(?:^|\n)\s*(?:#{1,6}\s*)?[*_]*(?:Question\s*1\s*[:—–-]?\s*)?(?:Reconsider Your Decision|Final Reflection|Your Reflection)[*_]*\s*:?\s*$/i,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Follow-up invitations belong to the form, never to a character's reply.
export function dialogueNarrative(value) {
  return String(value ?? "")
    .replace(
      /(?:^|\n)[\t >*_#-]*You may ask\b[^.!?\n]*\bfollow[ -]up\b[^.!?\n]*[.!?]?[*_]*[\t ]*/gim,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Also clean saved reviews generated before the student-facing prompt was tightened.
export function mitigationNarrative(value) {
  return String(value ?? "")
    .split(/\n\s*\n/)
    .filter((paragraph) => !/\b(?:MITIGATION_GATE|FINAL_OPTION|FINAL_AMENDMENTS|RESOLVED|mitigation gate|completion check|ready to freeze|freezing the package|application (?:may|can|should|must)|implementation (?:details|checks))\b/i.test(paragraph))
    .join("\n\n")
    .trim() || "Review your recommendation and any changes you want to include before continuing.";
}
