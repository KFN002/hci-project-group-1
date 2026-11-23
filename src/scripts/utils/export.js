/**
 * Downloads plain text as a browser file.
 *
 * @param {string} filename Download name.
 * @param {string} content File content.
 */
export function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * Prints the summary in an isolated print frame.
 * The browser's print dialog lets the user save the result as PDF.
 *
 * @param {string} title Summary title.
 * @param {string} html Sanitized summary HTML.
 */
export function printSummaryPdf(title, html) {
    const frame = document.createElement("iframe");
    frame.className = "print-frame";
    frame.setAttribute("title", "Print Summary.md");
    frame.srcdoc = `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
                body { max-width: 760px; margin: 40px auto; color: #17201f; font: 14px/1.65 Georgia, serif; }
                h1,h2,h3,h4 { color: #183f4b; line-height: 1.25; }
                mark { background: #ffe08a; }
                pre, code { font-family: monospace; }
                a { color: #183f4b; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>${html}</body>
        </html>`;

    document.body.appendChild(frame);
    frame.onload = () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => frame.remove(), 1000);
    };
}
