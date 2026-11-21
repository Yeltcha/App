import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { ensureTemporal } from './lib/dates'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/big-shoulders/wght.css'
import '@fontsource-variable/big-shoulders-stencil/wght.css'
import './index.css'

await ensureTemporal()

const [{ AuthProvider }, { App }] = await Promise.all([import('./lib/auth'), import('./App')])

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
