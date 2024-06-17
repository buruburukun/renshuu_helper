chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        id: 'renshuu',
        title: 'Lookup "%s" on renshuu',
        contexts: ['selection'],
        type: 'normal',
    });
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
    chrome.storage.session.set({
        searchQuery: item.selectionText,
    });
    chrome.sidePanel.open({
        tabId: tab.id,
    });
});
