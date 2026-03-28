import { useState, useRef, useEffect } from 'react'

const US_CITIES = [
  'Albany, NY', 'Albuquerque, NM', 'Anaheim, CA', 'Anchorage, AK', 'Arlington, TX',
  'Atlanta, GA', 'Aurora, CO', 'Austin, TX', 'Bakersfield, CA', 'Baltimore, MD',
  'Baton Rouge, LA', 'Birmingham, AL', 'Boise, ID', 'Boston, MA', 'Buffalo, NY',
  'Charlotte, NC', 'Chesapeake, VA', 'Chicago, IL', 'Chula Vista, CA', 'Cincinnati, OH',
  'Cleveland, OH', 'Colorado Springs, CO', 'Columbus, OH', 'Corpus Christi, TX',
  'Dallas, TX', 'Denver, CO', 'Detroit, MI', 'Durham, NC', 'El Paso, TX',
  'Fort Worth, TX', 'Fresno, CA', 'Garland, TX', 'Gilbert, AZ', 'Glendale, AZ',
  'Greensboro, NC', 'Henderson, NV', 'Hialeah, FL', 'Honolulu, HI', 'Houston, TX',
  'Indianapolis, IN', 'Irvine, CA', 'Irving, TX', 'Jacksonville, FL', 'Jersey City, NJ',
  'Kansas City, MO', 'Laredo, TX', 'Las Vegas, NV', 'Lexington, KY', 'Lincoln, NE',
  'Long Beach, CA', 'Los Angeles, CA', 'Louisville, KY', 'Lubbock, TX', 'Madison, WI',
  'Memphis, TN', 'Mesa, AZ', 'Miami, FL', 'Milwaukee, WI', 'Minneapolis, MN',
  'Nashville, TN', 'New Orleans, LA', 'New York, NY', 'Newark, NJ', 'Norfolk, VA',
  'North Las Vegas, NV', 'Oakland, CA', 'Oklahoma City, OK', 'Omaha, NE', 'Orlando, FL',
  'Philadelphia, PA', 'Phoenix, AZ', 'Pittsburgh, PA', 'Plano, TX', 'Portland, OR',
  'Raleigh, NC', 'Reno, NV', 'Richmond, VA', 'Riverside, CA', 'Sacramento, CA',
  'Saint Paul, MN', 'Salt Lake City, UT', 'San Antonio, TX', 'San Diego, CA',
  'San Francisco, CA', 'San Jose, CA', 'Santa Ana, CA', 'Scottsdale, AZ',
  'Seattle, WA', 'Spokane, WA', 'St. Louis, MO', 'Stockton, CA', 'Tampa, FL',
  'Tempe, AZ', 'Toledo, OH', 'Tucson, AZ', 'Tulsa, OK', 'Virginia Beach, VA',
  'Washington, DC', 'Wichita, KS', 'Winston-Salem, NC',
]

export default function CityInput({ value, onChange, placeholder, style }) {
  const [suggestions, setSuggestions] = useState([])
  const [focused, setFocused] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setSuggestions([])
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    if (v.length >= 2) {
      const q = v.toLowerCase()
      setSuggestions(
        US_CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 6)
      )
    } else {
      setSuggestions([])
    }
  }

  function pick(city) {
    onChange(city)
    setSuggestions([])
    setFocused(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        placeholder={placeholder || 'City, ST'}
        className="input"
        style={style}
        autoComplete="off"
      />
      {focused && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#181818', border: '1px solid #2a2a2a', borderTop: 'none',
          borderRadius: '0 0 8px 8px', overflow: 'hidden'
        }}>
          {suggestions.map(c => (
            <div
              key={c}
              onMouseDown={() => pick(c)}
              style={{
                padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
                color: '#ccc', borderBottom: '1px solid #1e1e1e',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#222'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
