/**
 * GraphQL Operation Documents
 *
 * All gql-tagged operations for the NextCalc Pro frontend.
 * Used with Apollo Client 4.2.0-alpha.0 hooks (useQuery, useMutation, useSuspenseQuery).
 *
 * Operations match the GraphQL schema defined in apps/api/src/graphql/schema.ts.
 */

import { gql } from '@apollo/client';

// ============================================================================
// USER QUERIES
// ============================================================================

/** Get the currently authenticated user's profile */
export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      image
      bio
      role
      createdAt
      updatedAt
      worksheetCount
    }
  }
`;

/** Get a user by ID */
export const USER_QUERY = gql`
  query User($id: ID!) {
    user(id: $id) {
      id
      email
      name
      image
      bio
      role
      createdAt
      worksheetCount
    }
  }
`;

// ============================================================================
// WORKSHEET QUERIES
// ============================================================================

/** Get a single worksheet by ID */
export const WORKSHEET_QUERY = gql`
  query Worksheet($id: ID!) {
    worksheet(id: $id) {
      id
      title
      description
      content
      visibility
      views
      createdAt
      updatedAt
      user {
        id
        name
        image
      }
      folder {
        id
        name
      }
      shares {
        id
        sharedWith
        permission
      }
    }
  }
`;

/** Get paginated worksheets for the current user */
export const WORKSHEETS_QUERY = gql`
  query Worksheets(
    $limit: Int = 20
    $offset: Int = 0
    $visibility: WorksheetVisibility
    $userId: ID
    $folderId: ID
    $searchQuery: String
  ) {
    worksheets(
      limit: $limit
      offset: $offset
      visibility: $visibility
      userId: $userId
      folderId: $folderId
      searchQuery: $searchQuery
    ) {
      nodes {
        id
        title
        description
        visibility
        views
        createdAt
        updatedAt
        user {
          id
          name
          image
        }
        folder {
          id
          name
        }
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

/** Get public worksheets (gallery) */
export const PUBLIC_WORKSHEETS_QUERY = gql`
  query PublicWorksheets(
    $limit: Int = 20
    $offset: Int = 0
    $searchQuery: String
  ) {
    publicWorksheets(
      limit: $limit
      offset: $offset
      searchQuery: $searchQuery
    ) {
      nodes {
        id
        title
        description
        views
        createdAt
        user {
          id
          name
          image
        }
      }
      pageInfo {
        hasNextPage
        totalCount
        currentPage
        totalPages
      }
    }
  }
`;

// ============================================================================
// WORKSHEET MUTATIONS
// ============================================================================

/** Create a new worksheet */
export const CREATE_WORKSHEET_MUTATION = gql`
  mutation CreateWorksheet($input: CreateWorksheetInput!) {
    createWorksheet(input: $input) {
      id
      title
      description
      visibility
      createdAt
    }
  }
`;

/** Update an existing worksheet */
export const UPDATE_WORKSHEET_MUTATION = gql`
  mutation UpdateWorksheet($id: ID!, $input: UpdateWorksheetInput!) {
    updateWorksheet(id: $id, input: $input) {
      id
      title
      description
      content
      visibility
      updatedAt
    }
  }
`;

/** Delete a worksheet (soft delete) */
export const DELETE_WORKSHEET_MUTATION = gql`
  mutation DeleteWorksheet($id: ID!) {
    deleteWorksheet(id: $id)
  }
`;

// ============================================================================
// FOLDER QUERIES & MUTATIONS
// ============================================================================

/** Get user's folders */
export const FOLDERS_QUERY = gql`
  query Folders($userId: ID) {
    folders(userId: $userId) {
      id
      name
      description
      createdAt
      parent {
        id
        name
      }
      children {
        id
        name
      }
    }
  }
`;

/** Create a new folder */
export const CREATE_FOLDER_MUTATION = gql`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
      id
      name
      description
    }
  }
`;

// ============================================================================
// CALCULATION QUERIES & MUTATIONS
// ============================================================================

/** Perform a server-side calculation */
export const CALCULATE_QUERY = gql`
  query Calculate($input: CalculationInput!) {
    calculate(input: $input) {
      input
      result
      formatted
      variables
      timestamp
    }
  }
`;

/** Get calculation history */
export const CALCULATION_HISTORY_QUERY = gql`
  query CalculationHistory($limit: Int = 50, $offset: Int = 0) {
    calculationHistory(limit: $limit, offset: $offset) {
      id
      userId
      expression
      result
      variables
      timestamp
    }
  }
`;

/** Save a calculation to history */
export const SAVE_CALCULATION_MUTATION = gql`
  mutation SaveCalculation($input: CalculationInput!) {
    saveCalculation(input: $input) {
      id
      expression
      result
      timestamp
    }
  }
`;

/** Clear calculation history */
export const CLEAR_CALCULATION_HISTORY_MUTATION = gql`
  mutation ClearCalculationHistory {
    clearCalculationHistory
  }
`;

// ============================================================================
// HEALTH QUERY
// ============================================================================

/** System health check */
export const HEALTH_QUERY = gql`
  query Health {
    health {
      status
      timestamp
      database {
        status
        latency
        error
      }
      redis {
        status
        latency
        error
      }
      version
    }
  }
`;
