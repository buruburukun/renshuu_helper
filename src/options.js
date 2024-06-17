document.addEventListener('DOMContentLoaded', () => {
    const defaults = {
        apikey: '',
        zoom: '1',
    };
    chrome.storage.sync.get(defaults, (result) => {
        document.getElementById('apikey').value = result.apikey;
        document.getElementById('zoom').value = result.zoom;
    });
});

document.getElementById('save').addEventListener('click', () => {
    const values = {
        apikey: document.getElementById('apikey').value,
        zoom: document.getElementById('zoom').value,
    };
    const saved = document.getElementById('saved');
    saved.innerText = 'Saving...';
    chrome.storage.sync.set(values, () => {
        saved.innerText = 'Saved!';
        setTimeout(() => {
            saved.innerText = '';
        }, 1000);
    });
});
