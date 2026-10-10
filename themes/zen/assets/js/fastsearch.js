import * as params from '@params';

let fuse;
let resList = document.getElementById('searchResults');
let sInput = document.getElementById('searchInput');
let first, last, current_elem = null;
let resultsAvailable = false;

const DEFAULT_OPTIONS = {
    distance: 100,
    threshold: 0.4,
    ignoreLocation: true,
    keys: ['title', 'permalink', 'summary', 'content'],
};

const SEARCH_DEBOUNCE_MS = 120;

function buildOptions() {
    if (!params.fuseOpts) return DEFAULT_OPTIONS;
    const o = params.fuseOpts;
    return {
        isCaseSensitive: o.iscasesensitive ?? false,
        includeScore: o.includescore ?? false,
        includeMatches: o.includematches ?? false,
        minMatchCharLength: o.minmatchcharlength ?? 1,
        shouldSort: o.shouldsort ?? true,
        findAllMatches: o.findallmatches ?? false,
        keys: o.keys ?? DEFAULT_OPTIONS.keys,
        location: o.location ?? 0,
        threshold: o.threshold ?? 0.4,
        distance: o.distance ?? 100,
        ignoreLocation: o.ignorelocation ?? true,
    };
}

async function loadIndex() {
    try {
        const response = await fetch('../index.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data) fuse = new Fuse(data, buildOptions());
    } catch (err) {
        console.error('failed to load search index:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIndex);
} else {
    loadIndex();
}

function activeToggle(ae) {
    document.querySelectorAll('.focus').forEach(function (element) {
        element.classList.remove('focus');
    });
    if (ae) {
        ae.focus();
        document.activeElement = current_elem = ae;
        ae.parentElement.classList.add('focus');
    } else {
        document.activeElement.parentElement.classList.add('focus');
    }
}

function reset() {
    resultsAvailable = false;
    resList.innerHTML = sInput.value = '';
    sInput.focus();
}

function renderResults(results) {
    if (!results.length) {
        resultsAvailable = false;
        resList.innerHTML = '';
        return;
    }
    let resultSet = '';
    for (const item of results) {
        resultSet += `<li class="post-entry"><header class="entry-header">${item.item.title}&nbsp;»</header>` +
            `<a href="${item.item.permalink}" aria-label="${item.item.title}"></a></li>`;
    }
    resList.innerHTML = resultSet;
    resultsAvailable = true;
    first = resList.firstChild;
    last = resList.lastChild;
}

let searchTimer = null;
function runSearch() {
    if (!fuse) return;
    const query = sInput.value.trim();
    const limit = params.fuseOpts ? params.fuseOpts.limit : undefined;
    const results = limit ? fuse.search(query, { limit }) : fuse.search(query);
    renderResults(results);
}

sInput.addEventListener('keyup', function () {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
});

sInput.addEventListener('search', function () {
    if (!this.value) reset();
});

// kb bindings
document.addEventListener('keydown', function (e) {
    const key = e.key;
    let ae = document.activeElement;

    const inbox = document.getElementById('searchbox').contains(ae);

    if (ae === sInput) {
        const elements = document.getElementsByClassName('focus');
        while (elements.length > 0) {
            elements[0].classList.remove('focus');
        }
    } else if (current_elem) ae = current_elem;

    if (key === 'Escape') {
        reset();
    } else if (!resultsAvailable || !inbox) {
        return;
    } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (ae === sInput) {
            activeToggle(resList.firstChild.lastChild);
        } else if (ae.parentElement !== last) {
            activeToggle(ae.parentElement.nextSibling.lastChild);
        }
    } else if (key === 'ArrowUp') {
        e.preventDefault();
        if (ae.parentElement === first) {
            activeToggle(sInput);
        } else if (ae !== sInput) {
            activeToggle(ae.parentElement.previousSibling.lastChild);
        }
    } else if (key === 'ArrowRight') {
        ae.click();
    }
});