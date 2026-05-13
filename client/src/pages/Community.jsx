import { useAuth, useUser } from '@clerk/clerk-react'
import React, { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'


axios.defaults.baseURL = import.meta.env.VITE_BASE_URL

const Community = () => {

  const [creations, setCreations] = useState([])
  const {user} = useUser()
  const [loading, setLoading] = useState(true)
  const { getToken } = useAuth()

  const fetchCreations = async ()=>{
    try {
      const {data} = await axios.get('/api/user/get-published-creations', {
        headers : {Authorization: `Bearer ${await getToken()}`}
      })
      if (data.success){
        setCreations(data.creations)
      }else{
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  const imageLikeToggle = async (id)=>{
    try {
      const {data} = await axios.post('/api/user/toggle-like-creation', {id}, {
        headers : {Authorization: `Bearer ${await getToken()}`}
      })

      if (data.success){
        toast.success(data.message)
        await fetchCreations()
      }else{
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(()=>{
    if(user){
      fetchCreations()
    }
  },[user])

  return !loading ? (
    <div className='flex-1 h-full flex flex-col gap-4 p-6'>
      Creations
      <div className='bg-white h-full w-full rounded-xl overflow-y-scroll p-4'>
        {creations.length === 0 ? (
          <div className='text-gray-500 py-10 text-center'>No published creations yet.</div>
        ) : creations.map((creation, index)=> {
          const likesCount = Array.isArray(creation.likes) ? creation.likes.length : 0
          const likedByUser = Array.isArray(creation.likes) && user?.id ? creation.likes.includes(user.id) : false

          return (
            <div key={index} className='mb-4 rounded-xl border border-gray-200 overflow-hidden'>
              <div className='relative group'>
                {creation.type === 'image' ? (
                  <img src={creation.content} alt={creation.prompt} className='w-full h-80 object-cover' />
                ) : (
                  <div className='p-4 bg-slate-50'>
                    <p className='text-sm font-semibold text-slate-700'>AI Content</p>
                    <p className='mt-2 text-sm text-slate-600'>{creation.prompt}</p>
                    <div className='mt-3 text-sm text-slate-700 whitespace-pre-line'>{creation.content}</div>
                  </div>
                )}

                <div className='absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/75 to-transparent text-white'>
                  <p className='text-sm line-clamp-2'>{creation.prompt}</p>
                  <div className='mt-2 flex items-center justify-between'>
                    <span className='text-xs uppercase tracking-[0.2em] text-white/80'>{creation.type}</span>
                    <button type='button' onClick={()=> imageLikeToggle(creation.id)} className='flex items-center gap-1 text-white'>
                      <Heart className={`${likedByUser ? 'fill-red-500 text-red-500' : 'text-white'} w-4 h-4`} />
                      <span>{likesCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ) : (
    <div className='flex justify-center items-center h-full'>
      <span className='w-10 h-10 my-1 rounded-full border-3 border-primary border-t-transparent animate-spin'></span>
    </div>
  )
}

export default Community
