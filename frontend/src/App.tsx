import { BrowserRouter, Routes, Route } from 'react-router-dom'
import {
  WalletProvider,
  WalletModalProvider,
  MidenWalletAdapter,
  WalletAdapterNetwork,
  PrivateDataPermission,
} from '@miden-sdk/miden-wallet-adapter'
import '@miden-sdk/miden-wallet-adapter/styles.css'
import NavBar from './components/NavBar'
import Markets from './pages/Markets'
import MyBets from './pages/MyBets'
import Settle from './pages/Settle'
import HowItWorks from './pages/HowItWorks'

const wallets = [new MidenWalletAdapter({ appName: 'Miden Weather Market' })]

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider
        wallets={wallets}
        network={WalletAdapterNetwork.Testnet}
        privateDataPermission={PrivateDataPermission.UponRequest}
        autoConnect
      >
        <WalletModalProvider>
          <NavBar />
          <Routes>
            <Route path="/" element={<Markets />} />
            <Route path="/my-bets" element={<MyBets />} />
            <Route path="/settle" element={<Settle />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
          </Routes>
        </WalletModalProvider>
      </WalletProvider>
    </BrowserRouter>
  )
}
