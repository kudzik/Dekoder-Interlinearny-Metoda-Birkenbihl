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
            const text = block.type === "heading" ? `<h${block.level ?? 1} class="tokens">${content}</h${block.level ?? 1}>` : `<div class="tokens">${content}</div>`;
            return `<section class="sentence${block.type === "heading" ? " heading-sentence" : ""}" data-sentence="${escapeHtml(sentence.id)}"><button class="play-sentence icon-button" type="button" aria-label="Odtwórz zdanie" title="Odtwórz zdanie">▶</button><div class="sentence-content">${text}<p class="natural"><strong>Naturalnie:</strong> ${escapeHtml(sentence.natural_pl)}</p></div></section>`;
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
<title>Arkusz dekodowania — Metoda Birkenbihl</title>
<style>
:root{color-scheme:light dark;--canvas:#f6f5f0;--paper:#fffefa;--ink:#172033;--muted:#64748b;--line:#e7e3da;--brand:#078f82}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}
.page{width:min(960px,calc(100% - 2rem));margin:2rem auto}.hero{margin-bottom:1rem}.eyebrow{margin:0;color:var(--brand);font-size:.72rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.hero h1{margin:.2rem 0;font:700 clamp(1.65rem,4vw,2.4rem)/1.2 Georgia,serif}.intro{margin:.4rem 0;color:var(--muted)}
.controls{position:sticky;z-index:10;top:.5rem;display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:1rem 0;padding:.65rem;border:1px solid var(--line);border-radius:1rem;background:color-mix(in srgb,var(--paper) 92%,transparent);box-shadow:0 8px 28px rgb(15 23 42/.08);backdrop-filter:blur(12px)}
.controls button{min-height:2.5rem;border:1px solid var(--line);border-radius:.7rem;background:var(--paper);padding:.5rem .8rem;color:inherit;font-weight:700;cursor:pointer}.controls button:first-child{border-color:var(--brand);background:var(--brand);color:white}.controls label{display:flex;align-items:center;gap:.5rem;margin-left:auto;color:var(--muted);font-size:.85rem}
main{overflow:hidden;border:1px solid var(--line);border-radius:1.25rem;background:var(--paper);box-shadow:0 16px 44px rgb(15 23 42/.06)}
.block{padding:1.25rem clamp(.75rem,3vw,2rem)}.block+.block{border-top:1px solid var(--line)}.list-item{padding-left:clamp(1.5rem,5vw,3rem)}
.sentence{display:grid;grid-template-columns:2.5rem minmax(0,1fr);gap:.55rem;align-items:start}.sentence+.sentence{margin-top:1.1rem}.sentence-content{min-width:0}.tokens{display:flex;flex-wrap:wrap;align-items:flex-end;gap:.15rem;margin:0}
.token{display:inline-flex;min-width:1.5rem;flex-direction:column;align-items:center;gap:.08rem;margin:0 0 .35rem;padding:.22rem .28rem;border:0;border-radius:.4rem;background:transparent;color:inherit;cursor:pointer}
.token:hover,.token:focus-visible{outline:2px solid var(--brand);background:color-mix(in srgb,var(--brand) 10%,transparent)}.token.chunk{border-bottom:2px dashed #d97706;background:color-mix(in srgb,#f59e0b 7%,transparent)}
.pl{color:#08786f;font-size:.78rem;line-height:1.35}.en{font:600 1.1rem/1.35 Georgia,serif}.heading-sentence .en{font-size:clamp(1.35rem,4vw,2rem)}
.icon-button{display:grid;width:2.5rem;height:2.5rem;margin-top:.65rem;place-items:center;border:1px solid #cbd5e1;border-radius:50%;background:#f8fafc;color:var(--brand);cursor:pointer}.heading-sentence .icon-button{margin-top:1.05rem}.icon-button:hover{border-color:var(--brand);background:var(--brand);color:white}
.natural{display:none;margin:.5rem 0 0;border-left:2px solid #cbd5e1;padding-left:.75rem;color:var(--muted);font-size:.9rem;font-style:italic}.show-natural .natural{display:block}.speaking{background:#ccfbf1}
button:focus-visible,input:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
@media(max-width:560px){.page{width:min(100% - 1rem,960px);margin:1rem auto}.controls{top:.25rem}.controls label{width:100%;margin-left:0}.block{padding:1rem .65rem}.sentence{gap:.35rem}.token{padding-inline:.2rem}}
@media(prefers-color-scheme:dark){:root{--canvas:#0b1220;--paper:#0f172a;--ink:#f1f5f9;--muted:#a8b4c5;--line:#2a374b}.pl{color:#5eead4}.icon-button{background:#1e293b;border-color:#475569}.speaking{background:#115e59}}
@media print{body{background:white;color:#111}.page{width:100%;margin:0}.controls{display:none}main{border:0;box-shadow:none}.natural{display:block}.block{break-inside:avoid;border-color:#ddd}.token{break-inside:avoid}.pl{color:#075e56}}
</style>
</head>
<body>
<div class="page">
<header class="hero"><p class="eyebrow">Metoda Birkenbihl</p><h1>Arkusz dekodowania</h1><p class="intro">Polskie znaczenie znajduje się nad odpowiadającym mu angielskim słowem lub zwrotem.</p></header>
<nav class="controls" aria-label="Sterowanie lekcją"><button id="play-all" type="button">▶ Czytaj całość</button><button id="toggle-natural" type="button">Pokaż naturalne tłumaczenia</button><label>Tempo <input id="rate" type="range" min="0.6" max="1.2" step="0.1" value="1"></label></nav>
<main>${blocks}</main>
</div>
<script>
const rate=document.querySelector("#rate");
function speak(text,element){if(!("speechSynthesis"in window)){return}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang="en-US";utterance.rate=Number(rate.value);if(element){element.classList.add("speaking");utterance.onend=()=>element.classList.remove("speaking");utterance.onerror=()=>element.classList.remove("speaking")}speechSynthesis.speak(utterance)}
document.addEventListener("click",event=>{const target=event.target;if(!(target instanceof HTMLElement)){return}const token=target.closest("[data-speak]");if(token){speak(token.dataset.speak||"");return}const sentence=target.closest(".play-sentence");if(sentence){const section=sentence.closest(".sentence");speak(Array.from(section.querySelectorAll(".en")).map(node=>node.textContent).join(" "),section);return}if(target.id==="toggle-natural"){document.body.classList.toggle("show-natural")}if(target.id==="play-all"){if(!("speechSynthesis"in window)){return}const rows=Array.from(document.querySelectorAll(".sentence"));let index=0;const next=()=>{if(index>=rows.length){return}const row=rows[index++];row.scrollIntoView({behavior:"smooth",block:"center"});const utterance=new SpeechSynthesisUtterance(Array.from(row.querySelectorAll(".en")).map(node=>node.textContent).join(" "));utterance.lang="en-US";utterance.rate=Number(rate.value);utterance.onend=next;speechSynthesis.speak(utterance)};speechSynthesis.cancel();next()}});
</script>
</body>
</html>`;
}
