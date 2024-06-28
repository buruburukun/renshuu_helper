const doRequest = async (apikey, endpoint, params, statusElem, onFailure, statusMap) => {
    if (!apikey) {
        statusElem.innerHTML = 'Error! Set the API key in the settings.';
        onFailure();
        return;
    }

    const url = `https://api.renshuu.org${endpoint}`;
    params['headers'] = {
        'Authorization': `Bearer ${apikey}`,
    };
    const response = await fetch(url, params);
    if (response.status === 401) {
        statusElem.innerHTML = 'Error! Invalid API key.';
        onFailure();
    } else if (response.status === 429) {
        statusElem.innerHTML = 'Error! Too many requests. Try again later.';
        onFailure();
    } else {
        try {
            const results = await response.json();
            const func = statusMap[response.status];
            if (func) {
                func(results);
            } else {
                console.warn('Unknown response code', response);
                statusElem.innerHTML = `Unknown response code ${response.status}. Attempting to continue.`;
                statusMap[200](results);
            }
        } catch (error) {
            statusElem.innerHTML = `Error! Something went wrong. Response code: ${response.status}.`;
            console.error('response', response);
            onFailure();
            throw error;
        }
    }
};

