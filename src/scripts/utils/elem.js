
/**
 * easier way to get elements by selector
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

/**
 * queries a descendant of a parent element
 */
export function q(selector, parent = document, all = false) {
    if(all) {
        return parent.querySelectorAll(selector);
    } else {
        return parent.querySelector(selector);
    }
}