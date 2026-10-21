const projects = {
  pitwall: {
    status: "Web app pubblica",
    title: "Analisi di gare<br>di Formula 1",
    description:
      "Confronto tra due piloti: posizioni, tempi sul giro, pneumatici e soste nelle gare concluse.",
    tech: "React · TypeScript · Cloudflare Workers",
    link: "https://pitwall.ago-filo-labs.workers.dev/?season=2024&race=9472&drivers=16,55",
    action: "Esplora una gara",
    source: "https://github.com/Ago-filo/Pitwall",
    image:
      "https://raw.githubusercontent.com/Ago-filo/Pitwall/bc1ac73234bfb70623f7da0838c6075eaae761d6/docs/comparison.png",
    alt: "Grafici reali di posizione e passo in PitWall",
    caption: "Leclerc / Sainz — Bahrain 2024",
    note: "Dati mancanti e limiti dell’analisi restano espliciti.",
  },
  fantamuretto: {
    status: "Web app pubblica",
    title: "Asta del<br>fantacalcio",
    description:
      "Preparazione e gestione dell’asta: fasce personali, prezzi obiettivo, budget e rose avversarie.",
    tech: "JavaScript · HTML · CSS · Dati nel browser",
    link: "https://ago-filo.github.io/Fantamuretto/",
    action: "Apri Fantamuretto",
    source: "https://github.com/Ago-filo/Fantamuretto",
    image: "images/fantamuretto-dashboard.png",
    alt: "Schermata reale della regia di Fantamuretto",
    caption: "Regia d’asta — configurazione demo",
    note: "I piani personali si possono importare ed esportare.",
  },
  brain: {
    status: "Esperimento personale",
    title: "Ricerca nelle note<br>con AI locale",
    description:
      "Un esperimento di ricerca e risposta sui documenti, con note in Obsidian e un modello eseguito localmente.",
    tech: "Obsidian · AnythingLLM · LM Studio",
    caption: "Note → Ricerca → Modello locale",
    note: "Risposte con riferimenti alle fonti e aggiornamento delle note in valutazione.",
  },
};
const panel = document.querySelector(".project-panel");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let transitionID = 0;
async function selectProject(key, focus = false) {
  const ticket = ++transitionID;
  const p = projects[key];
  document.querySelectorAll("[role=tab]").forEach((tab) => {
    const active = tab.dataset.project === key;
    tab.setAttribute("aria-selected", active);
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  panel.setAttribute("aria-labelledby", "tab-" + key);
  if (!reduce.matches)
    await panel.animate([{ opacity: 1 }, { opacity: 0.2 }], {
      duration: 120,
      fill: "forwards",
    }).finished;
  if (ticket !== transitionID) return;
  panel.getAnimations().forEach((a) => a.cancel());
  panel.dataset.current = key;
  document.querySelector("#project-title").innerHTML = p.title;
  for (const [field, id] of [
    ["status", "project-status"],
    ["description", "project-description"],
    ["tech", "project-tech"],
    ["note", "project-note"],
    ["caption", "preview-caption"],
  ])
    document.getElementById(id).textContent = p[field];
  const isBrain = key === "brain";
  document.querySelector("#project-image").hidden = isBrain;
  document.querySelector("#brain-diagram").hidden = !isBrain;
  document.querySelector(".project-actions").hidden = isBrain;
  document.querySelector(".stage-caption span:last-child").textContent = isBrain
    ? "Schema del flusso"
    : "Anteprima reale ↗";
  if (!isBrain) {
    const img = document.querySelector("#project-image");
    img.src = p.image;
    img.alt = p.alt;
    document.querySelector("#project-link").href = p.link;
    document.querySelector("#project-link").innerHTML =
      p.action + ' <span aria-hidden="true">↗</span>';
    document.querySelector("#source-link").href = p.source;
    await img.decode().catch(() => {});
  }
  if (!reduce.matches)
    panel.animate([{ opacity: 0.2 }, { opacity: 1 }], {
      duration: 280,
      easing: "cubic-bezier(.16,1,.3,1)",
    });
}
window.selectProject = selectProject;
const tabs = [...document.querySelectorAll("[role=tab]")];
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectProject(tab.dataset.project));
  tab.addEventListener("keydown", (e) => {
    let next;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      selectProject(tabs[next].dataset.project, true);
    }
  });
});
const stage = document.querySelector(".stage");
stage.addEventListener("pointermove", (e) => {
  if (reduce.matches || e.pointerType !== "mouse") return;
  const r = stage.getBoundingClientRect();
  stage.style.setProperty(
    "--tilt-y",
    ((e.clientX - r.left) / r.width - 0.5) * 5 + "deg",
  );
  stage.style.setProperty(
    "--tilt-x",
    -((e.clientY - r.top) / r.height - 0.5) * 4 + "deg",
  );
});
stage.addEventListener("pointerleave", () => {
  stage.style.setProperty("--tilt-x", "0deg");
  stage.style.setProperty("--tilt-y", "0deg");
});
document.querySelector(".theme-switch").addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = light ? "light" : "dark";
  document
    .querySelector(".theme-switch")
    .setAttribute(
      "aria-label",
      light ? "Attiva tema scuro" : "Attiva tema chiaro",
    );
});
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        document.querySelectorAll(".dock a").forEach((a) => {
          if (a.getAttribute("href") === "#" + entry.target.id)
            a.setAttribute("aria-current", "location");
          else a.removeAttribute("aria-current");
        });
      }
  },
  { rootMargin: "-15% 0px -65% 0px" },
);
["main", "progetti", "esperienza"].forEach((id) =>
  observer.observe(document.getElementById(id)),
);
