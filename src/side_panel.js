const config = {};
const timers = {};

const cssZoom = new CSSStyleSheet();
document.adoptedStyleSheets.push(cssZoom);
const cssFavoriteList = new CSSStyleSheet();
document.adoptedStyleSheets.push(cssFavoriteList);
const cssFavoriteSchedule = new CSSStyleSheet();
document.adoptedStyleSheets.push(cssFavoriteSchedule);

const init = new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (result) => {
        Object.assign(config, result);
        setZoom(config['zoom']);
        setFavoriteList(config['favoriteList']);
        setFavoriteSchedule(config['favoriteSchedule']);
        resolve();
    });
});

chrome.storage.sync.onChanged.addListener((changes) => {
    for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
        config[key] = newValue;
    }
    if (changes['zoom']) {
        setZoom(config['zoom']);
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
        cssZoom.replaceSync(`body { font-size: 100%; }`);
    }
};
const setFavoriteList = (favoriteList) => {
    if (favoriteList) {
        cssFavoriteList.replaceSync('.list_plus { display: block; }');
    } else {
        cssFavoriteList.replaceSync('.list_plus { display: none; }');
    }
};
const setFavoriteSchedule = (favoriteSchedule) => {
    if (favoriteSchedule) {
        cssFavoriteSchedule.replaceSync('.schedule_plus { display: block; }');
    } else {
        cssFavoriteSchedule.replaceSync('.schedule_plus { display: none; }');
    }
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
    const url = `https://www.renshuu.org/api/v1/word/search?value=${encodeURIComponent(query)}&pg=${page}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, url, {}, content, resetQuery, (results) => {
        content.innerHTML = formatSearch(results);
    });
};

chrome.storage.session.get(['searchQuery'], ({searchQuery}) => {
    search(searchQuery, 0);
});

chrome.storage.session.onChanged.addListener((changes) => {
    if (changes['searchQuery']) {
        search(changes['searchQuery'].newValue, 0);
    }
});

const formatSearch = (results) => {
    const count = results['result_count'];
    const m = (count / results['per_pg']) | 0;
    const page = parseInt(results['pg'], 10);
    const query = results['query'];
    const prev = (page <= 0) ? '' : `<div class="search_page" query="${query}" page="${page-1}">&lt;</div>`;
    const next = (page >= m) ? '' : `<div class="search_page" query="${query}" page="${page+1}">&gt;</div>`;
    let result = `
        <div class="flex_h">
            ${prev}
            <div>Page ${page+1} of ${m+1}</div>
            ${next}
            <div class="flex_pad"></div>
        </div>
        <div>${count} Results</div>
    `;
    for (const word of results['words']) {
        let entry = word['hiragana_full'];
        if (word['kanji_full']) {
            entry = `${word['kanji_full']} / ${entry}`;
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
            aforms = `Also written as: <span class="aform">${word['aforms'].join('</span><span class="aform">')}</span>`;
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
                    <div id="popup_${word['id']}" class="popup">
                        <div class="flex_h">
                            <div class="header">Add this term</div>
                            <div class="status" id="popup_${word['id']}_status"></div>
                            <div class="close" popupId="popup_${word['id']}">X</div>
                        </div>
                        <div class="flex_h lists">
                            <div class="column2">
                                <div class="subheader">Lists</div>
                                <div id="popup_${word['id']}_lists"></div>
                            </div>
                            <div class="column2">
                                <div class="subheader">Schedules</div>
                                <div id="popup_${word['id']}_schedules"></div>
                            </div>
                        </div>
                    </div>
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

    const url = `https://www.renshuu.org/api/v1/word/${wordId}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, url, {}, list, () => {}, (results) => {
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

    const url = `https://www.renshuu.org/api/v1/word/${wordId}`;
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
    await doRequest(apikey, url, params, stat, () => {
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
    if (e.target.classList.contains('plus')) {
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
