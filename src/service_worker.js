chrome.runtime.onInstalled.addListener(() => {
    for (const entityType of ['word', 'kanji', 'grammar', 'sentence']) {
        chrome.contextMenus.create({
            id: `${entityType}Search`,
            title: `Lookup ${entityType} "%s" on renshuu`,
            contexts: ['selection'],
            type: 'normal',
        });
    }

    chrome.contextMenus.create({
        id: 'apikey',
        title: 'Install renshuu API key',
        type: 'normal',
        documentUrlPatterns: ["https://*.renshuu.org/*"],
    });
});

const search = (item, tab, entityType) => {
    chrome.storage.session.set({
        searchQuery: item.selectionText,
        searchPage: 1,
        searchType: entityType,
    });
    if (tab.id !== -1) {
        chrome.sidePanel.open({
            tabId: tab.id,
        });
    }
};

chrome.contextMenus.onClicked.addListener((item, tab) => {
    for (const entityType of ['word', 'kanji', 'grammar', 'sentence']) {
        if (item.menuItemId === `${entityType}Search`) {
            search(item, tab, entityType);
            return;
        }
    }
    if (item.menuItemId === 'apikey') {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
            },
            func: async () => {
                // TODO this can be better
                document.querySelectorAll('div.fright[onclick]')[0].click();

                const waitForElm = (selector) => {
                    return new Promise(resolve => {
                        const alreadyExists = document.querySelector(selector);
                        if (alreadyExists) {
                            return resolve(alreadyExists);
                        }
                        const observer = new MutationObserver(_mutations => {
                            const found = document.querySelector(selector);
                            if (found) {
                                observer.disconnect();
                                resolve(found);
                            }
                        });
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true,
                        });
                    });
                };
                const closeButton = await waitForElm('#settings_close_btn');
                closeButton.click();

                const elem = document.getElementById('api_key');
                if (elem) {
                    return elem.value;
                } else {
                    console.error('Renshuu Helper: Could not find API key.');
                    return null;
                }
            },
        }).then((result) => {
            const apikey = result[0].result;
            if (apikey) {
                chrome.storage.sync.set({
                    apikey: apikey,
                });
            }
        });
    }
});
