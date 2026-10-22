import {endingNarrative,endingTransition} from "./narrative.js";
import { beforeAfterStreet, createStreetReveal } from "./reveal.js";
import { renderMarkdown } from "./markdown.js";
import { portrait, street, streetDesigns } from "./art.js";
import {
  fresh,
  benefitQuestions,
  feedbackQuestions,
  addAmendment,
  freeze,
  validPackage,
} from "./engine.js";
const C = await fetch("/content.json").then((r) => r.json());
let status = await fetch("/api/status")
  .then((r) => r.json())
  .catch(() => ({ ai: false }));
const storageKey = "bha-game-v1";
let S;
try {
  S = JSON.parse(localStorage.getItem(storageKey));
  if (!S || S.version !== 1) S = fresh();
} catch {
  S = fresh();
}
let preview = S.final?.option || S.initial || "B",
  view = "perspective",
  busy = false,
  selected = null,
  selectedPriorities = [],
  draftFinal = null,
  draft = "",
  pressureChoice = null,
  rating = null;
const $ = (s) => document.querySelector(s),
  app = $("#app");
const reveal = createStreetReveal();
const esc = (t) =>
  String(t ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(S));
  } catch {
    toast("Progress could not be saved on this device. Keep this tab open.");
  }
  $("#note-count").textContent = S.notes.length;
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => ($("#toast").style.display = "none"),
    5000,
  );
}
function modal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").showModal();
}
$("#modal .close").onclick = () => $("#modal").close();
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) $("#modal").close();
});
function note(title, text) {
  S.notes.push({ title, text });
}
function go(stage) {
  S.stage = stage;
  draft = "";
  selected = null;
  save();
  render();
  $(".panel h2")?.focus({ preventScroll: true });
}
function footer() {
  return `<footer><span>BLUE HILL AVENUE · WHO GETS THE STREET?</span><span>Simulated people, events & futures </span></footer>`;
}
const button = (text, action, disabled = false, cls = "primary") =>
  `<button type="button" class="${cls}" data-action="${action}" ${disabled ? "disabled" : ""}>${text}</button>`;
