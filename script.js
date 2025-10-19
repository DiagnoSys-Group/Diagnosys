// --- Google Sheets CSV URLs (UPDATED PATIENT URL) ---
// Doctor URL: Used as is.
const DOCTORS_DB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR-JME6LR_R-EW2xbHGu22JBdEXN5_wiayzwaZqaihS6IyHCjeEqoZKF3YItNoOmSRymeyECjnoQXN1/pub?output=csv';
// Patient URL: Changed from 'pubhtml' to 'pub?output=csv' for raw data access.
const PATIENT_DB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTyFSHcy1tmkb1sk7VJJbakrbMTQRYv8KopB5rg1_JVXMwV3Jxg9W63EOEMZ-juwrPd7s1FKZD1eOQK/pub?output=csv';

// --- Data Arrays ---
let doctorsData = [];
let databaseData = [];
// --- Realtime Polling Constant ---
const POLLING_INTERVAL = 15000; // 15 seconds in milliseconds
let dataIntervalId = null; // To hold the interval ID

// --- DOM Elements & Constants ---
const screens = {
    home: document.getElementById('home-screen'),
    doctors: document.getElementById('doctors-profile-screen'),
    database: document.getElementById('database-access-screen')
};

const doctorTableBody = document.getElementById('doctors-table-body');
const databaseTableBody = document.getElementById('database-table-body');
const doctorSearchInput = document.getElementById('doctor-search-input');
const databaseSearchInput = document.getElementById('database-search-input');

// --- Helper Functions for CSV Parsing ---
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length <= 1) return [];
    
    // Clean headers: trim, lowercase, remove extra spaces/special chars
    const rawHeaders = lines[0].split(',');
    const headers = rawHeaders.map(header => 
        header.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    );

    // Header normalization (Mapping sheet headers to desired JS object keys)
    const headerMap = {
        name: 'name',
        age: 'age',
        gender: 'gender',
        dateofbirth: 'dateofbirth',
        contact: 'contact',
        systolicbp: 'systolic', 
        diastolicbp: 'diastolic', 
        spo2: 'spo2',
        heartrate: 'heartrate',
        temperature: 'temperature',
        results: 'results',
        doctor: 'doctor'
    };

    const normalizedHeaders = headers.map(h => headerMap[h] || h);

    // Create a fingerprint of the true header row for reliable skipping of duplicates
    const headerFingerprint = rawHeaders.map(h => 
        h.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    ).join('');
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        
        // Skip empty or incomplete rows
        if (values.length < normalizedHeaders.length * 0.7 || values.every(v => v.trim() === '')) {
            continue;
        }
        
        // CRITICAL FIX: SKIP DUPLICATE HEADER ROWS
        const currentRowFingerprint = values.map(v => 
            v.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
        ).join('');
        
        // If the current row's content (after cleaning) matches the true header content, skip it.
        if (currentRowFingerprint === headerFingerprint) {
            continue; 
        }

        const obj = {};
        let isRowEmpty = true;

        normalizedHeaders.forEach((header, index) => {
            const value = values[index] ? values[index].trim() : '';
            obj[header] = value;
            if (value !== '') isRowEmpty = false;
        });

        if (!isRowEmpty) data.push(obj);
    }

    return data;
}

