const config = {};

const init = new Promise((resolve, reject) => {
    const defaults = {
        apikey: '',
        zoom: '1',
        dark: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        favoriteList: '',
        favoriteSchedule: '',
    };
    chrome.storage.sync.get(defaults, (result) => {
        Object.assign(config, result);
        document.getElementById('apikey').value = config['apikey'];
        document.getElementById('zoom').value = config['zoom'];
        document.getElementById('dark').checked = config['dark'];
        setDark(config['dark']);
        resolve();
        getListData();
    });
});

const validListId = (id) => {
    return id.match(/^[0-9]*$/);
};

document.getElementById('save').addEventListener('click', () => {
    const values = {
        apikey: document.getElementById('apikey').value,
        zoom: document.getElementById('zoom').value,
        dark: document.getElementById('dark').checked,
    };

    const listValue = document.getElementById('favorite_list').value;
    if (validListId(listValue)) {
        values['favoriteList'] = listValue;
    }
    const scheduleValue = document.getElementById('favorite_schedule').value;
    if (validListId(scheduleValue)) {
        values['favoriteSchedule'] = scheduleValue;
    }

    const saved = document.getElementById('saved');
    saved.innerText = 'Saving...';
    chrome.storage.sync.set(values, () => {
        saved.innerText = 'Saved!';
        setTimeout(() => {
            saved.innerText = '';
        }, 1000);
    });
});

const applyListData = (presences, isList) => {
    const idKey = isList ? 'list_id' : 'sched_id';
    const configKey = isList ? 'favoriteList' : 'favoriteSchedule';
    const selected = config[configKey];

    let result = `<option value="">None</option>`;
    for (const presence of presences) {
        const id = presence[idKey];
        const name = presence['name'];
        result += `
            <option value="${id}" ${(id === selected) ? 'selected' : ''}>${name}</option>
        `;
    }
    return result;
};

const getListData = async () => {
    const list = document.getElementById('favorite_list');
    const schedule = document.getElementById('favorite_schedule');

    await init;
    const apikey = config['apikey'];
    if (apikey) {
        const endpoint = '/v1/word/1871';
        await doRequest(apikey, endpoint, {}, list, () => {}, {
            200: (results) => {
                list.innerHTML = applyListData(results['words'][0]['presence']['lists'], true);
                schedule.innerHTML = applyListData(results['words'][0]['presence']['scheds'], false);
            },
        });
    } else {
        list.innerHTML = applyListData([], true);
        schedule.innerHTML = applyListData([], false);
    }
};

const setDark = (dark) => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.setAttribute('theme', theme);
};

chrome.storage.sync.onChanged.addListener((changes) => {
    for (const [key, {oldValue, newValue}] of Object.entries(changes)) {
        config[key] = newValue;
    }
    if (changes['apikey']) {
        document.getElementById('apikey').value = config['apikey'];
        getListData();
    }
    if (changes['dark']) {
        setDark(config['dark']);
    }
});
