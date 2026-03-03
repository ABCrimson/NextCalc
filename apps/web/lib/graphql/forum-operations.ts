/**
 * Forum GraphQL Operation Documents
 *
 * All gql-tagged operations for the NextCalc Pro community forum.
 * Used with Apollo Client 4.2.0-alpha.0 hooks (useQuery, useMutation).
 *
 * Operations match the forum-related types in apps/api/src/graphql/schema.ts.
 */

import { gql } from '@apollo/client';

// ============================================================================
// FORUM QUERIES
// ============================================================================

/** Get paginated forum posts for the main listing */
export const FORUM_POSTS_QUERY = gql`
  query ForumPosts($limit: Int = 20, $offset: Int = 0, $tags: [String!], $searchQuery: String) {
    forumPosts(limit: $limit, offset: $offset, tags: $tags, searchQuery: $searchQuery) {
      nodes {
        id
        title
        content
        tags
        views
        isPinned
        isClosed
        createdAt
        upvoteCount
        hasUpvoted
        user {
          id
          name
          image
        }
        commentCount
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        totalCount
        currentPage
        totalPages
      }
    }
  }
`;

/** Get a single forum post with all comments */
export const FORUM_POST_QUERY = gql`
  query ForumPost($id: ID!) {
    forumPost(id: $id) {
      id
      title
      content
      tags
      views
      isPinned
      isClosed
      createdAt
      updatedAt
      commentCount
      upvoteCount
      hasUpvoted
      user {
        id
        name
        image
        bio
        role
        createdAt
      }
      comments(limit: 100) {
        id
        content
        createdAt
        upvoteCount
        hasUpvoted
        user {
          id
          name
          image
        }
        parent {
          id
        }
        replies {
          id
          content
          createdAt
          upvoteCount
          hasUpvoted
          user {
            id
            name
            image
          }
        }
      }
    }
  }
`;

/** Get a user profile with their posts */
export const USER_PROFILE_QUERY = gql`
  query UserProfile($id: ID!) {
    user(id: $id) {
      id
      name
      image
      bio
      role
      createdAt
      worksheetCount
      forumPosts(limit: 50) {
        id
        title
        tags
        createdAt
        upvoteCount
        views
      }
    }
  }
`;

// ============================================================================
// FORUM MUTATIONS
// ============================================================================

/** Create a new forum post */
export const CREATE_FORUM_POST_MUTATION = gql`
  mutation CreateForumPost($input: CreateForumPostInput!) {
    createForumPost(input: $input) {
      id
      title
      content
      tags
      views
      isPinned
      isClosed
      createdAt
      upvoteCount
      hasUpvoted
      user {
        id
        name
        image
      }
    }
  }
`;

/** Update an existing forum post */
export const UPDATE_FORUM_POST_MUTATION = gql`
  mutation UpdateForumPost($id: ID!, $input: UpdateForumPostInput!) {
    updateForumPost(id: $id, input: $input) {
      id
      title
      content
      tags
      updatedAt
    }
  }
`;

/** Delete a forum post */
export const DELETE_FORUM_POST_MUTATION = gql`
  mutation DeleteForumPost($id: ID!) {
    deleteForumPost(id: $id)
  }
`;

/** Toggle upvote on a post or comment */
export const TOGGLE_UPVOTE_MUTATION = gql`
  mutation ToggleUpvote($targetId: ID!, $targetType: UpvoteTargetType!) {
    toggleUpvote(targetId: $targetId, targetType: $targetType) {
      upvoted
      upvoteCount
    }
  }
`;

/** Create a comment on a post */
export const CREATE_COMMENT_MUTATION = gql`
  mutation CreateComment($input: CreateCommentInput!) {
    createComment(input: $input) {
      id
      content
      createdAt
      upvoteCount
      hasUpvoted
      user {
        id
        name
        image
      }
      parent {
        id
      }
      replies {
        id
      }
    }
  }
`;

/** Update a comment */
export const UPDATE_COMMENT_MUTATION = gql`
  mutation UpdateComment($id: ID!, $input: UpdateCommentInput!) {
    updateComment(id: $id, input: $input) {
      id
      content
      updatedAt
    }
  }
`;

/** Delete a comment */
export const DELETE_COMMENT_MUTATION = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;
