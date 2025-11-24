
// --- STATE ---
let state = {
    subjects: [],
    syllabus: {},
    currentSubjectName: "",
    currentQuestions: [],
    filteredQuestions: [],
    currentIndex: 0
};

const els = {
    grid: document.getElementById('subjectGrid'),
    chapterList: document.getElementById('chapterList'),
    quiz: {
        container: document.getElementById('view-quiz'),
        qText: document.getElementById('questionText'),
        options: document.getElementById('optionsContainer'),
        feedback: document.getElementById('feedbackArea'),
        imgContainer: document.getElementById('imageContainer'),
        progressBar: document.getElementById('progressBar'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        idBadge: document.getElementById('qIDBadge')
    },
    search: document.getElementById('globalSearch'),
    toast: document.getElementById('toast')
};

// --- INIT ---
async function init() {
    try {
        const [subRes, sylRes] = await Promise.all([
            fetch('./data/subjects.json'),
            fetch('./data/syllabus.json')
        ]);
        state.subjects = await subRes.json();
        state.syllabus = await sylRes.json();
        
        renderSubjects(state.subjects);
        
        // DEEP LINK CHECK
        // Check if URL has ?q=Subject_ChX_Y
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get('q');
        if (sharedId) {
            handleDeepLink(sharedId);
        }

    } catch (e) {
        console.error("Init Error:", e);
        els.grid.innerHTML = '<p style="color:red">Error loading library. Please reload.</p>';
    }
    
    setupEvents();
}

// --- SUBJECTS ---
function renderSubjects(list) {
    els.grid.innerHTML = '';
    list.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'subject-card';
        // Determine icon based on name (Simple heuristic)
        let icon = 'fa-book-medical';
        if(sub.name.includes('Anatomy')) icon = 'fa-bone';
        if(sub.name.includes('Pharma')) icon = 'fa-pills';
        if(sub.name.includes('Surgery')) icon = 'fa-scalpel';
        
        card.innerHTML = `<i class="fa-solid ${icon} subject-icon"></i><h3>${sub.name}</h3>`;
        card.onclick = () => loadSubject(sub.name, sub.file);
        els.grid.appendChild(card);
    });
}

async function loadSubject(name, filename) {
    state.currentSubjectName = name;
    document.getElementById('chapterPageTitle').textContent = name;
    showView('view-chapters');
    
    // Loading UI
    els.chapterList.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch(`./data/${filename}`);
        state.currentQuestions = await res.json();
        renderChapters();
    } catch (e) {
        els.chapterList.innerHTML = '<p>Error loading chapters.</p>';
    }
}

function renderChapters() {
    els.chapterList.innerHTML = '';
    const chapters = state.syllabus[state.currentSubjectName] || [];
    
    if (chapters.length === 0) {
        // Fallback if syllabus missing
        els.chapterList.innerHTML = '<p>No chapters listed.</p>';
        return;
    }

    chapters.forEach((title, i) => {
        const chNum = i + 1;
        // Count questions for this chapter
        const count = state.currentQuestions.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
        
        if (count > 0) {
            const li = document.createElement('div');
            li.className = 'chapter-item';
            li.innerHTML = `
                <div class="chapter-info">
                    <b>Chapter ${chNum}</b>
                    <span>${title}</span>
                </div>
                <span class="chapter-count">${count}</span>
            `;
            li.onclick = () => startQuiz(chNum, title);
            els.chapterList.appendChild(li);
        }
    });
}

// --- QUIZ ENGINE ---
function startQuiz(chNum, title, specificId = null) {
    // Filter
    if(specificId) {
        // If deep linking, we might just show that one question, or the chapter it belongs to
        // For now, let's just load the specific question
        const q = state.currentQuestions.find(q => q.id === specificId);
        if(q) {
            state.filteredQuestions = [q];
            // If we want context, we could load the whole chapter and jump to index
            // But let's stick to simple for now
        }
    } else {
        state.filteredQuestions = state.currentQuestions.filter(q => q.id.includes(`_Ch${chNum}_`));
    }

    state.currentIndex = 0;
    showView('view-quiz');
    loadQuestion(0);
}

function loadQuestion(index) {
    const q = state.filteredQuestions[index];
    if(!q) return;

    // Update UI
    document.getElementById('qIndex').textContent = index + 1;
    document.getElementById('qTotal').textContent = state.filteredQuestions.length;
    document.getElementById('qTopic').textContent = q.topic || state.currentSubjectName;
    els.quiz.idBadge.textContent = `#${q.id}`;
    
    // Progress
    const pct = ((index + 1) / state.filteredQuestions.length) * 100;
    els.quiz.progressBar.style.width = `${pct}%`;

    // Content
    els.quiz.qText.innerHTML = q.question_text;
    
    // Images
    els.quiz.imgContainer.innerHTML = '';
    if (q.images && q.images.length > 0) {
        q.images.forEach(src => {
            const img = document.createElement('img');
            img.src = `./data/images/${src}`;
            img.onclick = () => window.open(img.src, '_blank'); // Zoom
            els.quiz.imgContainer.appendChild(img);
        });
    }

    // Options
    els.quiz.options.innerHTML = '';
    els.quiz.feedback.classList.add('hidden');
    els.quiz.nextBtn.disabled = true;

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const char = String.fromCharCode(97 + i); // a, b, c
        btn.innerHTML = `<b>${char.toUpperCase()}.</b> ${opt}`;
        btn.onclick = () => checkAnswer(btn, char, q);
        els.quiz.options.appendChild(btn);
    });

    // Navigation Buttons State
    els.quiz.prevBtn.disabled = index === 0;
}

