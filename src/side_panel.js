const config = {};

const init = new Promise((resolve, reject) => {
    chrome.storage.sync.get('apikey', (d) => {
        Object.assign(config, d);
        resolve();
    });
});

chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes['apikey']) {
        config['apikey'] = changes['apikey'].newValue;
    }
    if (changes['zoom']) {
        setZoom(changes['zoom'].newValue);
    }
});

const setZoom = (zoom) => {
    const d = parseFloat(zoom);
    if (d) {
        const z = d * 100;
        document.body.style.fontSize = (z|0) + '%';
    }
};

const resetQuery = () => {
    chrome.storage.session.set({
        searchQuery: '',
    });
};

const doRequest = async (url, params, statusElem, onFailure, onSuccess) => {
    await init;
    const apikey = config['apikey'];
    if (!apikey) {
        statusElem.innerHTML = 'Error! Set the API key in the settings.';
        onFailure();
        return;
    }

    params['headers'] = {
        'Authorization': `Bearer ${apikey}`,
    };
    const response = await fetch(url, params);
    switch (response.status) {
        case 401:
            statusElem.innerHTML = 'Error! Invalid API key.';
            break;
        default:
            console.warn('Unknown response code', response);
            statusElem.innerHTML = `Unknown response code ${response.status}. Attempting to continue.`;
        case 200:
            try {
                const results = await response.json();
                onSuccess(results);
                break;
            } catch (error) {
                statusElem.innerHTML = `Error! Something went wrong. Response code: ${response.status}.`;
                console.error('response', response);
                onFailure();
                throw error;
            }
    }
};

const search = async (query, page) => {
    if (!query) {
        return;
    }

    const content = document.body.querySelector('#content');
    content.innerHTML = `Searching for "${query}"...`;
    const url = `https://www.renshuu.org/api/v1/word/search?value=${encodeURIComponent(query)}&pg=${page}`;
    await doRequest(url, {}, content, resetQuery, (results) => {
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
        if (typeof word['def'] != 'string') {
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
                        <div class="word">${entry}</div>
                        <div class="plus" data="popup_${word['id']}">+</div>
                    </div>
                    <div id="popup_${word['id']}" class="popup">
                        <div class="flex_h">
                            <div class="header">Add this term</div>
                            <div class="status" id="popup_${word['id']}_status"></div>
                            <div class="close" data="popup_${word['id']}">X</div>
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
        const id = presence[idKey];
        const name = presence['name'];
        const present = presence['hasWord'];
        const inputId = `adder_${wordId}_${id}`;
        result += `
            <div>
                <input type="checkbox"
                    id="${inputId}"
                    class="adder"
                    wordId="${wordId}"
                    isList="${isList}"
                    listId="${id}"
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
    await doRequest(url, {}, list, () => {}, (results) => {
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

const lastAssign = [];
const assign = async (elem) => {
    while (lastAssign.length > 0) {
        clearTimeout(lastAssign.pop());
    }

    const wordId = elem.attributes.getNamedItem('wordId').value;
    const isList = elem.attributes.getNamedItem('isList').value === 'true';
    const listId = elem.attributes.getNamedItem('listId').value;
    const checked = elem.checked;
    const method = checked ? 'PUT' : 'DELETE';
    const key = isList ? 'list_id' : 'sched_id';
    const body = {};
    body[key] = listId;

    const stat = document.getElementById(`popup_${wordId}_status`);
    stat.classList.remove('error');
    stat.classList.add('show');
    stat.innerHTML = 'Submitting data...';

    const url = `https://www.renshuu.org/api/v1/word/${wordId}`;
    const params = {
        method: method,
        body: JSON.stringify(body),
    };
    await doRequest(url, params, stat, () => {
        stat.classList.add('error');
    }, (results) => {
        stat.innerHTML = 'Success!'
        lastAssign.push(setTimeout(() => {
            stat.classList.remove('show');
        }, 1000));
    });
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('plus')) {
        const id = e.target.attributes.getNamedItem('data').value;
        const shownPopups = document.body.querySelectorAll('.popup.show');
        for (const popup of shownPopups) {
            showPopup(popup.id, false);
        }
        showPopup(id, true);
    } else if (e.target.classList.contains('close')) {
        const id = e.target.attributes.getNamedItem('data').value;
        showPopup(id, false);
    } else if (e.target.classList.contains('adder')) {
        assign(e.target);
    } else if (e.target.classList.contains('search_page')) {
        const page = e.target.attributes.getNamedItem('page').value;
        const query = e.target.attributes.getNamedItem('query').value;
        search(query, page);
    }
});
