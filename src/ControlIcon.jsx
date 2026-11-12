export default function ControlIcon({ name, ...props }) {
  const paths = {
    sound: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    like: <><path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7" /></>,
    dislike: <><path d="M7 14V3H3v11h4Zm0 0 5 8c2 0 3-1 2-4l-1-4h6a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-2H7" /></>,
  }
  return (
    <svg className="control-icon" width="18" height="18" viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke={name === 'play' ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'inline-block', verticalAlign: '-0.2em', flexShrink: 0 }} {...props}>
      {name === 'play' ? <path d="M6 3.5v17L21 12 6 3.5Z" /> : paths[name]}
    </svg>
  )
}
