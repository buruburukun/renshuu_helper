const config = {};
const session = {};
const timers = {};
let history = [];
let historyIndex = -1;

const cssZoom = new CSSStyleSheet();
document.adoptedStyleSheets.push(cssZoom);

const init = new Promise((resolve, _reject) => {
    chrome.storage.sync.get(null, (result) => {
        Object.assign(config, result);
        setZoom(config['zoom']);
        setDark(config['dark']);
        setFurigana(config['furigana']);
        setFavoriteList(config['favoriteList']);
        setFavoriteSchedule(config['favoriteSchedule']);
        resolve();
    });
});

chrome.storage.sync.onChanged.addListener((changes) => {
    for (const [key, {newValue}] of Object.entries(changes)) {
        config[key] = newValue;
    }
    if (changes['zoom']) {
        setZoom(config['zoom']);
    }
    if (changes['dark']) {
        setDark(config['dark']);
    }
    if (changes['furigana']) {
        setFurigana(config['furigana']);
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
const setFurigana = (furigana) => {
    document.documentElement.setAttribute('furigana', furigana);
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
                const config = word['config'];

                let entry = word['pitch'].length > 0 ? formatPitch(word['pitch'][0]) : word['hiragana_full'];
                let rare = '';
                if (word['kanji_full']) {
                    if (config.includes('common-hiragana')) {
                        rare = `<div class="rare">Rarely written as: ${makeClickable(word['kanji_full'])}</div>`;
                    } else {
                        entry = `${makeClickable(word['kanji_full'])} / ${entry}`;
                    }
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
                            <span class="aform">${makeClickable(aform['term'])}</span>
                            ${popupHtml(aform['id'])}
                            <span class="plus" popupId="popup_${aform['id']}">+</span>
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
                            ${rare}
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
            const count = results['result_count'];
            let result = `
                <div>${count} Results</div>
            `;
            for (const kanji of results['kanjis']) {
                result += `
                    <div class="row">
                        <div>
                            <span class="kanji kanji_click">${kanji['kanji']}</span>
                            <span>${kanji['definition']}</span>
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
            const count = results['result_count'] || 0;
            const m = results['total_pg'] || 1;
            const page = parseInt(results['pg']) || 1;
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
            for (const grammar of results['grammar']) {
                const lines = [
                    grammar['title_english'],
                    grammar['title_japanese'],
                    grammar['meaning']['en'],
                    grammar['meaning_long']['en'],
                ];
                if (grammar['construct']) {
                    lines.push(`<img src="${grammar['construct']}"/>`);
                }
                result += `<div class="row"><div>`;
                let first = true;
                for (const line of lines) {
                    if (line) {
                        if (first) {
                            result += `<div class="grammar" grammarId="${grammar['id']}">${line}</div>`;
                        } else {
                            result += `<div>${line}</div>`;
                        }
                        first = false;
                    }
                }
                result += `</div></div>`;
            }
            return result;
        },
    },
    sentence: {
        endpoint: 'reibun',
        formatter: (results) => {
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
                result += `
                    <div class="row">
                        <div>
                            <div class="sentence">${makeClickable(ruby(reibun['hiragana'], reibun['japanese']))}</div>
                            <div>${reibun['meaning']['en']}</div>
                        </div>
                    </div>
                `;
            }
            return result;
        },
    },
};

const reMultipleSpaces = /\u3000+/g;
const sanitizeSentence = (s) => {
    let replaced = s
        .replaceAll('__\u3000__', '\u3000')
        .replaceAll('__', '\u3000__\u3000')
        .replaceAll(reMultipleSpaces, '\u3000');
    if (replaced.charAt(0) === '\u3000') {
        replaced = replaced.substring(1);
    }
    if (replaced.charAt(replaced.length-1) === '\u3000') {
        replaced = replaced.substring(0, replaced.length-1);
    }
    return replaced;
};

const furigana = (hparts, k) => {
    const d = [];
    for (let i = 0; i <= hparts.length; i++) {
        d[i] = [];
        for (let j = 0; j <= k.length; j++) {
            d[i][j] = 0;
        }
    }
    for (let i = 0; i <= hparts.length; i++) {
        d[i][0] = i;
    }
    for (let j = 0; j <= k.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= hparts.length; i++) {
        for (let j = 1; j <= k.length; j++) {
            const curh = hparts[i-1];
            const hlen = curh.length;
            if (curh === k.substring(j - hlen, j)) {
                d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-hlen]);
            } else {
                d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1);
            }
        }
    }

    let [i, j] = [hparts.length, k.length];
    const data = [];
    while (i > 0 && j > 0) {
        const min = Math.min(d[i][j-1], d[i-1][j]);
        const curh = hparts[i-1];
        const hlen = curh.length;
        if (j - hlen >= 0 && curh === k.substring(j - hlen, j)) {
            data.push({s: curh});
            i--;
            j -= hlen;
        } else if (min === d[i-1][j]) {
            data.push({h: curh});
            i--;
        } else {
            data.push({k: k.charAt(j-1)});
            j--;
        }
    }
    while (i > 0) {
        data.push({h: hparts[i-1]});
        i--;
    }
    while (j > 0) {
        data.push({k: k.charAt(j-1)});
        j--;
    }
    return data;
};

const furiganaOuter = (hparts, k, secondary) => {
    const data = furigana(hparts, k);
    if (!secondary) {
        return data;
    }
    let hs = '';
    let ks = '';
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        if (c.h) {
            hs = c.h + hs;
        } else if (c.k) {
            ks = c.k + ks;
        } else {
            if (hs !== '' || ks !== '') {
                const d = furigana(hs.split(''), ks);
                result.push(...d);
            }
            result.push(c);
            hs = '';
            ks = '';
        }
    }
    if (hs !== '' || ks !== '') {
        const d = furigana(hs.split(''), ks);
        result.push(...d);
    }
    return result;
};

const ruby = (hu, k) => {
    const h = sanitizeSentence(hu);
    let hparts = h.split('\u3000');
    const secondary = hparts.length !== 1;
    if (!secondary) {
        hparts = hparts.split('');
    }
    const data = furiganaOuter(hparts, k, secondary);
    let result = '';
    let mode = 's';
    for (let i = data.length - 1; i >= 0; i--) {
        const c = data[i];
        if (c.k && mode === 'k' || c.h && mode === 'h' || c.s && mode === 's') {
            result += c.k || c.h || c.s;
        } else if (c.k && mode === 's') {
            result += `<ruby>${c.k}`;
            mode = 'k';
        } else if (c.h && mode === 'k') {
            result += `<rt>${c.h}`;
            mode = 'h';
        } else if (c.s) {
            result += `</rt></ruby>${c.s}`;
            mode = 's';
        } else {
            console.error('Unexpected mode', hu, k, mode, i, data);
            throw new Error('Unexpected mode');
        }
    }
    if (mode === 'h') {
        result += '</rt></ruby>';
    } else if (mode !== 's') {
        console.error('End unexpected mode', hu, k, mode, data);
        throw new Error('End unexpected mode');
    }
    return result;
};

const search = async (query, page, type) => {
    if (!query || page < 1) {
        return;
    }

    const content = document.getElementById('content');
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
        addHistory({
            query: session['searchQuery'],
            type: session['searchType'],
        });
    }
});

chrome.storage.session.onChanged.addListener((changes) => {
    for (const [key, {newValue}] of Object.entries(changes)) {
        session[key] = newValue;
    }
    if (changes['searchQuery']) {
        document.getElementById('searchBar').value = session['searchQuery'];
    }
    if (changes['searchQuery'] || changes['searchPage'] || changes['searchType']) {
        search(session['searchQuery'], session['searchPage'], session['searchType']);
    }
    if (changes['searchQuery'] || changes['searchType']) {
        addHistory({
            query: session['searchQuery'],
            type: session['searchType'],
        });
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

const formatLists = (wordId, presences, isList, entityType) => {
    const key = isList ? 'lists' : 'scheds';
    const idKey = isList ? 'list_id' : 'sched_id';

    // TODO groups
    let result = '';
    for (const presence of presences[key]) {
        const listId = presence[idKey];
        const name = presence['name'];
        const present = presence['hasWord'];
        const inputId = `adder_${wordId}_${listId}`;
        result += `
            <div>
                <input type="checkbox"
                    id="${inputId}"
                    class="adder"
                    entityType="${entityType}"
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
            list.innerHTML = formatLists(wordId, results['words'][0]['presence'], true, 'word');
            schedule.innerHTML = formatLists(wordId, results['words'][0]['presence'], false, 'word');
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
    }
};

const assign = (elem) => {
    const wordId = elem.attributes.getNamedItem('wordId').value;
    const isList = elem.attributes.getNamedItem('isList').value === 'true';
    const listId = elem.attributes.getNamedItem('listId').value;
    const entityType = elem.attributes.getNamedItem('entityType').value;
    const add = elem.checked;
    const timerId = `popup_${wordId}_status`;
    const stat = document.getElementById(timerId);
    assignInternal(wordId, entityType, isList, listId, add, timerId, stat);
};

const assignInternal = async (wordId, entityType, isList, listId, add, timerId, stat) => {
    if (timers[timerId]) {
        clearTimeout(timers[timerId]);
    }

    stat.classList.remove('error');
    stat.classList.add('show');
    stat.innerHTML = 'Submitting data...';

    const endpoint = `/v1/${SEARCH_TYPES[entityType].endpoint}/${wordId}`;
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
            stat.innerHTML = 'Success!';
            timers[timerId] = setTimeout(() => {
                stat.classList.remove('show');
                delete timers[timerId];
            }, 1000);
        },
        404: (_) => {
            stat.classList.add('error');
            stat.innerHTML = 'Invalid list/schedule';
        },
        409: (_) => {
            stat.innerHTML = 'Success!';
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
        assignInternal(wordId, 'word', isList, listId, add, timerId, stat);
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

const singleKanji = async (kanji) => {
    resetQuery();
    const content = document.getElementById('content');
    content.innerHTML = `Looking up "${kanji}"...`;
    const endpoint = `/v1/kanji/${kanji}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, content, () => {}, {
        200: (results) => {
            // TODO
            let parts = '';
            if (results['parts']) {
                for (const part of results['parts']) {
                    parts += `<div><span class="kanji_click">${part['piece']}</span><span>${part['definition']}</span></div>`;
                }
            }
            let result = `
                <div class="flex_h">
                    <div class="kanji_big">${results['kanji']}</div>
                    <div class="single_plus" popupId="popup_${results['kanji']}">+</div>
                </div>
                ${popupHtml(results['kanji'])}
                <div>${results['definition']}</div>
                <div>Kunyomi: ${results['kunyomi']}</div>
                <div>Onyomi: ${results['onyomi']}</div>

                <div>Strokes: ${results['scount']}</div>
                <div>Radical: ${makeClickable(results['radical'])} (${results['radical_name']})</div>
                <div>Parts: ${parts}</div>

                <div>JLPT: ${results['jlpt']}</div>
                <div>Kanji Kentei: ${makeClickable(results['kanken'])}</div>
            `;
            if (results['rwords']) {
                result += '<div>Example words</div>'
                for (const rword of results['rwords']) {
                    result += `<div>${rword['reading']}</div>`;
                    for (const word of rword['words']) {
                        result += `
                            <div>${makeClickable(word['term'])}</div>
                            <div>${word['def']}</div>
                        `;
                    }
                }
            }
            content.innerHTML = result;
            const popupId = `popup_${results['kanji']}`;
            const popupLists = document.getElementById(popupId + '_lists');
            const popupSchedules = document.getElementById(popupId + '_schedules');
            popupLists.innerHTML = formatLists(results['kanji'], results['presence'], true, 'kanji');
            popupSchedules.innerHTML = formatLists(results['kanji'], results['presence'], false, 'kanji');
        },
    });
};

const singleGrammar = async (grammarId) => {
    // TODO
    console.log('singleGrammar', grammarId);
    resetQuery();
    const content = document.getElementById('content');
    content.innerHTML = `Looking up grammar...`;
    const endpoint = `/v1/grammar/${grammarId}`;
    await init;
    const apikey = config['apikey'];
    await doRequest(apikey, endpoint, {}, content, () => {}, {
        200: (results) => {
            // TODO
            console.log(results);
            if (Array.isArray(results)) {
                content.innerHTML = `Grammar with id ${grammarId} seems to be broken.`;
                return;
            }
            let models = '<div>Examples:</div>';
            for (const model of results['models']) {
                models += `
                    <div class="sentence">${highlight(makeClickable(ruby(model['hiragana'], model['japanese'])))}</div>
                    <div>${highlight(model['meanings']['en'])}</div>
                `;
            }
            const result = `
                <div class="flex_h">
                    <div>${makeClickable(results['title_japanese'])}</div>
                    <div class="single_plus" popupId="popup_${results['id']}">+</div>
                </div>
                ${popupHtml(results['id'])}
                <div>${results['meaning']['en']}</div>
                <div>${results['meaning_long']['en']}</div>
                <div><img src="${results['construct']}"/></div>
                ${models}
            `;
            content.innerHTML = result;
            const popupId = `popup_${results['id']}`;
            const popupLists = document.getElementById(popupId + '_lists');
            const popupSchedules = document.getElementById(popupId + '_schedules');
            popupLists.innerHTML = formatLists(results['id'], results['presence'], true, 'grammar');
            popupSchedules.innerHTML = formatLists(results['id'], results['presence'], false, 'grammar');
        },
    });
};

const highlight = (s) => {
    if (!s) {
        return s;
    }
    let inside = false;
    let result = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charAt(i);
        if (c === '_' && i + 1 < s.length && s.charAt(i + 1) === '_') {
            i++;
            if (inside) {
                result += '</span>';
            } else {
                result += '<span class="highlight">';
            }
            inside = !inside;
        } else {
            result += c;
        }
    }
    if (inside) {
        console.error('Malformed sentence:', s);
        result += '</span>';
    }
    return result;
};

const makeClickable = (s) => {
    if (!s) {
        return s;
    }
    let result = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charAt(i);
        const code = s.charCodeAt(i);
        if (0x4e00 <= code && code <= 0x9fff) {
            result += `<span class="kanji_click">${c}</span>`;
        } else {
            result += c;
        }
    }
    return result;
};

const navigateHistory = (forward) => {
    if (forward && historyIndex + 1 >= history.length) {
        return;
    }
    if (!forward && historyIndex <= 0) {
        return;
    }
    historyIndex += forward ? 1 : -1;
    const h = history[historyIndex];
    if (h.type === 'singleKanji') {
        singleKanji(h.query);
    } else if (h.type === 'singleGrammar') {
        singleGrammar(h.query);
    } else {
        search(h.query, 1, h.type);
    }
};

const addHistory = (item) => {
    history = history.slice(0, historyIndex + 1);
    history.push(item);
    historyIndex++;
};

document.addEventListener('click', (e) => {
    const classList = e.target.classList;
    if (classList.contains('plus') || classList.contains('single_plus')) {
        const popupId = e.target.attributes.getNamedItem('popupId').value;
        const shownPopups = document.querySelectorAll('.popup.show');
        for (const popup of shownPopups) {
            showPopup(popup.id, false);
        }
        if (classList.contains('single_plus')) {
            const popup = document.getElementById(popupId);
            popup.classList.add('show');
        } else {
            showPopup(popupId, true);
        }
    } else if (classList.contains('close')) {
        const popupId = e.target.attributes.getNamedItem('popupId').value;
        showPopup(popupId, false);
    } else if (classList.contains('list_plus')) {
        addToList(e.target, true);
    } else if (classList.contains('schedule_plus')) {
        addToList(e.target, false);
    } else if (classList.contains('adder')) {
        assign(e.target);
    } else if (classList.contains('search_page')) {
        const page = e.target.attributes.getNamedItem('page').value;
        chrome.storage.session.set({
            searchPage: page,
        });
    } else if (classList.contains('search_button')) {
        chrome.storage.session.set({
            searchQuery: document.getElementById('searchBar').value,
            searchPage: 1,
            searchType: e.target.attributes.getNamedItem('searchType').value,
        });
    } else if (e.target.id === 'profile') {
        showProfile();
    } else if (classList.contains('kanji_click')) {
        addHistory({
            query: e.target.textContent,
            type: 'singleKanji',
        });
        singleKanji(e.target.textContent);
    } else if (e.target.id === 'searchBack') {
        navigateHistory(false);
    } else if (e.target.id === 'searchForward') {
        navigateHistory(true);
    } else if (classList.contains('grammar')) {
        const grammarId = e.target.attributes.getNamedItem('grammarId').value;
        addHistory({
            query: grammarId,
            type: 'singleGrammar',
        });
        singleGrammar(grammarId);
    }
});
