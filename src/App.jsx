import { useEffect, useMemo, useState } from 'react'
import { HashRouter, useLocation, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { addDoc, collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import './guest.css'

const TMDB_URL = 'https://api.themoviedb.org/3'
const tmdbToken = import.meta.env.VITE_TMDB_READ_TOKEN

const fallbackMovies = [
  ['aurora', 'Aurora Drift', '2026', 'PG-13', 'Sci-Fi', 'A rescue pilot follows a mysterious signal across a frozen planet.', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=85'],
  ['vector', 'Midnight Vector', '2025', 'PG-13', 'Mystery', 'A city map redraws itself every night, revealing a path nobody should take.', 'https://images.unsplash.com/photo-1519608487953-e999c86e7452?auto=format&fit=crop&w=900&q=85'],
  ['horizon', 'Glass Horizon', '2024', 'PG', 'Drama', 'An engineer races to protect the world’s first floating city.', 'https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=900&q=85'],
  ['current', 'Wild Current', '2025', 'PG', 'Adventure', 'Two siblings journey down an uncharted river after a historic storm.', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=85'],
].map(([id, title, year, rating, genre, description, image]) => ({ id, title, year, rating, genre, description, image }))

const fallbackSeries = [
  ['harbor-line', 'Harbor Line', '2025', 'TV-14', 'Crime Drama', 'A harbor detective follows a missing-person case that reaches into the city’s most powerful family.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85'],
  ['after-dark', 'After Dark', '2024', 'TV-MA', 'Mystery', 'Every night at midnight, a different resident of a quiet town receives the same impossible voicemail.', 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=900&q=85'],
  ['signal-nine', 'Signal Nine', '2026', 'TV-14', 'Sci-Fi', 'A small team discovers that a signal from deep space has been predicting disasters on Earth.', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=85'],
  ['highwater', 'Highwater', '2025', 'TV-14', 'Survival Drama', 'When a flood cuts off a coastal town, four strangers must decide what they are willing to sacrifice to get home.', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=85'],
].map(([id, title, year, rating, genre, description, image]) => ({ id, title, year, rating, genre, description, image, type: 'series' }))

// Open-animation releases: used here instead of copying Netflix footage.
const trailers = [
  { title: 'Spider-Man: Across the Spider-Verse', detail: '2023 · Action · Animation', description: 'Miles Morales is launched across the Multiverse, where he must decide what it truly means to be a hero.', videoId: 'cqGjhVJWtEg' },
  { title: 'The Fantastic Four: First Steps', detail: '2025 · Sci-Fi · Adventure', description: 'Marvel’s first family is pulled into a cosmic crisis that tests their powers, their bond, and the future of their world.', videoId: 'pAsmrKyMqaA' },
  { title: 'Superman', detail: '2025 · Action · Drama', description: 'A young Clark Kent learns to balance his extraordinary powers with the compassion that makes him human.', videoId: '2woCZg5QdVE' },
]

function toTmdbMovie(item, type) {
  const title = type === 'series' ? item.name : item.title
  const year = (type === 'series' ? item.first_air_date : item.release_date || '').slice(0, 4) || 'New'
  return { id: `tmdb-${type}-${item.id}`, tmdbID: item.id, title, year, rating: type === 'series' ? 'TV Series' : 'Movie', type, genre: type === 'series' ? 'TV Series' : 'Movie', description: item.overview || 'Select this title to view more information.', image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85' }
}

async function tmdbRequest(path) {
  const response = await fetch(`${TMDB_URL}${path}`, { headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' } })
  if (!response.ok) throw new Error('TMDB request failed')
  return response.json()
}

export default function App() {
  return <HashRouter><StreamingApp /></HashRouter>
}

function StreamingApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(false)
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [apiMovies, setApiMovies] = useState([])
  const [apiStatus, setApiStatus] = useState('')
  const [trailerIndex, setTrailerIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [search, setSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [customMovies, setCustomMovies] = useState([])
  const [myList, setMyList] = useState(() => JSON.parse(localStorage.getItem('netflix-list') || '[]'))

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => localStorage.setItem('netflix-list', JSON.stringify(myList)), [myList])
  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => {
      if (snapshot.exists() && Array.isArray(snapshot.data().myList)) setMyList(snapshot.data().myList)
    }, () => { /* Local storage stays available if Firestore has not been enabled yet. */ })
  }, [user])
  useEffect(() => {
    if (!user) return
    return onSnapshot(collection(db, 'titles'), (snapshot) => {
      setCustomMovies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    }, () => { /* The app continues to work until the database is enabled. */ })
  }, [user])
  useEffect(() => {
    if ((!user && !guest) || !tmdbToken) return
    async function loadMovies() {
      setApiStatus('Loading live movies and TV shows…')
      try {
        const [popularMovies, popularSeries, trending] = await Promise.all([tmdbRequest('/movie/popular'), tmdbRequest('/tv/popular'), tmdbRequest('/trending/all/week')])
        const movies = popularMovies.results.slice(0, 10).map((item) => toTmdbMovie(item, 'movie'))
        const seriesResults = popularSeries.results.slice(0, 10).map((item) => toTmdbMovie(item, 'series'))
        const trendingResults = trending.results.slice(0, 6).filter((item) => item.media_type === 'movie' || item.media_type === 'tv').map((item) => toTmdbMovie(item, item.media_type === 'tv' ? 'series' : 'movie'))
        const uniqueTitles = [...trendingResults, ...movies, ...seriesResults]
          .filter((title, index, titles) => titles.findIndex((item) => item.id === title.id) === index)
        setApiMovies(uniqueTitles)
        setApiStatus('Live movies and TV series powered by TMDB')
      } catch { setApiStatus('Live titles are unavailable right now — showing the demo collection.') }
    }
    loadMovies()
  }, [user, guest])

  async function handleAuth(event) {
    event.preventDefault(); setError(''); setLoading(true)
    try { if (register) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password) }
    catch (err) { setError(err.message.replace('Firebase: ', '')) }
    finally { setLoading(false) }
  }

  async function openMovie(movie) {
    setSelected(movie)
    navigate(`/title/${movie.id}`)
    if (movie.tmdbID && tmdbToken) {
      try {
        const kind = movie.type === 'series' ? 'tv' : 'movie'
        const [details, season] = await Promise.all([tmdbRequest(`/${kind}/${movie.tmdbID}?append_to_response=videos`), movie.type === 'series' ? tmdbRequest(`/tv/${movie.tmdbID}/season/1`) : Promise.resolve(null)])
        const trailer = details.videos?.results?.find((video) => video.site === 'YouTube' && video.type === 'Trailer')
        setSelected({ ...movie, description: details.overview || movie.description, genre: details.genres?.map((genre) => genre.name).join(', ') || movie.genre, rating: details.vote_average ? `★ ${details.vote_average.toFixed(1)}` : movie.rating, trailerId: trailer?.key, seasons: details.number_of_seasons, episodes: season?.episodes?.map((episode) => ({ title: episode.name, runtime: episode.runtime || 45, overview: episode.overview })) })
      } catch { /* The basic title information still remains available. */ }
      return
    }
  }

  const toggle = (id) => setMyList((list) => {
    const nextList = list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
    if (user) setDoc(doc(db, 'profiles', user.uid), { myList: nextList, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {})
    return nextList
  })
  const feature = trailers[trailerIndex]
  const allMovies = useMemo(() => [...customMovies, ...(apiMovies.length ? apiMovies : [...fallbackMovies, ...fallbackSeries])], [customMovies, apiMovies])
  const movieOnly = allMovies.filter((movie) => movie.type !== 'series')
  const series = allMovies.filter((movie) => movie.type === 'series')
  const films = [movieOnly[0], series[0], movieOnly[1], series[1], movieOnly[2], series[2], movieOnly[3], series[3]].filter(Boolean)
  const savedMovies = allMovies.filter((movie) => myList.includes(movie.id))
  const searchResults = search.trim() ? allMovies.filter((movie) => movie.title.toLowerCase().includes(search.trim().toLowerCase())) : []
  const nextTrailer = () => setTrailerIndex((index) => (index + 1) % trailers.length)
  const previousTrailer = () => setTrailerIndex((index) => (index - 1 + trailers.length) % trailers.length)

  useEffect(() => {
    const routeId = location.pathname.split('/')[2]
    if (!routeId) return
    const routeMovie = allMovies.find((movie) => movie.id === routeId)
    if (routeMovie) setSelected((current) => current?.id === routeId ? current : routeMovie)
  }, [location.pathname, allMovies])

  if (!user && !guest) return <main className="auth-page"><header><strong>NETFLIX</strong></header><form className="auth-card" onSubmit={handleAuth}><h1>{register ? 'Create your account' : 'Sign in'}</h1><input type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required /><input type="password" minLength="6" placeholder="Password (6+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="form-error">{error}</p>}<button className="primary" disabled={loading}>{loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button><button type="button" className="guest-button" onClick={() => setGuest(true)}>Browse as guest</button><p>{register ? 'Already have an account?' : 'New to Netflix?'} <button type="button" className="text-button" onClick={() => setRegister(!register)}>{register ? 'Sign in' : 'Create one'}</button></p></form></main>

  if (location.pathname === '/admin') return <AdminPanel user={user} close={() => navigate('/')} />

  return <main className="app-shell"><header className="nav"><strong>NETFLIX</strong><nav><a href="#home">Home</a><a href="#new">New & Popular</a><a href="#list">My List</a></nav><form className="search" onSubmit={(event) => event.preventDefault()}><span>⌕</span><input aria-label="Search titles" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titles, people, genres" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</form><div className="profile"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span>N</span>⌄</button>{profileOpen && <div className="profile-menu"><p>{user.email}</p><button onClick={() => { navigate('/admin'); setProfileOpen(false) }}>Content admin</button><button onClick={() => signOut(auth)}>Sign out of Netflix</button></div>}</div></header>{search && <Row title={`Search results for “${search}”`} movies={searchResults} select={openMovie} empty="No matching titles in the current collection." />}<section className="video-hero" id="home"><iframe key={`${feature.videoId}-${muted}`} className="hero-video" title={`${feature.title} video`} src={`https://www.youtube-nocookie.com/embed/${feature.videoId}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&cc_load_policy=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><div className="hero-shade" /><div className="hero-copy"><p className="eyebrow">FEATURED TRAILER</p><h1>{feature.title}</h1><p className="feature-meta">{feature.detail}</p><p>{feature.description}</p><button className="primary" onClick={() => setSelected({ ...feature, isTrailer: true })}>▶ Play</button><button className="secondary" onClick={() => setMuted(!muted)}>{muted ? '🔊 Turn sound on' : '🔇 Mute'}</button><button className="secondary" onClick={nextTrailer}>Next suggestion ›</button></div><div className="trailer-controls"><button aria-label="Previous trailer" onClick={previousTrailer}>‹</button>{trailers.map((trailer, index) => <button className={index === trailerIndex ? 'active-dot' : ''} aria-label={`Show ${trailer.title}`} key={trailer.videoId} onClick={() => setTrailerIndex(index)} />)}<button aria-label="Next trailer" onClick={nextTrailer}>›</button></div></section><Row title="Popular Movies" movies={films.slice(0, 8)} select={openMovie} /><section className="api-note" id="new"><span className="live-dot" /> {apiStatus || 'Sign in to load live content from OMDb.'}</section><Row title="Binge-Worthy Series" movies={series} select={openMovie} empty="Series will appear here when the live catalog finishes loading." /><Row id="list" title="My List" movies={savedMovies} select={openMovie} empty="Add a title using the + My List button." /><footer>Built with React, JavaScript, CSS, Firebase Authentication, and the OMDb API.</footer>{selected && <MovieModal movie={selected} close={() => { setSelected(null); navigate('/') }} inList={myList.includes(selected.id || selected.videoId)} toggle={toggle} />}</main>
}

function Row({ title, movies, select, empty, id }) { return <section className="row" id={id}><h2>{title}</h2>{movies.length ? <div className="cards">{movies.map((movie) => <button className="movie-card" key={movie.id} onClick={() => select(movie)}><img src={movie.image} alt={`${movie.title} poster`} /><span>{movie.title}</span></button>)}</div> : empty && title !== 'My List' ? <p className="empty">{empty}</p> : null}</section> }

function MovieModal({ movie, close, inList, toggle }) {
  const [season, setSeason] = useState(1)
  const [loadedEpisodes, setLoadedEpisodes] = useState(movie.episodes || [])
  const [ratings, setRatings] = useState(() => JSON.parse(localStorage.getItem('netflix-ratings') || '{}'))
  const rating = ratings[movie.id] || ''
  const listId = movie.id || movie.videoId
  useEffect(() => {
    if (movie.type !== 'series' || !movie.tmdbID) {
      setLoadedEpisodes(movie.episodes || [])
      return
    }
    let active = true
    tmdbRequest(`/tv/${movie.tmdbID}/season/${season}`)
      .then((data) => {
        if (active) setLoadedEpisodes(data.episodes?.map((episode) => ({ title: episode.name, runtime: episode.runtime || 45, overview: episode.overview })) || [])
      })
      .catch(() => {
        if (active) setLoadedEpisodes([])
      })
    return () => { active = false }
  }, [movie.id, movie.tmdbID, movie.type, movie.episodes, season])
  function rate(value) {
    const nextRatings = { ...ratings, [movie.id]: value }
    setRatings(nextRatings)
    localStorage.setItem('netflix-ratings', JSON.stringify(nextRatings))
  }
  if (movie.isTrailer) return <div className="modal-backdrop" onClick={close}><article className="movie-modal video-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={close}>×</button><iframe title={`${movie.title} video`} src={`https://www.youtube-nocookie.com/embed/${movie.videoId}?autoplay=1&controls=0&rel=0&cc_load_policy=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></article></div>
  const episodes = loadedEpisodes.length ? loadedEpisodes : ['A new beginning', 'The unexpected signal', 'Into the unknown', 'The truth comes out', 'No way back'].map((title, index) => ({ title, runtime: 42 + index * 3 }))
  const seasonCount = movie.seasons || 3
  return <div className="modal-backdrop" onClick={close}><article className="movie-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={close}>×</button><img src={movie.image} alt={`${movie.title} poster`} /><div className="modal-copy"><h2>{movie.title}</h2><p className="meta">{movie.year} · {movie.rating} · {movie.genre}</p><p>{movie.description}</p><div className="ratings" aria-label="Rate this title"><span>Rate this title</span><button className={rating === 'down' ? 'selected-rating' : ''} onClick={() => rate('down')} title="Not for me">👎</button><button className={rating === 'up' ? 'selected-rating' : ''} onClick={() => rate('up')} title="Like">👍</button><button className={rating === 'love' ? 'selected-rating' : ''} onClick={() => rate('love')} title="Love this">💖</button></div>{movie.trailerId && <iframe className="inline-trailer" title={`${movie.title} trailer`} src={`https://www.youtube-nocookie.com/embed/${movie.trailerId}?autoplay=0&rel=0&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}{movie.type === 'series' && <section className="episode-panel"><div className="episode-heading"><h3>Episodes</h3><select value={season} onChange={(event) => setSeason(Number(event.target.value))} aria-label="Choose season">{Array.from({ length: seasonCount }, (_, index) => <option key={index + 1} value={index + 1}>Season {index + 1}</option>)}</select></div>{episodes.map((episode, index) => <button className="episode" key={`${episode.title}-${index}`} onClick={() => window.alert(`Playing ${movie.title} — Season ${season}, Episode ${index + 1}: ${episode.title}`)}><span>{index + 1}</span><div><strong>{episode.title}</strong><small>Season {season} · {episode.runtime || 45}m</small></div><b>▶</b></button>)}</section>}{movie.trailerId ? <p className="trailer-ready">Trailer loaded from TMDB</p> : <a className="primary video-link" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} official trailer`)}`} target="_blank" rel="noreferrer">▶ Watch trailer</a>}<button className="secondary" onClick={() => toggle(listId)}>{inList ? '✓ In My List' : '+ My List'}</button></div></article></div>
}

function AdminPanel({ user, close }) {
  const [form, setForm] = useState({ title: '', year: '2026', genre: 'Drama', type: 'movie', image: '', description: '' })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      await addDoc(collection(db, 'titles'), { ...form, rating: form.type === 'series' ? 'TV-14' : 'PG-13', createdBy: user.uid, createdAt: new Date().toISOString(), image: form.image || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85' })
      setMessage('Title saved to your Firebase catalog.'); setForm({ title: '', year: '2026', genre: 'Drama', type: 'movie', image: '', description: '' })
    } catch { setMessage('Firestore needs to be enabled before titles can be saved.') }
    finally { setSaving(false) }
  }
  return <main className="admin-page"><header className="admin-nav"><strong>NETFLIX</strong><button onClick={close}>← Back to browse</button></header><section className="admin-content"><p className="eyebrow">CONTENT MANAGEMENT</p><h1>Add a title</h1><p>Build your own streaming catalog with Firebase.</p><form className="admin-form" onSubmit={submit}><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Example: Night Shift" /></label><div className="form-grid"><label>Year<input required value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} /></label><label>Genre<input required value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} placeholder="Thriller" /></label></div><label>Content type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="movie">Movie</option><option value="series">TV series</option></select></label><label>Poster image URL <small>(optional)</small><input value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} placeholder="https://..." /></label><label>Description<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Write a short description for your title." /></label>{message && <p className="admin-message">{message}</p>}<button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save title'}</button></form></section></main>
}
