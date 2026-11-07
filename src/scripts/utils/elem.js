
/**
 * utility to get elements much easier than using document.getX or document.querySelector
 * plus it supports from any parent element, not just document
 * 
 * ! WARNING !
 * 
 * if you use 
 * ```js
 * get("element_name")
 * // or
 * get(".element_class")
 * ```
 * you will get an array of elements, not just one
 */
export function get(selector, parent = document) {
    if(selector.startsWith("#")) {
        return parent.getElementById(selector.slice(1));
    } else if(selector.startsWith(".")) {
        return parent.querySelectorAll(selector);
    } else {
        return parent.getElementsByTagName(selector);
    }
}

// same but for query selection
export function q(selector, parent = document, all = false) {
    if(all) {
        return parent.querySelectorAll(selector);
    } else {
        return parent.querySelector(selector);
    }
}