chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        id: 'wordSearch',
        title: 'Lookup "%s" on renshuu',
        contexts: ['selection'],
        type: 'normal',
    });

    chrome.contextMenus.create({
        id: 'apikey',
        title: 'Install renshuu API key',
        type: 'normal',
        documentUrlPatterns: ["https://*.renshuu.org/*"],
    });
});

chrome.contextMenus.onClicked.addListener(async (item, tab) => {
    if (item.menuItemId === 'wordSearch') {
        chrome.storage.session.set({
            searchQuery: item.selectionText,
            searchPage: 1,
            searchType: 'word',
        });
        chrome.sidePanel.open({
            tabId: tab.id,
        });
    } else if (item.menuItemId === 'apikey') {
        chrome.scripting.executeScript({
            target: {
                tabId: tab.id,
            },
            func: async () => {
                // TODO this can be better
                document.querySelectorAll('div.fright[onclick]')[0].click();

                const waitForElm = (selector) => {
                    return new Promise(resolve => {
                        if (document.querySelector(selector)) {
                            return resolve(document.querySelector(selector));
                        }
                        const observer = new MutationObserver(mutations => {
                            if (document.querySelector(selector)) {
                                observer.disconnect();
                                resolve(document.querySelector(selector));
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
