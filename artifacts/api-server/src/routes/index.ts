import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import postsRouter from "./posts.js";
import chatRouter from "./chat.js";
import matchRouter from "./match.js";
import safetyRouter from "./safety.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(chatRouter);
router.use(matchRouter);
router.use(safetyRouter);

export default router;
