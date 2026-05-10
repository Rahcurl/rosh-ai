import express from "express";
import { auth } from "../middlewares/auth.js";
import { getPublishedCreations, getUserCreations, toggleLikeCreation, updateUserPlan, getUserPlan, getPlanLimits } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/get-user-creations', auth, getUserCreations)
userRouter.get('/get-published-creations', auth, getPublishedCreations)
userRouter.post('/toggle-like-creation', auth, toggleLikeCreation)
userRouter.post('/update-plan', auth, updateUserPlan)
userRouter.get('/get-user-plan', auth, getUserPlan)
userRouter.get('/get-plan-limits', getPlanLimits)

export default userRouter;