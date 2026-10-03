import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'AI Fitness — Your training space',description:'Your personal fitness mirror: movement, coaching, and progress in one place.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
