
let subjects = [];
let syllabus = {};
let currentQuestions = [];
let filteredQuestions = [];
let currentIndex = 0;
let currentSubject = null;

const views = {
    home: document.getElementById('view-home'),
    chapters: document.getElementById('view-chapters'),
    quiz: document.getElementById('view-quiz')
};

// --- NAVIGATION ---
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
    window.scrollTo(0, 0);
}

function goHome() { showView('home'); }
function goBackToChapters() { showView('chapters'); }

// --- INIT ---
async function init() {
    try {
        // Load Syllabus (The Chapter Order)
        const sylRes = await fetch('./data/syllabus.json');
        syllabus = await sylRes.json();
        
        // Load Subject List
        const subRes = await fetch('./data/subjects.json');
        subjects = await subRes.json();
        
        renderHome();
    } catch (e) {
        console.error("Init failed", e);
        document.getElementById('subjectGrid').innerHTML = '<p style="color:red; text-align:center;">Error loading data. Please check internet or file path.</p>';
    }
}

function renderHome() {
    const grid = document.getElementById('subjectGrid');
    grid.innerHTML = '';
    subjects.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `<h3>${sub.name}</h3>`;
        card.onclick = () => loadSubject(sub);
        grid.appendChild(card);
    });
}

// --- LOAD SUBJECT ---
async function loadSubject(sub) {
    currentSubject = sub;
    document.getElementById('chapterPageTitle').innerText = sub.name;
    const list = document.getElementById('chapterList');
    list.innerHTML = '<li style="text-align:center; padding:20px;">Loading questions...</li>';
    showView('chapters');

    try {
        const res = await fetch(`./data/${sub.file}`);
        const data = await res.json();
        currentQuestions = data;
        renderChapters(data, sub.name);
    } catch (e) {
        list.innerHTML = '<li style="text-align:center; padding:20px; color:red;">Error loading chapters.</li>';
        console.error(e);
    }
}

function renderChapters(data, subjectName) {
    const list = document.getElementById('chapterList');
    list.innerHTML = '';

    // We use the syllabus to get the correct Chapter Titles
    const chaptersFromSyllabus = syllabus[subjectName] || [];
    
    // Fallback if syllabus missing: Group by ID
    if(chaptersFromSyllabus.length === 0) {
        list.innerHTML = '<li style="padding:20px;">No chapter index found for this subject.</li>';
        return;
    }

    chaptersFromSyllabus.forEach((title, index) => {
        const chNum = index + 1;
        // Filter questions by ID (e.g. Anaesthesia_Ch1_1)
        const count = data.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
        
        // Only show chapters that actually have questions
        if (count > 0) {
            const li = document.createElement('li');
            li.className = 'chapter-item';
            li.innerHTML = `<span><b>${chNum}.</b> ${title}</span> <span class="chapter-count">${count}</span>`;
            li.onclick = () => startQuiz(chNum, title);
            list.appendChild(li);
        }
    });
}

// --- QUIZ ---
function startQuiz(chNum, title) {
    // Filter by ID pattern _Ch1_
    filteredQuestions = currentQuestions.filter(q => q.id.includes(`_Ch${chNum}_`));
    document.getElementById('quizPageTitle').innerText = title;
    currentIndex = 0;
    loadQuestion(0);
    showView('quiz');
}

function loadQuestion(index) {
    const q = filteredQuestions[index];
    document.getElementById('qIndex').innerText = index + 1;
    document.getElementById('qTotal').innerText = filteredQuestions.length;
    
    // Progress
    document.getElementById('progressBar').style.width = `${((index+1)/filteredQuestions.length)*100}%`;

    document.getElementById('questionText').innerText = q.question_text;
    
    // Images
    const imgCont = document.getElementById('imageContainer');
    imgCont.innerHTML = '';
    if(q.images) {
        q.images.forEach(src => {
            const img = document.createElement('img');
            img.src = `./data/images/${src}`;
            imgCont.appendChild(img);
        });
    }

    // Options
    const optsCont = document.getElementById('optionsContainer');
    optsCont.innerHTML = '';
    document.getElementById('feedbackArea').classList.add('hidden');
    document.getElementById('nextBtn').disabled = true;

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const char = String.fromCharCode(97 + i);
        btn.innerHTML = `<b>${char.toUpperCase()}.</b> ${opt}`;
        btn.onclick = () => checkAnswer(btn, char, q);
        optsCont.appendChild(btn);
    });

    // Nav
    document.getElementById('prevBtn').onclick = () => {
        if(currentIndex > 0) loadQuestion(--currentIndex);
    };
    document.getElementById('nextBtn').onclick = () => {
        if(currentIndex < filteredQuestions.length - 1) loadQuestion(++currentIndex);
    };
}

function checkAnswer(btn, selected, q) {
    if(btn.classList.contains('disabled')) return;
    
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.classList.add('disabled'));

    const correct = q.correct_option.trim().toLowerCase();
    const isCorrect = selected === correct;

    if(isCorrect) {
        btn.classList.add('correct');
        showFeedback(true, q.explanation);
    } else {
        btn.classList.add('wrong');
        // Highlight correct
        const correctIdx = correct.charCodeAt(0) - 97;
        if(allBtns[correctIdx]) allBtns[correctIdx].classList.add('correct');
        showFeedback(false, q.explanation);
    }
    document.getElementById('nextBtn').disabled = false;
}

function showFeedback(isCorrect, text) {
    const area = document.getElementById('feedbackArea');
    area.classList.remove('hidden');
    document.getElementById('feedbackIcon').innerText = isCorrect ? '✅' : '❌';
    document.getElementById('feedbackTitle').innerText = isCorrect ? 'Correct' : 'Incorrect';
    document.getElementById('feedbackTitle').style.color = isCorrect ? 'var(--correct)' : 'var(--wrong)';
    document.getElementById('explanationText').innerText = text || "No explanation available.";
}

// Search
document.getElementById('subjectSearch').onkeyup = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.subject-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
    });
};

init();
