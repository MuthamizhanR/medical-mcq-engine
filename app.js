/**
 * MedEngine V2 Core Logic
 * Architecture: SPA with Hash Routing & In-Memory Caching
 */

const App = {
    // --- STATE ---
    data: {
        subjects: [], // List of subject objects
        syllabus: {}, // Chapter mapping
        cache: {},    // Cache for heavy subject JSON files
        activeSubject: null,
        activeQuestions: [],
        currentQIndex: 0
    },

    // --- CONFIG ---
    elements: {
        main: document.getElementById('main-container'),
        search: document.getElementById('searchInput'),
        lightbox: document.getElementById('lightbox'),
        lightboxImg: document.getElementById('lightbox-img')
    },

    // --- INITIALIZATION ---
    async init() {
        try {
            // 1. Load Meta Data
            const [subRes, sylRes] = await Promise.all([
                fetch('./data/subjects.json'),
                fetch('./data/syllabus.json')
            ]);
            
            this.data.subjects = await subRes.json();
            this.data.syllabus = await sylRes.json();

            // 2. Setup Router
            window.addEventListener('hashchange', () => this.router());
            
            // 3. Setup Search
            this.elements.search.addEventListener('input', (e) => this.handleSearch(e.target.value));

            // 4. Start Router
            this.router();

        } catch (error) {
            this.elements.main.innerHTML = `<div class="loading" style="color:var(--error)">
                <i class="fa-solid fa-triangle-exclamation"></i><br>Failed to load library.<br>Check file structure.
            </div>`;
            console.error(error);
        }
    },

    // --- ROUTER ---
    async router() {
        const hash = window.location.hash.slice(1) || '/'; // Remove #
        const segments = hash.split('/');

        // Route: Home
        if (hash === '/' || hash === '') {
            this.renderHome();
            return;
        }

        // Route: Subject Overview (#subject/Surgery)
        if (segments[0] === 'subject') {
            const subName = decodeURIComponent(segments[1]);
            await this.loadSubjectData(subName);
            this.renderChapterList(subName);
            return;
        }

        // Route: Quiz Mode (#quiz/Surgery/1) -> Chapter 1
        if (segments[0] === 'quiz') {
            const subName = decodeURIComponent(segments[1]);
            const chapterIndex = parseInt(segments[2]);
            
            // Ensure data is loaded
            if (!this.data.cache[subName]) await this.loadSubjectData(subName);
            
            this.startQuiz(subName, chapterIndex);
            return;
        }
        
        // Route: Deep Link (#q/QuestionID)
        if (segments[0] === 'q') {
            this.handleDeepLink(segments[1]);
        }
    },

    // --- DATA MANAGER ---
    async loadSubjectData(name) {
        // Check Cache first
        if (this.data.cache[name]) return;

        // Show Loading
        this.elements.main.innerHTML = `<div class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i><br>Loading ${name}...</div>`;

        // Find filename
        const subjectObj = this.data.subjects.find(s => s.name === name);
        if (!subjectObj) return alert("Subject not found!");

        try {
            const res = await fetch(`./data/${subjectObj.file}`);
            const json = await res.json();
            this.data.cache[name] = json; // Save to memory
        } catch (e) {
            alert("Error loading subject file: " + subjectObj.file);
        }
    },

    // --- RENDERERS ---
    
    // 1. Home Grid
    renderHome() {
        this.elements.search.value = ''; // Clear search
        const html = `
            <div class="grid">
                ${this.data.subjects.map(sub => `
                    <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                        <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                        <h3>${sub.name}</h3>
                    </div>
                `).join('')}
            </div>
        `;
        this.elements.main.innerHTML = html;
    },

    // 2. Chapter List
    renderChapterList(subName) {
        const chapters = this.data.syllabus[subName] || [];
        const allQuestions = this.data.cache[subName] || [];

        // Calculate counts per chapter
        const listHtml = chapters.map((title, idx) => {
            const chNum = idx + 1;
            const qCount = allQuestions.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
            if(qCount === 0) return ''; // Hide empty chapters

            return `
                <li class="chapter-item" onclick="location.hash = '#quiz/${subName}/${chNum}'">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-sub); font-weight:700">CHAPTER ${chNum}</div>
                        <div style="font-weight:600">${title}</div>
                    </div>
                    <span class="badge">${qCount} Qs</span>
                </li>
            `;
        }).join('');

        const html = `
            <div class="list-header">
                <button class="back-btn" onclick="location.hash = '#/'"><i class="fa-solid fa-arrow-left"></i></button>
                <h1>${subName}</h1>
            </div>
            <ul style="list-style:none; padding-bottom:80px">
                ${listHtml}
            </ul>
        `;
        this.elements.main.innerHTML = html;
    },

    // 3. Quiz Interface
    startQuiz(subName, chNum) {
        // Filter Questions
        this.data.activeSubject = subName;
        if (chNum === 'ALL') {
            this.data.activeQuestions = this.data.cache[subName];
        } else {
            // Filter logic based on ID pattern: Subject_Ch1_1
            this.data.activeQuestions = this.data.cache[subName].filter(q => q.id.includes(`_Ch${chNum}_`));
        }
        
        this.data.currentQIndex = 0;
        this.renderQuestion();
    },

    renderQuestion() {
        const q = this.data.activeQuestions[this.data.currentQIndex];
        const total = this.data.activeQuestions.length;

        // Image Handling
        let imgHtml = '';
        if(q.images && q.images.length > 0) {
            imgHtml = q.images.map(img => 
                `<img src="./data/images/${img}" class="q-image" onclick="App.openImage(this.src)" onerror="this.style.display='none'">`
            ).join('');
        }

        const html = `
            <div class="quiz-header">
                <button class="back-btn" onclick="history.back()"><i class="fa-solid fa-xmark"></i></button>
                <span>Question ${this.data.currentQIndex + 1} / ${total}</span>
                <span class="badge" style="font-family:monospace">${q.id.split('_').pop()}</span>
            </div>

            <div class="question-box">
                <div class="q-text">${q.question_text}</div>
                <div class="q-images-container" style="text-align:center">${imgHtml}</div>
                
                <div class="options-stack">
                    ${q.options.map((opt, i) => `
                        <div class="option" onclick="App.handleAnswer(this, ${i}, '${q.correct_option}')">
                            ${String.fromCharCode(65 + i)}. ${opt}
                        </div>
                    `).join('')}
                </div>

                <div id="explanation" class="explanation">
                    <strong><i class="fa-solid fa-circle-info"></i> Explanation:</strong>
                    <p>${q.explanation}</p>
                </div>
            </div>

            <div class="footer-controls">
                <button class="btn btn-secondary" onclick="App.navQuestion(-1)" ${this.data.currentQIndex === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <button class="btn btn-primary" onclick="App.navQuestion(1)">
                    Next <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
        this.elements.main.innerHTML = html;
    },

    // --- INTERACTION LOGIC ---
    handleAnswer(el, index, correctChar) {
        if (el.parentElement.classList.contains('answered')) return; // Prevent re-answering

        const selectedChar = String.fromCharCode(97 + index); // 'a', 'b', 'c'...
        const correctIndex = correctChar.toLowerCase().charCodeAt(0) - 97;
        const options = el.parentElement.children;

        el.parentElement.classList.add('answered');

        // Style logic
        if (selectedChar === correctChar.toLowerCase()) {
            el.classList.add('selected-correct');
        } else {
            el.classList.add('selected-wrong');
            options[correctIndex].classList.add('selected-correct'); // Show correct one
        }

        // Disable all options
        Array.from(options).forEach(opt => opt.classList.add('disabled'));

        // Show explanation
        document.getElementById('explanation').classList.add('show');
    },

    navQuestion(dir) {
        const newIndex = this.data.currentQIndex + dir;
        if (newIndex >= 0 && newIndex < this.data.activeQuestions.length) {
            this.data.currentQIndex = newIndex;
            this.renderQuestion();
        }
    },

    handleSearch(query) {
        if(query.length < 2) {
            if(window.location.hash === '' || window.location.hash === '#/') this.renderHome();
            return;
        }
        
        // Simple Search Logic (Can be expanded)
        // Currently searches subjects for Home view
        if(window.location.hash === '' || window.location.hash === '#/') {
            const filtered = this.data.subjects.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
            const html = `
                <div class="grid">
                    ${filtered.map(sub => `
                        <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                            <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                            <h3>${sub.name}</h3>
                        </div>
                    `).join('')}
                </div>
            `;
            this.elements.main.innerHTML = html;
        }
    },
    
    // --- UTILS ---
    openImage(src) {
        this.elements.lightboxImg.src = src;
        this.elements.lightbox.classList.remove('hidden');
    },

    getIcon(name) {
        const map = {
            'Surgery': 'fa-scalpel',
            'Medicine': 'fa-user-doctor',
            'Pediatrics': 'fa-baby',
            'Anatomy': 'fa-bone',
            'Pharmacology': 'fa-pills',
            'Pathology': 'fa-microscope',
            'OBGYN': 'fa-person-pregnant'
        };
        return map[name] || 'fa-book-medical';
    }
};

// Start App
window.addEventListener('DOMContentLoaded', () => App.init());

// Expose to window for onclick events in HTML strings
window.App = App;
