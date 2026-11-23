import { get, q } from "./utils/elem.js";
import { escapeHtml, formatBytes, extensionOf, fileIcon } from "./utils/format.js";
import { downloadTextFile, printSummaryPdf } from "./utils/export.js";

// elements
const tabs = q(".tab", document, true);
const tab_content = q(".tab-content", document, true);
const documentUpload = get("#document-upload");
const folderUpload = get("#folder-upload");
const fileList = get("#file-list");
const documentViewer = q(".document-viewer");
const reviewTab = get("#review-tab");
const runButton = get("#run");
const reviewStatus = q(".review-status");
const breadcrumbs = q(".breadcrumbs");
const acceptedExtensions = new Set(["pdf", "txt", "doc", "docx"]);
const maxFileSize = 25 * 1024 * 1024;

// global constants
let projectNumber = 0;
let activeProject = null;
let previewUrl = null;

// more elements
const fileListActions = get("#file-list-actions");
const addFilesButton = get("#add-files-button");
const addFolderButton = get("#add-folder-button");
const moreButton = get("#more");
const exportMenu = get("#export-menu");
const exportMarkdownButton = get("#export-markdown");
const exportPdfButton = get("#export-pdf");

/**
 * utility to check if file is supported based on its extension
 * @param {*} file 
 * @returns 
 */
function isSupported(file) {
    return acceptedExtensions.has(extensionOf(file));
}

/**
 * changes the content of the review tab to show an overview of the project
 * @param {} project 
 */
function setReviewOverview(project) {
    const supported = project.files.length;
    const totalSize = project.files.reduce((sum, file) => sum + file.size, 0);

    reviewTab.innerHTML = `
        <div class="review-overview">
            <div class="overview-heading">
                <span class="overview-icon"><i class="fa-solid fa-folder-open"></i></span>
                <div>
                    <p class="eyebrow">${project.type === "folder" ? "Folder overview" : "Project overview"}</p>
                    <h3>${escapeHtml(project.name)}</h3>
                </div>
            </div>
            <div class="overview-stats">
                <div><strong>${supported}</strong><span>Files</span></div>
                <div><strong>${formatBytes(totalSize)}</strong><span>Total size</span></div>
                <div><strong>${project.type === "folder" ? "Folder" : "Project"}</strong><span>Source</span></div>
            </div>
            <div class="overview-section">
                <h4>Files included</h4>
                <div class="review-file-list">
                    ${project.files.map(file => `
                        <div class="review-file">
                            <i class="fa-regular ${fileIcon(file)}"></i>
                            <span>${escapeHtml(file.name)}</span>
                            <small>${formatBytes(file.size)}</small>
                        </div>
                    `).join("")}
                </div>
            </div>
            <p class="review-ready"><i class="fa-solid fa-circle-check"></i> Ready to analyze</p>
        </div>
    `;
}

/**
 * adds entry to history of the active project and renders the history tab
 * @param {*} action 
 * @param {*} detail 
 * @returns 
 */
function addHistory(action, detail) {
    if(!activeProject) return;
    activeProject.history ||= [];
    activeProject.history.unshift({
        id: `${Date.now()}-${activeProject.history.length}`,
        action,
        detail,
        time: new Date(),
    });
    renderHistory();
}

/**
 * renders the history tab with the history of the active project
 */
