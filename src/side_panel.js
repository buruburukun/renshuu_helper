const config = {};
const timers = {};

const cssZoom = new CSSStyleSheet();
document.adoptedStyleSheets.push(cssZoom);

const init = new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (result) => {
        Object.assign(config, result);
        setZoom(config['zoom']);
        setDark(config['dark']);
        setFavoriteList(config['favoriteList']);
        setFavoriteSchedule(config['favoriteSchedule']);
        resolve();
    });
});

chrome.storage.sync.onChanged.addListener((changes) => {
    for (const [key, {oldValue, newValue}] of Object.entries(changes)) {
        config[key] = newValue;
    }
    if (changes['zoom']) {
        setZoom(config['zoom']);
    }
    if (changes['dark']) {
        setDark(config['dark']);
    }
    if (changes['favoriteList']) {
        setFavoriteList(config['favoriteList']);
    }
    if (changes['favoriteSchedule']) {
        setFavoriteSchedule(config['favoriteSchedule']);
    }
});

const setZoom = (zoom) => {
    const d = parseFloat(zoom);
    if (d) {
        const z = d * 100;
        cssZoom.replaceSync(`body { font-size: ${z|0}%; }`);
    } else {
        cssZoom.replaceSync('');
    }
};
const setDark = (dark) => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('theme', theme);
};
const setFavoriteList = (favoriteList) => {
    document.documentElement.setAttribute('favorite_list', favoriteList ? 'true' : '');
};
const setFavoriteSchedule = (favoriteSchedule) => {
    document.documentElement.setAttribute('favorite_schedule', favoriteSchedule ? 'true' : '');
};

const resetQuery = () => {
    chrome.storage.session.set({
        searchQuery: '',
    });
};

const search = async (query, page) => {
    if (!query) {
        return;
    }

    const content = document.querySelector('#content');
    content.innerHTML = `Searching for "${query}"...`;
    const endpoint = `/v1/word/search?value=${encodeURIComponent(query)}&pg=${page}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, content, resetQuery, (results) => {
        content.innerHTML = formatSearch(results);
    });
};

chrome.storage.session.get(['searchQuery'], ({searchQuery}) => {
    search(searchQuery, 1);
});

chrome.storage.session.onChanged.addListener((changes) => {
    if (changes['searchQuery']) {
        search(changes['searchQuery'].newValue, 1);
    }
});

const formatPitch = (pitch) => {
    const result = [];
    let high = false;
    let rise = false;
    for (const ch of pitch) {
        if (ch === '\u2b67') {
            rise = true;
            high = true;
        } else if (ch === '\u2b68') {
            high = false;
            result[result.length - 1].drop = true;
        } else {
            result.push({
                ch: ch,
                rise: rise,
                high: high,
                drop: false,
            });
            rise = false;
        }
    }
    return result.map((d) => {
        const classes = [];
        if (d.rise) {
            classes.push('pitch_rise');
        }
        if (d.high) {
            classes.push('pitch_high');
        }
        if (d.drop) {
            classes.push('pitch_drop');
        }
        return `<span class="${classes.join(' ')}">${d.ch}</span>`;
    }).join('');
};

const popupHtml = (wordId) => {
    return `
        <div id="popup_${wordId}" class="popup">
            <div class="flex_h">
                <div class="header">Add this term</div>
                <div class="status" id="popup_${wordId}_status"></div>
                <div class="close" popupId="popup_${wordId}">X</div>
            </div>
            <div class="flex_h lists">
                <div class="column2">
                    <div class="subheader">Lists</div>
                    <div id="popup_${wordId}_lists"></div>
                </div>
                <div class="column2">
                    <div class="subheader">Schedules</div>
                    <div id="popup_${wordId}_schedules"></div>
                </div>
            </div>
        </div>
    `;
};

const formatSearch = (results) => {
    const count = results['result_count'];
    const m = results['total_pg'];
    const page = parseInt(results['pg'], 10);
    const query = results['query'];
    const prev = (page <= 1) ? '' : `<div class="search_page" query="${query}" page="${page-1}">&lt;</div>`;
    const next = (page >= m) ? '' : `<div class="search_page" query="${query}" page="${page+1}">&gt;</div>`;
    let result = `
        <div class="flex_h">
            ${prev}
            <div>Page ${page} of ${m}</div>
            ${next}
            <div class="flex_pad"></div>
        </div>
        <div>${count} Results</div>
    `;
    for (const word of results['words']) {
        let entry = word['pitch'].length > 0 ? formatPitch(word['pitch'][0]) : word['hiragana_full'];
        if (word['kanji_full']) {
            entry = `${word['kanji_full']} / ${entry}`;
        }

        let alternatePitch = '';
        if (word['pitch'].length > 1) {
            alternatePitch = `<div class="alternate_pitch">
                Alternate accent: ${word['pitch'].slice(1).map(formatPitch).join(', ')}
            </div>`;
        }

        let definition = word['def'];
        if (typeof word['def'] !== 'string') {
            definition = `<ol><li>${word['def'].join('</li><li>')}</li></ol>`;
        }

        let markers = '';
        if (word['markers'].length > 0) {
            markers = `<span class="marker">${word['markers'].join('</span><span class="marker">')}</span>`;
        }

        let aforms = '';
        if (word['aforms'].length > 0) {
            aforms = 'Also written as: ';
            for (const aform of word['aforms']) {
                aforms += `
                    <span class="aform" popupId="popup_${aform['id']}">
                        ${popupHtml(aform['id'])}
                        ${aform['term']}
                    </span>
                `;
            }
        }

        result += `
            <div class="row">
                <div>
                    <div class="flex_h">
                        <div class="word flex_pad">${entry}</div>
                        <div class="status" id="${word['id']}_status"></div>
                        <div class="list_plus" wordId="${word['id']}">L+</div>
                        <div class="schedule_plus" wordId="${word['id']}">S+</div>
                        <div class="plus" popupId="popup_${word['id']}">+</div>
                    </div>
                    ${popupHtml(word['id'])}
                    ${alternatePitch}
                    <div class="partofspeech">${word['typeofspeech']}</div>
                    <div class="definition">${definition}</div>
                    <div class="markers">${markers}</div>
                    <div class="aforms">${aforms}</div>
                </div>
            </div>
        `;
    }
    return result;
};

const formatLists = (wordId, results, isList) => {
    const key = isList ? 'lists' : 'scheds';
    const idKey = isList ? 'list_id' : 'sched_id';

    // TODO groups
    let result = '';
    for (const presence of results['words'][0]['presence'][key]) {
        const listId = presence[idKey];
        const name = presence['name'];
        const present = presence['hasWord'];
        const inputId = `adder_${wordId}_${listId}`;
        result += `
            <div>
                <input type="checkbox"
                    id="${inputId}"
                    class="adder"
                    wordId="${wordId}"
                    isList="${isList}"
                    listId="${listId}"
                    ${present ? 'checked' : ''}>
                <label for="${inputId}">${name}</label>
            </div>
        `;
    }
    return result;
};

const populateListData = async (wordId, list, schedule) => {
    list.innerHTML = 'Getting data...';
    schedule.innerHTML = '';

    const endpoint = `/v1/word/${wordId}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, list, () => {}, (results) => {
        list.innerHTML = formatLists(wordId, results, true);
        schedule.innerHTML = formatLists(wordId, results, false);
    });
};

