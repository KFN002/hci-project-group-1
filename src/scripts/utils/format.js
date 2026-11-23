/**
 * converts a value to text safe for insertion into HTML
 *
 * @param {*} value value that will be displayed
 * @returns {string} HTML-escaped text
 */
export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * utility to get formatted size of file size in bytes
 *
 * @param {number} bytes size in bytes
 * @returns {string} the formatted size
 */
export function formatBytes(bytes) {
    if(bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);

    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

/**
 * utility to get extension of a file object
 *
 * @param {File} file Browser file object.
 * @returns {string} The file extension.
 */
export function extensionOf(file) {
    return file.name.split(".").pop().toLowerCase();
}

/** 
 * returns icon based on file extension
 *
 * @param {File} file Browser file object.
 */
export function fileIcon(file) {
    const extension = extensionOf(file);
    if(extension === "pdf") return "fa-file-pdf";
    if(extension === "txt") return "fa-file-lines";
    if(extension === "doc" || extension === "docx") return "fa-file-word";
    return "fa-file";
}
