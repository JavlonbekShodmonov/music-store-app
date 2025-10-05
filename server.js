const express = require('express');
const cors = require('cors');
const { faker, fakerEN_US, fakerDE, fakerUK } = require('@faker-js/faker');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Locale mapping to faker instances
const FAKER_LOCALES = {
  'en-US': fakerEN_US,
  'de-DE': fakerDE,
  'uk-UA': fakerUK
};

// Genre lists by locale
const GENRES = {
  'en-US': ['Rock', 'Pop', 'Jazz', 'Blues', 'Hip Hop', 'Electronic', 'Country', 'R&B', 'Metal', 'Folk', 'Indie', 'Classical'],
  'de-DE': ['Rock', 'Pop', 'Schlager', 'Techno', 'Metal', 'Jazz', 'Volksmusik', 'Hip Hop', 'Punk', 'Electronic', 'Klassik', 'Indie'],
  'uk-UA': ['Рок', 'Поп', 'Джаз', 'Блюз', 'Хіп-хоп', 'Електронна', 'Фольк', 'Метал', 'Інді', 'Класична', 'Реп', 'Панк']
};

// Seeded random number generator (Mulberry32)
function createSeededRandom(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Combine seed with page number
function combineSeed(userSeed, pageNumber) {
  return (BigInt(userSeed) * 1103515245n + BigInt(pageNumber) * 12345n) & 0xFFFFFFFFFFFFFFFFn;
}

// Generate songs for a page
function generateSongs(locale, seed, page, pageSize, avgLikes) {
  const fakerInstance = FAKER_LOCALES[locale] || fakerEN_US;
  
  const combinedSeed = Number(combineSeed(seed, page) & 0xFFFFFFFFn);
  const rng = createSeededRandom(combinedSeed);
  
  const songs = [];
  const startIndex = (page - 1) * pageSize;
  
  for (let i = 0; i < pageSize; i++) {
    const index = startIndex + i + 1;
    
    // Generate song data based on seed + index
    const itemSeed = combinedSeed + i;
    fakerInstance.seed(itemSeed);
    
    // Generate song title
    const titleWords = rng() > 0.5 ? 2 : 3;
    let title = '';
    for (let j = 0; j < titleWords; j++) {
      if (j > 0) title += ' ';
      title += fakerInstance.word.adjective().charAt(0).toUpperCase() + fakerInstance.word.adjective().slice(1);
    }
    
    // Generate artist (50% chance of band name vs personal name)
    const artist = rng() > 0.5 
      ? fakerInstance.company.name().split(' ').slice(0, 2).join(' ')
      : fakerInstance.person.fullName();
    
    // Generate album (70% chance of album, 30% single)
    const isSingle = rng() > 0.7;
    const album = isSingle ? 'Single' : fakerInstance.commerce.productName();
    
    // Generate genre
    const genreList = GENRES[locale] || GENRES['en-US'];
    const genre = genreList[Math.floor(rng() * genreList.length)];
    
    // Generate likes based on avgLikes (independent of seed)
    let likes = 0;
    if (avgLikes > 0) {
      const wholePart = Math.floor(avgLikes);
      const fractionalPart = avgLikes - wholePart;
      likes = wholePart;
      if (Math.random() < fractionalPart) {
        likes += 1;
      }
    }
    
    songs.push({
      index,
      title,
      artist,
      album,
      genre,
      likes,
      seed: itemSeed
    });
  }
  
  return songs;
}

// Generate detailed song info
function generateSongDetails(locale, songSeed) {
  const fakerInstance = FAKER_LOCALES[locale] || fakerEN_US;
  fakerInstance.seed(songSeed);
  
  const review = fakerInstance.lorem.paragraphs(3);
  
  return { review };
}

// API endpoint for songs
app.get('/api/songs', (req, res) => {
  const locale = req.query.locale || 'en-US';
  const seed = BigInt(req.query.seed || '0');
  const page = parseInt(req.query.page || '1');
  const pageSize = parseInt(req.query.pageSize || '20');
  const avgLikes = parseFloat(req.query.avgLikes || '0');
  
  const songs = generateSongs(locale, seed, page, pageSize, avgLikes);
  
  res.json({ songs, page, pageSize });
});

// API endpoint for song details
app.get('/api/song/:seed', (req, res) => {
  const locale = req.query.locale || 'en-US';
  const songSeed = parseInt(req.params.seed);
  
  const details = generateSongDetails(locale, songSeed);
  
  res.json(details);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});