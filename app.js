/**
 * MedEngine V2.2 - Text Encoding Fix & Master Index Removed
 */

const App = {
    // --- STATE ---
    data: {
        subjects: [],
        syllabus: {},
        cache: {},
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
            this.elements.main.innerHTML = `<div class="loading" style="color:var(--error)">
                <i class="fa-solid fa-triangle-exclamation"></i><br>Failed to load library.<br>Check file structure.
            </div>`;
            console.error(error);
        }
    },

    // --- ROUTER ---
    async router() {
        const hash = window.location.hash.slice(1) || '/';
        const segments = hash.split('/');

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
            const chapterIndex = segments[2]; // Keep as string to handle 'ALL'
            
            if (!this.data.cache[subName]) await this.loadSubjectData(subName);
            this.startQuiz(subName, chapterIndex);
            return;
        }
        
        if (segments[0] === 'q') {
            this.handleDeepLink(segments[1]);
        }
    },

    // --- DATA MANAGER ---
    async loadSubjectData(name) {
        if (this.data.cache[name]) return;

        this.elements.main.innerHTML = `<div class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i><br>Loading ${name}...</div>`;

        const subjectObj = this.data.subjects.find(s => s.name === name);
        // Fallback for misnamed files
        const fileName = subjectObj ? subjectObj.file : `${name}.json`;

        try {
            const res = await fetch(`./data/${fileName}`);
            const json = await res.json();
            this.data.cache[name] = json;
        } catch (e) {
            alert("Error loading subject file: " + fileName);
            this.renderHome();
        }
    },

    // --- TEXT CLEANER ENGINE (Fixes Broken Symbols) ---
    cleanText(text) {
        if (!text) return "";
        return text
            // Replace the triple bar '≡' with a hyphen
            .replace(/≡/g, "-") 
            .replace(//g, "•") // Fix weird bullet points
            .replace(/â€“/g, "-") // Fix encoding dashes
            .replace(/â€™/g, "'") // Fix apostrophes
            .replace(/ï»¿/g, "") // BOM fix
            // Fix Greek letters
            .replace(//g, "α").replace(//g, "β").replace(//g, "γ").replace(//g, "δ")
            .replace(//g, "µ");
    },

    // --- RENDERERS ---
    
    renderHome() {
        this.elements.search.value = '';
        const html = `
            <div class="grid">
                ${this.data.subjects.map(sub => `
                    <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                        <div class="card-icon-box">
                            <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                        </div>
                        <h3>${sub.name}</h3>
                    </div>
                `).join('')}
            </div>
        `;
        this.elements.main.innerHTML = html;
    },

    renderChapterList(subName) {
        const chapters = this.data.syllabus[subName] || [];
        const allQuestions = this.data.cache[subName] || [];

        // Header for the list
        let listHtml = `
            <li class="chapter-item special" onclick="location.hash = '#quiz/${subName}/ALL'">
                <div>
                    <div style="font-size:0.8rem; color:var(--primary); font-weight:700">FULL BANK</div>
                    <div style="font-weight:600">Practice All Questions</div>
                </div>
                <span class="badge">${allQuestions.length} Qs</span>
            </li>
        `;

        listHtml += chapters.map((title, idx) => {
            const chNum = idx + 1;
            // Filter based on ID pattern "_ChX_"
            const count = allQuestions.filter(q => q.id.includes(`_Ch${chNum}_`)).length;
            if(count === 0) return '';

            return `
                <li class="chapter-item" onclick="location.hash = '#quiz/${subName}/${chNum}'">
                    <div>
                        <div style="font-size:0.8rem; color:var(--text-sub); font-weight:700">CHAPTER ${chNum}</div>
                        <div style="font-weight:600">${this.cleanText(title)}</div>
                    </div>
                    <span class="badge">${count} Qs</span>
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

    startQuiz(subName, chNum) {
        this.data.activeSubject = subName;
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
            <div class="quiz-header">
                <button class="back-btn" onclick="history.back()"><i class="fa-solid fa-xmark"></i></button>
                <span>Question ${this.data.currentQIndex + 1} / ${total}</span>
                <span class="badge" style="font-family:monospace">${q.id.split('_').pop()}</span>
            </div>

            <div class="question-box">
                <div class="q-text">${this.cleanText(q.question_text)}</div>
                <div class="q-images-container" style="text-align:center">${imgHtml}</div>
                
                <div class="options-stack">
                    ${q.options.map((opt, i) => `
                        <div class="option" onclick="App.handleAnswer(this, ${i}, '${q.correct_option}')">
                            ${String.fromCharCode(65 + i)}. ${this.cleanText(opt)}
                        </div>
                    `).join('')}
                </div>

                <div id="explanation" class="explanation">
                    <strong><i class="fa-solid fa-circle-info"></i> Explanation:</strong>
                    <p>${this.cleanText(q.explanation)}</p>
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
        if (el.parentElement.classList.contains('answered')) return;

        const selectedChar = String.fromCharCode(97 + index); // a, b, c
        const correctIndex = correctChar.toLowerCase().charCodeAt(0) - 97;
        const options = el.parentElement.children;

        el.parentElement.classList.add('answered');

        if (selectedChar === correctChar.toLowerCase()) {
            el.classList.add('selected-correct');
        } else {
            el.classList.add('selected-wrong');
            if(options[correctIndex]) options[correctIndex].classList.add('selected-correct');
        }

        Array.from(options).forEach(opt => opt.classList.add('disabled'));
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
        
        if(window.location.hash === '' || window.location.hash === '#/') {
            const filtered = this.data.subjects.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
            const html = `
                <div class="grid">
                    ${filtered.map(sub => `
                        <div class="card" onclick="location.hash = '#subject/${sub.name}'">
                            <div class="card-icon-box">
                                <i class="fa-solid ${this.getIcon(sub.name)}"></i>
                            </div>
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
        const normName = name.toLowerCase().trim();
        const map = {
            'anaesthesia': 'fa-syringe',
            'anatomy': 'fa-bone',
            'biochemistry': 'fa-flask',
            'dermatology': 'fa-hand-dots',
            'ent': 'fa-ear-listen',
            'fmt': 'fa-skull-crossbones',
            'medicine': 'fa-user-doctor',
            'microbiology': 'fa-virus',
            'obgyn': 'fa-person-pregnant',
            'ophthalmology': 'fa-eye',
            'orthopaedics': 'fa-crutch',
            'psm': 'fa-users', 
            'pathology': 'fa-microscope',
            'pediatrics': 'fa-baby',
            'pharmacology': 'fa-pills',
            'physiology': 'fa-heart-pulse',
            'psychiatry': 'fa-brain',
            'radiology': 'fa-x-ray',
            'surgery': 'fa-scalpel'
        };
        return map[normName] || 'fa-book-medical'; // Fallback
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
