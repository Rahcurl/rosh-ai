import { clerkClient } from "@clerk/express";

// Middleware to check userId and hasPremiumPlan

export const auth = async (req, res, next)=>{
    try {
        const { userId, has } = await req.auth()
        const hasPremiumPlan = await has({ plan: 'premium' })

        if (hasPremiumPlan) {
            req.plan = 'premium'
            req.free_usage = 0
            return next()
        }

        req.plan = 'free'
        const user = await clerkClient.users.getUser(userId)
        req.free_usage = user.privateMetadata?.free_usage ?? 0
        next()
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}