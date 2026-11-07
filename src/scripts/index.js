
import { get, q } from "./utils/elem.js";

const tabs = q(".tab", document, true);
const tab_content = q(".tab-content", document, true);

/**
 * add click event for each tab to show the matching content and hide the others
 */
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
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

get("#document-upload").addEventListener("change", (event) => {
    const file = event.target.files[0];

    // get content
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        console.log("file content", content);
    };

    reader.readAsText(file);
});