// --- Data Fetching and Loading (Core Update) ---
async function fetchData(url) {
    // FIX: Add a cache-busting parameter to ensure the browser and Google fetch the latest version.
    // Use an ampersand (&) because the URL already contains a question mark (?)
    const cacheBusterUrl = `${url}&timestamp=${new Date().getTime()}`;
    try {
        const response = await fetch(cacheBusterUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return [];
    }
}

async function fetchAndLoadData() {
    // Only show "Loading..." message on initial load, not during rapid updates
    if (doctorsData.length === 0 && databaseData.length === 0) {
        doctorTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading doctor data...</td></tr>';
        databaseTableBody.innerHTML = '<tr><td colspan="13" style="text-align:center;">Loading patient data...</td></tr>';
    }

    const [doctorsResult, databaseResult] = await Promise.all([
        fetchData(DOCTORS_DB_URL),
        fetchData(PATIENT_DB_URL)
    ]);

    doctorsData = doctorsResult;
    databaseData = databaseResult;

    // Redraw the table only for the currently active screen
    const activeScreenElement = document.querySelector('.screen.active');
    const activeScreen = activeScreenElement ? activeScreenElement.id.replace('-screen', '') : 'home';

    if (activeScreen === 'doctors') renderDoctorsTable(doctorsData);
    else if (activeScreen === 'database') renderDatabaseTable(databaseData);
    else if (activeScreen === 'home') switchScreen('home'); 
}

// --- Core Rendering and Search ---

function startPolling() {
    // Clear any existing interval to prevent duplicates
    if (dataIntervalId) {
        clearInterval(dataIntervalId);
    }
    // Set a new interval to fetch and load data every 15 seconds
    dataIntervalId = setInterval(fetchAndLoadData, POLLING_INTERVAL);
    console.log(`Polling started: fetching data every ${POLLING_INTERVAL / 1000} seconds.`);
}

function stopPolling() {
    if (dataIntervalId) {
        clearInterval(dataIntervalId);
        dataIntervalId = null;
        console.log("Polling stopped.");
    }
}


function switchScreen(targetScreen) {
    Object.values(screens).forEach(screen => screen?.classList.remove('active'));
    screens[targetScreen]?.classList.add('active');
    
    // Stop polling if switching to the Home screen
    if (targetScreen === 'home') {
        stopPolling();
    } else {
        // Start polling if switching to a data-intensive screen
        startPolling(); 
    }

    if (targetScreen === 'doctors') {
        doctorSearchInput.value = '';
        renderDoctorsTable(doctorsData);
    } else if (targetScreen === 'database') {
        databaseSearchInput.value = '';
        renderDatabaseTable(databaseData);
    }
}

function renderDoctorsTable(data) {
    doctorTableBody.innerHTML = '';
    if (data.length === 0) {
        doctorTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No doctor data found.</td></tr>';
        return;
    }
    data.forEach(doctor => {
        const row = doctorTableBody.insertRow();
        row.innerHTML = `
            <td>${doctor.name || ''}</td>
            <td>${doctor.contact || ''}</td>
            <td>${doctor.schedule || ''}</td>
            <td>${doctor.availability || ''}</td>
        `;
    });
}

function renderDatabaseTable(data) {
    databaseTableBody.innerHTML = '';
    if (data.length === 0) {
        databaseTableBody.innerHTML = '<tr><td colspan="13" style="text-align:center;">No patient records found.</td></tr>';
        return;
    }

    data.forEach(record => {
        const row = databaseTableBody.insertRow();
        row.innerHTML = `
            <td>${record.name || ''}</td>
            <td>${record.age || ''}</td>
            <td>${record.gender || ''}</td>
            <td>${record.dateofbirth || ''}</td>
            <td>${record.contact || ''}</td>
            <td>${record.systolic || ''}</td>
            <td>${record.diastolic || ''}</td>
            <td>${record.spo2 || ''}</td>
            <td>${record.heartrate || ''}</td>
            <td>${record.temperature || ''}</td>
            <td>${record.results || ''}</td>
            <td>${record.doctor || ''}</td>
        `;
    });
}

function filterData(query, data) {
    const lowerCaseQuery = query.toLowerCase();
    return data.filter(item =>
        Object.values(item).some(value =>
            String(value).toLowerCase().includes(lowerCaseQuery)
        )
    );
}

function handleDoctorSearch() {
    const query = doctorSearchInput.value.trim();
    renderDoctorsTable(filterData(query, doctorsData));
}

function handleDatabaseSearch() {
    const query = databaseSearchInput.value.trim();
    renderDatabaseTable(filterData(query, databaseData));
}

// --- Event Listeners (Unchanged) ---
document.getElementById('btn-doctors-profile')?.addEventListener('click', () => switchScreen('doctors'));
document.getElementById('btn-database-access')?.addEventListener('click', () => switchScreen('database'));
document.getElementById('btn-back-doctors')?.addEventListener('click', () => switchScreen('home'));
document.getElementById('btn-back-database')?.addEventListener('click', () => switchScreen('home'));
doctorSearchInput?.addEventListener('input', handleDoctorSearch);
databaseSearchInput?.addEventListener('input', handleDatabaseSearch);

// --- Initialization ---
window.onload = () => {
    switchScreen('home'); // Sets initial screen and stops polling
    fetchAndLoadData(); // Initial one-time fetch (will start polling if not on 'home')
};