/**
 * GraphQL Resolvers
 *
 * Main resolver export combining all resolver modules.
 * Uses modular pattern for maintainability.
 */

import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
import { calculationResolvers } from './calculation';
import { commentResolvers } from './comment';
import { folderResolvers } from './folder';
import { forumResolvers } from './forum';
import { profileResolvers } from './profile';
import { sharedCalculationResolvers } from './shared-calculation';
import { upvoteResolvers } from './upvote';
import { userResolvers } from './user';
import { worksheetResolvers } from './worksheet';

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
    ...profileResolvers.Query,
    ...sharedCalculationResolvers.Query,
  },

  // Mutation resolvers
  Mutation: {
    ...profileResolvers.Mutation,
    ...worksheetResolvers.Mutation,
    ...folderResolvers.Mutation,
    ...calculationResolvers.Mutation,
    ...forumResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...upvoteResolvers.Mutation,
    ...sharedCalculationResolvers.Mutation,
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
