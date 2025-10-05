const API_URL = window.location.origin;
const PAGE_SIZE = 20;

let currentPage = 1;
let currentView = 'table';
let currentSynth = null;
let currentSequence = null;

// Get parameters
function getParams() {
    return {
        locale: document.getElementById('locale').value,
        seed: document.getElementById('seed').value,
        avgLikes: parseFloat(document.getElementById('avgLikes').value)
    };
}

// Generate a seeded random number generator
function seededRandom(seed) {
    return function() {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Generate album cover
function generateCover(title, artist, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    const rng = seededRandom(seed);
    
    // Generate background gradient
    const gradient = ctx.createLinearGradient(0, 0, 300, 300);
    const hue1 = Math.floor(rng() * 360);
    const hue2 = (hue1 + 60 + Math.floor(rng() * 120)) % 360;
    gradient.addColorStop(0, `hsl(${hue1}, 70%, 50%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 70%, 30%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
    
    // Add pattern
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `hsl(${hue1}, 50%, ${30 + rng() * 40}%)`;
        ctx.beginPath();
        ctx.arc(rng() * 300, rng() * 300, rng() * 50 + 10, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Add text overlay
    const textGradient = ctx.createLinearGradient(0, 200, 0, 300);
    textGradient.addColorStop(0, 'rgba(0,0,0,0)');
    textGradient.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = textGradient;
    ctx.fillRect(0, 200, 300, 100);
    
    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(truncateText(title, 18), 15, 250);
    
    // Draw artist
    ctx.font = '16px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(truncateText(artist, 20), 15, 275);
    
    return canvas.toDataURL();
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Generate music
function generateMusic(seed, duration = 4) {
    const rng = seededRandom(seed);
    
    // Musical scales
    const scales = [
        ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], // C Major
        ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], // A Minor
        ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'], // D Major
    ];
    
    const scale = scales[Math.floor(rng() * scales.length)];
    
    // Generate melody
    const notes = [];
    const numNotes = 16;
    for (let i = 0; i < numNotes; i++) {
        notes.push({
            note: scale[Math.floor(rng() * scale.length)],
            time: i * 0.25,
            duration: 0.2
        });
    }
    
    return { notes, duration };
}

// Play music
async function playMusic(seed, button) {
    if (currentSequence) {
        currentSequence.stop();
        currentSequence.dispose();
        if (currentSynth) {
            currentSynth.dispose();
        }
        currentSequence = null;
        button.textContent = '▶ Play';
        button.classList.remove('playing');
        return;
    }
    
    await Tone.start();
    
    const { notes } = generateMusic(seed);
    
    currentSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.3,
            release: 0.5
        }
    }).toDestination();
    
    currentSequence = new Tone.Sequence((time, note) => {
        currentSynth.triggerAttackRelease(note.note, note.duration, time);
    }, notes.map(n => ({ note: n.note, duration: n.duration })), '4n');
    
    currentSequence.loop = false;
    currentSequence.start(0);
    Tone.Transport.start();
    
    button.textContent = '⏸ Stop';
    button.classList.add('playing');
    
    setTimeout(() => {
        if (currentSequence) {
            Tone.Transport.stop();
            currentSequence.dispose();
            if (currentSynth) {
                currentSynth.dispose();
            }
            currentSequence = null;
            button.textContent = '▶ Play';
            button.classList.remove('playing');
        }
    }, 4500);
}

// Fetch songs from API
async function fetchSongs(page = 1) {
    const params = getParams();
    const url = `${API_URL}/api/songs?locale=${params.locale}&seed=${params.seed}&page=${page}&pageSize=${PAGE_SIZE}&avgLikes=${params.avgLikes}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.songs;
}

// Fetch song details
async function fetchSongDetails(songSeed, locale) {
    const url = `${API_URL}/api/song/${songSeed}?locale=${locale}`;
    const response = await fetch(url);
    return await response.json();
}

// Render table view
async function renderTableView() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    const songs = await fetchSongs(currentPage);
    
    songs.forEach(song => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${song.index}</td>
            <td>${song.title}</td>
            <td>${song.artist}</td>
            <td>${song.album}</td>
            <td>${song.genre}</td>
            <td>${song.likes}</td>
        `;
        
        row.addEventListener('click', () => toggleExpanded(row, song));
        tbody.appendChild(row);
    });
    
    document.getElementById('pageInfo').textContent = `Page ${currentPage}`;
}

// Toggle expanded row
async function toggleExpanded(row, song) {
    const existingExpanded = row.nextElementSibling;
    
    if (existingExpanded && existingExpanded.classList.contains('expanded-row')) {
        existingExpanded.remove();
        return;
    }
    
    // Remove any other expanded rows
    document.querySelectorAll('.expanded-row').forEach(el => el.remove());
    
    const expandedRow = document.createElement('tr');
    expandedRow.className = 'expanded-row';
    expandedRow.innerHTML = `
        <td colspan="6">
            <div class="expanded-content show">
                <div class="expanded-inner">
                    <div class="cover-container">
                        <div class="album-cover">
                            <img class="cover-bg" src="${generateCover(song.title, song.artist, song.seed)}" alt="Album cover">
                        </div>
                        <button class="play-button" data-seed="${song.seed}">▶ Play</button>
                    </div>
                    <div class="song-details">
                        <h2>${song.title}</h2>
                        <p style="color: #aaa; margin-bottom: 20px;">${song.artist} • ${song.album}</p>
                        <div class="review" id="review-${song.seed}">Loading review...</div>
                    </div>
                </div>
            </div>
        </td>
    `;
    
    row.after(expandedRow);
    
    // Add play button listener
    const playBtn = expandedRow.querySelector('.play-button');
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playMusic(song.seed, playBtn);
    });
    
    // Load review
    const params = getParams();
    const details = await fetchSongDetails(song.seed, params.locale);
    document.getElementById(`review-${song.seed}`).innerHTML = `<p>${details.review}</p>`;
}

// Render gallery view
let galleryPage = 1;
let isLoadingGallery = false;

async function renderGalleryView(append = false) {
    const gallery = document.getElementById('galleryView');
    
    if (!append) {
        gallery.innerHTML = '';
        galleryPage = 1;
    }
    
    isLoadingGallery = true;
    document.getElementById('loading').style.display = 'block';
    
    const songs = await fetchSongs(galleryPage);
    
    songs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        
        const coverImg = generateCover(song.title, song.artist, song.seed);
        
        card.innerHTML = `
            <div class="card-cover">
                <img src="${coverImg}" style="width: 100%; height: 100%; object-fit: cover;" alt="Cover">
                <div class="card-index">#${song.index}</div>
            </div>
            <div class="card-title">${song.title}</div>
            <div class="card-artist">${song.artist}</div>
            <div class="card-info">${song.album} • ${song.genre}</div>
            <div class="card-likes">❤ ${song.likes}</div>
        `;
        
        gallery.appendChild(card);
    });
    
    isLoadingGallery = false;
    document.getElementById('loading').style.display = 'none';
}

// Infinite scroll
window.addEventListener('scroll', () => {
    if (currentView !== 'gallery') return;
    
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    if (scrollTop + windowHeight >= documentHeight - 500 && !isLoadingGallery) {
        galleryPage++;
        renderGalleryView(true);
    }
});

// View switching
document.getElementById('tableViewBtn').addEventListener('click', () => {
    currentView = 'table';
    document.getElementById('tableView').classList.add('active');
    document.getElementById('galleryView').classList.remove('active');
    document.getElementById('tableViewBtn').classList.add('active');
    document.getElementById('galleryViewBtn').classList.remove('active');
    renderTableView();
});

document.getElementById('galleryViewBtn').addEventListener('click', () => {
    currentView = 'gallery';
    document.getElementById('galleryView').classList.add('active');
    document.getElementById('tableView').classList.remove('active');
    document.getElementById('galleryViewBtn').classList.add('active');
    document.getElementById('tableViewBtn').classList.remove('active');
    window.scrollTo(0, 0);
    renderGalleryView();
});

// Pagination
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTableView();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    renderTableView();
});

// Parameter change handlers
document.getElementById('locale').addEventListener('change', () => {
    currentPage = 1;
    if (currentView === 'table') {
        renderTableView();
    } else {
        window.scrollTo(0, 0);
        renderGalleryView();
    }
});

document.getElementById('seed').addEventListener('input', () => {
    currentPage = 1;
    if (currentView === 'table') {
        renderTableView();
    } else {
        window.scrollTo(0, 0);
        renderGalleryView();
    }
});

document.getElementById('avgLikes').addEventListener('input', () => {
    // Likes change only updates likes, not other data
    if (currentView === 'table') {
        renderTableView();
    } else {
        window.scrollTo(0, 0);
        renderGalleryView();
    }
});

// Random seed generator
document.getElementById('randomSeed').addEventListener('click', () => {
    const randomSeed = Math.floor(Math.random() * 9007199254740991);
    document.getElementById('seed').value = randomSeed;
    currentPage = 1;
    if (currentView === 'table') {
        renderTableView();
    } else {
        window.scrollTo(0, 0);
        renderGalleryView();
    }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    renderTableView();
});