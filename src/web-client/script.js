// script.js
const statusDiv = document.getElementById('status');
const referenceInput = document.getElementById('reference');
const sendButton = document.getElementById('sendButton');
const resultPre = document.getElementById('result');
const errorDiv = document.getElementById('error');
const errorMessagePre = document.getElementById('errorMessage');
const queryInput = document.getElementById('query');
const versionInput = document.getElementById('version');
const searchButton = document.getElementById('searchButton');
const searchResultPre = document.getElementById('searchResult');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');

let ws;
let isConnected = false;
let currentQuery = ''; // Store current query for pagination
let offset = 0;       // Pagination offset
const limit = 100;     // Updated to 100 for testing

function updateStatus(message, connected) {
    statusDiv.textContent = message;
    isConnected = connected;
    sendButton.disabled = !connected;
    searchButton.disabled = !connected;
    prevButton.disabled = !connected || offset === 0;
    nextButton.disabled = !connected;
    if (connected) {
        statusDiv.style.color = 'green';
    } else {
        statusDiv.style.color = 'red';
    }
}

function displayResult(text) {
    resultPre.textContent = text;
    searchResultPre.textContent = '';
    errorDiv.style.display = 'none';
}

function displaySearchResult(results) {
    searchResultPre.innerHTML = '';
    const header = document.createElement('p');
    header.textContent = `Results for offset ${offset} (Limit: ${limit}) - Received ${results.length} items`;
    searchResultPre.appendChild(header);

    if (Array.isArray(results) && results.length > 0) {
        results.forEach(result => {
            const p = document.createElement('p');
            p.textContent = `${result.reference || 'N/A'}: ${result.text || 'No text'}`;
            searchResultPre.appendChild(p);
        });
    } else {
        searchResultPre.textContent = "No results found.";
    }
    resultPre.textContent = '';
    errorDiv.style.display = 'none';
    prevButton.disabled = offset === 0;
    nextButton.disabled = results.length < limit; // Disable if fewer results than limit
}

function displayError(message) {
    errorMessagePre.textContent = message;
    errorDiv.style.display = 'block';
    resultPre.textContent = '';
    searchResultPre.textContent = '';
}

function connectWebSocket() {
    const wsUrl = `ws://${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connection opened');
    };

    ws.onmessage = (event) => {
        console.log('Message from server:', event.data);
        try {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'status':
                    updateStatus(data.message || (data.connected ? 'Connected' : 'Disconnected'), data.connected);
                    break;
                case 'toolResult':
                    if (data.toolName === 'searchText' && data.result && Array.isArray(data.result.content)) {
                        console.log('Search results received:', { count: data.result.content.length, offset, limit });
                        displaySearchResult(data.result.content);
                    } else if (data.toolName === 'getEnglishText' && data.result && data.result.content && Array.isArray(data.result.content) && data.result.content[0]?.type === 'text') {
                        displayResult(data.result.content[0].text);
                    } else {
                        displayError(`Unexpected result format for ${data.toolName}: ${JSON.stringify(data.result)}`);
                    }
                    break;
                case 'error':
                    displayError(data.message);
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Failed to parse server message:', error);
            displayError('Received invalid message from server.');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('Connection error', false);
        displayError('WebSocket connection error. Check the console.');
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        updateStatus('Disconnected. Attempting to reconnect...', false);
        setTimeout(connectWebSocket, 5000);
    };
}

// --- Event Listeners ---

sendButton.addEventListener('click', () => {
    const reference = referenceInput.value.trim();
    if (!reference) {
        displayError('Please enter a Bible reference.');
        return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
        const request = {
            type: 'callTool',
            toolName: 'getEnglishText',
            reference: reference
        };
        console.log('Sending getEnglishText request:', request);
        ws.send(JSON.stringify(request));
        resultPre.textContent = 'Loading...';
        searchResultPre.textContent = '';
        errorDiv.style.display = 'none';
    } else {
        displayError('Not connected to the server.');
    }
});

searchButton.addEventListener('click', () => {
    const query = queryInput.value.trim();
    const version = versionInput.value.trim();
    if (!query) {
        displayError('Please enter text to search for.');
        return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
        currentQuery = query;
        offset = 0;
        const request = {
            type: 'callTool',
            toolName: 'searchText',
            query: query,
            ...(version && { version: version }),
            limit: limit,
            offset: offset,
        };
        console.log('Sending search request:', request);
        ws.send(JSON.stringify(request));
        searchResultPre.textContent = 'Searching...';
        resultPre.textContent = '';
        errorDiv.style.display = 'none';
    } else {
        displayError('Not connected to the server.');
    }
});

prevButton.addEventListener('click', () => {
    if (offset >= limit) {
        offset -= limit;
        performSearch();
    }
});

nextButton.addEventListener('click', () => {
    offset += limit;
    performSearch();
});

function performSearch() {
    const version = versionInput.value.trim();
    if (ws && ws.readyState === WebSocket.OPEN && currentQuery) {
        const request = {
            type: 'callTool',
            toolName: 'searchText',
            query: currentQuery,
            ...(version && { version: version }),
            limit: limit,
            offset: offset,
        };
        console.log('Sending paginated search request:', request);
        ws.send(JSON.stringify(request));
        searchResultPre.textContent = 'Searching...';
        resultPre.textContent = '';
        errorDiv.style.display = 'none';
    } else {
        displayError('Not connected to the server or no query.');
    }
}

// Enter key handlers
[referenceInput, queryInput, versionInput].forEach(input => {
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (input === referenceInput) sendButton.click();
            else searchButton.click();
        }
    });
});

// Initial connection attempt
connectWebSocket();