
let subjects = [];
let questions = [];
let currentIdx = 0;
let currentFile = "";

// Init
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('data/master_index.json');
        if (!res.ok) throw new Error("Failed to load master index");
        subjects = await res.json();
        renderSidebar(subjects);
    } catch (e) {
        console.error("Init error:", e);
        document.getElementById('subject-list').innerHTML = "<li>Error loading index. Please check console.</li>";
    }
});

// Sidebar Logic
function renderSidebar(data) {
    const list = document.getElementById('subject-list');
    list.innerHTML = "";
    data.forEach(s => {
        const li = document.createElement('li');
        li.textContent = `${s.subject} (${s.question_count})`;
        li.onclick = () => loadSubject(s.file, s.subject, li);
        list.appendChild(li);
    });
}

function filterSubjects() {
    const term = document.getElementById('subjectSearch').value.toLowerCase();
    const filtered = subjects.filter(s => s.subject.toLowerCase().includes(term));
    renderSidebar(filtered);
}

// Load Quiz
async function loadSubject(file, name, el) {
    document.querySelectorAll('#subject-list li').forEach(l => l.classList.remove('active'));
    if(el) el.classList.add('active');
    
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('quiz-interface').classList.remove('hidden');
    document.getElementById('quiz-title').textContent = name;
    document.getElementById('progress-container').classList.remove('hidden');
    
    currentFile = file;
    try {
        const res = await fetch(`data/${file}`);
        questions = await res.json();
        currentIdx = 0;
        renderQuestion();
    } catch (e) {
        alert("Error loading question file: " + file);
    }
}

// Render Engine
function renderQuestion() {
    const q = questions[currentIdx];
    
    // Progress
    document.getElementById('q-counter').textContent = `Q ${currentIdx + 1} of ${questions.length}`;
    const pct = ((currentIdx + 1) / questions.length) * 100;
    document.getElementById('progress-fill').style.width = `${pct}%`;
    document.getElementById('progress-fill').style.background = 'var(--primary)';
    document.getElementById('progress-fill').style.height = '100%';

    // Content
    document.getElementById('q-text').textContent = q.question_text;
    
    // Images
    const imgContainer = document.getElementById('q-images');
    imgContainer.innerHTML = "";
    if(q.images && q.images.length > 0) {
        q.images.forEach(img => {
            const i = document.createElement('img');
            i.src = `data/images/${img}`;
            i.onclick = () => window.open(i.src, '_blank');
            imgContainer.appendChild(i);
        });
    }

    // Options
    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = "";
    const labels = ['a', 'b', 'c', 'd'];
    
    q.options.forEach((optText, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = optText;
        btn.onclick = () => handleAnswer(labels[i], btn);
        optContainer.appendChild(btn);
    });

    // Reset Explanation
    document.getElementById('explanation-panel').classList.add('hidden');
    document.getElementById('btn-prev').disabled = (currentIdx === 0);
    document.getElementById('btn-next').disabled = (currentIdx === questions.length - 1);
}

function handleAnswer(selected, btn) {
    const q = questions[currentIdx];
    // Normalizing answer key to ensure it matches 'a', 'b', 'c', 'd'
    const correct = q.correct_option ? q.correct_option.toLowerCase().trim() : '';
    
    // Disable all
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);

    if(selected === correct) {
        btn.classList.add('correct');
        showExplanation(true);
    } else {
        btn.classList.add('wrong');
        showExplanation(false);
        
        // Highlight correct answer automatically
        const btns = document.querySelectorAll('.opt-btn');
        const correctIdx = ['a','b','c','d'].indexOf(correct);
        if(correctIdx > -1 && btns[correctIdx]) {
            btns[correctIdx].classList.add('correct');
        }
    }
}

function showExplanation(isCorrect) {
    const q = questions[currentIdx];
    const panel = document.getElementById('explanation-panel');
    const status = document.getElementById('answer-status');
    const text = document.getElementById('exp-text');
    
    status.textContent = isCorrect ? "Correct!" : "Incorrect";
    status.style.color = isCorrect ? "var(--success)" : "var(--error)";
    
    let expContent = q.explanation || "No detailed explanation provided.";
    expContent = expContent.replace(/\n/g, '<br>');
    
    text.innerHTML = expContent;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleExp() {
    const panel = document.getElementById('explanation-panel');
    if (panel.classList.contains('hidden')) {
        showExplanation(true);
        document.getElementById('answer-status').textContent = "Revealed";
        document.getElementById('answer-status').style.color = "var(--warning)";
    } else {
        panel.classList.add('hidden');
    }
}

function prevQ() {
    if(currentIdx > 0) {
        currentIdx--;
        renderQuestion();
    }
}

function nextQ() {
    if(currentIdx < questions.length - 1) {
        currentIdx++;
        renderQuestion();
    }
}
