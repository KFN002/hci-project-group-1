import { get, q } from "./utils/elem.js";

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

// utility to escape HTML special characters
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
    if(bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes /(1024 ** index);
    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function extensionOf(file) {
    return file.name.split(".").pop().toLowerCase();
}

function isSupported(file) {
    return acceptedExtensions.has(extensionOf(file));
}

function fileIcon(file) {
    const extension = extensionOf(file);
    if(extension === "pdf") return "fa-file-pdf";
    if(extension === "txt") return "fa-file-lines";
    if(extension === "doc" || extension === "docx") return "fa-file-word";
    return "fa-file";
}

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

function selectFile(index) {
    if(!activeProject) return;
    const file = activeProject.files[index];
    if(!file) return;

    fileList.querySelectorAll(".file-row").forEach((row, rowIndex) => {
        row.classList.toggle("active", rowIndex === index);
    });

    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)} / ${escapeHtml(file.name)}</strong>`;

    if(previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;

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

function showSummary() {
    if(!activeProject?.summaryFile) return;

    fileList.querySelectorAll(".file-row").forEach(row => row.classList.remove("active"));
    fileList.querySelector(".summary-row")?.classList.add("active");
    breadcrumbs.innerHTML = `<span>My documents</span><b>/</b><strong>${escapeHtml(activeProject.name)} / Summary.md</strong>`;
    documentViewer.innerHTML = `
        <article class="text-preview summary-preview">
            <div class="preview-heading">
                <div><p class="eyebrow">Generated summary</p><h2>Summary.md</h2></div>
                <span>${escapeHtml(activeProject.summaryFile.model)}</span>
            </div>
            <pre>${escapeHtml(activeProject.summaryFile.summary)}</pre>
        </article>
    `;
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
    get("#more").disabled = false;

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
            };
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
                        <div class="confidence-score">AI<span>${escapeHtml(data.model)}</span></div>
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