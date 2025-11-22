import '../styles/globals.css'
import { AuthProvider } from '../lib/AuthContext'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <title>Web Template</title>
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  )
}
