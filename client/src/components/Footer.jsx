import React, { useState } from 'react'
import emailjs from '@emailjs/browser'
import toast from 'react-hot-toast'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion' // For smooth animations
import confetti from 'canvas-confetti' // For the celebration
import { assets } from '../assets/assets'

const Footer = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  // Configuration - Replace with your actual IDs from EmailJS Dashboard

  const SERVICE_ID = "service_9vaednl"; 

  const TEMPLATE_ID = "template_lnqvnjl";

  const PUBLIC_KEY = "Z_My7oXZAahm0bJJO"; // Provided by you

  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#6366f1', '#a855f7', '#22c55e']
    });
  }

  const handleSubscribe = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setLoading(true)
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, { user_email: trimmed }, PUBLIC_KEY)
      
      // Success sequence
      setSubscribed(true)
      setEmail('')
      fireConfetti()
      toast.success("Welcome to the community!")
      
      // Reset after 10 seconds
      setTimeout(() => setSubscribed(false), 10000)
    } catch (err) {
      toast.error('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="px-6 md:px-16 lg:px-24 xl:px-32 pt-8 w-full text-gray-500 mt-20 border-t border-gray-200/50 dark:border-slate-800">
      <div className="flex flex-col md:flex-row justify-between w-full gap-10 pb-12">
        
        {/* Left Side: Branding */}
        <div className="md:max-w-96">
          <img className="h-9 mb-6" src={assets.logo} alt="Rosh-AI" />
          <p className="text-sm leading-relaxed">
            Experience the power of AI with <span className="text-gray-800 dark:text-white font-medium">Rosh-AI</span>. 
            Transform your content creation with our suite of premium tools.
          </p>
        </div>

        {/* Right Side: Navigation & Newsletter */}
        <div className="flex-1 flex flex-col sm:flex-row md:justify-end gap-12 lg:gap-20">
          <div className="shrink-0">
            <h2 className="font-semibold mb-5 text-gray-900 dark:text-slate-100">Company</h2>
            <ul className="text-sm space-y-3">
              <li><a href="#" className="hover:text-primary transition-colors">Home</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">About us</a></li>
              <li><a href="mailto:bhurtelkhani068@gmail.com" className="hover:text-primary transition-colors">Contact</a></li>
            </ul>
          </div>

          <div className="max-w-md w-full relative">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              Stay in the loop <Sparkles className="w-4 h-4 text-yellow-500" />
            </h2>
            
            <AnimatePresence mode="wait">
              {!subscribed ? (
                <motion.div
                  key="form-step"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <p className="text-sm mb-5">Get the latest AI updates delivered to your inbox.</p>
                  <form onSubmit={handleSubscribe} className="flex gap-2">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-indigo-500/50 transition-all"
                      type="email"
                      required
                    />
                    <button
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="success-step"
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 p-4 rounded-xl flex flex-col items-center text-center gap-2"
                >
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mb-1 shadow-lg shadow-indigo-500/40">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-indigo-900 dark:text-indigo-100 font-bold">You're on the list!</h3>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    We've sent a connection request to bhurtelkhani068@gmail.com.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 py-6 text-center text-xs">
        <p>Copyright 2025 © bhurtel. All Right Reserved.</p>
      </div>
    </footer>
  )
}

export default Footer