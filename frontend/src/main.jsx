import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { BranchProvider } from './context/BranchContext.jsx'
import BranchSelector from './components/BranchSelector.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <BranchProvider>
          <AuthProvider>
            <CartProvider>
              <App />
              <BranchSelector />
            </CartProvider>
          </AuthProvider>
        </BranchProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
