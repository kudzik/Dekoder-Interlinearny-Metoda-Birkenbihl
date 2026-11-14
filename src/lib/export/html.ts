import type { DecodedDocument } from "../decode/schema";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tokenMarkup(token: DecodedDocument["blocks"][number]["sentences"][number]["tokens"][number]): string {
  const chunkClass = token.is_chunk ? " chunk" : "";
  const grammar = token.grammar ? ` title="${escapeHtml(token.grammar)}"` : "";
  return `<button class="token${chunkClass}" type="button" data-speak="${escapeHtml(token.en)}"${grammar}><span class="pl">${escapeHtml(token.pl_literal)}</span><span class="en">${escapeHtml(token.en)}</span></button>`;
}

export function createStandaloneHtml(document: DecodedDocument): string {
  const blocks = document.blocks
    .map((block) => {
      const sentences = block.sentences
        .map(
          (sentence) => {
            const content = sentence.tokens.map(tokenMarkup).join(" ");
            const text = block.type === "heading" ? `<h${block.level ?? 1}>${content}</h${block.level ?? 1}>` : `<div>${content}</div>`;
            return `<section class="sentence" data-sentence="${escapeHtml(sentence.id)}">${text}<p class="natural">${escapeHtml(sentence.natural_pl)}</p><button class="play-sentence" type="button">Odtwórz zdanie</button></section>`;
          },
        )
        .join("\n");
      return `<div class="block${block.type === "list-item" ? " list-item" : ""}">${sentences}</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dekodowanie — Metoda Birkenbihl</title>
<style>
body{max-width:900px;margin:2rem auto;padding:0 1rem;background:#faf9f6;color:#1e293b;font:16px/1.6 system-ui,sans-serif}
.controls{position:sticky;top:0;padding:1rem 0;background:#faf9f6}
.token{display:inline-flex;flex-direction:column;vertical-align:bottom;margin:.2rem .4rem .7rem 0;padding:.2rem .35rem;border:0;border-radius:.4rem;background:transparent;cursor:pointer}
.token:hover,.token:focus{outline:2px solid #0d9488}.token.chunk{border-bottom:2px dashed #d97706}
.pl{color:#0f766e;font-size:.75rem}.en{font:1.15rem Georgia,serif}
.natural{display:none;color:#64748b;font-style:italic}.show-natural .natural{display:block}
.speaking{background:#ccfbf1}button{padding:.45rem .7rem}.block{margin:.5rem 0 1.5rem}.list-item{margin-left:1rem}
@media(prefers-color-scheme:dark){body,.controls{background:#0f172a;color:#f1f5f9}.pl{color:#5eead4}.speaking{background:#115e59}}
</style>
</head>
<body>
<nav class="controls"><button id="play-all" type="button">Czytaj całość</button><button id="toggle-natural" type="button">Pokaż/ukryj tłumaczenia</button><label>Tempo <input id="rate" type="range" min="0.6" max="1.2" step="0.1" value="1"></label></nav>
<main>${blocks}</main>
<script>
const rate=document.querySelector("#rate");
function speak(text,element){if(!("speechSynthesis"in window)){return}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="en-US";utterance.rate=Number(rate.value);if(element){element.classList.add("speaking");utterance.onend=()=>element.classList.remove("speaking");utterance.onerror=()=>element.classList.remove("speaking")}speechSynthesis.speak(utterance)}
document.addEventListener("click",event=>{const target=event.target;if(!(target instanceof HTMLElement)){return}const token=target.closest("[data-speak]");if(token){speak(token.dataset.speak||"");return}const sentence=target.closest(".play-sentence");if(sentence){const section=sentence.closest(".sentence");speak(Array.from(section.querySelectorAll(".en")).map(node=>node.textContent).join(" "),section);return}if(target.id==="toggle-natural"){document.body.classList.toggle("show-natural")}if(target.id==="play-all"){if(!("speechSynthesis"in window)){return}const rows=Array.from(document.querySelectorAll(".sentence"));let index=0;const next=()=>{if(index>=rows.length){return}const row=rows[index++];row.scrollIntoView({behavior:"smooth",block:"center"});const utterance=new SpeechSynthesisUtterance(Array.from(row.querySelectorAll(".en")).map(node=>node.textContent).join(" "));utterance.lang="en-US";utterance.rate=Number(rate.value);utterance.onend=next;speechSynthesis.speak(utterance)};speechSynthesis.cancel();next()}});
</script>
</body>
</html>`;
}
