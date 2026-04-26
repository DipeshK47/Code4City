const express = require("express");
const {
  createComment,
  createPost,
  createReply,
  deleteComment,
  deletePost,
  getPost,
  likePost,
  listComments,
  listPosts,
  unlikePost,
  updatePost,
} = require("../controllers/communityController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/posts", listPosts);
router.post("/posts", requireAuth, createPost);
router.get("/posts/:id", getPost);
router.patch("/posts/:id", requireAuth, updatePost);
router.delete("/posts/:id", requireAuth, deletePost);
router.post("/posts/:id/like", requireAuth, likePost);
router.delete("/posts/:id/like", requireAuth, unlikePost);
router.get("/posts/:id/comments", listComments);
router.post("/posts/:id/comments", requireAuth, createComment);
router.post("/comments/:id/replies", requireAuth, createReply);
router.delete("/comments/:id", requireAuth, deleteComment);

module.exports = router;
