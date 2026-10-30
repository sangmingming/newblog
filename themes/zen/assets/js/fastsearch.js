import * as params from '@params';

let fuse;
let indexPromise;

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

function loadIndex() {
    if (!indexPromise) {
        indexPromise = fetch(params.indexURL || '/index.json')
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                fuse = new Fuse(data || [], buildOptions());
                return fuse;
            })
            .catch((error) => {
                indexPromise = undefined;
                console.error('failed to load search index:', error);
                throw error;
            });
    }
    return indexPromise;
}

function initSearchRoot(root) {
    const input = root.querySelector('[data-search-input]');
    const resultsList = root.querySelector('[data-search-results]');
    const emptyMessage = root.querySelector('[data-search-empty]');
    let searchTimer;
    let loading = false;

    function clearResults() {
        resultsList.replaceChildren();
        if (emptyMessage) emptyMessage.hidden = true;
    }

    function renderResults(results, query) {
        clearResults();
        if (!results.length) {
            if (query && emptyMessage) emptyMessage.hidden = false;
            return;
        }

        const fragment = document.createDocumentFragment();
        results.forEach(({ item }) => {
            const entry = document.createElement('li');
            entry.className = 'post-entry';

            const header = document.createElement('header');
            header.className = 'entry-header';
            header.textContent = `${item.title} »`;

            const link = document.createElement('a');
            link.href = item.permalink;
            link.setAttribute('aria-label', item.title);

            entry.append(header, link);
            fragment.appendChild(entry);
        });
        resultsList.appendChild(fragment);
    }

    async function runSearch() {
        const query = input.value.trim();
        if (!query) {
            clearResults();
            return;
        }

        try {
            if (!fuse && !loading) {
                loading = true;
                await loadIndex();
            }
            const limit = params.fuseOpts ? params.fuseOpts.limit : undefined;
            const results = limit ? fuse.search(query, { limit }) : fuse.search(query);
            if (query === input.value.trim()) renderResults(results, query);
        } catch {
            if (emptyMessage) {
                emptyMessage.textContent = '搜索索引暂时加载失败，请稍后再试。';
                emptyMessage.hidden = false;
            }
        } finally {
            loading = false;
        }
    }

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
    });

    input.addEventListener('search', () => {
        if (!input.value) clearResults();
    });

    input.addEventListener('focus', () => {
        loadIndex().catch(() => {});
    });

    root.addEventListener('keydown', (event) => {
        const links = [...resultsList.querySelectorAll('a')];
        const activeElement = document.activeElement;
        const activeIndex = links.indexOf(activeElement);

        if (event.key === 'ArrowDown' && links.length) {
            event.preventDefault();
            if (activeElement === input) links[0].focus();
            else if (activeIndex < links.length - 1) links[activeIndex + 1].focus();
        } else if (event.key === 'ArrowUp' && links.length) {
            event.preventDefault();
            if (activeIndex === 0) input.focus();
            else if (activeIndex > 0) links[activeIndex - 1].focus();
        } else if (event.key === 'Escape' && activeElement === input && input.value) {
            input.value = '';
            clearResults();
            event.stopPropagation();
        }
    });
}

document.querySelectorAll('[data-search-root]').forEach(initSearchRoot);

const searchDialog = document.getElementById('nav-search');
const searchToggles = document.querySelectorAll('.nav-search-toggle');
let lastSearchTrigger;
let previousBodyOverflow = '';

function closeSearch() {
    if (!searchDialog || searchDialog.hidden) return;
    searchDialog.hidden = true;
    document.body.style.overflow = previousBodyOverflow;
    if (lastSearchTrigger) lastSearchTrigger.focus();
}

function openSearch(event) {
    if (event) event.preventDefault();
    if (!searchDialog) return;
    lastSearchTrigger = event ? event.currentTarget : searchToggles[0];
    document.querySelectorAll('.menu-dropdown details[open]').forEach((details) => {
        details.open = false;
    });
    previousBodyOverflow = document.body.style.overflow;
    searchDialog.hidden = false;
    document.body.style.overflow = 'hidden';
    const input = searchDialog.querySelector('[data-search-input]');
    input.focus();
    loadIndex().catch(() => {});
}

searchToggles.forEach((toggle) => toggle.addEventListener('click', openSearch));
document.querySelectorAll('[data-search-close]').forEach((button) => {
    button.addEventListener('click', closeSearch);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeSearch();
        return;
    }

    const target = event.target;
    const isTyping = target instanceof HTMLElement &&
        (target.matches('input, textarea, select') || target.isContentEditable);
    if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        openSearch(event);
    }

    if (event.key === 'Tab' && searchDialog && !searchDialog.hidden) {
        const focusable = [...searchDialog.querySelectorAll('button:not([tabindex="-1"]), input, a[href]')]
            .filter((element) => !element.disabled && element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

const dropdowns = document.querySelectorAll('.menu-dropdown details');
dropdowns.forEach((dropdown) => {
    dropdown.addEventListener('toggle', () => {
        if (!dropdown.open) return;
        dropdowns.forEach((other) => {
            if (other !== dropdown) other.open = false;
        });
    });
});

document.addEventListener('click', (event) => {
    dropdowns.forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.open = false;
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    dropdowns.forEach((dropdown) => {
        if (dropdown.open) {
            dropdown.open = false;
            dropdown.querySelector('summary').focus();
        }
    });
});
