/**
 * MedEngine V3.0 - Final Analysis, Index Patch & Pediatrics Fix
 */

const App = {
    // --- STATE ---
    data: {
        subjects: [],
        syllabus: {},
        cache: {},
        activeSubject: null,
        activeQuestions: [],
        currentQIndex: 0,
        // Track User Performance for the current session
        sessionStats: { correct: 0, wrong: 0, total: 0 }
    },

    // --- DOM ELEMENTS ---
    elements: {
        main: document.getElementById('main-container'),
        search: document.getElementById('searchInput'),
        lightbox: document.getElementById('lightbox'),
        lightboxImg: document.getElementById('lightbox-img'),
        header: document.getElementById('main-header')
    },

    // --- INITIALIZATION ---
    async init() {
        // 1. Initialize Theme immediately
        const savedTheme = localStorage.getItem('medtrix-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        try {
            // 2. Fetch Core Data
            const [subRes, sylRes] = await Promise.all([
                fetch('./data/subjects.json'),
                fetch('./data/syllabus.json')
            ]);
            
            this.data.subjects = await subRes.json();
            this.data.syllabus = await sylRes.json();

            // 3. Setup Routing & Search Events
            window.addEventListener('hashchange', () => this.router());
            this.elements.search.addEventListener('input', (e) => this.handleSearch(e.target.value));

            // 4. Desktop Keyboard Shortcuts
            document.addEventListener('keydown', (e) => {
                // Only work if we are inside a quiz (Header is hidden)
                if (this.elements.header.style.display === 'none') {
                    if (e.key === 'ArrowRight') {
                        // Check if it's the last question to trigger finish, else next
                        if (this.data.currentQIndex === this.data.activeQuestions.length - 1) {
                            this.finishQuiz();
                        } else {
                            this.navQuestion(1);
                        }
                    }
                    if (e.key === 'ArrowLeft') this.navQuestion(-1);
                    if (e.key === 'Escape') history.back();
                }
            });

            // 5. Start the Router
            this.router();

        } catch (error) {
            console.error(error);
            this.elements.main.innerHTML = `<div style="text-align:center; padding:50px; color:var(--error)">
                <h3><i class="fa-solid fa-triangle-exclamation"></i> Error</h3>
                <p>Could not load Library. Check your JSON files.</p>
            </div>`;
        }
    },

    // --- ROUTER ---
    async router() {
        const hash = window.location.hash.slice(1) || '/';
        const segments = hash.split('/');
        
        // Hide Header on Quiz View to save screen space
        const isQuiz = segments[0] === 'quiz';
        this.elements.header.style.display = isQuiz ? 'none' : 'block';

        if (hash === '/' || hash === '') {
            this.renderHome();
            return;
        }

        if (segments[0] === 'subject') {
            const subName = decodeURIComponent(segments[1]);
            await this.loadSubjectData(subName);
            this.renderChapterList(subName);
            return;
        }

        if (segments[0] === 'quiz') {
            const subName = decodeURIComponent(segments[1]);
            const chapterIndex = segments[2];
            
            if (!this.data.cache[subName]) await this.loadSubjectData(subName);
            this.startQuiz(subName, chapterIndex);
            return;
        }
    },

    // --- DATA FETCHING ---
    async loadSubjectData(name) {
        if (this.data.cache[name]) return;
        
        this.elements.main.innerHTML = `<div style="text-align:center; padding:50px;">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--accent)"></i>
            <p style="margin-top:10px; font-family:'Orbitron'">ACCESSING MATRIX...</p>
        </div>`;

        // Attempt to find file even if casing/spelling differs slightly
        const subjectObj = this.data.subjects.find(s => s.name === name);
        const fileName = subjectObj ? subjectObj.file : `${name}.json`;
        
        try {
            const res = await fetch(`./data/${fileName}`);
            this.data.cache[name] = await res.json();
        } catch (e) {
            alert(`File not found: ${fileName}`);
        }
    },

    // --- THEME LOGIC ---
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('medtrix-theme', next);
    },

    // --- TEXT SANITIZER (Fixes Encoding & Symbols) ---
    cleanText(text) {
        if (!text) return "";
        const map = { 
            '≡':'→', '->':'→', 'â€“':'-', 'â€”':'—', 
            'â€™':"'", 'ï»¿':'', '':'•', '':'•', 
            '':'≥', '':'≤', '':'×', '':'µ', '':'°' 
        };
        // 1. Replace Garbage Chars
        let clean = text.replace(/≡|->|â€“|â€”|â€™|ï»¿|||||||/g, m => map[m]);
        // 2. Fix Greek Letters
        return clean.replace(//g,"α").replace(//g,"β").replace(//g,"γ")
                    .replace(//g,"δ").replace(//g,"Δ").replace(//g,"θ");
    },

    // --- RENDERERS ---

    // 1. Home Grid
    renderHome() {
        this.elements.search.value = '';
        this.elements.main.className = 'grid'; // Grid Layout
        
        const html = this.data.subjects.map(sub => `
            <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                <h3>${sub.name}</h3>
            </div>
        `).join('');
        this.elements.main.innerHTML = html;
    },

    // 2. Chapter List
    renderChapterList(subName) {
        this.elements.main.className = ''; // List Layout

        // --- PEDIATRICS FIX START ---
        // Look for 'Pediatrics' OR 'Paediatrics' in the syllabus
        let chapters = this.data.syllabus[subName];
        if (!chapters && subName === 'Paediatrics') chapters = this.data.syllabus['Pediatrics'];
        if (!chapters && subName === 'Pediatrics') chapters = this.data.syllabus['Paediatrics'];
        chapters = chapters || [];
        // --- PEDIATRICS FIX END ---

        const allQuestions = this.data.cache[subName] || [];

        // Header
        let html = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px">
                <button class="btn btn-secondary" style="flex:0; padding:10px 15px" onclick="location.hash='#/'">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h2 style="font-family:'Orbitron'; color:var(--accent)">${subName}</h2>
            </div>
        `;

        // "Full Bank" Button
        html += `
            <div class="card" style="flex-direction:row; justify-content:space-between; margin-bottom:15px; border-left:4px solid var(--accent);"
                 onclick="location.hash = '#quiz/${subName}/ALL'">
                <div style="text-align:left">
                    <div style="font-size:0.8rem; color:var(--accent); font-weight:bold">FULL BANK</div>
                    <div style="font-weight:600">Practice All ${allQuestions.length} Qs</div>
                </div>
                <div class="id-badge">ALL</div>
            </div>
        `;

        // Chapter Items
        html += chapters.map((title, idx) => {
            const chNum = idx + 1;
            const count = allQuestions.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
            if(count === 0) return '';
            
            return `
                <div class="card" style="flex-direction:row; justify-content:space-between; text-align:left; margin-bottom:10px" 
                     onclick="location.hash = '#quiz/${subName}/${chNum}'">
                    <div style="padding-right:10px">
                        <div style="font-size:0.8rem; color:var(--text-sub); font-weight:bold">CHAPTER ${chNum}</div>
                        <div style="font-weight:600">${this.cleanText(title)}</div>
                    </div>
                    <div class="id-badge">${count}</div>
                </div>
            `;
        }).join('');

        this.elements.main.innerHTML = `<div style="max-width:800px; margin:0 auto">${html}</div>`;
    },

    // 3. Quiz Mode
    startQuiz(subName, chNum) {
        this.data.activeSubject = subName;
        this.elements.main.className = '';
        
        // Reset Performance Stats
        this.data.sessionStats = { correct: 0, wrong: 0, total: 0 };

        // Filter Questions
        if (chNum === 'ALL') {
            this.data.activeQuestions = this.data.cache[subName];
        } else {
            this.data.activeQuestions = this.data.cache[subName].filter(q => q.id.includes(`_Ch${chNum}_`));
        }
        
        this.data.currentQIndex = 0;
        this.renderQuestion();
    },

    renderQuestion() {
        const q = this.data.activeQuestions[this.data.currentQIndex];
        const total = this.data.activeQuestions.length;
        const current = this.data.currentQIndex + 1;

        // Image Handling
        let imgHtml = '';
        if(q.images && q.images.length > 0) {
            imgHtml = q.images.map(img => 
                `<img src="./data/images/${img}" class="q-image" onclick="App.openImage(this.src)" onerror="this.style.display='none'">`
            ).join('');
        }

        // Clean ID badge
        const shortID = q.id.replace(this.data.activeSubject + '_', '');

        // Determine if this is the last question
        const isLast = current === total;
        const nextBtnText = isLast ? 'Finish & Analyse' : 'Next <i class="fa-solid fa-chevron-right"></i>';
        const nextAction = isLast ? 'App.finishQuiz()' : 'App.navQuestion(1)';

        const html = `
            <div class="quiz-header">
                <button class="btn btn-secondary" style="flex:0; padding:5px 15px" onclick="history.back()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <span>${current} / ${total}</span>
                <span class="id-badge">${shortID}</span>
            </div>

            <div class="question-box">
                <div class="q-text">${this.cleanText(q.question_text)}</div>
                <div style="text-align:center">${imgHtml}</div>
                
                <div class="options-stack">
                    ${q.options.map((opt, i) => `
                        <div class="option" onclick="App.handleAnswer(this, ${i}, '${q.correct_option}')">
                            ${String.fromCharCode(65 + i)}. ${this.cleanText(opt)}
                        </div>
                    `).join('')}
                </div>

                <div id="explanation" class="explanation">
                    <strong><i class="fa-solid fa-circle-info"></i> Explanation:</strong><br><br>
                    ${this.cleanText(q.explanation)}
                </div>
            </div>

            <div class="footer-controls">
                <button class="btn btn-secondary" onclick="App.navQuestion(-1)" ${this.data.currentQIndex === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button class="btn btn-primary" onclick="${nextAction}">
                    ${nextBtnText}
                </button>
            </div>
        `;
        this.elements.main.innerHTML = `<div style="max-width:800px; margin:0 auto; padding-bottom:60px;">${html}</div>`;
    },

    handleAnswer(el, index, correctChar) {
        // Prevent clicking twice
        if (el.parentElement.classList.contains('answered')) return;
        el.parentElement.classList.add('answered');

        const selectedChar = String.fromCharCode(97 + index); 
        const correctIndex = correctChar.toLowerCase().charCodeAt(0) - 97;
        const options = el.parentElement.children;

        // --- STATS LOGIC ---
        this.data.sessionStats.total++;
        if (selectedChar === correctChar.toLowerCase()) {
            el.classList.add('selected-correct');
            this.data.sessionStats.correct++;
        } else {
            el.classList.add('selected-wrong');
            this.data.sessionStats.wrong++;
            // Highlight the correct answer automatically
            if(options[correctIndex]) options[correctIndex].classList.add('selected-correct');
        }
        // -------------------

        // Disable all options
        Array.from(options).forEach(opt => opt.classList.add('disabled'));

        // Show Explanation
        document.getElementById('explanation').classList.add('show');
        saveToMedtrixHistory(this.currentQuestion, el, (selectedChar === correctChar.toLowerCase()));
    },

    navQuestion(dir) {
        const newIndex = this.data.currentQIndex + dir;
        if (newIndex >= 0 && newIndex < this.data.activeQuestions.length) {
            this.data.currentQIndex = newIndex;
            this.renderQuestion();
        }
    },

    // --- 4. ANALYSIS & RESULTS ---
    finishQuiz() {
        const s = this.data.sessionStats;
        const totalQs = this.data.activeQuestions.length;
        const skipped = totalQs - s.total;
        
        // Avoid division by zero
        const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;

        // --- MEDTRIX LINK: Save Global Stats for Dashboard ---
        try {
            const globalStats = JSON.parse(localStorage.getItem('MEDTRIX_GLOBAL_STATS') || '{"totalAnswered":0, "totalCorrect":0, "quizzesTaken":0}');
            globalStats.totalAnswered += (s.total || 0);
            globalStats.totalCorrect += (s.correct || 0);
            globalStats.quizzesTaken += 1;
            localStorage.setItem('MEDTRIX_GLOBAL_STATS', JSON.stringify(globalStats));
            console.log("✅ Medtrix Stats Saved:", globalStats);
        } catch (e) { console.error("Medtrix Sync Error:", e); }
        // -----------------------------------------------------
        
        let msg = "Keep Practicing!";
        if(accuracy > 50) msg = "Good Effort!";
        if(accuracy > 80) msg = "Excellent Work!";

        const html = `
            <div class="result-box">
                <div class="score-circle">
                    <div class="score-number">${accuracy}%</div>
                    <div class="score-label">Accuracy</div>
                </div>
                
                <h2 style="font-family:'Orbitron'; color:var(--accent)">${msg}</h2>
                <p style="color:var(--text-sub)">You attempted ${s.total} out of ${totalQs} questions.</p>

                <div class="stat-grid">
                    <div class="stat-card" style="border-bottom: 4px solid var(--success)">
                        <div class="stat-val" style="color:var(--success)">${s.correct}</div>
                        <div class="stat-name">Correct</div>
                    </div>
                    <div class="stat-card" style="border-bottom: 4px solid var(--error)">
                        <div class="stat-val" style="color:var(--error)">${s.wrong}</div>
                        <div class="stat-name">Incorrect</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-val">${skipped}</div>
                        <div class="stat-name">Skipped</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-val">${totalQs}</div>
                        <div class="stat-name">Total</div>
                    </div>
                </div>

                <div class="action-row">
                    <button class="btn btn-secondary" onclick="location.reload()">
                        <i class="fa-solid fa-house"></i> Home
                    </button>
                    <button class="btn btn-primary" onclick="App.startQuiz('${this.data.activeSubject}', 'ALL')">
                        <i class="fa-solid fa-rotate-right"></i> Retry
                    </button>
                </div>
            </div>
        `;

        this.elements.main.innerHTML = `<div style="max-width:600px; margin:0 auto">${html}</div>`;
        this.elements.header.style.display = 'block'; // Bring back header
    },

    // --- UTILS ---
    handleSearch(query) {
        if(window.location.hash !== '' && window.location.hash !== '#/') return;
        if(query.length < 2) { this.renderHome(); return; }
        
        const filtered = this.data.subjects.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
        this.elements.main.innerHTML = filtered.map(sub => `
            <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                <h3>${sub.name}</h3>
            </div>
        `).join('');
    },
    
    openImage(src) {
        this.elements.lightboxImg.src = src;
        this.elements.lightbox.classList.remove('hidden');
    },

    getIcon(name) {
        const n = name.toLowerCase().trim();
        const map = {
            'anaesthesia': 'fa-syringe', 'anatomy': 'fa-bone', 'biochemistry': 'fa-flask',
            'dermatology': 'fa-hand-dots', 'ent': 'fa-ear-listen', 'fmt': 'fa-skull-crossbones',
            'medicine': 'fa-user-doctor', 'microbiology': 'fa-virus', 'obgyn': 'fa-person-pregnant',
            'ophthalmology': 'fa-eye', 'orthopaedics': 'fa-crutch', 'psm': 'fa-users', 
            'pathology': 'fa-microscope', 'pediatrics': 'fa-baby', 'paediatrics': 'fa-baby',
            'pharmacology': 'fa-pills', 'physiology': 'fa-heart-pulse', 'psychiatry': 'fa-brain', 
            'radiology': 'fa-x-ray', 'surgery': 'fa-scalpel'
        };
        return map[n] || 'fa-book-medical';
    }
};

// Start the Engine
window.addEventListener('DOMContentLoaded', () => App.init());


// --- MEDTRIX HISTORY LOGGER ---
function saveToMedtrixHistory(q, el, cls) {
    try {
        if (!q) return;
        let opts = q.options || [q.choice1, q.choice2, q.choice3, q.choice4].filter(Boolean);
        let selText = el ? el.innerText : "Unknown";
        let isCorrect = (cls === 'correct');
        let corText = isCorrect ? selText : (q.answer ? (q['choice'+q.answer] || q.answer) : "See Review");

        let entry = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            source: document.title,
            question: q.question ? q.question.replace(/<[^>]*>/g, '') : "N/A",
            options: opts,
            selectedAnswer: selText,
            correctAnswer: corText,
            isCorrect: isCorrect,
            image: q.image || q.img || null
        };

        let h = JSON.parse(localStorage.getItem('MEDTRIX_HISTORY') || '[]');
        h.unshift(entry);
        if (h.length > 100) h.pop();
        localStorage.setItem('MEDTRIX_HISTORY', JSON.stringify(h));
        console.log("✅ MEDTRIX LOG SAVED");
    } catch(e) { console.error("Log Failed:", e); }
}
