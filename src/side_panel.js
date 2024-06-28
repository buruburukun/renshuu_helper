const config = {};
const session = {};
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
        searchPage: 0,
    });
};

const SEARCH_TYPES = {
    word: {
        endpoint: 'word',
        formatter: (results) => {
            const count = results['result_count'];
            const m = results['total_pg'];
            const page = results['pg'];
            const prev = (page <= 1) ? '' : `<div class="search_page" page="${page-1}">&lt;</div>`;
            const next = (page >= m) ? '' : `<div class="search_page" page="${page+1}">&gt;</div>`;
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
        },
    },
    kanji: {
        endpoint: 'kanji',
        formatter: (results) => {
            console.log(results);
            const count = results['result_count'];
            let result = `
                <div>${count} Results</div>
            `;
            for (const kanji of results['kanjis']) {
                // id
                result += `
                    <div class="row">
                        <div>
                            <div>${kanji['kanji']}</div>
                            <div>${kanji['definition']}</div>
                        </div>
                    </div>
                `;
            }
            return result;
        },
    },
    grammar: {
        endpoint: 'grammar',
        formatter: (results) => {
            console.log(results);
            const count = results['result_count'];
            let result = `
                <div>${count} Results</div>
            `;
            for (const grammar of results['grammar']) {
                // construct (image)
                // grammar_id
                // id
                // models
                // url
                result += `
                    <div class="row">
                        <div>
                            <div>${grammar['title_english']}</div>
                            <div>${grammar['title_japanese']}</div>
                            <div>${grammar['meaning']['en']}</div>
                            <div>${grammar['meaning_long']['en']}</div>
                        </div>
                    </div>
                `;
            }
            return result;
        },
    },
    sentence: {
        endpoint: 'reibun',
        formatter: (results) => {
            console.log(results);
            const count = results['result_count'];
            const perPage = results['per_page'];
            const m = (((count + perPage - 1) / perPage) | 0) || 1;
            const page = results['pg'];
            const prev = (page <= 1) ? '' : `<div class="search_page" page="${page-1}">&lt;</div>`;
            const next = (page >= m) ? '' : `<div class="search_page" page="${page+1}">&gt;</div>`;
            let result = `
                <div class="flex_h">
                    ${prev}
                    <div>Page ${page} of ${m}</div>
                    ${next}
                    <div class="flex_pad"></div>
                </div>
                <div>${count} Results</div>
            `;
            for (const reibun of results['reibuns']) {
                // hiragana
                // id
                result += `
                    <div class="row">
                        <div>
                            <div>${reibun['japanese']}</div>
                            <div>${reibun['meaning']['en']}</div>
                        </div>
                    </div>
                `;
            }
            return result;
        },
    },
};

const search = async (query, page, type) => {
    if (!query || page < 1) {
        return;
    }

    const content = document.querySelector('#content');
    content.innerHTML = `Searching for "${query}"...`;
    const endpoint = `/v1/${SEARCH_TYPES[type].endpoint}/search?value=${encodeURIComponent(query)}&pg=${page}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, content, resetQuery, {
        200: (results) => {
            content.innerHTML = SEARCH_TYPES[type].formatter(results);
        },
    });
};

chrome.storage.session.get(null, (result) => {
    Object.assign(session, result);
    document.getElementById('searchBar').value = session['searchQuery'] || '';
    if (session['searchQuery']) {
        search(session['searchQuery'], 1, session['searchType']);
    }
});

chrome.storage.session.onChanged.addListener((changes) => {
    for (const [key, {oldValue, newValue}] of Object.entries(changes)) {
        session[key] = newValue;
    }
    if (changes['searchQuery']) {
        document.getElementById('searchBar').value = session['searchQuery'];
    }
    if (changes['searchQuery'] || changes['searchPage'] || changes['searchType']) {
        search(session['searchQuery'], session['searchPage'], session['searchType']);
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
    await doRequest(apikey, endpoint, {}, list, () => {}, {
        200: (results) => {
            list.innerHTML = formatLists(wordId, results, true);
            schedule.innerHTML = formatLists(wordId, results, false);
        },
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
    }, {
        200: (results) => {
            const resultMessage = results['result'];
            console.log('Result message:', resultMessage);
            stat.innerHTML = 'Success!'
            timers[timerId] = setTimeout(() => {
                stat.classList.remove('show');
                delete timers[timerId];
            }, 1000);
        },
        404: (results) => {
            stat.classList.add('error');
            stat.innerHTML = 'Invalid list/schedule';
        },
        409: (results) => {
            stat.innerHTML = 'Success!'
            timers[timerId] = setTimeout(() => {
                stat.classList.remove('show');
                delete timers[timerId];
            }, 1000);
        },
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

const showProfile = async () => {
    const streakKeys = ['correct_in_a_row', 'correct_in_a_row_alltime', 'days_studied_in_a_row', 'days_studied_in_a_row_alltime'];

    const content = document.getElementById('content');
    const endpoint = '/v1/profile';
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, content, () => {}, {
        200: (results) => {
            let s = `
                <div>${results['real_name']}</div>
                <div>Level ${results['adventure_level']}</div>
                <div>renshuu user since ${results['user_length']}</div>
                <div><img src="${results['kao']}"/></div>
                <div>Studied today: ${results['studied']['today_all']}</div>
                <div>Words ${results['studied']['today_vocab']}</div>
                <div>Kanji ${results['studied']['today_kanji']}</div>
                <div>Grammar ${results['studied']['today_grammar']}</div>
                <div>Sentences ${results['studied']['today_sent']}</div>
                <div>Adjective Conjugations ${results['studied']['today_aconj']}</div>
                <div>Verb Conjugations ${results['studied']['today_conj']}</div>
                <div>Known: ${results['studied']['total']}</div>
                <div>Words ${results['studied']['total_vocab']}</div>
                <div>Kanji ${results['studied']['total_kanji']}</div>
                <div>Grammar ${results['studied']['total_grammar']}</div>
                <div>Sentences ${results['studied']['total_sent']}</div>
                <table>
            `;
            s += '<tr><th>Progress</th>';
            for (let i = 5; i >= 1; i--) {
                s += `<th>N${i}</th>`
            }
            s += '</tr>';
            for (const t of ['vocab', 'kanji', 'grammar', 'sent']) {
                s += `<tr><td>${t}</td>`;
                for (let i = 5; i >= 1; i--) {
                    s += `<td>${results['level_progress_percs'][t][`n${i}`]}</td>`;
                }
                s += '</tr>';
            }
            s += '</table>';
            s += '<table>';
            s += '<tr><th>Streaks</th>';
            s += '<th>Correct Current</th>';
            s += '<th>Correct Best</th>';
            s += '<th>Days Current</th>';
            s += '<th>Days Best</th>';
            s += '</tr>';
            for (const t of ['vocab', 'kanji', 'grammar', 'sent', 'conj', 'aconj']) {
                s += `<tr><td>${t}</td>`;
                for (const u of streakKeys) {
                    s += `<td>${results['streaks'][t][u]}</td>`;
                }
                s += '</tr>';
            }
            s += '</table>';
            content.innerHTML = s;
        },
    });
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
        const page = e.target.attributes.getNamedItem('page').value;
        chrome.storage.session.set({
            searchPage: page,
        });
    } else if (e.target.classList.contains('searchButton')) {
        chrome.storage.session.set({
            searchQuery: document.getElementById('searchBar').value,
            searchPage: 1,
            searchType: e.target.attributes.getNamedItem('searchType').value,
        });
    } else if (e.target.id === 'profile') {
        showProfile();
    }
});
