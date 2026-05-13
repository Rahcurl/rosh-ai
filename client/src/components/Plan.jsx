import React, { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'
import toast from 'react-hot-toast'

const Plan = () => {
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const { getToken } = useAuth()

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      description: 'Get started with basic features',
      features: [
        '5 creations per month',
        'Basic AI tools',
        'Community support',
        'Standard resolution images',
        'Article Writing',
        'Blog Title Generator'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      description: 'Perfect for content creators',
      featured: true,
      features: [
        '500 creations per month',
        'Advanced AI tools',
        'Priority support',
        'HD resolution images',
        'Custom branding',
        'Analytics dashboard',
        'Article Writing',
        'Blog Title Generator',
        'Image Generation',
        'Background Removal'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$29.99',
      period: '/month',
      description: 'For teams and businesses',
      features: [
        'Unlimited creations',
        'Everything in Pro',
        'API access',
        'White label solutions',
        '4K resolution images',
        'Dedicated account manager',
        'Custom integrations',
        'All Tools Available'
      ]
    }
  ]

  // Fetch current user plan
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/api/user/get-user-plan`,
          { headers: { Authorization: `Bearer ${await getToken()}` } }
        )
        if (response.data.success) {
          setCurrentPlan(response.data.plan)
        }
      } catch (error) {
        console.log('Could not fetch plan:', error.message)
      }
      setLoading(false)
    }

    fetchUserPlan()
  }, [getToken])

  // Handle plan selection
  const handleSelectPlan = async (planId) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/api/user/update-plan`,
        { plan: planId },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      )

      if (response.data.success) {
        setCurrentPlan(planId)
        toast.success(`Upgraded to ${planId} plan!`)
      } else {
        toast.error(response.data.message)
      }
    } catch (error) {
      toast.error('Failed to update plan')
    }
  }

  if (loading) {
    return <div className='text-center py-20'>Loading...</div>
  }

  return (
    <div className='max-w-6xl mx-auto z-20 my-20 px-4 sm:px-6 lg:px-8'>
      <div className='text-center mb-12'>
        <h2 className='text-slate-700 text-[42px] font-semibold mb-4'>Choose Your Plan</h2>
        <p className='text-gray-500 max-w-lg mx-auto'>Start for free and scale up as you grow. Find the perfect plan for your content creation needs.</p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-8 mt-14'>
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`rounded-lg border ${plan.featured ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200'} p-8 relative transition-all`}
          >
            {plan.featured && (
              <div className='absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold'>
                Popular
              </div>
            )}
            
            <h3 className='text-xl font-semibold text-slate-700 mb-2'>{plan.name}</h3>
            <p className='text-gray-600 text-sm mb-4'>{plan.description}</p>
            
            <div className='mb-6'>
              <span className='text-4xl font-bold text-slate-700'>{plan.price}</span>
              {plan.period && <span className='text-gray-600'>{plan.period}</span>}
            </div>

            {currentPlan === plan.id ? (
              <div className='w-full py-2 px-4 rounded-lg font-semibold mb-8 bg-green-100 text-green-700 text-center'>
                ✓ Current Plan
              </div>
            ) : (
              <button 
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-2 px-4 rounded-lg font-semibold mb-8 transition-all ${
                  plan.featured 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Select Plan
              </button>
            )}

            <div className='space-y-4'>
              {plan.features.map((feature, i) => (
                <div key={i} className='flex items-start gap-3'>
                  <Check className='w-5 h-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span className='text-gray-600 text-sm'>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className='mt-16 p-6 bg-blue-50 rounded-lg border border-blue-200'>
        <h3 className='text-lg font-semibold text-slate-700 mb-2'>📊 Your Current Plan: <span className='text-blue-600 uppercase'>{currentPlan}</span></h3>
        <p className='text-gray-600'>
          {currentPlan === 'free' && 'You can create 5 content pieces per month. Upgrade to unlock more tools and higher limits.'}
          {currentPlan === 'pro' && 'You can create up to 500 content pieces per month with advanced tools. Everything you need for professional content creation.'}
          {currentPlan === 'enterprise' && 'Unlimited creations with access to all tools. Perfect for teams and businesses with custom needs.'}
        </p>
      </div>
    </div>
  )
}

export default Plan
