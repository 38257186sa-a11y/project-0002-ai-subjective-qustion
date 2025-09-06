// ======= AI Quiz Hub - frontend (app.js) =======

// --- Built-in prompt bank (local fallback) ---
const BUILTIN_BANK = {
  political_science: [
    { title: 'Hegemony in Gramsci', promptTopic: 'Critically analyze the concept of hegemony in Antonio Gramsci’s Prison Notebooks.' },
    { title: 'Sovereignty: Bodin & Hobbes', promptTopic: 'Compare Jean Bodin and Thomas Hobbes on sovereignty.' }
  ],
  ssc_history: [
    { title: 'Revolt of 1857', promptTopic: 'Discuss causes and consequences of the Revolt of 1857.' }
  ],
  history: [
    { title: 'Ashoka and Dhamma', promptTopic: 'Explain Ashoka’s Dhamma policy and its impact.' }
  ],
  world_history: [
    { title: 'Russian Revolution 1917', promptTopic: 'Analyze causes and consequences of the Russian Revolution of 1917.' }
  ],
  languages: [
    { title: 'Kumaran Asan', promptTopic: 'Discuss Kumaran Asan’s role in Malayalam modern poetry.' }
  ],
  mixed: [
    { title: 'Comparative Politics', promptTopic: 'Trace transformation of Comparative Politics after WWII.' }
  ]
};

// --- Utility functions ---
const el = id => document.getElementById(id);
function log(msg){
  const a = el('logArea');
  a.innerText = (new Date()).toLocaleTimeString() + ' — ' + msg + '\n' + a.innerText;
}
function formatDate(d){ return d.toISOString().slice(0,10); }
function seedFromDate(dateStr){ let s=0; for(let i=0;i<dateStr.length;i++) s = ((s<<5)-s) + dateStr.charCodeAt(i); return Math.abs(s); }
function pickFromBank(topic,seed){ const arr = BUILTIN_BANK[topic] || BUILTIN_BANK['mixed']; return arr[seed % arr.length]; }
function generateComprehensionPlaceholders(n){ return Array.from({length:n},(_,i)=>({q:`Comprehension Q${i+1}?`, answer:'[Answer]'})); }
function generateMCQPlaceholders(n){ return Array.from({length:n},(_,i)=>({q:`MCQ ${i+1}?`, options:['A','B','C','D'], answer:'A'})); }

// --- DeepSeek proxy call (serverless) ---
async function callDeepSeek(prompt){
  try{
    const resp = await fetch('/.netlify/functions/deepseek', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prompt })
    });
    if(!resp.ok){
      const t = await resp.text();
      throw new Error('DeepSeek function error: ' + resp.status + ' ' + t);
    }
    const data = await resp.json();
    // serverless returns { output: "..." }
    return data.output || '';
  } catch(err){
    log('DeepSeek call failed: ' + err.message);
    throw err;
  }
}

// --- Generate module (tries AI, falls back to local placeholders) ---
async function generateModule({ topic, mode, date, essayCount, compCount, mcqCount }){
  const dateStr = formatDate(date);
  const seed = seedFromDate(dateStr);
  el('seedDisplay').innerText = seed;
  el('dateDisplay').innerText = dateStr;

  const base = pickFromBank(topic, seed);
  log('Picked base topic: ' + base.title);

  const module = { date: dateStr, seed, topic, essays: [] };

  for(let i=0;i<essayCount;i++){
    let essayText = `[Local placeholder] ${base.promptTopic}\n\n(Enable DeepSeek mode for AI-generated output.)`;
    let comp = generateComprehensionPlaceholders(compCount);
    let mcq = generateMCQPlaceholders(mcqCount);

    if(mode === 'deepseek'){
      // Build prompt that requests JSON output
      const aiPrompt = `${base.promptTopic}

Produce a JSON object EXACTLY in this format (no extra commentary):
{
  "essay": "<900-1200 word essay here>",
  "comprehension": [{"q":"<question>","answer":"<brief 20-40 word answer>"}, ...],
  "mcq": [{"q":"<question>","options":["optA","optB","optC","optD"],"answer":"<correct option text>"} , ...]
}

Essay must be academic (UGC NET / MA-level). Provide ${compCount} comprehension Q&As and ${mcqCount} MCQs.`;

      try{
        const output = await callDeepSeek(aiPrompt);
        // Attempt to parse AI response as JSON
        let parsed = null;
        try { parsed = JSON.parse(output); } catch(e){ /* maybe AI returned text + JSON or plain text */ }

        if(parsed && parsed.essay){
          essayText = parsed.essay;
          comp = Array.isArray(parsed.comprehension) ? parsed.comprehension : comp;
          mcq = Array.isArray(parsed.mcq) ? parsed.mcq : mcq;
          log('AI returned structured JSON and was parsed successfully.');
        } else {
          // try to find first JSON-looking substring
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}');
          if(jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart){
            const candidate = output.slice(jsonStart, jsonEnd+1);
            try { parsed = JSON.parse(candidate); } catch(e) { parsed = null; }
            if(parsed && parsed.essay){
              essayText = parsed.essay;
              comp = Array.isArray(parsed.comprehension) ? parsed.comprehension : comp;
              mcq = Array.isArray(parsed.mcq) ? parsed.mcq : mcq;
              log('Found JSON inside AI output and parsed.');
            } else {
              // fallback: use entire output as essay text
              essayText = output;
              log('AI output used as plain essay text (no structured JSON parsed).');
            }
          } else {
            essayText = output || essayText;
            log('AI output used as plain essay text (no JSON found).');
          }
        }
      } catch (err) {
        log('DeepSeek generation failed; using local placeholders.');
      }
    }

    module.essays.push({ title: base.title, essay: essayText, comprehension: comp, mcq: mcq });
  } // end essays loop

  return module;
}

