import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppErrorBoundary from './AppErrorBoundary'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Required #root mount element is missing')

createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
)
