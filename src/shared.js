const doRequest = async (apikey, url, params, statusElem, onFailure, onSuccess) => {
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

