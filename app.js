/**
 * MedEngine V2.7 - Global Character Sanitation & Medtrix UI
 */

const App = {
    data: {
        subjects: [],
        syllabus: {},
        cache: {},
        activeSubject: null,
        activeQuestions: [],
        currentQIndex: 0
    },

    elements: {
        main: document.getElementById('main-container'),
        search: document.getElementById('searchInput'),
        lightbox: document.getElementById('lightbox'),
        lightboxImg: document.getElementById('lightbox-img')
    },

    async init() {
        // Theme Init
        const savedTheme = localStorage.getItem('medtrix-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        try {
            const [subRes, sylRes] = await Promise.all([
                fetch('./data/subjects.json'),
                fetch('./data/syllabus.json')
            ]);
            
            this.data.subjects = await subRes.json();
            this.data.syllabus = await sylRes.json();

            window.addEventListener('hashchange', () => this.router());
            this.elements.search.addEventListener('input', (e) => this.handleSearch(e.target.value));
            this.router();

        } catch (error) {
            this.elements.main.innerHTML = `<div style="text-align:center; color:var(--error); margin-top:50px;">
                <h2><i class="fa-solid fa-triangle-exclamation"></i> Error</h2>
                <p>Could not load data library.</p>
            </div>`;
        }
    },

    async router() {
        const hash = window.location.hash.slice(1) || '/';
        const segments = hash.split('/');

        // Toggle UI elements based on view
        const isQuiz = segments[0] === 'quiz';
        if(document.querySelector('.search-wrapper')) {
            document.querySelector('.search-wrapper').style.display = isQuiz ? 'none' : 'block';
        }
        if(document.getElementById('main-header')) {
            document.getElementById('main-header').style.display = isQuiz ? 'none' : 'block';
        }

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

    async loadSubjectData(name) {
        if (this.data.cache[name]) return;
        this.elements.main.innerHTML = `<div style="text-align:center; padding:50px; font-family:'Orbitron'">LOADING MATRIX...</div>`;
        const subjectObj = this.data.subjects.find(s => s.name === name);
        const fileName = subjectObj ? subjectObj.file : `${name}.json`;
        const res = await fetch(`./data/${fileName}`);
        this.data.cache[name] = await res.json();
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('medtrix-theme', next);
    },

    // --- UNIVERSAL TEXT CLEANER (The Fix) ---
    cleanText(text) {
        if (!text) return "";
        
        // Dictionary of common encoding garbage -> Correct Symbol
        const map = {
            '≡': '→',
            '': '→',
            '->': '→',
            'â€“': '-',
            'â€”': '—',
            'â€™': "'",
            'â€œ': '"',
            'â€': '"',
            'ï»¿': '',
            '': '•',
            '': '•',
            '': '≥',
            '': '≤',
            '': '×',
            '': 'µ' // Micro symbol
        };

        // 1. Replace Garbage Characters
        let clean = text.replace(/≡||->|â€“|â€”|â€™|â€œ|â€|ï»¿||||||/g, matched => map[matched]);

        // 2. Fix Broken Greek Letters (Common in Medical PDFs)
        clean = clean
            .replace(//g, "α").replace(//g, "β").replace(//g, "γ").replace(//g, "δ")
            .replace(//g, "ε").replace(//g, "θ").replace(//g, "λ").replace(//g, "μ")
            .replace(//g, "π").replace(//g, "σ").replace(//g, "τ").replace(//g, "ω")
            .replace(//g, "Δ"); // Delta

        return clean;
    },

    // --- RENDERERS ---
    
    renderHome() {
        this.elements.search.value = '';
        this.elements.main.className = 'grid'; 
        const html = this.data.subjects.map(sub => `
            <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                <div class="card-icon-box">
                    <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                </div>
                <h3>${sub.name}</h3>
            </div>
        `).join('');
        this.elements.main.innerHTML = html;
    },

    renderChapterList(subName) {
        this.elements.main.className = ''; 
        const chapters = this.data.syllabus[subName] || [];
        const allQuestions = this.data.cache[subName] || [];

        let listHtml = `
            <div class="list-header">
                <button class="back-btn" onclick="location.hash = '#/'"><i class="fa-solid fa-arrow-left"></i></button>
                <h2 style="font-family:'Orbitron'; color:var(--accent)">${subName}</h2>
            </div>
            
            <div class="chapter-item" onclick="location.hash = '#quiz/${subName}/ALL'" style="border-color:var(--accent)">
                <div>
                    <div style="font-size:0.8rem; color:var(--accent); font-weight:700">FULL BANK</div>
                    <div style="font-weight:600">Practice All Questions</div>
                </div>
                <span class="badge">${allQuestions.length} Qs</span>
            </div>
        `;

        listHtml += chapters.map((title, idx) => {
            const chNum = idx + 1;
            const count = allQuestions.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
            if(count === 0) return '';
            return `
                <div class="chapter-item" onclick="location.hash = '#quiz/${subName}/${chNum}'">
                    <div>
                        <div style="font-size:0.75rem; color:var(--subtext); font-weight:700">CHAPTER ${chNum}</div>
                        <div style="font-weight:600">${this.cleanText(title)}</div>
                    </div>
                    <span class="badge" style="background:var(--subtext)">${count}</span>
                </div>
            `;
        }).join('');

        this.elements.main.innerHTML = `<div style="max-width:800px; margin:0 auto;">${listHtml}</div>`;
    },

    startQuiz(subName, chNum) {
        this.data.activeSubject = subName;
        this.elements.main.className = ''; 
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

        let imgHtml = '';
        if(q.images && q.images.length > 0) {
            imgHtml = q.images.map(img => 
                `<img src="./data/images/${img}" class="q-image" onclick="App.openImage(this.src)" onerror="this.style.display='none'">`
            ).join('');
        }

        const html = `
            <div class="list-header" style="justify-content:space-between">
                <button class="back-btn" onclick="history.back()"><i class="fa-solid fa-xmark"></i></button>
                <span style="font-family:'Orbitron'; font-weight:bold">${this.data.currentQIndex + 1} / ${total}</span>
            </div>

            <div class="question-box">
                <div class="q-text">${this.cleanText(q.question_text)}</div>
                <div style="text-align:center; margin:15px 0;">${imgHtml}</div>
                
                <div class="options-stack">
                    ${q.options.map((opt, i) => `
                        <div class="option" onclick="App.handleAnswer(this, ${i}, '${q.correct_option}')">
                            ${String.fromCharCode(65 + i)}. ${this.cleanText(opt)}
                        </div>
                    `).join('')}
                </div>

                <div id="explanation" class="option" style="display:none; margin-top:20px; border-color:var(--accent); background:rgba(37,99,235,0.05); cursor:default">
                    <strong><i class="fa-solid fa-circle-info"></i> Explanation:</strong><br><br>
                    ${this.cleanText(q.explanation)}
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
        this.elements.main.innerHTML = `<div style="max-width:800px; margin:0 auto; padding-bottom:60px;">${html}</div>`;
    },

    handleAnswer(el, index, correctChar) {
        if (el.parentElement.classList.contains('answered')) return;
        el.parentElement.classList.add('answered');

        const selectedChar = String.fromCharCode(97 + index); 
        const correctIndex = correctChar.toLowerCase().charCodeAt(0) - 97;
        const options = el.parentElement.children;

        if (selectedChar === correctChar.toLowerCase()) {
            el.classList.add('selected-correct');
        } else {
            el.classList.add('selected-wrong');
            if(options[correctIndex]) options[correctIndex].classList.add('selected-correct');
        }
        document.getElementById('explanation').style.display = 'block';
    },

    navQuestion(dir) {
        const newIndex = this.data.currentQIndex + dir;
        if (newIndex >= 0 && newIndex < this.data.activeQuestions.length) {
            this.data.currentQIndex = newIndex;
            this.renderQuestion();
        }
    },

    handleSearch(query) {
        if(window.location.hash !== '' && window.location.hash !== '#/') return;
        
        if(query.length < 2) {
            this.renderHome();
            return;
        }
        const filtered = this.data.subjects.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
        this.elements.main.innerHTML = filtered.map(sub => `
            <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                <div class="card-icon-box"><i class="fa-solid ${this.getIcon(sub.name)}"></i></div>
                <h3>${sub.name}</h3>
            </div>
        `).join('');
    },
    
    openImage(src) {
        this.elements.lightboxImg.src = src;
        this.elements.lightbox.classList.remove('hidden');
    },

    getIcon(name) {
        const map = {
            'anaesthesia': 'fa-syringe', 'anatomy': 'fa-bone', 'biochemistry': 'fa-flask',
            'dermatology': 'fa-hand-dots', 'ent': 'fa-ear-listen', 'fmt': 'fa-skull-crossbones',
            'medicine': 'fa-user-doctor', 'microbiology': 'fa-virus', 'obgyn': 'fa-person-pregnant',
            'ophthalmology': 'fa-eye', 'orthopaedics': 'fa-crutch', 'psm': 'fa-users', 
            'pathology': 'fa-microscope', 'pediatrics': 'fa-baby', 'pharmacology': 'fa-pills',
            'physiology': 'fa-heart-pulse', 'psychiatry': 'fa-brain', 'radiology': 'fa-x-ray', 'surgery': 'fa-scalpel'
        };
        return map[name.toLowerCase().trim()] || 'fa-book-medical';
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