const showPopup = async (popupId, show) => {
    const popup = document.getElementById(popupId);
    const popupLists = document.getElementById(popupId + '_lists');
    const popupSchedules = document.getElementById(popupId + '_schedules');
    if (show) {
        popup.classList.add('show');
        const wordId = popupId.substring(6);
        await populateListData(wordId, popupLists, popupSchedules);
    } else {
        popup.classList.remove('show');
        popupLists.innerHTML = '';
        popupSchedules.innerHTML = '';
    }
};

const assign = async (elem) => {
    const wordId = elem.attributes.getNamedItem('wordId').value;
    const isList = elem.attributes.getNamedItem('isList').value === 'true';
    const listId = elem.attributes.getNamedItem('listId').value;
    const add = elem.checked;
    const timerId = `popup_${wordId}_status`;
    const stat = document.getElementById(timerId);
    assignInternal(wordId, isList, listId, add, timerId, stat);
};

const assignInternal = async (wordId, isList, listId, add, timerId, stat) => {
    if (timers[timerId]) {
        clearTimeout(timers[timerId]);
    }

    stat.classList.remove('error');
    stat.classList.add('show');
    stat.innerHTML = 'Submitting data...';

    const endpoint = `/v1/word/${wordId}`;
    const method = add ? 'PUT' : 'DELETE';
    const key = isList ? 'list_id' : 'sched_id';
    const body = {};
    body[key] = listId;
    const params = {
        method: method,
        body: JSON.stringify(body),
    };
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, params, stat, () => {
        stat.classList.add('error');
    }, (results) => {
        const resultMessage = results['words'][0]['result'] || results['words'][0]['error'];
        if (resultMessage === undefined) {
            stat.innerHTML = `Error! ${isList ? 'List' : 'Schedule'} might not exist.`;
            stat.classList.add('error');
        } else {
            console.log("Result message:", resultMessage);
            stat.innerHTML = 'Success!'
            timers[timerId] = setTimeout(() => {
                stat.classList.remove('show');
                delete timers[timerId];
            }, 1000);
        }
    });
}

const addToList = (elem, isList) => {
    const configKey = isList ? 'favoriteList' : 'favoriteSchedule';
    const listId = config[configKey];
    if (listId) {
        const wordId = elem.attributes.getNamedItem('wordId').value;
        const add = true;
        const timerId = `${wordId}_status`;
        const stat = document.getElementById(timerId);
        assignInternal(wordId, isList, listId, add, timerId, stat);
    }
};

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('plus') || e.target.classList.contains('aform')) {
        const popupId = e.target.attributes.getNamedItem('popupId').value;
        const shownPopups = document.querySelectorAll('.popup.show');
        for (const popup of shownPopups) {
            showPopup(popup.id, false);
        }
        showPopup(popupId, true);
    } else if (e.target.classList.contains('close')) {
        const popupId = e.target.attributes.getNamedItem('popupId').value;
        showPopup(popupId, false);
    } else if (e.target.classList.contains('list_plus')) {
        addToList(e.target, true);
    } else if (e.target.classList.contains('schedule_plus')) {
        addToList(e.target, false);
    } else if (e.target.classList.contains('adder')) {
        assign(e.target);
    } else if (e.target.classList.contains('search_page')) {
        const query = e.target.attributes.getNamedItem('query').value;
        const page = e.target.attributes.getNamedItem('page').value;
        search(query, page);
    }
});