function renderHistory() {
    const historyTab = get("#history-tab");
    const history = activeProject?.history || [];
    if(!history.length) {
        historyTab.innerHTML = `
            <div class="insights-empty">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <strong>No changes yet</strong>
                <p>Document review history will appear here.</p>
            </div>
        `;
        return;
    }

    historyTab.innerHTML = `
        <div class="history-list">
            ${history.map(entry => `
                <article class="history-entry">
                    <span class="history-icon"><i class="fa-solid fa-clock-rotate-left"></i></span>
                    <div>
                        <strong>${escapeHtml(entry.action)}</strong>
                        <p>${escapeHtml(entry.detail)}</p>
                        <time>${escapeHtml(entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</time>
                    </div>
                </article>
            `).join("")}
        </div>
    `;
}

/**
 * toggles the summary export menu.
 */
function toggleExportMenu(event) {
    event.stopPropagation();
    exportMenu.hidden = !exportMenu.hidden;
}

/**
 * downloads the current Summary.md as a plain md file.
 */
function exportSummaryMarkdown() {
    if(!activeProject?.summaryFile) return;
    downloadTextFile("Summary.md", activeProject.summaryFile.summary);
    exportMenu.hidden = true;
}

/**
 * opens the browser print dialog so the rendered summary can be saved as PDF.
 */
function exportSummaryPdf() {
    if(!activeProject?.summaryFile) return;
    const summaryHtml = document.querySelector(".summary-markdown")?.innerHTML
        || renderMarkdown(activeProject.summaryFile.summary);
    printSummaryPdf("Summary.md", summaryHtml);
    exportMenu.hidden = true;
}

/**
 * renders the file list in the left panel for the active project.
 */
function renderFileList(project) {
    fileList.innerHTML = `
        <h3 class="project-heading">
            <button type="button" class="project-heading-button" title="Return to ${escapeHtml(project.name)} overview">
                <i class="fa-solid fa-folder-open"></i>
                <span>${escapeHtml(project.name)}</span>
            </button>
        </h3>
        <div class="project-files"></div>
    `;
    fileListActions.hidden = false;

    fileList.querySelector(".project-heading-button").addEventListener("click",() => {
        fileList.querySelectorAll(".file-row").forEach(row => row.classList.remove("active"));
        breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(project.name)}</strong>`;
        renderProjectOverview(project);
    });

    // render each file as a button in the file list
    const projectFiles = fileList.querySelector(".project-files");
    project.files.forEach((file, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "file-row";
        button.dataset.fileIndex = String(index);
        button.innerHTML = `
            <i class="fa-regular ${fileIcon(file)}"></i>
            <span>${escapeHtml(file.name)}</span>
        `;
        button.addEventListener("click",() => selectFile(index));
        projectFiles.appendChild(button);
    });

    // add special button for Summary.md if it exists in the project
    if(project.summaryFile) {
        const summaryButton = document.createElement("button");
        summaryButton.type = "button";
        summaryButton.className = "file-row summary-row";
        summaryButton.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Summary.md</span>';
        summaryButton.addEventListener("click", showSummary);
        projectFiles.appendChild(summaryButton);
    }
}

function renderProjectOverview(project) {
    const totalSize = project.files.reduce((sum, file) => sum + file.size, 0);
    documentViewer.innerHTML = `
        <div class="project-overview">
            <div class="project-overview-header">
                <span class="project-overview-icon"><i class="fa-solid fa-folder-open"></i></span>
                <div>
                    <p class="eyebrow">${project.type === "folder" ? "Folder" : "Generated project"}</p>
                    <h2>${escapeHtml(project.name)}</h2>
                    <p>${project.files.length} supported file${project.files.length === 1 ? "" : "s"} · ${formatBytes(totalSize)}</p>
                </div>
            </div>
            <div class="project-file-table">
                <div class="project-file-table-head">
                    <span>File name</span><span>Type</span><span>Size</span>
                </div>
                ${project.files.map((file, index) => `
                    <button type="button" class="project-file-row" data-file-index="${index}">
                        <span><i class="fa-regular ${fileIcon(file)}"></i>${escapeHtml(file.name)}</span>
                        <span>${extensionOf(file).toUpperCase()}</span>
                        <span>${formatBytes(file.size)}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    documentViewer.querySelectorAll(".project-file-row").forEach(row => {
        row.addEventListener("click",() => selectFile(Number(row.dataset.fileIndex)));
    });
}

/**
 * selects a file from the active project and displays its content in the document viewer.
 * @param {*} index 
 * @returns 
 */
function selectFile(index) {
    // check if active project exists and if the file index is valid
    if(!activeProject) return;
    const file = activeProject.files[index];
    if(!file) return;

    fileList.querySelectorAll(".file-row").forEach((row, rowIndex) => {
        row.classList.toggle("active", rowIndex === index);
    });

    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)} / ${escapeHtml(file.name)}</strong>`;

    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;

    // .txt files can be previewed as plain text in a <pre> block
    if(extensionOf(file) === "txt") {
        const reader = new FileReader();
        reader.onload =(event) => {
            documentViewer.innerHTML = `
                <article class="text-preview">
                    <div class="preview-heading">
                        <div><p class="eyebrow">Text document</p><h2>${escapeHtml(file.name)}</h2></div>
                        <span>${formatBytes(file.size)}</span>
                    </div>
                    <pre>${escapeHtml(String(event.target.result || ""))}</pre>
                </article>
            `;
        };
        reader.readAsText(file);
        return;
    }

    // special handling for PDF files, which can be previewed in an iframe
    if(extensionOf(file) === "pdf") {
        previewUrl = URL.createObjectURL(file);
        documentViewer.innerHTML = `
            <article class="pdf-preview">
                <div class="preview-heading">
                    <div><p class="eyebrow">PDF document</p><h2>${escapeHtml(file.name)}</h2></div>
                    <a class="download-link" href="${previewUrl}" download="${escapeHtml(file.name)}">Download</a>
                </div>
                <iframe src="${previewUrl}" title="${escapeHtml(file.name)}"></iframe>
            </article>
        `;
        return;
    }

    documentViewer.innerHTML = `
        <article class="office-preview">
            <span class="office-icon"><i class="fa-regular ${fileIcon(file)}"></i></span>
            <p class="eyebrow">${extensionOf(file).toUpperCase()} document</p>
            <h2>${escapeHtml(file.name)}</h2>
            <p>${formatBytes(file.size)} · This format is ready for review, but browser-native text preview is unavailable.</p>
            <a class="download-link" href="${URL.createObjectURL(file)}" download="${escapeHtml(file.name)}">Download file</a>
        </article>
    `;
}

/**
 * shows summary of the active project in the document viewer, if it exists.
 * @returns 
 */
function showSummary() {
    if(!activeProject?.summaryFile) return;
    moreButton.disabled = false;

    fileList.querySelectorAll(".file-row").forEach(row => row.classList.remove("active"));
    fileList.querySelector(".summary-row")?.classList.add("active");
    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)} / Summary.md</strong>`;
    const renderedSummary = renderMarkdown(activeProject.summaryFile.summary);
    documentViewer.innerHTML = `
        <article class="text-preview summary-preview">
            <div class="preview-heading">
                <div><p class="eyebrow">Generated summary</p><h2>Summary.md</h2></div>
                <span>${escapeHtml(activeProject.summaryFile.model)}</span>
            </div>
            <div class="markdown-body summary-markdown">${renderedSummary}</div>
            <form class="summary-prompt" id="summary-prompt">
                <label for="summary-prompt-input">Ask about this summary</label>
                <div class="summary-prompt-row">
                    <input id="summary-prompt-input" name="prompt" type="text" autocomplete="off" placeholder="Ask a follow-up question..." required>
                    <button type="submit"><i class="fa-solid fa-arrow-up"></i><span>Send</span></button>
                </div>
            </form>
        </article>
    `;

    const promptForm = get("#summary-prompt");
    promptForm.addEventListener("submit", submitSummaryPrompt);
    prepareSummaryHighlights();
}

/**
 * splits rendered text into click-sized sentences for highlight metadata.
 *
 * @param {string} text Text content from a summary element.
 * @returns {string[]} Sentence fragments.
 */
function splitSentences(text) {
    return String(text).match(/[^.!?\n]+[.!?]?|[^.!?\n]+$/g)?.map(value => value.trim()).filter(Boolean) || [];
}

/**
 * collects useful words for a lightweight source overlap check.
 *
 * @param {string} text text to index.
 * @returns {Set<string>} lowercase words with at least four characters.
 */
function keywords(text) {
    return new Set(String(text).toLowerCase().match(/[a-z0-9]{4,}/g) || []);
}

/**
 * matches one summary sentence to the strongest supporting source passage.
 *
 * @param {string} sentence summary sentence.
 * @param {number} index highlight index.
 * @returns {object} highlight metadata used by the review tab.
 */
function buildHighlight(sentence, index) {
    const summaryWords = keywords(sentence);
    let best = null;

    for(const source of activeProject.summaryFile.sourceTexts || []) {
        const sourceWords = keywords(source.text);
        const overlap = [...summaryWords].filter(word => sourceWords.has(word)).length;
        const score = summaryWords.size ? overlap / summaryWords.size : 0;
        const snippet = sentence.slice(0, 180);
        const position = source.text.toLowerCase().indexOf(snippet.toLowerCase());
        const candidate = { source, score, position: position >= 0 ? position : findLoosePosition(source.text, sentence) };
        if(!best || candidate.score > best.score || (candidate.score === best.score && candidate.position >= 0 && best.position < 0)) {
            best = candidate;
        }
    }

    if(!best) {
        return {
            id: `highlight-${index}`,
            text: sentence,
            confidence: 50,
            citations: [],
            model: activeProject.summaryFile.model,
        };
    }

    const confidence = Math.max(52, Math.min(96, Math.round(52 + best.score * 44)));
    return {
        id: `highlight-${index}`,
        text: sentence,
        confidence,
        citations: [{
            filename: best.source.filename,
            text: best.source.text,
            position: best.position,
            match: sentence,
        }],
        model: activeProject.summaryFile.model,
    };
}

/**
 * Finds a fallback source position when the full sentence cannot be matched.
 *
 * @param {string} sourceText Original extracted document text.
 * @param {string} sentence Summary sentence.
 * @returns {number} Character offset, or zero when no word matches.
 */
function findLoosePosition(sourceText, sentence) {
    const words = [...keywords(sentence)].slice(0, 6);
    for(const word of words) {
        const position = sourceText.toLowerCase().indexOf(word);
        if(position >= 0) return position;
    }
    return 0;
}

/**
 * Wraps summary paragraphs and list items as clickable highlight elements.
 * This is intentionally rerun after every summary or follow-up replacement.
 */
function prepareSummaryHighlights() {
    const container = document.querySelector(".summary-markdown");
    if(!container || !activeProject?.summaryFile) return;

    const sourceTexts = activeProject.summaryFile.sourceTexts || [];
    if(!sourceTexts.length) return;
    activeProject.summaryFile.highlights = [];

    const candidates = container.querySelectorAll("p, li");
    let highlightIndex = 0;
    candidates.forEach(element => {
        const sentences = splitSentences(element.textContent);
        if(!sentences.length) return;

        const fragments = element.innerHTML;
        element.innerHTML = "";
        sentences.forEach(sentence => {
            if(element.childNodes.length) element.append(document.createTextNode(" "));
            if(sentence.length < 20) {
                element.append(document.createTextNode(sentence));
                return;
            }
            const highlight = buildHighlight(sentence, highlightIndex++);
            activeProject.summaryFile.highlights.push(highlight);
            const mark = document.createElement("mark");
            mark.className = "summary-highlight";
            mark.dataset.highlightId = highlight.id;
            mark.textContent = sentence;
            mark.title = `${highlight.confidence}% confidence · ${highlight.citations.length} source citation`;
            element.append(mark);
        });

        if(!element.childNodes.length) element.innerHTML = fragments;
    });

    container.querySelectorAll(".summary-highlight").forEach(mark => {
        mark.addEventListener("click", () => showHighlightDetails(mark.dataset.highlightId));
    });
}

function showHighlightDetails(highlightId) {
    const highlight = activeProject?.summaryFile?.highlights?.find(item => item.id === highlightId);
    if(!highlight) return;

    document.querySelectorAll(".summary-highlight").forEach(mark => mark.classList.toggle("active", mark.dataset.highlightId === highlightId));
    const tabReview = get("#review-tab");
    tabReview.innerHTML = `
        <div class="highlight-details">
            <div class="highlight-detail-heading">
                <p class="eyebrow">Selected summary highlight</p>
                <span class="highlight-confidence">${highlight.confidence}%<small>Confidence</small></span>
            </div>
            <blockquote>${escapeHtml(highlight.text)}</blockquote>
            <div class="highlight-meta">
                <div><span>Model</span><strong>${escapeHtml(highlight.model)}</strong></div>
                <div><span>Evidence</span><strong>${highlight.citations.length} cited source${highlight.citations.length === 1 ? "" : "s"}</strong></div>
            </div>
            <div class="highlight-citations">
                <h4>Cited sources</h4>
                ${highlight.citations.map((citation, index) => `
                    <button type="button" class="highlight-citation" data-citation-index="${index}">
                        <i class="fa-regular fa-file-lines"></i>
                        <span><strong>${escapeHtml(citation.filename)}</strong><small>Source match · position ${citation.position + 1}</small></span>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                `).join("") || '<p class="no-citations">No source match was found.</p>'}
            </div>
        </div>
    `;

    tabs.forEach(item => item.classList.toggle("active", item.dataset.tab === "review"));
    tab_content.forEach(content => content.classList.toggle("hidden", content.id !== "review-tab"));
    tabReview.querySelectorAll(".highlight-citation").forEach(button => {
        button.addEventListener("click", () => {
            const citation = highlight.citations[Number(button.dataset.citationIndex)];
            showSourceCitation(citation);
        });
    });
}

function showSourceCitation(citation) {
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)} / ${escapeHtml(citation.filename)}</strong>`;

    const before = citation.text.slice(Math.max(0, citation.position - 400), citation.position);
    const matchLength = Math.max(citation.match.length, 1);
    const matched = citation.text.slice(citation.position, citation.position + matchLength);
    const after = citation.text.slice(citation.position + matchLength, citation.position + 400);
    documentViewer.innerHTML = `
        <article class="text-preview source-preview">
            <div class="preview-heading">
                <div><p class="eyebrow">Cited source</p><h2>${escapeHtml(citation.filename)}</h2></div>
                <span>Source position ${citation.position + 1}</span>
            </div>
            <pre id="cited-source-content">${escapeHtml(before)}<mark id="cited-source-match">${escapeHtml(matched || citation.match)}</mark>${escapeHtml(after)}</pre>
        </article>
    `;

    requestAnimationFrame(() => {
        document.getElementById("cited-source-match")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

function renderMarkdown(markdown) {
    if(window.marked && window.DOMPurify) {
        return window.DOMPurify.sanitize(window.marked.parse(markdown || ""));
    }

    return escapeHtml(markdown || "").replace(/\n/g, "<br>");
}

async function submitSummaryPrompt(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.prompt;
    const prompt = input.value.trim();
    if(!prompt || !activeProject?.summaryFile) return;

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Send</span>';

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("summary", activeProject.summaryFile.summary);
    formData.append("project_name", activeProject.name);

    try {
        const response = await fetch("/api/reviews/followup", { method: "POST", body: formData });
        const data = await response.json();
        if(!response.ok) throw new Error(data.detail || "Follow-up request failed");

        // A chain prompt replaces the complete summary. Follow-up cards are not
        // a second document and must not be appended below the original summary.
        activeProject.summaryFile.followUps ||= [];
        activeProject.summaryFile.followUps.push({ prompt, response: data.response });
        activeProject.summaryFile.summary = data.response.trim();
        activeProject.summaryFile.highlights = [];
        addHistory("Chain prompting", `Replaced Summary.md: ${prompt}`);
        showSummary();
    } catch(error) {
        reviewStatus.innerHTML = "<i></i> Prompt failed";
        const errorElement = document.createElement("p");
        errorElement.className = "prompt-error";
        errorElement.textContent = error.message;
        form.appendChild(errorElement);
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fa-solid fa-arrow-up"></i><span>Send</span>';
    }
}

function applySelection(files, sourceType) {
    const selected = Array.from(files);
    if(!selected.length) return;

    const supported = selected.filter(file => isSupported(file) && file.size <= maxFileSize);
    if(!supported.length) {
        reviewStatus.innerHTML = "<i></i> Unsupported files";
        return;
    }

    if(sourceType === "folder") {
        const relativePath = supported[0].webkitRelativePath || "";
        const folderName = relativePath.split("/")[0] || "Selected folder";
        if(activeProject && activeProject.type === "folder" && activeProject.name === folderName) {
            const existing = new Set(activeProject.files.map(file => `${file.name}:${file.size}:${file.lastModified}`));
            supported.forEach(file => {
                const key = `${file.name}:${file.size}:${file.lastModified}`;
                if(!existing.has(key)) activeProject.files.push(file);
            });
        } else {
            activeProject = { name: folderName, type: "folder", files: supported };
        }
    } else {
        if(activeProject && activeProject.type === "file") {
            const existing = new Set(activeProject.files.map(file => `${file.name}:${file.size}:${file.lastModified}`));
            supported.forEach(file => {
                const key = `${file.name}:${file.size}:${file.lastModified}`;
                if(!existing.has(key)) activeProject.files.push(file);
            });
        } else {
            projectNumber += 1;
            activeProject = { name: `Project${projectNumber}`, type: "file", files: supported };
        }
    }

    renderFileList(activeProject);
    renderProjectOverview(activeProject);
    setReviewOverview(activeProject);
    runButton.disabled = false;
    reviewStatus.innerHTML = "<i></i> Ready for review";
    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)}</strong>`;
    moreButton.disabled = true;

    if(selected.length !== supported.length) {
        const rejected = selected.length - supported.length;
        reviewStatus.innerHTML = `<i></i> ${rejected} file${rejected === 1 ? "" : "s"} skipped`;
    }
}

documentUpload.addEventListener("change",(event) => {
    applySelection(event.target.files, "file");
});

folderUpload.addEventListener("change",(event) => {
    applySelection(event.target.files, "folder");
});

addFilesButton?.addEventListener("click",() => {
    documentUpload.value = "";
    documentUpload.click();
});

addFolderButton?.addEventListener("click",() => {
    folderUpload.value = "";
    folderUpload.click();
});

async function readDroppedEntry(entry, path = "") {
    if(entry.isFile) {
        return new Promise(resolve => {
            entry.file(file => {
                if(!path) Object.defineProperty(file, "webkitRelativePath", { value: file.name });
                resolve([file]);
            });
        });
    }

    if(entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise(resolve => {
            const collected = [];
            const readBatch =() => reader.readEntries(async batch => {
                if(!batch.length) {
                    resolve(collected);
                    return;
                }
                collected.push(...batch);
                readBatch();
            });
            readBatch();
        });

        const nestedFiles = await Promise.all(entries.map(child => readDroppedEntry(child, `${path}${entry.name}/`)));
        return nestedFiles.flat();
    }

    return [];
}

function getDroppedFolders(items) {
    return Array.from(items)
        .map(item => item.webkitGetAsEntry?.())
        .filter(Boolean);
}

const uploadDropzone = get("#upload-dropzone");
if(uploadDropzone) {
    ["dragenter", "dragover"].forEach(eventName => {
        uploadDropzone.addEventListener(eventName, event => {
            event.preventDefault();
            event.stopPropagation();
            uploadDropzone.classList.add("drag-active");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        uploadDropzone.addEventListener(eventName, event => {
            event.preventDefault();
            event.stopPropagation();
            uploadDropzone.classList.remove("drag-active");
        });
    });

    uploadDropzone.addEventListener("drop", async event => {
        const entries = getDroppedFolders(event.dataTransfer.items);
        if(entries.length) {
            const nestedFiles = await Promise.all(entries.map(entry => readDroppedEntry(entry)));
            const folderEntries = entries.filter(entry => entry.isDirectory);
            const files = nestedFiles.flat();
            folderEntries.forEach(folderEntry => {
                files.forEach(file => {
                    if(!file.webkitRelativePath) {
                        Object.defineProperty(file, "webkitRelativePath", {
                            value: `${folderEntry.name}/${file.name}`,
                        });
                    }
                });
            });
            applySelection(files, folderEntries.length ? "folder" : "file");
        } else {
            applySelection(event.dataTransfer.files, "file");
        }
    });
}

documentViewer.addEventListener("dragenter", event => {
    event.preventDefault();
    documentViewer.classList.add("drag-active");
});

documentViewer.addEventListener("dragover", event => {
    event.preventDefault();
});

documentViewer.addEventListener("dragleave", event => {
    if(!documentViewer.contains(event.relatedTarget)) {
        documentViewer.classList.remove("drag-active");
    }
});

documentViewer.addEventListener("drop", event => {
    event.preventDefault();
    documentViewer.classList.remove("drag-active");
    if(!event.dataTransfer?.files?.length) return;
    applySelection(event.dataTransfer.files, "file");
});

runButton.addEventListener("click",() => {
    if(!activeProject) return;

    runButton.disabled = true;
    runButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reviewing...';
    reviewStatus.innerHTML = "<i></i> Reviewing";

    const formData = new FormData();
    formData.append("project_name", activeProject.name);
    activeProject.files.forEach(file => formData.append("files", file, file.name));

    fetch("/api/reviews", { method: "POST", body: formData })
        .then(async response => {
            const data = await response.json();
            if(!response.ok) throw new Error(data.detail || "Review generation failed");
            return data;
        })
        .then(data => {
            activeProject.summaryFile = {
                name: data.filename,
                summary: data.summary,
                model: data.model,
                confidence: Number(data.confidence),
                followUps: [],
                sourceTexts: (data.source_texts || []).map(source => ({
                    filename: source.filename,
                    text: source.text,
                })),
            };
            addHistory("Review generated", `${data.filename} created with ${data.confidence}% confidence`);
            renderFileList(activeProject);
            showSummary();
            setReviewOverview(activeProject);
            reviewTab.innerHTML = `
                <div class="review-results">
                    <div class="review-result-heading">
                        <div>
                            <p class="eyebrow">Review complete</p>
                            <h3>${escapeHtml(activeProject.name)}</h3>
                        </div>
                        <div class="confidence-score">${escapeHtml(data.confidence)}%<span>Confidence</span></div>
                    </div>
                    <div class="summary-card">
                        <h4>Generated summary</h4>
                        <p>The project summary is available in the center panel and as <strong>Summary.md</strong> in the left project list.</p>
                    </div>
                    <div class="overview-section">
                        <h4>Supporting evidence</h4>
                        ${activeProject.files.map(file => `
                            <div class="evidence-row">
                                <i class="fa-regular ${fileIcon(file)}"></i>
                                <div><strong>${escapeHtml(file.name)}</strong><span>${extensionOf(file).toUpperCase()} · ${formatBytes(file.size)}</span></div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
            reviewStatus.innerHTML = "<i></i> Review complete";
            runButton.disabled = false;
            runButton.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Run review';
        })
        .catch(error => {
            reviewStatus.innerHTML = "<i></i> Review failed";
            reviewTab.innerHTML = `
                <div class="insights-empty">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <strong>Could not generate the review</strong>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            `;
            runButton.disabled = false;
            runButton.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Run review';
        });
});

moreButton.addEventListener("click", toggleExportMenu);
exportMarkdownButton.addEventListener("click", exportSummaryMarkdown);
exportPdfButton.addEventListener("click", exportSummaryPdf);

document.addEventListener("click", event => {
    if(!exportMenu.hidden && !exportMenu.contains(event.target) && event.target !== moreButton) {
        exportMenu.hidden = true;
    }
});

/**
 * add click event for each tab to show the matching content and hide the others
 */
tabs.forEach(tab => {
    tab.addEventListener("click",() => {
        // remove any active class from the tabs and hide the content
        tabs.forEach(item => {
            item.classList.remove("active")
        });

        tab_content.forEach(content => {
            content.classList.add("hidden");
        });

        // add this tab as active
        tab.classList.add("active");
        get(`#${tab.dataset.tab}-tab`).classList.remove("hidden");
    });
});