function checkAnswer(btn, selected, q) {
    if (btn.classList.contains('disabled')) return;

    // Disable all
    const allBtns = els.quiz.options.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.classList.add('disabled'));

    const correct = q.correct_option.trim().toLowerCase();
    const isCorrect = selected === correct;

    if (isCorrect) {
        btn.classList.add('correct');
        showFeedback(true, q.explanation);
    } else {
        btn.classList.add('wrong');
        // Highlight correct
        const correctIdx = correct.charCodeAt(0) - 97;
        if (allBtns[correctIdx]) allBtns[correctIdx].classList.add('correct');
        showFeedback(false, q.explanation);
    }
    els.quiz.nextBtn.disabled = false;
}

function showFeedback(isCorrect, text) {
    const area = els.quiz.feedback;
    area.classList.remove('hidden');
    
    const icon = document.getElementById('feedbackIcon');
    const title = document.getElementById('feedbackTitle');
    
    if(isCorrect) {
        icon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--correct)"></i>';
        title.textContent = "Correct Answer";
        title.style.color = "var(--correct)";
    } else {
        icon.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--wrong)"></i>';
        title.textContent = "Incorrect";
        title.style.color = "var(--wrong)";
    }
    
    document.getElementById('explanationText').innerHTML = text || "No explanation provided.";
    
    // Auto scroll to feedback on mobile
    if(window.innerWidth < 768) {
        setTimeout(() => area.scrollIntoView({behavior: "smooth"}), 100);
    }
}

// --- DEEP LINKING & SEARCH ---

async function handleDeepLink(id) {
    // ID Format: Subject_ChX_Y
    // 1. Find Subject
    const parts = id.split('_');
    if(parts.length < 1) return;
    
    const subjName = parts[0].replace(/_/g, ' '); // Naive guess
    // Better: loop through subjects to find partial match
    const subject = state.subjects.find(s => id.startsWith(s.name.replace(/ /g, '_')));
    
    if(subject) {
        // Load Subject
        state.currentSubjectName = subject.name;
        document.getElementById('chapterPageTitle').textContent = subject.name;
        
        try {
            const res = await fetch(`./data/${subject.file}`);
            state.currentQuestions = await res.json();
            
            // Find specific question
            const q = state.currentQuestions.find(x => x.id === id);
            if(q) {
                // Launch Quiz with JUST this question
                state.filteredQuestions = [q];
                state.currentIndex = 0;
                showView('view-quiz');
                loadQuestion(0);
            } else {
                showToast("Question not found in subject.");
                renderSubjects(state.subjects);
            }
        } catch(e) {
            console.error(e);
        }
    }
}

// Search Logic
els.search.addEventListener('keyup', async (e) => {
    const term = e.target.value.trim();
    
    // If looks like an ID (contains underscore and digits)
    if(e.key === 'Enter' && term.includes('_')) {
        handleDeepLink(term);
        return;
    }

    // Regular Subject Search
    const items = document.querySelectorAll('.subject-card');
    items.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term.toLowerCase()) ? 'flex' : 'none';
    });
});

// Sharing
window.shareQuestion = () => {
    const q = state.filteredQuestions[state.currentIndex];
    const url = `${window.location.origin}${window.location.pathname}?q=${q.id}`;
    
    navigator.clipboard.writeText(url).then(() => {
        showToast("Link copied to clipboard!");
    });
};

function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.className = "toast show";
    setTimeout(() => { els.toast.className = els.toast.className.replace("show", ""); }, 3000);
}

// View Routing
window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
};
window.goHome = () => {
    // Clear URL params if any
    window.history.replaceState({}, document.title, window.location.pathname);
    showView('view-home');
};
window.goBackToChapters = () => showView('view-chapters');

// Quiz Nav
els.quiz.nextBtn.onclick = () => {
    if(state.currentIndex < state.filteredQuestions.length - 1) loadQuestion(++state.currentIndex);
};
els.quiz.prevBtn.onclick = () => {
    if(state.currentIndex > 0) loadQuestion(--state.currentIndex);
};

// Keyboard Nav
document.addEventListener('keydown', (e) => {
    if(document.getElementById('view-quiz').classList.contains('active')) {
        if(e.key === 'ArrowRight') els.quiz.nextBtn.click();
        if(e.key === 'ArrowLeft') els.quiz.prevBtn.click();
    }
});

init();