// --- Render module to page ---
function renderModule(mod){
  const container = el('questionArea');
  container.innerHTML = '';
  mod.essays.forEach((es, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    const h = document.createElement('h3');
    h.innerText = `${idx+1}. ${es.title}`;
    wrap.appendChild(h);

    const essayDiv = document.createElement('div');
    essayDiv.innerHTML = `<pre>${es.essay}</pre>`;
    wrap.appendChild(essayDiv);

    const compH = document.createElement('h4'); compH.innerText = 'Comprehension Questions'; wrap.appendChild(compH);
    const ol = document.createElement('ol');
    (es.comprehension || []).forEach(item => {
      const li = document.createElement('li');
      li.innerText = item.q + (item.answer ? ' — ' + item.answer : '');
      ol.appendChild(li);
    });
    wrap.appendChild(ol);

    const mcqH = document.createElement('h4'); mcqH.innerText = 'MCQs'; wrap.appendChild(mcqH);
    (es.mcq || []).forEach(m => {
      const d = document.createElement('div'); d.className = 'mcq';
      const opts = (m.options || []).map((o,i)=>`${String.fromCharCode(65+i)}) ${o}`).join('  ');
      d.innerHTML = `<div><strong>Q:</strong> ${m.q}</div><div class="small"> ${opts}</div><div class="small"><strong>Answer:</strong> ${m.answer || ''}</div>`;
      wrap.appendChild(d);
    });

    container.appendChild(wrap);
  });
}

// --- Save / Download ---
function saveLastModule(mod){
  const saved = JSON.parse(localStorage.getItem('saved_modules') || '[]');
  saved.unshift(mod);
  localStorage.setItem('saved_modules', JSON.stringify(saved.slice(0,50)));
  log('Saved module to localStorage (saved_modules).');
}
function downloadModule(mod){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(mod, null, 2)], {type:'application/json'}));
  a.download = `ai_quiz_module_${mod.date}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  log('Downloaded module JSON.');
}

// --- Wiring UI events ---
el('generateBtn').addEventListener('click', async ()=>{
  const topic = el('topicSelect').value;
  const mode = el('modeSelect').value;
  const essayCount = parseInt(el('essayCount').value,10) || 1;
  const compCount = parseInt(el('compCount').value,10) || 10;
  const mcqCount = parseInt(el('mcqCount').value,10) || 2;

  el('generateBtn').disabled = true;
  el('generateBtn').innerText = 'Generating...';
  try{
    const module = await generateModule({ topic, mode, date: new Date(), essayCount, compCount, mcqCount });
    renderModule(module);
    localStorage.setItem('last_module', JSON.stringify(module));
    log('Module generated and saved to last_module.');
  } catch(e){
    log('Generation failed: ' + e.message);
  } finally {
    el('generateBtn').disabled = false;
    el('generateBtn').innerText = 'Generate Today\'s Set';
  }
});

el('regenerateBtn').addEventListener('click', ()=>{
  // change date seed by random offset 1..7 days
  const offset = Math.floor(Math.random()*7)+1;
  const date = new Date(); date.setDate(date.getDate() + offset);
  const seed = seedFromDate(formatDate(date));
  el('seedDisplay').innerText = seed;
  log('Regenerate clicked — using random future seed offset: ' + offset);
  // simply click generate (uses current date, but this gives randomness in pickFromBank)
  el('generateBtn').click();
});

el('saveBtn').addEventListener('click', ()=>{
  const mod = JSON.parse(localStorage.getItem('last_module') || 'null');
  if(!mod) { alert('No module to save. Generate one first.'); return; }
  saveLastModule(mod);
  alert('Saved locally in browser storage.');
});

el('downloadBtn').addEventListener('click', ()=>{
  const mod = JSON.parse(localStorage.getItem('last_module') || 'null');
  if(!mod) { alert('No module to download. Generate one first.'); return; }
  downloadModule(mod);
});

// --- Init on load ---
(function init(){
  el('dateDisplay').innerText = formatDate(new Date());
  el('seedDisplay').innerText = seedFromDate(formatDate(new Date()));
  const last = localStorage.getItem('last_module');
  if(last) {
    try{ renderModule(JSON.parse(last)); } catch(e){}
  }
  log('App initialized.');
})();
