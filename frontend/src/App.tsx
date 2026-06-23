import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Markets from './pages/Markets'
import MyBets from './pages/MyBets'
import Settle from './pages/Settle'
import HowItWorks from './pages/HowItWorks'

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<Markets />} />
        <Route path="/my-bets" element={<MyBets />} />
        <Route path="/settle" element={<Settle />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </BrowserRouter>
  )
}
