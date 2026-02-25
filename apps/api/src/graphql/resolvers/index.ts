/**
 * GraphQL Resolvers
 *
 * Main resolver export combining all resolver modules.
 * Uses modular pattern for maintainability.
 */

import { userResolvers } from './user';
import { worksheetResolvers } from './worksheet';
import { folderResolvers } from './folder';
import { calculationResolvers } from './calculation';
import { forumResolvers } from './forum';
import { commentResolvers } from './comment';
import { upvoteResolvers } from './upvote';
import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';

export const resolvers = {
  // Custom scalars
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,

  // Query resolvers
  Query: {
    ...userResolvers.Query,
    ...worksheetResolvers.Query,
    ...folderResolvers.Query,
    ...calculationResolvers.Query,
    ...forumResolvers.Query,
    ...commentResolvers.Query,
  },

  // Mutation resolvers
  Mutation: {
    ...worksheetResolvers.Mutation,
    ...folderResolvers.Mutation,
    ...calculationResolvers.Mutation,
    ...forumResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...upvoteResolvers.Mutation,
  },

  // Subscription resolvers
  Subscription: {
    ...worksheetResolvers.Subscription,
  },

  // Type resolvers
  User: userResolvers.User,
  Worksheet: worksheetResolvers.Worksheet,
  Folder: folderResolvers.Folder,
  ForumPost: forumResolvers.ForumPost,
  Comment: commentResolvers.Comment,
};
