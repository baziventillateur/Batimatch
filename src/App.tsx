import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import ConsultationLayout from './pages/ConsultationLayout'
import DpgfTab from './pages/DpgfTab'
import OffersTab from './pages/OffersTab'
import OfferEditor from './pages/OfferEditor'
import CompareTab from './pages/CompareTab'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-sm" aria-label="Batimatch, retour aux consultations">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1B2A3A" />
        <rect x="6" y="19" width="5" height="7" fill="#F3F5F8" />
        <rect x="13.5" y="13" width="5" height="13" fill="#F3F5F8" />
        <rect x="21" y="8" width="5" height="18" fill="#F8E04E" />
      </svg>
      <span className="font-title text-[23px] leading-none font-bold tracking-[0.01em]">batimatch</span>
    </Link>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-dvh flex-col">
        <header className="no-print border-b border-line bg-sheet">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
            <Logo />
            <p className="hidden text-[13.5px] text-ink-3 sm:block">DPGF, offres et comparatif des entreprises</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pt-7">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/c/:cid" element={<ConsultationLayout />}>
              <Route index element={<Navigate to="dpgf" replace />} />
              <Route path="dpgf" element={<DpgfTab />} />
              <Route path="offres" element={<OffersTab />} />
              <Route path="offres/:oid" element={<OfferEditor />} />
              <Route path="comparatif" element={<CompareTab />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
