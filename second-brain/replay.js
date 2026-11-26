const buttons = [...document.querySelectorAll("[data-question]")];
const question = document.querySelector("#question");
const answer = document.querySelector("#answer");
const sources = document.querySelector("#sources");

function showQuestion(key) {
  const item = demoQuestions[key];
  buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.question === key)));
  question.textContent = item.question;
  answer.textContent = item.answer;
  const passages = item.sources.map(({ title, text }) => {
    const quote = document.createElement("blockquote");
    const excerpt = document.createElement("p");
    const label = document.createElement("cite");
    excerpt.textContent = text;
    label.textContent = title;
    quote.append(excerpt, label);
    return quote;
  });
  if (passages.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Nessun importo riportato nelle note.";
    passages.push(empty);
  }
  sources.replaceChildren(...passages);
}

buttons.forEach((button) => button.addEventListener("click", () => showQuestion(button.dataset.question)));
showQuestion(buttons[0].dataset.question);
