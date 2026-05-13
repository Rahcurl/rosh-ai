import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { X } from 'lucide-react'

const Hero = () => {
  const navigate = useNavigate()
  const { user } = useUser()
  const [showVideo, setShowVideo] = useState(false)

  const baseAvatars = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&auto=format&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop&crop=face",
  ]

  const avatars = user?.imageUrl
    ? [user.imageUrl, ...baseAvatars.slice(0, 2)]
    : baseAvatars

  return (
    <div className='px-4 sm:px-20 xl:px-32 relative inline-flex flex-col w-full justify-center bg-[url(/gradientBackground.png)] bg-cover bg-no-repeat min-h-screen'>

      {/* Hero Text */}
      <div className='text-center mb-6'>
        <h1 className='text-3xl sm:text-5xl md:text-6xl 2xl:text-7xl font-semibold mx-auto leading-[1.2]'>
          Create amazing content <br /> with <span className='text-primary'>Rosh-AI</span>
        </h1>
        <p className='mt-4 max-w-xs sm:max-w-lg 2xl:max-w-xl m-auto max-sm:text-xs text-gray-600'>
          Transform your content creation with our suite of premium AI tools.
          Write articles, generate images, and enhance your workflow.
        </p>
      </div>

      {/* Buttons */}
      <div className='flex flex-wrap justify-center gap-4 text-sm max-sm:text-xs'>
        <button
          onClick={() => navigate('/ai')}
          className='bg-primary text-white px-10 py-3 rounded-lg hover:scale-102 active:scale-95 transition cursor-pointer'
        >
          Start creating now
        </button>
        <button
          onClick={() => setShowVideo(true)}
          className='bg-white px-10 py-3 rounded-lg border border-gray-300 hover:scale-102 active:scale-95 transition cursor-pointer flex items-center gap-2'
        >
          <span className='w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0'>
            <svg className='w-3 h-3 text-white fill-white ml-0.5' viewBox='0 0 24 24'>
              <path d='M8 5v14l11-7z' />
            </svg>
          </span>
          Watch demo
        </button>
      </div>

      {/* Trusted by */}
      <div className='flex items-center gap-3 mt-8 mx-auto text-gray-600 text-sm max-sm:text-xs'>
        <div className='flex items-center'>
          {avatars.map((src, i) => (
            <img
              key={i}
              src={src}
              alt="user avatar"
              className='w-9 h-9 rounded-full object-cover border-2 border-white'
              style={{
                marginLeft: i === 0 ? 0 : '-10px',
                zIndex: avatars.length - i,
                position: 'relative',
              }}
            />
          ))}
        </div>
        Trusted by <span className='font-semibold text-gray-700 mx-1'>10k+</span> people
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div
          className='fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4'
          onClick={() => setShowVideo(false)}
        >
          <div
            className='relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-black'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className='flex items-start justify-between px-5 py-4 bg-white'>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>
                  See Rosh-AI in Action
                </h2>
                <p className='text-sm text-gray-500 mt-0.5'>
                  Watch how easy it is to generate articles, create images,
                  and supercharge your workflow — all in under 2 minutes.
                </p>
              </div>
              <button
                onClick={() => setShowVideo(false)}
                className='ml-4 mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition cursor-pointer'
              >
                <X className='w-4 h-4 text-gray-600' />
              </button>
            </div>

            {/* Video */}
            <div className='aspect-video w-full'>
              <iframe
                className='w-full h-full'
                src='https://www.youtube.com/embed/SqIgNaoe_mg?autoplay=1&rel=0'
                title='See Rosh-AI in Action'
                allow='autoplay; fullscreen; picture-in-picture'
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Hero