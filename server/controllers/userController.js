import sql from "../configs/db.js";

// Plan limits
const planLimits = {
  free: { creationsPerMonth: 5, features: ['write-article', 'blog-titles'] },
  pro: { creationsPerMonth: 500, features: ['write-article', 'blog-titles', 'generate-images', 'remove-background'] },
  enterprise: { creationsPerMonth: 9999, features: ['write-article', 'blog-titles', 'generate-images', 'remove-background', 'remove-object', 'review-resume'] }
}

// Update user plan
export const updateUserPlan = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { plan } = req.body

    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.json({ success: false, message: "Invalid plan" })
    }

    // Create users table if not exists and insert/update user
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        plan TEXT DEFAULT 'free',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    const uid = userId != null ? String(userId) : ''
    await sql`
      INSERT INTO users (id, plan) VALUES (${uid}, ${plan})
      ON CONFLICT (id) DO UPDATE SET plan = ${plan}, updated_at = NOW()
    `

    res.json({ success: true, message: `Plan updated to ${plan}`, plan })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// Get user plan
export const getUserPlan = async (req, res) => {
  try {
    const { userId } = req.auth()

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        plan TEXT DEFAULT 'free',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `

    const uid = userId != null ? String(userId) : ''
    const [user] = await sql`SELECT * FROM users WHERE id = ${uid}`
    const plan = user?.plan || 'free'

    res.json({ success: true, plan, limits: planLimits[plan] })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// Get plan limits
export const getPlanLimits = async (req, res) => {
  res.json({ success: true, planLimits })
}

export const getUserCreations = async (req, res)=>{
    try {
        const {userId} = req.auth()
        const uid = userId != null ? String(userId) : ''

       const creations = await sql`SELECT * FROM creations WHERE user_id = ${uid} ORDER BY created_at DESC`;

        res.json({ success: true, creations });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const getPublishedCreations = async (req, res)=>{
    try {

       const creations = await sql`
       SELECT * FROM creations WHERE publish = true ORDER BY created_at DESC`;

        res.json({ success: true, creations });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const toggleLikeCreation = async (req, res)=>{
    try {

        const {userId} = req.auth()
        const {id} = req.body

        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`

        if(!creation){
            return res.json({ success: false, message: "Creation not found" })
        }

        const currentLikes = Array.isArray(creation.likes) ? creation.likes : [];
        const userIdStr = userId.toString();
        let updatedLikes;
        let message;

        if (currentLikes.includes(userIdStr)) {
            updatedLikes = currentLikes.filter((user) => user !== userIdStr);
            message = 'Creation Unliked'
        } else {
            updatedLikes = [...currentLikes, userIdStr]
            message = 'Creation Liked'
        }

       await sql`UPDATE creations SET likes = ${updatedLikes} WHERE id = ${id}`;

        res.json({ success: true, message });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}