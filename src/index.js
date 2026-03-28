// src/index.js
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Reset CSS minimal
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', -apple-system, sans-serif; background: #F7F5F0; color: #1A1714; }
  button, input, select, textarea { font-family: inherit; }
  a { color: inherit; text-decoration: none; }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
`
document.head.appendChild(style)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)
