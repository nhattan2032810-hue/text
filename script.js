document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadContainer = document.getElementById('upload-container');
    const quizApp = document.getElementById('quiz-app');
    const paginationContainer = document.getElementById('pagination-container');
    const questionText = document.getElementById('question-text');
    const answersContainer = document.getElementById('answers-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const progressText = document.getElementById('progress-text');
    const paginationNextArrow = document.getElementById('pagination-next-arrow');
    const paginationPrevArrow = document.getElementById('pagination-prev-arrow');

    // State
    let questionsData = [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let navCurrentPage = 0;
    const NAV_PAGE_SIZE = 20;

    // --- EVENT LISTENERS ---
    fileInput.addEventListener('change', handleFileSelect);
    prevBtn.addEventListener('click', showPreviousQuestion);
    nextBtn.addEventListener('click', showNextQuestion);
    submitBtn.addEventListener('click', generateAndDownloadWord);
    paginationNextArrow.addEventListener('click', () => changeNavPage(1));
    paginationPrevArrow.addEventListener('click', () => changeNavPage(-1));
    
    // --- FUNCTIONS ---
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = `Tệp đã chọn: ${file.name}`;
        const reader = new FileReader();
        reader.onload = (e) => {
            mammoth.extractRawText({ arrayBuffer: e.target.result })
                .then(parseAndStartQuiz)
                .catch(handleError);
        };
        reader.readAsArrayBuffer(file);
    }

    function parseAndStartQuiz(result) {
        const text = result.value;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        questionsData = [];
        let currentQuestion = null;
        const questionRegex = /^\d+\.\s(.+)/;
        const answerRegex = /^[a-z]\)\s(.+)/i;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (questionRegex.test(trimmedLine)) {
                if (currentQuestion) questionsData.push(currentQuestion);
                currentQuestion = { question: trimmedLine, answers: [] };
            } else if (currentQuestion && answerRegex.test(trimmedLine)) {
                currentQuestion.answers.push(trimmedLine);
            }
        });
        if (currentQuestion) questionsData.push(currentQuestion);
        
        if (questionsData.length > 0) {
            userAnswers = new Array(questionsData.length).fill(null);
            uploadContainer.classList.add('hidden');
            quizApp.classList.remove('hidden');
            renderUI();
        } else {
            handleError("Không tìm thấy câu hỏi nào trong tệp. Vui lòng kiểm tra định dạng tệp.");
        }
    }

    function renderUI() {
        renderPagination();
        renderQuestion();
        updateProgress();
    }

    function renderPagination() {
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(questionsData.length / NAV_PAGE_SIZE);
        const start = navCurrentPage * NAV_PAGE_SIZE;
        const end = Math.min(start + NAV_PAGE_SIZE, questionsData.length);

        for (let i = start; i < end; i++) {
            const item = document.createElement('div');
            item.className = 'page-number';
            item.textContent = i + 1;
            if (i === currentQuestionIndex) item.classList.add('active');
            if (userAnswers[i] !== null) item.classList.add('answered');
            
            item.addEventListener('click', () => {
                currentQuestionIndex = i;
                renderUI();
            });
            paginationContainer.appendChild(item);
        }
        
        paginationPrevArrow.classList.toggle('hidden', navCurrentPage === 0);
        paginationNextArrow.classList.toggle('hidden', navCurrentPage >= totalPages - 1);
    }

    function renderQuestion() {
        const question = questionsData[currentQuestionIndex];
        questionText.textContent = question.question;
        answersContainer.innerHTML = '';

        question.answers.forEach(answer => {
            const option = document.createElement('div');
            option.className = 'answer-option';
            if (userAnswers[currentQuestionIndex] === answer) {
                option.classList.add('selected');
            }
            option.dataset.answer = answer;

            option.innerHTML = `
                <div class="radio-circle"></div>
                <div class="answer-text">${answer}</div>
            `;
            
            option.addEventListener('click', handleAnswerSelect);
            answersContainer.appendChild(option);
        });
    }

    function handleAnswerSelect(event) {
        const selectedOption = event.currentTarget;
        const selectedAnswer = selectedOption.dataset.answer;
        userAnswers[currentQuestionIndex] = selectedAnswer;

        setTimeout(() => {
            if (currentQuestionIndex < questionsData.length - 1) {
                currentQuestionIndex++;
                const newNavPage = Math.floor(currentQuestionIndex / NAV_PAGE_SIZE);
                if (newNavPage !== navCurrentPage) {
                    navCurrentPage = newNavPage;
                }
            }
            renderUI();
        }, 300);
    }

    function showPreviousQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            const newNavPage = Math.floor(currentQuestionIndex / NAV_PAGE_SIZE);
            if (newNavPage !== navCurrentPage) {
                navCurrentPage = newNavPage;
            }
            renderUI();
        }
    }

    function showNextQuestion() {
        if (currentQuestionIndex < questionsData.length - 1) {
            currentQuestionIndex++;
            const newNavPage = Math.floor(currentQuestionIndex / NAV_PAGE_SIZE);
            if (newNavPage !== navCurrentPage) {
                navCurrentPage = newNavPage;
            }
            renderUI();
        }
    }
    
    function changeNavPage(direction) {
        const totalPages = Math.ceil(questionsData.length / NAV_PAGE_SIZE);
        const newPage = navCurrentPage + direction;
        if (newPage >= 0 && newPage < totalPages) {
            navCurrentPage = newPage;
            renderPagination();
        }
    }

    function updateProgress() {
        const answeredCount = userAnswers.filter(answer => answer !== null).length;
        progressText.textContent = `Đã chọn: ${answeredCount} / ${questionsData.length}`;
    }

    function generateAndDownloadWord() {
        try {
            if (questionsData.length === 0) {
                return alert("Không có dữ liệu để xuất file.");
            }
            if (typeof docx === 'undefined') {
                return alert("Lỗi: Thư viện 'docx' chưa được tải. Vui lòng kiểm tra kết nối mạng.");
            }

            const { Document, Packer, Paragraph, TextRun } = docx;
            
            const paragraphs = [];
            questionsData.forEach((q, index) => {
                paragraphs.push(new Paragraph({
                    children: [new TextRun({ text: q.question, bold: true })],
                    spacing: { after: 200 },
                }));

                q.answers.forEach(answer => {
                    const isSelected = userAnswers[index] === answer;
                    paragraphs.push(new Paragraph({
                        children: [new TextRun({ text: answer, bold: isSelected })],
                        indent: { left: 720 },
                    }));
                });
                paragraphs.push(new Paragraph(""));
            });

            const doc = new Document({
                sections: [{ children: paragraphs }],
            });

            Packer.toBlob(doc).then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'dap_an_da_chon.docx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }).catch(err => {
                console.error("Lỗi khi tạo blob từ Packer:", err);
                alert("Đã xảy ra lỗi trong quá trình tạo file Word.");
            });
        } catch(error) {
            console.error("Lỗi không xác định trong generateAndDownloadWord:", error);
            alert("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.");
        }
    }

    function handleError(error) {
        console.error(error);
        alert(error.message || "Đã xảy ra lỗi khi đọc tệp Word.");
    }
});