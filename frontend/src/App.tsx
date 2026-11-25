import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import LinguaVoice from './pages/LinguaVoice'
import VoiceID from './pages/VoiceID'
import MeetingLens from './pages/MeetingLens'
import MeetingDetail from './pages/MeetingDetail'
import AudioLab from './pages/AudioLab'
import HistoryPage from './pages/History'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="linguavoice" element={<LinguaVoice />} />
              <Route path="voiceid" element={<VoiceID />} />
              <Route path="meetinglens" element={<MeetingLens />} />
              <Route path="meetings/:id" element={<MeetingDetail />} />
              <Route path="audio-lab" element={<AudioLab />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </MotionConfig>
  )
}
