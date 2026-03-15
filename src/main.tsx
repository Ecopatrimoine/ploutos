import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PWAUpdatePrompt />
  </React.StrictMode>,
)