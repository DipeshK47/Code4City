const communityService = require("../services/communityService");
const { getOptionalUserFromRequest } = require("../utils/optionalAuth");

function getViewerUserId(req) {
  return getOptionalUserFromRequest(req)?.id ?? null;
}

function handleError(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

async function listPosts(req, res) {
  try {
    const data = await communityService.listPosts({
      viewerUserId: getViewerUserId(req),
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load community posts.");
  }
}

async function getPost(req, res) {
  try {
    const data = await communityService.getPost(
      req.params.id,
      getViewerUserId(req),
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load community post.");
  }
}

async function createPost(req, res) {
  try {
    const data = await communityService.createPost({
      userId: req.user.id,
      title: req.body.title,
      body: req.body.body,
      meetupId: req.body.meetupId,
    });

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create post.");
  }
}

async function updatePost(req, res) {
  try {
    const data = await communityService.updatePost(
      req.params.id,
      req.user.id,
      req.body,
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update post.");
  }
}

async function deletePost(req, res) {
  try {
    await communityService.deletePost(req.params.id, req.user.id);

    return res.json({
      success: true,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete post.");
  }
}

async function likePost(req, res) {
  try {
    const data = await communityService.likePost(req.params.id, req.user.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to like post.");
  }
}

async function unlikePost(req, res) {
  try {
    const data = await communityService.unlikePost(req.params.id, req.user.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to remove post like.");
  }
}

async function listComments(req, res) {
  try {
    const data = await communityService.listComments(req.params.id);

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load comments.");
  }
}

async function createComment(req, res) {
  try {
    const data = await communityService.createComment({
      postId: req.params.id,
      userId: req.user.id,
      body: req.body.body,
    });

    return res.status(201).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create comment.");
  }
}

async function createReply(req, res) {
  try {
    const data = await communityService.createReply(
      req.params.id,
      req.user.id,
      req.body.body,
    );

    return res.status(201).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create reply.");
  }
}

async function deleteComment(req, res) {
  try {
    const data = await communityService.deleteComment(req.params.id, req.user.id);

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete comment.");
  }
}

module.exports = {
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
};