function input(
  label,
  action,
  placeholder = "Write in your own words…",
  extra = "",
) {
  return `<form data-submit="${action}"><label class="question-label" for="answer">${esc(label)}</label><textarea id="answer" name="answer" placeholder="${esc(placeholder)}" maxlength="2000" required ${busy ? "disabled" : ""}>${esc(draft)}</textarea>${extra}<div class="button-row"><button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Thinking…" : "Send response"} <span>↗</span></button></div></form>`;
}
function stageNum() {
  return (
    {
      welcome: 0,
      opening: 0,
      priorities: 0,
      people: 1,
      experts: 2,
      pressure: 3,
      pressureReason: 3,
      synthesis: 4,
      final: 5,
      benefits: 5,
      mitigation: 5,
      ending: 6,
      feedback: 6,
      complete: 6,
      interview: S.active?.type === "experts" ? 2 : 1,
    }[S.stage] ?? 0
  );
}
function stepper() {
  return `<nav class="stepper" aria-label="Game progress">${["Your first take", "Meet the neighbors", "Ask an expert", "Under pressure", "Take a moment", "Your recommendation", "Five years later"].map((t, i) => `<span class="step ${i === stageNum() ? "current" : i < stageNum() ? "done" : ""}" ${i === stageNum() ? 'aria-current="step"' : ""}><b>${i < stageNum() ? "✓" : i + 1}</b>${t}</span>`).join("")}</nav>`;
}
function allocationStrip(option) {
  const design = streetDesigns[option],
    names = {
      Walk: "Walking and public space",
      Bike: "Biking",
      Curb: "Parking and loading",
      Traffic: "General traffic",
      Bus: "Dedicated bus space",
      "Traffic + bus": "Shared traffic and buses",
    },
    symbols = {
      Walk: "↔",
      Bike: "↟",
      Curb: "P",
      Traffic: "↑",
      Bus: "BUS",
      "Traffic + bus": "BUS + ↑",
    };
  return `<div class="allocation"><span class="eyebrow">How the same street space is shared</span><div class="space-strip" aria-label="Illustrative street space allocation for Option ${option}">${design.lanes.map(([name, width]) => `<span class="space-block space-${name.split(" ")[0].toLowerCase()}" style="flex:${width}" title="${names[name]}" data-lane="${name}" tabindex="0" role="button" aria-label="${names[name]}: show explanation">${symbols[name]}</span>`).join("")}</div><div class="allocation-note">${esc(design.tradeoff)}</div></div>`;
}
function visual() {
  const isOutcome = S.frozen && ["ending", "feedback"].includes(S.stage);
  const shown = isOutcome ? S.final.option : preview;
  const design = streetDesigns[shown];
  return `<aside class="visual"><div class="visual-top"><span class="eyebrow">The avenue, reimagined</span><div class="view-toggle" aria-label="Street view">${[
    ["perspective", "Perspective"],
    ["plan", "Top view"],
  ]
    .map(
      ([id, label]) =>
        `<button data-view="${id}" class="${view === id ? "active" : ""}" aria-pressed="${view === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div></div><div class="street-card">${isOutcome ? beforeAfterStreet(S.final, view, reveal.progress) : `<div class="scene"><span class="scene-label">MATTAPAN / DORCHESTER / ROXBURY</span>${street(preview, S.final?.option === preview ? S.final.amendments : [], view)}</div>`}<div class="street-caption"><div><strong>${isOutcome ? "Your final design · " : "Option "}${shown} · ${esc(design.title)}</strong><br><span>${esc(design.focus)}</span></div>${isOutcome ? "" : `<div class="option-tabs" aria-label="Preview street options">${["A", "B", "C"].map((x) => `<button data-preview="${x}" class="${preview === x ? "active" : ""}" aria-pressed="${preview === x}">${x}</button>`).join("")}</div>`}</div>${allocationStrip(shown)}</div><ul class="street-differences">${design.details.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><div class="lane-info" id="lane-info" aria-live="polite">Select a part of the street or the colored strip to explore its use.</div><div class="legend"><span><i style="background:#b8755f"></i>Bus priority</span><span><i style="background:#78a890"></i>Biking</span><span><i style="background:#b4bec5"></i>Parking & loading</span><span><i style="background:#737e7b"></i>Traffic</span><span><i style="background:#dfd2b9"></i>Walking & public space</span></div><p class="micro">Illustrative space allocation, not measured widths or a proposed engineering plan. Previewing an option does not change your decision.</p><span class="status ${status.ai ? "live" : ""}">${status.ai ? "DeepSeek dialogue connected" : "Offline preview · prerecorded character perspectives"}</span></aside>`;
}
function options(choice = selected) {
  return C.options
    .map(
      (o) =>
        `<button class="option-card ${choice === o.id ? "selected" : ""}" data-option="${o.id}" aria-pressed="${choice === o.id}"><span class="letter">${o.id}</span><span><h3>${esc(o.title)}</h3><p>${esc(o.body)}</p></span></button>`,
    )
    .join("");
}
function packageSummary() {
  return S.final
    ? `<div class="package"><span class="eyebrow">Your recommendation</span><strong>${S.final.option} · ${esc(C.options.find((o) => o.id === S.final.option).title)}</strong>${S.final.amendments.length ? S.final.amendments.map((id) => esc(C.amendments.find((a) => a.id === id).name)).join(" + ") : "Without amendments"}</div>`
    : "";
}
function amendments() {
  return `<p class="micro">Choose zero, one, or two. All amendments are available with every base option. Shared street space limits what can be achieved together.</p><div class="amendments">${C.amendments.map((a) => `<label class="amendment"><input type="checkbox" data-amendment="${a.id}" ${draftFinal.amendments.includes(a.id) ? "checked" : ""}><span><strong>${a.id}. ${esc(a.name)}</strong><small>${esc(a.tradeoff)}</small></span></label>`).join("")}</div>`;
}
function welcome() {
  return `<section class="welcome"><div><span class="eyebrow orange">A youth planning simulation</span><h1>Blue Hill Avenue</h1><p class="intro-copy">Who gets the street? Step into a youth planning fellow’s shoes and help shape the future of Blue Hill Avenue.</p><div class="button-row">${button("Begin the game <span>↗</span>", "begin")}</div><p class="promise">15–20 minutes. Three approaches. No single right answer.</p></div><div class="scene"><span class="scene-label">BLUE HILL AVENUE · BOSTON, MA</span>${street("B")}<span class="scene-badge">A street is more than a way through.</span></div></section><section class="welcome-bottom"><article><span class="num">01</span><div><h3>Imagine the possibilities</h3><p>Explore three approaches to the same limited street space.</p></div></article><article><span class="num">02</span><div><h3>Meet the people</h3><p>Ask your own questions. Hear what a redesign means for everyday life.</p></div></article><article><span class="num">03</span><div><h3>Live with the tradeoffs</h3><p>Make a recommendation. Return five years later to see its consequences.</p></div></article></section>${footer()}`;
}
function menu(type) {
  const isExpert = type === "experts",
    list = C[type],
    done = S[type];
  return `<span class="eyebrow">${isExpert ? "Specialized information" : "The people behind the plan"}</span><h2 tabindex="-1">${isExpert ? "Get another perspective." : "Every trip has a story."}</h2><p>${isExpert ? "The people you met told you what this decision could mean for their lives. Now you can ask for specialized information. You may consult up to three experts. Experts will not tell you which option to choose." : "You have made your first choice. But a design that makes sense on a map may feel very different to someone who has to live with it. Eight people want to talk with you. You only have time to meet three. Who do you want to hear from?"}</p><p class="counter">${done.length} of 3 ${isExpert ? "optional consultations" : "resident interviews"} completed · Choose ${isExpert ? "an expert or move on" : "one person to meet next"}.</p><div class="people-grid">${list
    .filter((p) => !done.some((d) => d.name === p.name))
    .map(
      (p) =>
        `<button class="person-card" data-person="${esc(p.name)}" data-type="${type}">${portrait([...C.people, ...C.experts].findIndex((x) => x.name === p.name))}<h3>${esc(p.name)}</h3><span class="role">${esc(p.role)}</span><p>${esc(p.description)}</p></button>`,
    )
    .join(
      "",
    )}</div>${isExpert ? `<div class="button-row">${button(done.length ? "Move on to public pressure →" : "No experts — move on →", "stop-experts", busy, "secondary")}</div>` : ""}`;
}
function interview() {
  const p = [...C.people, ...C.experts].find((x) => x.name === S.active.name),
    index = [...C.people, ...C.experts].indexOf(p);
  const rec = S[S.active.type].find((x) => x.name === p.name);
  const next =
    S.active.type === "experts"
      ? "Choose another expert or move on"
      : S.people.length === 3
        ? "Move on to experts"
        : "Meet the next person";
  return `<div class="person-head">${portrait(index, true)}<div><span class="eyebrow">A simulated conversation</span><h2 tabindex="-1">${esc(p.name)}</h2><span class="role">${esc(p.role)}</span></div></div><div class="dialogue"><div class="bubble quote">“${esc(p.intro)}”</div>${S.conversation.map((m) => `<div class="bubble ${m.role === "you" ? "you" : ""}"><small>${m.role === "you" ? "You" : esc(p.name)}</small><div class="${m.role === "you" ? "" : "markdown"}">${m.role === "you" ? esc(m.text) : renderMarkdown(m.text)}</div></div>`).join("")}${busy ? '<div class="busy" role="status">Listening and composing a response…</div>' : ""}${!rec ? input(`What would you like to ask ${p.name}?`, "ask", `Ask ${p.name.split(" ")[0]} about what matters to you…`) : !rec.followup ? `<p class="micro">You may ask ${esc(p.name)} one brief follow-up, or ${S.active.type === "experts" ? "choose another expert or move on" : S.people.length === 3 ? "move on to experts" : "move on to your next person"}.</p>${input("One brief follow-up (optional)", "followup", "What would you like to clarify?")}<div class="button-row">${button(next + " →", "next-person", busy, "secondary")}</div>` : `<div class="button-row">${button(next + " →", "next-person", busy)}</div>`}</div>`;
}
function panel() {
  switch (S.stage) {
    case "opening":
      return `<span class="eyebrow">Your role · Youth planning fellow</span><h2 tabindex="-1">Who gets the street?</h2><div class="source-opening">${C.opening
        .split("\n")
        .slice(1, 5)
        .map((t) => `<p>${esc(t)}</p>`)
        .join(
          "",
        )}</div><p>If you had to decide right now, what should Boston build: A, B, or C?</p>${options()}<div class="button-row">${button("Make my first choice →", "initial", !selected)}</div>`;
    case "priorities":
      return `<span class="eyebrow">Start with what matters to you</span><h2 tabindex="-1">What matters most<br>in your decision?</h2><p>Choose two. These are your starting priorities; your perspective may evolve as you listen.</p><div class="chip-grid">${C.priorities.map((p, i) => `<button class="chip ${selectedPriorities.includes(i) ? "selected" : ""}" data-priority="${i}" aria-pressed="${selectedPriorities.includes(i)}">${esc(p)}</button>`).join("")}</div><p class="counter">${selectedPriorities.length} of 2 selected</p><div class="button-row">${button("Meet the neighbors →", "priorities", selectedPriorities.length !== 2)}</div>`;
    case "people":
      return menu("people");
    case "experts":
      return menu("experts");
    case "interview":
      return interview();
    case "pressure": {
      const event = C.events[S.initial];
      return `<span class="eyebrow orange">Public pressure · A simulated event</span><h2 tabindex="-1">The street has something to say.</h2><div class="event">${esc(event.story)}</div><p>What do you do? This response is provisional; you will choose your final recommendation later.</p>${event.choices.map((c, i) => `<button class="option-card ${pressureChoice === i ? "selected" : ""}" data-pressure="${i}" aria-pressed="${pressureChoice === i}"><span class="letter">${i + 1}</span><span><p>${esc(c)}</p></span></button>`).join("")}${input("Choose a response above, or write your own. What is your reason?", "pressure", "Explain your response, or write a different reaction…", pressureChoice !== null ? '<p class="micro">Your selected response is recorded with your explanation.</p>' : "")}`;
    }
    case "pressureReason":
      return `<span class="eyebrow orange">Your response under pressure</span><h2 tabindex="-1">What’s behind your response?</h2><div class="bubble you">${esc(S.pressure.response)}</div>${input("Why did you choose that response?", "pressure-reason", "A brief explanation, “unsure,” or “pass” is fine.")}`;
    case "synthesis":
      return `<span class="eyebrow">Take a moment</span><h2 tabindex="-1">What have you heard?</h2>${S.synthesis ? `<div class="text-block markdown">${renderMarkdown(S.synthesis)}</div>${input("What do you think now? After everything you’ve heard, what feels most important to you now? Did anything reinforce, complicate, or change how you think about your original choice?", "reflection")}` : retryPanel("synthesis", "Bring together the perspectives you actually heard.")}`;
    case "final":
      return `<span class="eyebrow">Your recommendation</span><h2 tabindex="-1">Now, what should<br>Boston build?</h2><p>Your original choice was ${S.initial} — ${esc(C.options.find((o) => o.id === S.initial).title)}.</p>${!draftFinal ? `${options()}<div class="button-row">${button("Keep my original choice", "keep", false, "secondary")}${button("Keep my choice, but amend it", "amend", false, "secondary")}</div><div class="button-row">${button("Change my position →", "change", !selected || selected === S.initial)}</div><p class="micro">To change your position, select a different option above. You can then add up to two amendments.</p>` : `<div class="package"><strong>Option ${draftFinal.option} · ${esc(C.options.find((o) => o.id === draftFinal.option).title)}</strong>${draftFinal.option === S.initial ? "Keeping your original base option" : "Changing your base option"}</div><p class="micro">Select a base option below if you want to change it.</p>${options(draftFinal.option)}${amendments()}<p class="counter">${draftFinal.amendments.length} of 2 amendments selected</p><div class="button-row">${button("Confirm recommendation →", "confirm-package")}${button("Back", "back-final", false, "secondary")}</div>`}`;
    case "benefits":
      return `<span class="eyebrow">Consider the consequences · ${S.benefits.length + 1} of 3</span><h2 tabindex="-1">Who benefits?<br>Who carries the costs?</h2>${packageSummary()}${input(benefitQuestions[S.benefits.length], "benefit", "Your thoughts, “unsure,” or “pass”…")}<div class="button-row">${button("Revise recommendation", "revise", busy, "secondary")}</div>`;
    case "mitigation":
      return `<span class="eyebrow">Before the city moves forward</span><h2 tabindex="-1">Make your commitments clear.</h2>${packageSummary()}${S.mitigationReview ? `<div class="text-block markdown">${renderMarkdown(S.mitigationReview)}</div><p>Do you want to include any changes from your reflections? Review and confirm your whole package; nothing is added automatically.</p><div class="button-row">${button("Revise recommendation", "revise", busy, "secondary")}${button("Keep this package · see five years later →", "implement", busy)}</div>` : retryPanel("mitigation", "Review possible changes raised in your reflections before implementing.")}`;
    case "ending":
      return `<span class="eyebrow orange">Five years later</span><h2 tabindex="-1">A different avenue.<br>The same question.</h2>${packageSummary()}<p class="quote">${endingTransition}</p>${S.ending ? `<div class="text-block markdown">${renderMarkdown(endingNarrative(S.ending))}</div>${input(S.reasonPending ? "What is your reason? You can also pass." : feedbackQuestions[0], "feedback", "Would you make the same choice? Tell us why, or pass.")}` : retryPanel("ending", "Returning to the avenue…")}`;
    case "feedback":
      return `<span class="eyebrow">A moment to look back · ${S.feedback.length + 1} of 4</span><h2 tabindex="-1">${S.feedback.length === 1 ? "How was the experience?" : S.feedback.length === 2 ? "What would you change?" : "Who else belongs here?"}</h2>${S.feedback.length === 1 ? `<p>${esc(feedbackQuestions[1])}</p><form data-submit="rating"><div class="rating">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rating="${i + 1}" class="${rating === i + 1 ? "selected" : ""}">${i + 1}</button>`).join("")}</div><div class="button-row"><button class="primary" ${rating ? "" : "disabled"}>Record rating →</button>${button("Pass", "pass-rating", false, "secondary")}</div></form>` : input(feedbackQuestions[S.feedback.length], "feedback", "Your thoughts, “none,” or “pass”…")}`;
    default:
      return "";
  }
}
function retryPanel(kind, label) {
  return `<p>${esc(label)}</p>${busy ? '<div class="busy" role="status">Composing a response…</div>' : button("Continue →", `generate-${kind}`)}`;
}
function render() {
  if (S.stage === "welcome") {
    app.innerHTML = welcome();
  } else if (S.stage === "complete") {
    app.innerHTML = `${stepper()}<section class="complete"><span class="eyebrow">Your time on the avenue</span><h1>Thanks for playing<br>the game!</h1><p>Your choices and field notes are saved on this device.</p>${packageSummary()}<div class="button-row" style="justify-content:center">${button("Read my field notes", "notes", false, "secondary")}${button("Play again ↗", "restart")}</div></section>${footer()}`;
  } else
    app.innerHTML = `${stepper()}<div class="workspace">${visual()}<section class="panel" aria-label="Current game step">${panel()}</section></div>${footer()}`;
  bind();
  reveal.sync();
  $("#note-count").textContent = S.notes.length;
}
function bind() {
  $("#street-reveal-range")?.addEventListener("input", (e) =>
    reveal.set(e.target.value),
  );
  app
    .querySelectorAll("[data-action]")
    .forEach((el) => (el.onclick = () => action(el.dataset.action)));
  app.querySelectorAll("[data-view]").forEach(
    (el) =>
      (el.onclick = () => {
        rememberDraft();
        view = el.dataset.view;
        render();
      }),
  );
  app.querySelectorAll("[data-preview]").forEach(
    (el) =>
      (el.onclick = () => {
        rememberDraft();
        preview = el.dataset.preview;
        render();
      }),
  );
  app.querySelectorAll("[data-lane]").forEach((el) => {
    const show = () => {
      const info = {
        Bus: "Dedicated bus space separates buses from general traffic. Intersections and bottlenecks still affect reliability.",
        Bike: "Bike space supports cycling. Its extent competes with other uses of this limited street.",
        Traffic:
          "General traffic carries drivers, workers, and families. Allocating more space here leaves less for other improvements.",
        "Traffic + bus":
          "Buses share general traffic space and remain affected by congestion.",
        Walk: "Sidewalks and crossings support walking, access to transit, and neighborhood life.",
        Curb: "The curb serves parking, deliveries, loading, and pickup. These uses compete for the same street edge.",
      };
      const target = $("#lane-info");
      if (target) {
        const name = el.dataset.lane;
        const comparison =
          name === "Curb"
            ? " C keeps more of this space than B."
            : name === "Bike" || name === "Walk"
              ? " B gives more room to this use than C."
              : name === "Bus"
                ? " Both B and C include center-running bus priority; retaining more access in C limits the improvements possible."
                : "";
        target.textContent =
          (info[name] || "") + (preview === "A" ? "" : comparison);
      }
    };
    el.onclick = show;
    el.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
    };
  });
  app.querySelectorAll("[data-option]").forEach(
    (el) =>
      (el.onclick = () => {
        selected = el.dataset.option;
        preview = selected;
        if (draftFinal) draftFinal.option = selected;
        render();
      }),
  );
  app.querySelectorAll("[data-priority]").forEach(
    (el) =>
      (el.onclick = () => {
        const id = Number(el.dataset.priority);
        if (selectedPriorities.includes(id))
          selectedPriorities = selectedPriorities.filter((x) => x !== id);
        else if (selectedPriorities.length < 2) selectedPriorities.push(id);
        else
          return toast(
            "Choose exactly two priorities. Deselect one to choose another.",
          );
        render();
      }),
  );
  app.querySelectorAll("[data-person]").forEach(
    (el) =>
      (el.onclick = () => {
        S.active = { name: el.dataset.person, type: el.dataset.type };
        S.conversation = [];
        go("interview");
      }),
  );
  app.querySelectorAll("[data-pressure]").forEach(
    (el) =>
      (el.onclick = () => {
        rememberDraft();
        pressureChoice = Number(el.dataset.pressure);
        render();
      }),
  );
  app.querySelectorAll("[data-amendment]").forEach(
    (el) =>
      (el.onchange = () => {
        try {
          draftFinal.amendments = addAmendment(
            draftFinal.amendments,
            Number(el.dataset.amendment),
          );
        } catch (e) {
          toast(e.message);
        }
        render();
      }),
  );
  app.querySelectorAll("[data-rating]").forEach(
    (el) =>
      (el.onclick = () => {
        rating = Number(el.dataset.rating);
        render();
      }),
  );
  app.querySelectorAll("form[data-submit]").forEach(
    (form) =>
      (form.onsubmit = (e) => {
        e.preventDefault();
        if (busy) return;
        const value = new FormData(form).get("answer");
        submit(form.dataset.submit, String(value || "").trim()).catch((e) =>
          toast(e.message),
        );
      }),
  );
  $("#answer")?.addEventListener("input", (e) => {
    draft = e.target.value;
  });
}
function rememberDraft() {
  if ($("#answer")) draft = $("#answer").value;
}
async function api(kind, extra = {}) {
  busy = true;
  render();
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, state: S, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || "Unable to complete this response.");
    return data.text;
  } finally {
    busy = false;
  }
}
async function generate(kind) {
  try {
    const t = await api(kind);
    if (kind === "synthesis") {
      S.synthesis = t;
      note("", t);
    }
    if (kind === "mitigation") S.mitigationReview = t;
    if (kind === "ending") {
      S.ending = endingNarrative(t);
      note("Five years later", S.ending);
    }
    save();
    render();
  } catch (e) {
    render();
    toast(e.message);
  }
}
async function action(a) {
  if (a === "replay-street") {
    reveal.play();
    return;
  }
  if (busy) return;
  if (a === "begin") return go("opening");
  if (a === "initial" && selected) {
    S.initial = selected;
    note(
      "Your first choice",
      `${selected} — ${C.options.find((o) => o.id === selected).title}`,
    );
    return go("priorities");
  }
  if (a === "priorities" && selectedPriorities.length === 2) {
    S.priorities = [...selectedPriorities];
    note(
      "Your starting priorities",
      S.priorities.map((i) => C.priorities[i]).join(" · "),
    );
    return go("people");
  }
  if (a === "next-person") {
    const type = S.active.type,
      record = S[type].find((x) => x.name === S.active.name);
    if (!record) return;
    record.resolved = true;
    S.active = null;
    if (type === "people")
      return go(S.people.length === 3 ? "experts" : "people");
    return go(S.experts.length === 3 ? "pressure" : "experts");
  }
  if (a === "stop-experts") return go("pressure");
  if (a === "keep") {
    S.final = { option: S.initial, amendments: [], confirmed: true };
    return finishPackage();
  }
  if (a === "amend") {
    draftFinal = { option: S.initial, amendments: [] };
    render();
    return;
  }
  if (a === "change" && selected && selected !== S.initial) {
    draftFinal = { option: selected, amendments: [] };
    render();
    return;
  }
  if (a === "confirm-package" && validPackage(draftFinal)) {
    S.final = { ...structuredClone(draftFinal), confirmed: true };
    draftFinal = null;
    return finishPackage();
  }
  if (a === "back-final") {
    draftFinal = null;
    render();
    return;
  }
  if (a === "revise") {
    S.returnStage = S.stage;
    draftFinal = {
      option: S.final.option,
      amendments: [...S.final.amendments],
    };
    S.mitigationResolved = false;
    S.mitigationReview = null;
    go("final");
    return;
  }
  if (a === "implement") {
    try {
      S.mitigationResolved = true;
      freeze(S);
      preview = S.final.option;
      reveal.set(0);
      note(
        "Frozen recommendation",
        `${S.final.option} — ${S.final.amendments.map((i) => C.amendments.find((a) => a.id === i).name).join("; ") || "Without amendments"}`,
      );
      go("ending");
      reveal.play();
      await generate("ending");
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (a.startsWith("generate-")) return generate(a.slice(9));
  if (a === "pass-rating") {
    S.feedback.push("pass");
    return go("feedback");
  }
  if (a === "notes") return openNotes();
  if (a === "restart") return restart();
}
function finishPackage() {
  note(
    "Recommendation",
    `${S.final.option} — ${S.final.amendments.map((i) => C.amendments.find((a) => a.id === i).name).join("; ") || "Without amendments"}`,
  );
  const returnStage = S.returnStage;
  S.returnStage = null;
  S.mitigationReview = null;
  if (returnStage === "mitigation") {
    go("mitigation");
    generate("mitigation");
  } else go("benefits");
}
async function submit(type, text) {
  if (type === "rating") {
    if (!rating) return;
    S.feedback.push(String(rating));
    rating = null;
    go("feedback");
    return;
  }
  if (!text) return;
  if (type === "ask" || type === "followup") {
    const followup = type === "followup",
      record = S[S.active.type].find((x) => x.name === S.active.name);
    if (followup && (!record || record.followup)) return;
    const question = text,
      person = S.active.name;
    draft = text;
    try {
      const answer = await api("dialogue", {
        person,
        question,
        followup,
        history: S.conversation,
      });
      S.conversation.push(
        { role: "you", text: question },
        { role: "speaker", text: answer },
      );
      if (!followup)
        S[S.active.type].push({
          name: person,
          question,
          answer,
          resolved: false,
          followup: null,
        });
      else {
        record.followup = { question, answer };
        record.resolved = false;
      }
      note(
        `${person}${followup ? " · Follow-up" : ""}`,
        `You: ${question}\n\n${person}: ${answer}`,
      );
      draft = "";
      save();
      render();
    } catch (e) {
      render();
      toast(e.message);
    }
    return;
  }
  if (type === "pressure") {
    const choice =
      pressureChoice !== null
        ? C.events[S.initial].choices[pressureChoice]
        : null;
    S.pressure = { response: choice || text, reason: choice ? text : null };
    if (
      !choice &&
      /\b(because|since|so that|as I|I think|I worry)\b/i.test(text)
    )
      S.pressure.reason = text;
    note("Public pressure · Response", S.pressure.response);
    if (!S.pressure.reason) return go("pressureReason");
    note("Public pressure · Reason", S.pressure.reason);
    go("synthesis");
    return generate("synthesis");
  }
  if (type === "pressure-reason") {
    S.pressure.reason = text;
    note("Public pressure · Reason", text);
    go("synthesis");
    return generate("synthesis");
  }
  if (type === "reflection") {
    S.reflection = text;
    note("Your reflection", text);
    selected = null;
    return go("final");
  }
  if (type === "benefit") {
    note(benefitQuestions[S.benefits.length], text);
    S.benefits.push(text);
    if (S.benefits.length < 3) return go("benefits");
    go("mitigation");
    return generate("mitigation");
  }
  if (type === "feedback") {
    if (
      S.feedback.length === 0 &&
      !S.reasonPending &&
      !/^(pass|unsure|decline|prefer not|skip)\b/i.test(text) &&
      !/\b(because|since|reason|due to|so that)\b/i.test(text) &&
      text.split(/\s+/).length < 16
    ) {
      S.reconsiderAnswer = text;
      S.reasonPending = true;
      draft = "";
      save();
      render();
      const label = $(".question-label");
      if (label) label.textContent = "What is your reason? You can also pass.";
      return;
    }
    if (S.reasonPending) {
      text = `${S.reconsiderAnswer}\nReason: ${text}`;
      S.reasonPending = false;
    }
    note(feedbackQuestions[S.feedback.length], text);
    S.feedback.push(text);
    return go(S.feedback.length === 4 ? "complete" : "feedback");
  }
}
function openNotes() {
  modal(
    `<span class="eyebrow">Your notebook</span><h2>Field notes</h2><p class="micro">Saved on this device. Your words and the perspectives you heard.</p>${S.notes.length ? S.notes.map((n) => `<article class="note"><h3>${esc(n.title)}</h3><div class="markdown">${renderMarkdown(n.title === "Five years later" ? endingNarrative(n.text) : n.text)}</div></article>`).join("") : "<p>Your notes will appear here as you play.</p>"}<div class="button-row">${button("Download notes", "export", false, "secondary")}</div>`,
  );
  $('#modal [data-action="export"]').onclick = () => {
    const blob = new Blob(
      [S.notes.map((n) => `${n.title}\n${n.text}`).join("\n\n————\n\n")],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "blue-hill-field-notes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}
$("#journal").onclick = openNotes;
$("#settings").onclick = () => {
  modal(
    `<span class="eyebrow">Game settings</span><h2>Take your time.</h2><p>Your progress saves automatically in this browser. You can close the tab and come back to the current question.</p><p>${status.ai ? "DeepSeek dialogue is connected. Questions and game context are sent to DeepSeek to generate responses." : "You are in offline preview mode. Characters share prerecorded perspectives rather than generated answers. To enable live AI, configure DEEPSEEK_API_KEY in the server’s .env file and restart it."}</p><p class="micro">All characters and outcomes are simulated. No answers are submitted to Boston or the MBTA.</p><div class="button-row">${button("Start a new game", "reset", false, "secondary")}</div>`,
  );
  $('#modal [data-action="reset"]').onclick = restart;
};
function restart() {
  modal(
    `<h2>Start a fresh visit?</h2><p>This removes the current game and field notes from this browser. Download your notes first if you want to keep them.</p><div class="button-row">${button("Start new game", "confirm-reset")}${button("Keep playing", "cancel-reset", false, "secondary")}</div>`,
  );
  $('#modal [data-action="cancel-reset"]').onclick = () => $("#modal").close();
  $('#modal [data-action="confirm-reset"]').onclick = () => {
    reveal.set(100);
    S = fresh();
    selected = null;
    selectedPriorities = [];
    draftFinal = null;
    pressureChoice = null;
    rating = null;
    draft = "";
    $("#modal").close();
    save();
    render();
  };
}
render();
