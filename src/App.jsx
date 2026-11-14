import { useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, useLocation, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { addDoc, collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'
import './guest.css'
import './responsive.css'
import './title-page.css'
import './trailer-cleanup.css'
import './mobile.css'
import ControlIcon from './ControlIcon'
import TrailerPlayer from './TrailerPlayer'

const TMDB_URL = 'https://api.themoviedb.org/3'
const tmdbToken = import.meta.env.VITE_TMDB_READ_TOKEN
const TRAILER_DISPLAY_MS = 78000
const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85'
const excludedTitles = new Set([
  'Tagesschau',
  'The Tonight Show Starring Jimmy Fallon',
  'Watch What Happens Live with Andy Cohen',
  'Paradise Hotel',
  'Toy Story 5',
  'Toy Story',
  'Moana',
  'Frozen',
  'The Lion King',
  'Lilo & Stitch',
  'Mufasa: The Lion King',
])

function isStreamworthy(item) {
  return !excludedTitles.has(item.title || item.name)
}

const fallbackMovies = [
  [
    'aurora',
    'Aurora Drift',
    '2026',
    'PG-13',
    'Sci-Fi',
    'A rescue pilot follows a mysterious signal across a frozen planet.',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'vector',
    'Midnight Vector',
    '2025',
    'PG-13',
    'Mystery',
    'A city map redraws itself every night, revealing a path nobody should take.',
    'https://images.unsplash.com/photo-1519608487953-e999c86e7452?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'horizon',
    'Glass Horizon',
    '2024',
    'PG',
    'Drama',
    'An engineer races to protect the world’s first floating city.',
    'https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'current',
    'Wild Current',
    '2025',
    'PG',
    'Adventure',
    'Two siblings journey down an uncharted river after a historic storm.',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=85',
  ],
].map(([id, title, year, rating, genre, description, image]) => ({
  id,
  title,
  year,
  rating,
  genre,
  description,
  image,
}))

const fallbackSeries = [
  [
    'harbor-line',
    'Harbor Line',
    '2025',
    'TV-14',
    'Crime Drama',
    'A harbor detective follows a missing-person case that reaches into the city’s most powerful family.',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'after-dark',
    'After Dark',
    '2024',
    'TV-MA',
    'Mystery',
    'Every night at midnight, a different resident of a quiet town receives the same impossible voicemail.',
    'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'signal-nine',
    'Signal Nine',
    '2026',
    'TV-14',
    'Sci-Fi',
    'A small team discovers that a signal from deep space has been predicting disasters on Earth.',
    'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=85',
  ],
  [
    'highwater',
    'Highwater',
    '2025',
    'TV-14',
    'Survival Drama',
    'When a flood cuts off a coastal town, four strangers must decide what they are willing to sacrifice to get home.',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=85',
  ],
].map(([id, title, year, rating, genre, description, image]) => ({
  id,
  title,
  year,
  rating,
  genre,
  description,
  image,
  type: 'series',
}))

// Open-animation releases: used here instead of copying Netflix footage.
const trailers = [
  {
    title: 'Spider-Man: Across the Spider-Verse',
    detail: '2023 · Action · Animation',
    description:
      'Miles Morales is launched across the Multiverse, where he must decide what it truly means to be a hero.',
    videoId: 'shW9i6k8cB0',
    backdrop: 'https://image.tmdb.org/t/p/original/kVd3a9YeLGkoeR50jGEXM6EqseS.jpg',
  },
  {
    title: 'Outer Banks',
    detail: '2023 · TV-MA · Adventure',
    description:
      'The Pogues chase a legendary treasure while navigating friendship, family secrets, and dangerous rivals along the Carolina coast.',
    videoId: 'SuqZPVPxsZE',
    backdrop: 'https://image.tmdb.org/t/p/original/fGk5GVPP7qfEHr8b9pzS6AWsOmV.jpg',
  },
  {
    title: 'The Fantastic Four: First Steps',
    detail: '2025 · Sci-Fi · Adventure',
    description:
      'Marvel’s first family is pulled into a cosmic crisis that tests their powers, their bond, and the future of their world.',
    videoId: 'pAsmrKyMqaA',
    backdrop: 'https://image.tmdb.org/t/p/original/s94NjfKkcSczZ1FembwmQZwsuwY.jpg',
  },
  {
    title: 'Superman',
    detail: '2025 · Action · Drama',
    description:
      'A young Clark Kent learns to balance his extraordinary powers with the compassion that makes him human.',
    videoId: '2woCZg5QdVE',
    backdrop: 'https://image.tmdb.org/t/p/original/eGX66zonvc4bXg3rM08RUxdYSDx.jpg',
  },
]

function toTmdbMovie(item, type) {
  const title = type === 'series' ? item.name : item.title
  const year =
    (type === 'series' ? item.first_air_date : item.release_date || '').slice(0, 4) || 'New'
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : FALLBACK_POSTER
  const backdrop = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : poster

  return {
    id: `tmdb-${type}-${item.id}`,
    tmdbID: item.id,
    title,
    year,
    rating: type === 'series' ? 'TV Series' : 'Movie',
    type,
    genre: type === 'series' ? 'TV Series' : 'Movie',
    description: item.overview || 'Select this title to view more information.',
    image: poster,
    poster,
    backdrop,
    seasons: type === 'series' ? item.number_of_seasons : undefined,
  }
}

async function tmdbRequest(path) {
  const response = await fetch(`${TMDB_URL}${path}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
  })
  if (!response.ok) throw new Error('TMDB request failed')
  return response.json()
}

export default function App() {
  return (
    <HashRouter>
      <StreamingApp />
    </HashRouter>
  )
}

function StreamingApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const [routeLoading, setRouteLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(false)
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [apiMovies, setApiMovies] = useState([])
  const [upcomingTitles, setUpcomingTitles] = useState([])
  const [apiStatus, setApiStatus] = useState('')
  const [trailerIndex, setTrailerIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [mobileTrailerPlaying, setMobileTrailerPlaying] = useState(false)
  const heroPlayer = useRef(null)
  const heroTouch = useRef(null)
  const suppressHeroClick = useRef(false)
  const [search, setSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [customMovies, setCustomMovies] = useState([])
  const [myList, setMyList] = useState(() =>
    JSON.parse(localStorage.getItem('netflix-list') || '[]')
  )

  useEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    setRouteLoading(true)
    const timer = window.setTimeout(() => setRouteLoading(false), 420)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  useEffect(() => onAuthStateChanged(auth, setUser), [])
  useEffect(() => localStorage.setItem('netflix-list', JSON.stringify(myList)), [myList])
  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'profiles', user.uid),
      (snapshot) => {
        if (snapshot.exists() && Array.isArray(snapshot.data().myList))
          setMyList(snapshot.data().myList)
      },
      () => {
        /* Local storage stays available if Firestore has not been enabled yet. */
      }
    )
  }, [user])
  useEffect(() => {
    if (!user) return
    return onSnapshot(
      collection(db, 'titles'),
      (snapshot) => {
        setCustomMovies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      },
      () => {
        /* The app continues to work until the database is enabled. */
      }
    )
  }, [user])
  useEffect(() => {
    if ((!user && !guest) || !tmdbToken) return
    async function loadMovies() {
      setApiStatus('Loading live movies and TV shows…')
      try {
        const [popularMovies, popularSeries, topRatedSeries, trending, upcoming, upcomingShows, outerBanks, familyGuy] =
          await Promise.all([
            Promise.all([1, 2, 3].map((page) => tmdbRequest(`/movie/popular?page=${page}`))),
            Promise.all([1, 2, 3].map((page) => tmdbRequest(`/tv/popular?page=${page}`))),
            Promise.all([1, 2].map((page) => tmdbRequest(`/tv/top_rated?page=${page}`))),
            tmdbRequest('/trending/all/week'),
            Promise.all([1, 2].map((page) => tmdbRequest(`/movie/upcoming?page=${page}`))),
            Promise.all([1, 2].map((page) => tmdbRequest(`/tv/on_the_air?page=${page}`))),
            tmdbRequest('/tv/100757'),
            tmdbRequest('/tv/1434'),
          ])
        const movies = popularMovies.flatMap((page) => page.results)
          .filter(isStreamworthy)
          .map((item) => toTmdbMovie(item, 'movie'))
        const seriesResults = popularSeries.flatMap((page) => page.results)
          .filter(isStreamworthy)
          .map((item) => toTmdbMovie(item, 'series'))
        const topSeries = topRatedSeries.flatMap((page) => page.results)
          .filter(isStreamworthy)
          .map((item) => toTmdbMovie(item, 'series'))
        const trendingResults = trending.results
          .filter(
            (item) =>
              (item.media_type === 'movie' || item.media_type === 'tv') && isStreamworthy(item)
          )
          .slice(0, 6)
          .map((item) => toTmdbMovie(item, item.media_type === 'tv' ? 'series' : 'movie'))
        const requestedSeries = [outerBanks, familyGuy]
          .filter(isStreamworthy)
          .map((item) => toTmdbMovie(item, 'series'))
        const upcomingResults = [
          ...upcoming.flatMap((page) => page.results).map((item) => toTmdbMovie(item, 'movie')),
          ...upcomingShows
            .flatMap((page) => page.results)
            .map((item) => toTmdbMovie(item, 'series')),
        ]
          .filter(isStreamworthy)
          .filter(
            (title, index, titles) => titles.findIndex((item) => item.id === title.id) === index
          )
        const uniqueTitles = [
          ...requestedSeries,
          ...trendingResults,
          ...movies,
          ...seriesResults,
          ...topSeries,
        ].filter(
          (title, index, titles) => titles.findIndex((item) => item.id === title.id) === index
        )
        setApiMovies(uniqueTitles)
        setUpcomingTitles(upcomingResults)
        setApiStatus(`${uniqueTitles.length} live movies and TV series powered by TMDB`)
      } catch {
        setApiStatus('Live titles are unavailable right now — showing the demo collection.')
      }
    }
    loadMovies()
  }, [user, guest])

  async function handleAuth(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (register) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''))
    } finally {
      setLoading(false)
    }
  }

  async function openMovie(movie) {
    setSelected(movie)
    navigate(`/title/${movie.id}`)
    if (movie.tmdbID && tmdbToken) {
      try {
        const kind = movie.type === 'series' ? 'tv' : 'movie'
        const [details, season] = await Promise.all([
          tmdbRequest(`/${kind}/${movie.tmdbID}?append_to_response=videos`),
          movie.type === 'series'
            ? tmdbRequest(`/tv/${movie.tmdbID}/season/1`)
            : Promise.resolve(null),
        ])
        const trailer = details.videos?.results?.find(
          (video) => video.site === 'YouTube' && video.type === 'Trailer'
        )
        setSelected({
          ...movie,
          image: details.poster_path
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
            : movie.poster || movie.image || FALLBACK_POSTER,
          poster: details.poster_path
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
            : movie.poster || movie.image || FALLBACK_POSTER,
          backdrop: details.backdrop_path
            ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
            : movie.backdrop || movie.image || FALLBACK_POSTER,
          description: details.overview || movie.description,
          genre: details.genres?.map((genre) => genre.name).join(', ') || movie.genre,
          rating: details.vote_average ? `★ ${details.vote_average.toFixed(1)}` : movie.rating,
          trailerId: trailer?.key,
          seasons: details.number_of_seasons,
          episodes: season?.episodes?.map((episode) => ({
            title: episode.name,
            runtime: episode.runtime || 45,
            overview: episode.overview,
          })),
        })
      } catch {
        /* The basic title information still remains available. */
      }
      return
    }
  }

  const toggle = (id) =>
    setMyList((list) => {
      const nextList = list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
      if (user)
        setDoc(
          doc(db, 'profiles', user.uid),
          { myList: nextList, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => {})
      return nextList
    })
  const feature = trailers[trailerIndex]
  const isMobileViewport = window.matchMedia('(max-width: 700px)').matches
  useEffect(() => setMobileTrailerPlaying(false), [trailerIndex])
  const allMovies = useMemo(
    () =>
      [
        ...customMovies,
        ...(apiMovies.length ? apiMovies : [...fallbackMovies, ...fallbackSeries]),
      ].filter(isStreamworthy),
    [customMovies, apiMovies]
  )
  const movieOnly = allMovies.filter((movie) => movie.type !== 'series')
  const series = allMovies.filter((movie) => movie.type === 'series')
  const outerBanks = series.find((movie) => movie.title === 'Outer Banks')
  const familyGuy = series.find((movie) => movie.title === 'Family Guy')
  const bingeSeries = [outerBanks, familyGuy, ...series].filter(
    (movie, index, titles) => movie && titles.findIndex((item) => item?.id === movie.id) === index
  )
  const dramaAndAction = [...movieOnly, ...series]
    .filter((movie) => !['Family Guy', 'The Simpsons'].includes(movie.title))
    .slice(0, 10)
  const comedyAndAnimation = [
    familyGuy,
    ...series.filter((movie) => /comedy|animation/i.test(movie.genre || '')),
  ].filter(
    (movie, index, titles) => movie && titles.findIndex((item) => item?.id === movie.id) === index
  )
  const savedMovies = allMovies.filter((movie) => myList.includes(movie.id))
  const searchResults = search.trim()
    ? allMovies.filter((movie) => movie.title.toLowerCase().includes(search.trim().toLowerCase()))
    : []
  const nextTrailer = () => setTrailerIndex((index) => (index + 1) % trailers.length)
  const previousTrailer = () =>
    setTrailerIndex((index) => (index - 1 + trailers.length) % trailers.length)
  const startHeroSwipe = (event) => {
    const touch = event.touches[0]
    heroTouch.current = { x: touch.clientX, y: touch.clientY }
  }
  const finishHeroSwipe = (event) => {
    if (!heroTouch.current) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - heroTouch.current.x
    const deltaY = touch.clientY - heroTouch.current.y
    heroTouch.current = null
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return
    suppressHeroClick.current = true
    window.setTimeout(() => {
      suppressHeroClick.current = false
    }, 450)
    if (deltaX < 0) nextTrailer()
    else previousTrailer()
  }

  useEffect(() => {
    const carouselTimer = window.setTimeout(
      () => setTrailerIndex((index) => (index + 1) % trailers.length),
      TRAILER_DISPLAY_MS
    )
    return () => window.clearTimeout(carouselTimer)
  }, [trailerIndex])

  useEffect(() => {
    const hero = document.querySelector('.video-hero')
    if (!hero) return
    const hitbox = document.createElement('button')
    hitbox.type = 'button'
    hitbox.className = 'hero-route-hitbox'
    hitbox.setAttribute('aria-label', `Open ${feature.title}`)
    function openFeaturedTrailer() {
      if (suppressHeroClick.current) {
        suppressHeroClick.current = false
        return
      }
      setSelected({ ...feature, isTrailer: true })
    }
    hitbox.addEventListener('click', openFeaturedTrailer)
    hero.append(hitbox)
    return () => hitbox.remove()
  })

  useEffect(() => {
    if (selected?.isTrailer && location.pathname === '/')
      navigate(`/title/featured-${selected.videoId}`)
  }, [selected, location.pathname, navigate])

  if (!user && !guest)
    return (
      <main className="auth-page">
        <header>
          <strong>NETFLIX</strong>
        </header>
        <form className="auth-card" onSubmit={handleAuth}>
          <h1>{register ? 'Create your account' : 'Sign in'}</h1>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            minLength="6"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="form-error">{error}</p>}
          <button className="primary" disabled={loading}>
            {loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
          <button type="button" className="guest-button" onClick={() => setGuest(true)}>
            Browse as guest
          </button>
          <p>
            {register ? 'Already have an account?' : 'New to Netflix?'}{' '}
            <button type="button" className="text-button" onClick={() => setRegister(!register)}>
              {register ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </form>
      </main>
    )

  if (routeLoading) return <StreamingRouteSkeleton />

  if (location.pathname === '/admin') return <AdminPanel user={user} close={() => navigate('/')} />

  const routeId = location.pathname.split('/')[2]
  const routedMovie = routeId
    ? allMovies.find((movie) => movie.id === routeId) ||
      (routeId === `featured-${feature.videoId}`
        ? {
            ...feature,
            id: routeId,
            type: 'movie',
            year: feature.detail?.slice(0, 4) || 'New',
            rating: 'PG-13',
            genre: feature.detail?.split('·').slice(1).join('·').trim() || 'Featured',
            image:
              'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85',
            trailerId: feature.videoId,
          }
        : null)
    : null
  if (routedMovie)
    return (
      <TitleLandingPage
        key={routedMovie.id}
        movie={selected?.id === routeId ? selected : routedMovie}
        relatedMovies={allMovies.filter((item) => item.id !== routedMovie.id).slice(0, 6)}
        openMovie={openMovie}
        back={() => {
          setSelected(null)
          navigate('/')
        }}
        inList={myList.includes(routedMovie.id)}
        toggle={toggle}
      />
    )

  if (isMobileViewport)
    {
      const mobileSection =
        location.pathname === '/shows'
          ? 'Shows'
          : location.pathname === '/movies'
            ? 'Movies'
            : location.pathname === '/new-hot'
              ? 'New & Hot'
              : location.pathname === '/notifications'
                ? 'Notifications'
                : location.pathname === '/search'
                  ? 'Search'
                  : location.pathname === '/my-netflix'
                    ? 'My Netflix'
              : 'Home'
      const mobileFeatures =
        mobileSection === 'Shows'
          ? bingeSeries.slice(0, 4)
          : mobileSection === 'Movies'
            ? movieOnly.slice(0, 4)
            : mobileSection === 'New & Hot'
              ? dramaAndAction.slice(0, 4)
              : mobileSection === 'Notifications'
                ? upcomingTitles.slice(0, 4)
                : mobileSection === 'My Netflix'
                  ? savedMovies.slice(0, 4)
                  : mobileSection === 'Search' && searchResults.length
                    ? searchResults.slice(0, 4)
              : [movieOnly[0], ...bingeSeries.slice(0, 3)].filter(Boolean)
      const mobileRows =
        mobileSection === 'Notifications'
          ? [['Coming Soon', upcomingTitles]]
          : mobileSection === 'New & Hot'
            ? [['Trending Now', dramaAndAction], ['Coming Soon', upcomingTitles]]
          : mobileSection === 'My Netflix'
            ? [['My List', savedMovies]]
            : mobileSection === 'Search'
              ? [[search ? `Results for “${search}”` : 'Browse the catalog', search ? searchResults : allMovies]]
              : mobileSection === 'Shows'
                ? [['Popular Shows', series], ['Binge-Worthy Series', bingeSeries]]
                : mobileSection === 'Movies'
                  ? [['Popular Movies', movieOnly], ['Action, Drama & Adventure', dramaAndAction]]
                  : [
                      ['Binges That Blow Up the Group Chat', bingeSeries],
                      ['Popular Movies', movieOnly],
                      ['Action, Drama & Adventure', dramaAndAction],
                      ['Comedy & Animation', comedyAndAnimation],
                    ]
      return (
      <MobileNetflixHome
        key={location.pathname}
        section={mobileSection}
        features={
          mobileFeatures.length || ['My Netflix', 'Search', 'Notifications'].includes(mobileSection)
            ? mobileFeatures
            : allMovies.slice(0, 4)
        }
        rows={mobileRows}
        openMovie={openMovie}
        inList={(id) => myList.includes(id)}
        toggle={toggle}
        navigate={navigate}
        search={search}
        setSearch={setSearch}
        signOutUser={() => (user ? signOut(auth) : setGuest(false))}
      />
    )
    }

  return (
    <main className="app-shell">
      <header className="nav">
        <strong>NETFLIX</strong>
        <nav
          id="netflix-navigation"
          onClick={(event) => {
            if (event.target.closest('a')) setProfileOpen(false)
          }}
        >
          <a href="#home">Home</a>
          <a href="#new">New & Popular</a>
          <a href="#list">My List</a>
          <button
            className="mobile-account-action"
            onClick={() => (user ? signOut(auth) : setGuest(false))}
          >
            Sign out
          </button>
        </nav>
        <form className="search" onSubmit={(event) => event.preventDefault()}>
          <span>⌕</span>
          <input
            aria-label="Search titles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Titles, people, genres"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </form>
        <div className="profile">
          <button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
            aria-label={
              profileOpen ? 'Close navigation and account menu' : 'Open navigation and account menu'
            }
            aria-controls="netflix-navigation"
          >
            <span>N</span>⌄
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <p>{user?.email || 'Guest profile'}</p>
              {user && (
                <button
                  onClick={() => {
                    navigate('/admin')
                    setProfileOpen(false)
                  }}
                >
                  Content admin
                </button>
              )}
              <button onClick={() => (user ? signOut(auth) : setGuest(false))}>
                Sign out of Netflix
              </button>
            </div>
          )}
        </div>
      </header>
      {search && (
        <Row
          title={`Search results for “${search}”`}
          movies={searchResults}
          select={openMovie}
          empty="No matching titles in the current collection."
        />
      )}
      <section
        className="video-hero"
        id="home"
        style={{
          backgroundImage: 'linear-gradient(115deg, #080808 0%, #151515 58%, #24090b 100%)',
        }}
        onTouchStart={startHeroSwipe}
        onTouchEnd={finishHeroSwipe}
        onTouchCancel={() => {
          heroTouch.current = null
        }}
      >
        <TrailerPlayer
          ref={heroPlayer}
          videoId={feature.videoId}
          className="hero-video"
          title={`${feature.title} video`}
          onMutedChange={setMuted}
          onPlayingChange={setMobileTrailerPlaying}
        />
        {isMobileViewport && !mobileTrailerPlaying && (
          <img className="mobile-hero-poster" src={feature.backdrop} alt="" />
        )}
        <div className="hero-shade" />
        <div className="hero-copy" key={feature.videoId}>
          <p className="eyebrow">FEATURED TRAILER</p>
          <h1>{feature.title}</h1>
          <p className="feature-meta">{feature.detail}</p>
          <p>{feature.description}</p>
          <button className="primary" onClick={() => setSelected({ ...feature, isTrailer: true })}>
            <ControlIcon name="play" /> Play
          </button>
          <button
            className="secondary"
            onClick={() =>
              isMobileViewport
                ? heroPlayer.current?.togglePlayback()
                : heroPlayer.current?.toggleSound()
            }
          >
            <ControlIcon
              name={
                isMobileViewport
                  ? mobileTrailerPlaying
                    ? 'pause'
                    : 'play'
                  : muted
                    ? 'muted'
                    : 'sound'
              }
            />{' '}
            {isMobileViewport
              ? mobileTrailerPlaying
                ? 'Pause trailer'
                : 'Play trailer'
              : muted
                ? 'Turn sound on'
                : 'Mute'}
          </button>
          <button className="secondary" onClick={nextTrailer}>
            Next suggestion ›
          </button>
        </div>
        <div className="trailer-controls">
          <button aria-label="Previous trailer" onClick={previousTrailer}>
            ‹
          </button>
          {trailers.map((trailer, index) => (
            <button
              className={index === trailerIndex ? 'active-dot' : ''}
              aria-label={`Show ${trailer.title}`}
              key={trailer.videoId}
              onClick={() => setTrailerIndex(index)}
            />
          ))}
          <button aria-label="Next trailer" onClick={nextTrailer}>
            ›
          </button>
        </div>
      </section>
      <Row title="Popular Movies" movies={movieOnly.slice(0, 10)} select={openMovie} />
      <section className="api-note" id="new">
        <span className="live-dot" /> {apiStatus || 'Sign in to load live content from TMDB.'}
      </section>
      <Row
        title="Binge-Worthy Series"
        movies={bingeSeries.slice(0, 12)}
        select={openMovie}
        empty="Series will appear here when the live catalog finishes loading."
      />
      <Row title="Action, Drama & Adventure" movies={dramaAndAction} select={openMovie} />
      <Row
        title="Comedy & Animation"
        movies={comedyAndAnimation.slice(0, 10)}
        select={openMovie}
        empty="More comedies are loading now."
      />
      <Row id="list" title="My List" movies={savedMovies} select={openMovie} />
      <footer>Built with React, JavaScript, CSS, Firebase Authentication, and the TMDB API.</footer>
      {selected && (
        <MovieModal
          movie={selected}
          close={() => {
            setSelected(null)
            navigate('/')
          }}
          inList={myList.includes(selected.id || selected.videoId)}
          toggle={toggle}
        />
      )}
    </main>
  )
}

function StreamingRouteSkeleton() {
  return (
    <main
      className="route-skeleton route-skeleton--netflix"
      aria-busy="true"
      aria-label="Loading page"
    >
      <header className="route-skeleton__nav">
        <span className="route-skeleton__brand" />
        <span className="route-skeleton__nav-item" />
        <span className="route-skeleton__nav-item" />
        <span className="route-skeleton__search" />
      </header>
      <section className="route-skeleton__hero">
        <span className="route-skeleton__eyebrow" />
        <span className="route-skeleton__title" />
        <span className="route-skeleton__title route-skeleton__title--short" />
        <span className="route-skeleton__copy" />
        <span className="route-skeleton__copy route-skeleton__copy--short" />
        <span className="route-skeleton__button" />
      </section>
      <section className="route-skeleton__row">
        <span className="route-skeleton__row-title" />
        <div className="route-skeleton__cards">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="route-skeleton__card" key={index} />
          ))}
        </div>
      </section>
    </main>
  )
}

function MobileNetflixHome({ section, features, rows, openMovie, inList, toggle, navigate, search, setSearch, signOutUser }) {
  const featureTrack = useRef(null)
  const featureIndex = useRef(0)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const track = featureTrack.current
      if (!track || features.length < 2) return
      featureIndex.current = (featureIndex.current + 1) % features.length
      track.scrollTo({
        left: featureIndex.current * (track.clientWidth - 20),
        behavior: 'smooth',
      })
    }, 6500)
    return () => window.clearInterval(timer)
  }, [features.length])
  const routes = [
    ['Shows', '/shows'],
    ['Movies', '/movies'],
    ['New & Hot', '/new-hot'],
  ]
  return (
    <main className="mobile-netflix-home mobile-netflix-page-slide">
      <header className="mobile-netflix-header">
        <div className="mobile-netflix-brandline">
          <strong onClick={() => navigate('/')}>NETFLIX</strong>
          {section !== 'Home' && <h1>{section}</h1>}
        </div>
        <button className="mobile-netflix-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Open account menu">{menuOpen ? '×' : '☰'}</button>
        {menuOpen && (
          <div className="mobile-netflix-menu">
            <button onClick={() => { navigate('/notifications'); setMenuOpen(false) }}>Notifications</button>
            <button onClick={signOutUser}>Sign out</button>
          </div>
        )}
      </header>
      <nav className="mobile-netflix-filters" aria-label="Browse Netflix">
        {routes.map(([label, path]) => (
          <button className={section === label ? 'active' : ''} key={path} onClick={() => navigate(path)}>{label}</button>
        ))}
      </nav>
      {section === 'Search' && (
        <form className="mobile-netflix-search" onSubmit={(event) => event.preventDefault()}>
          <span>⌕</span>
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search movies and shows" aria-label="Search movies and shows" />
          {search && <button type="button" onClick={() => setSearch('')}>×</button>}
        </form>
      )}
      {section === 'Notifications' && <p className="mobile-netflix-route-note">Upcoming movies and shows</p>}
      {section === 'My Netflix' && !features.length && <p className="mobile-netflix-empty">Titles you add to My List will appear here.</p>}
      {!!features.length && <section ref={featureTrack} className="mobile-netflix-feature-track" aria-label="Featured titles">
        {features.map((feature) => (
          <article className="mobile-netflix-feature" key={feature.id}>
            <button className="mobile-netflix-feature-image" onClick={() => openMovie(feature)}>
              <img src={feature.poster || feature.image} alt={`${feature.title} poster`} />
              <span className="mobile-netflix-feature-gradient" />
              <strong>{feature.title}</strong>
              <small>{feature.genre || 'Featured today'}</small>
            </button>
            <div className="mobile-netflix-feature-actions">
              <button className="mobile-netflix-play" onClick={() => openMovie(feature)}>
                <ControlIcon name="play" /> Play
              </button>
              <button onClick={() => toggle(feature.id)}>
                <ControlIcon name={inList(feature.id) ? 'check' : 'plus'} /> My List
              </button>
            </div>
          </article>
        ))}
      </section>}
      {rows.map(([title, movies]) => (
        <MobileNetflixRow key={title} title={title} movies={movies} openMovie={openMovie} />
      ))}
      <nav className="mobile-netflix-bottom" aria-label="Netflix app navigation">
        <button className={section === 'Home' ? 'active' : ''} onClick={() => navigate('/')}><span>⌂</span>Home</button>
        <button className={section === 'Search' ? 'active' : ''} onClick={() => navigate('/search')}><span>⌕</span>Search</button>
        <button className={section === 'My Netflix' ? 'active' : ''} onClick={() => navigate('/my-netflix')}><span className="mobile-netflix-avatar">N</span>My Netflix</button>
      </nav>
    </main>
  )
}

function MobileNetflixRow({ title, movies, openMovie }) {
  if (!movies.length) return null
  const upcoming = title === 'Coming Soon'
  return (
    <section className={`mobile-netflix-row${upcoming ? ' mobile-netflix-upcoming' : ''}`}>
      <h2>{title}</h2>
      <div>
        {movies.map((movie) => (
          <button key={movie.id} onClick={() => openMovie(movie)}>
            <img src={movie.poster || movie.image} alt={`${movie.title} poster`} />
            {upcoming && <span><strong>{movie.title}</strong><small>{movie.year} · Coming soon</small></span>}
          </button>
        ))}
      </div>
    </section>
  )
}

function Row({ title, movies, select, empty, id }) {
  const cardsRef = useRef(null)
  const scrollRow = (direction) =>
    cardsRef.current?.scrollBy({
      left: direction * Math.max(cardsRef.current.clientWidth * 0.8, 320),
      behavior: 'smooth',
    })
  return (
    <section className="row" id={id}>
      <h2>{title}</h2>
      {movies.length ? (
        <div className="row-carousel">
          <button
            className="row-scroll-control row-scroll-control--previous"
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollRow(-1)}
          >
            ‹
          </button>
          <div className="cards" ref={cardsRef}>
            {movies.map((movie) => (
              <button className="movie-card" key={movie.id} onClick={() => select(movie)}>
                <img src={movie.image} alt={`${movie.title} poster`} />
                <span>{movie.title}</span>
              </button>
            ))}
          </div>
          <button
            className="row-scroll-control row-scroll-control--next"
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollRow(1)}
          >
            ›
          </button>
        </div>
      ) : empty && title !== 'My List' ? (
        <p className="empty">{empty}</p>
      ) : null}
    </section>
  )
}

function TitleLandingPage({ movie, relatedMovies, openMovie, back, inList, toggle }) {
  const [title, setTitle] = useState(movie)
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState(movie.episodes || [])
  const [titleMuted, setTitleMuted] = useState(false)
  const [titlePlaying, setTitlePlaying] = useState(false)
  const titlePlayer = useRef(null)

  useEffect(() => {
    if (!movie.tmdbID || !tmdbToken) return
    const kind = movie.type === 'series' ? 'tv' : 'movie'
    Promise.all([
      tmdbRequest(`/${kind}/${movie.tmdbID}?append_to_response=videos`),
      movie.type === 'series' ? tmdbRequest(`/tv/${movie.tmdbID}/season/1`) : Promise.resolve(null),
    ])
      .then(([details, firstSeason]) => {
        const trailer = details.videos?.results?.find(
          (video) => video.site === 'YouTube' && video.type === 'Trailer'
        )
        setTitle({
          ...movie,
          image: details.poster_path
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
            : movie.poster || movie.image || FALLBACK_POSTER,
          poster: details.poster_path
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
            : movie.poster || movie.image || FALLBACK_POSTER,
          description: details.overview || movie.description,
          genre: details.genres?.map((genre) => genre.name).join(', ') || movie.genre,
          rating: details.vote_average ? `★ ${details.vote_average.toFixed(1)}` : movie.rating,
          trailerId: trailer?.key,
          backdrop: details.backdrop_path
            ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
            : movie.backdrop || movie.image || FALLBACK_POSTER,
          seasons: details.number_of_seasons || 1,
        })
        setEpisodes(firstSeason?.episodes || [])
      })
      .catch(() => {})
  }, [movie])

  useEffect(() => {
    if (title.type !== 'series' || !title.tmdbID) return
    tmdbRequest(`/tv/${title.tmdbID}/season/${season}`)
      .then((data) => setEpisodes(data.episodes || []))
      .catch(() => {})
  }, [title.tmdbID, title.type, season])

  const episodeList = episodes.length
    ? episodes
    : ['A new beginning', 'The unexpected signal', 'Into the unknown'].map((name, index) => ({
        name,
        runtime: 45 + index * 2,
        overview: 'Continue the story in this episode.',
      }))

  if (window.matchMedia('(max-width: 700px)').matches)
    return (
      <MobileNetflixTitle
        title={title}
        back={back}
        inList={inList}
        toggle={toggle}
        player={titlePlayer}
        playing={titlePlaying}
        setPlaying={setTitlePlaying}
        muted={titleMuted}
        setMuted={setTitleMuted}
        relatedMovies={relatedMovies}
        openMovie={openMovie}
      />
    )

  return (
    <main className="title-page">
      <header className="title-nav">
        <strong>NETFLIX</strong>
        <button onClick={back}>← Back to browse</button>
        <button className="secondary" onClick={() => toggle(movie.id)}>
          {inList ? '✓ In My List' : '+ My List'}
        </button>
      </header>
      <section
        className="title-hero-page"
        style={{
          backgroundImage: `linear-gradient(90deg, #080808 4%, rgba(8,8,8,.72) 38%, rgba(8,8,8,.12)), linear-gradient(0deg, #080808 0%, transparent 52%), url(${title.backdrop || title.image})`,
        }}
      >
        {title.trailerId && (
          <TrailerPlayer
            ref={titlePlayer}
            videoId={title.trailerId}
            className="title-trailer"
            title={`${title.title} trailer`}
            onMutedChange={setTitleMuted}
          />
        )}
        <div className="title-hero-content">
          <p className="eyebrow">{title.type === 'series' ? 'NETFLIX SERIES' : 'FEATURED FILM'}</p>
          <h1>{title.title}</h1>
          <p className="title-meta">
            {title.year} · {title.rating} · {title.genre}
          </p>
          <p>{title.description}</p>
          {title.trailerId && (
            <>
              <button className="primary" onClick={() => titlePlayer.current?.toggleSound()}>
                <ControlIcon name={titleMuted ? 'muted' : 'sound'} />{' '}
                {titleMuted ? 'Turn sound on' : 'Mute trailer'}
              </button>
              <a
                className="secondary title-watch-link"
                href={`https://www.youtube.com/watch?v=${title.trailerId}`}
                target="_blank"
                rel="noreferrer"
              >
                <ControlIcon name="play" /> Watch full trailer
              </a>
            </>
          )}
          <button className="secondary" onClick={() => toggle(movie.id)}>
            {inList ? '✓ In My List' : '+ My List'}
          </button>
        </div>
      </section>
      <section className="title-details">
        <img
          src={title.poster || title.image || FALLBACK_POSTER}
          alt={`${title.title} poster`}
          onError={(event) => {
            event.currentTarget.src = FALLBACK_POSTER
          }}
        />
        <div>
          <h2>About {title.title}</h2>
          <p>{title.description}</p>
          <p className="title-cast">
            {title.type === 'series'
              ? `${title.seasons || 1} season${(title.seasons || 1) === 1 ? '' : 's'} available`
              : 'Movie'}{' '}
            · {title.genre}
          </p>
        </div>
      </section>
      {title.type === 'series' && (
        <section className="title-episodes">
          <div className="episode-heading">
            <h2>Episodes</h2>
            <select value={season} onChange={(event) => setSeason(Number(event.target.value))}>
              {Array.from({ length: title.seasons || 1 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Season {index + 1}
                </option>
              ))}
            </select>
          </div>
          {episodeList.map((episode, index) => (
            <article className="title-episode" key={`${episode.id || episode.name}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <h3>{episode.name}</h3>
                <small>{episode.runtime || 45}m</small>
                <p>{episode.overview || 'Continue the story in this episode.'}</p>
              </div>
              <b>
                <ControlIcon name="play" />
              </b>
            </article>
          ))}
        </section>
      )}
      <footer>Streaming-clone portfolio project. Movie and TV data provided by TMDB.</footer>
    </main>
  )
}

function MobileNetflixTitle({
  title,
  back,
  inList,
  toggle,
  player,
  playing,
  setPlaying,
  muted,
  setMuted,
  relatedMovies,
  openMovie,
}) {
  const togglePlayback = () => {
    player.current?.togglePlayback()
  }
  return (
    <main className="mobile-netflix-title mobile-netflix-page-slide">
      <section className="mobile-title-media">
        {title.trailerId ? (
          <TrailerPlayer
            ref={player}
            videoId={title.trailerId}
            className="mobile-title-video"
            title={`${title.title} trailer`}
            onPlayingChange={setPlaying}
            onMutedChange={setMuted}
            autoPlay
          />
        ) : (
          <img src={title.backdrop || title.image} alt="" />
        )}
        <button className="mobile-title-close" onClick={back} aria-label="Close title">×</button>
        {title.trailerId && (
          <button
            className="mobile-title-sound"
            onClick={() => player.current?.toggleSound()}
            aria-label={muted ? 'Turn trailer sound on' : 'Mute trailer'}
          >
            <ControlIcon name={muted ? 'muted' : 'sound'} />
          </button>
        )}
      </section>
      <section className="mobile-title-copy">
        <h1>{title.title}</h1>
        <p className="mobile-title-meta">{title.year} <span>{title.rating}</span> {title.type === 'series' ? `${title.seasons || 1} Season${(title.seasons || 1) === 1 ? '' : 's'}` : 'Movie'} <b>HD</b></p>
        {title.trailerId && (
          <button className="mobile-title-primary" onClick={togglePlayback}>
            <ControlIcon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play'}
          </button>
        )}
        <button className="mobile-title-download"><span>⇩</span> Download</button>
        <p className="mobile-title-description">{title.description}</p>
        <p className="mobile-title-cast">Genres: {title.genre}</p>
        <div className="mobile-title-actions">
          <button onClick={() => toggle(title.id)}><ControlIcon name={inList ? 'check' : 'plus'} /><span>My List</span></button>
          <button><ControlIcon name="like" /><span>Rate</span></button>
          <button><span className="mobile-share-icon">⌁</span><span>Share</span></button>
        </div>
        <div className="mobile-title-rule" />
        <h2>More Like This</h2>
        <div className="mobile-title-suggestions">
          {relatedMovies.slice(0, 3).map((movie) => (
            <button key={movie.id} onClick={() => openMovie(movie)}>
              <img
                src={movie.poster || movie.image || FALLBACK_POSTER}
                alt={`${movie.title} poster`}
              />
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function MovieModal({ movie, close, inList, toggle }) {
  const [season, setSeason] = useState(1)
  const [loadedEpisodes, setLoadedEpisodes] = useState(movie.episodes || [])
  const [ratings, setRatings] = useState(() =>
    JSON.parse(localStorage.getItem('netflix-ratings') || '{}')
  )
  const rating = ratings[movie.id] || ''
  const listId = movie.id || movie.videoId
  useEffect(() => {
    if (movie.type !== 'series' || !movie.tmdbID) return
    let active = true
    tmdbRequest(`/tv/${movie.tmdbID}/season/${season}`)
      .then((data) => {
        if (active)
          setLoadedEpisodes(
            data.episodes?.map((episode) => ({
              title: episode.name,
              runtime: episode.runtime || 45,
              overview: episode.overview,
            })) || []
          )
      })
      .catch(() => {
        if (active) setLoadedEpisodes([])
      })
    return () => {
      active = false
    }
  }, [movie.id, movie.tmdbID, movie.type, movie.episodes, season])
  function rate(value) {
    const nextRatings = { ...ratings, [movie.id]: value }
    setRatings(nextRatings)
    localStorage.setItem('netflix-ratings', JSON.stringify(nextRatings))
  }
  if (movie.isTrailer)
    return (
      <div className="modal-backdrop" onClick={close}>
        <article className="movie-modal video-modal" onClick={(event) => event.stopPropagation()}>
          <button className="close" onClick={close}>
            ×
          </button>
          <TrailerPlayer videoId={movie.videoId} title={`${movie.title} video`} controls />
        </article>
      </div>
    )
  const episodes = loadedEpisodes.length
    ? loadedEpisodes
    : [
        'A new beginning',
        'The unexpected signal',
        'Into the unknown',
        'The truth comes out',
        'No way back',
      ].map((title, index) => ({ title, runtime: 42 + index * 3 }))
  const seasonCount = movie.seasons || 3
  return (
    <div className="modal-backdrop" onClick={close}>
      <article className="movie-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>
        <img src={movie.image} alt={`${movie.title} poster`} />
        <div className="modal-copy">
          <h2>{movie.title}</h2>
          <p className="meta">
            {movie.year} · {movie.rating} · {movie.genre}
          </p>
          <p>{movie.description}</p>
          <div className="ratings" aria-label="Rate this title">
            <span>Rate this title</span>
            <button
              className={rating === 'down' ? 'selected-rating' : ''}
              onClick={() => rate('down')}
              title="Not for me"
            >
              <ControlIcon name="dislike" />
            </button>
            <button
              className={rating === 'up' ? 'selected-rating' : ''}
              onClick={() => rate('up')}
              title="Like"
            >
              <ControlIcon name="like" />
            </button>
            <button
              className={rating === 'love' ? 'selected-rating' : ''}
              onClick={() => rate('love')}
              title="Love this"
            >
              <ControlIcon name="heart" />
            </button>
          </div>
          {movie.trailerId && (
            <TrailerPlayer
              className="inline-trailer"
              videoId={movie.trailerId}
              title={`${movie.title} trailer`}
              controls
            />
          )}
          {movie.type === 'series' && (
            <section className="episode-panel">
              <div className="episode-heading">
                <h3>Episodes</h3>
                <select
                  value={season}
                  onChange={(event) => setSeason(Number(event.target.value))}
                  aria-label="Choose season"
                >
                  {Array.from({ length: seasonCount }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Season {index + 1}
                    </option>
                  ))}
                </select>
              </div>
              {episodes.map((episode, index) => (
                <button
                  className="episode"
                  key={`${episode.title}-${index}`}
                  onClick={() =>
                    window.alert(
                      `Playing ${movie.title} — Season ${season}, Episode ${index + 1}: ${episode.title}`
                    )
                  }
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{episode.title}</strong>
                    <small>
                      Season {season} · {episode.runtime || 45}m
                    </small>
                  </div>
                  <b>
                    <ControlIcon name="play" />
                  </b>
                </button>
              ))}
            </section>
          )}
          {movie.trailerId ? (
            <p className="trailer-ready">Trailer loaded from TMDB</p>
          ) : (
            <a
              className="primary video-link"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} official trailer`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <ControlIcon name="play" /> Watch trailer
            </a>
          )}
          <button className="secondary" onClick={() => toggle(listId)}>
            {inList ? '✓ In My List' : '+ My List'}
          </button>
        </div>
      </article>
    </div>
  )
}

function AdminPanel({ user, close }) {
  const [form, setForm] = useState({
    title: '',
    year: '2026',
    genre: 'Drama',
    type: 'movie',
    image: '',
    description: '',
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await addDoc(collection(db, 'titles'), {
        ...form,
        rating: form.type === 'series' ? 'TV-14' : 'PG-13',
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        image:
          form.image ||
          'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85',
      })
      setMessage('Title saved to your Firebase catalog.')
      setForm({
        title: '',
        year: '2026',
        genre: 'Drama',
        type: 'movie',
        image: '',
        description: '',
      })
    } catch {
      setMessage('Firestore needs to be enabled before titles can be saved.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <main className="admin-page">
      <header className="admin-nav">
        <strong>NETFLIX</strong>
        <button onClick={close}>← Back to browse</button>
      </header>
      <section className="admin-content">
        <p className="eyebrow">CONTENT MANAGEMENT</p>
        <h1>Add a title</h1>
        <p>Build your own streaming catalog with Firebase.</p>
        <form className="admin-form" onSubmit={submit}>
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Example: Night Shift"
            />
          </label>
          <div className="form-grid">
            <label>
              Year
              <input
                required
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value })}
              />
            </label>
            <label>
              Genre
              <input
                required
                value={form.genre}
                onChange={(event) => setForm({ ...form, genre: event.target.value })}
                placeholder="Thriller"
              />
            </label>
          </div>
          <label>
            Content type
            <select
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              <option value="movie">Movie</option>
              <option value="series">TV series</option>
            </select>
          </label>
          <label>
            Poster image URL <small>(optional)</small>
            <input
              value={form.image}
              onChange={(event) => setForm({ ...form, image: event.target.value })}
              placeholder="https://..."
            />
          </label>
          <label>
            Description
            <textarea
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Write a short description for your title."
            />
          </label>
          {message && <p className="admin-message">{message}</p>}
          <button className="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save title'}
          </button>
        </form>
      </section>
    </main>
  )
}
