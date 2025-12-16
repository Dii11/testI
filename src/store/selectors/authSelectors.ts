import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../index';

const selectAuthState = (state: RootState) => state.auth;

export const selectUser = createSelector([selectAuthState], authState => authState.user);

export const selectIsAuthenticated = createSelector(
  [selectAuthState],
  authState => authState.isAuthenticated
);

export const selectAuthIsLoading = createSelector(
  [selectAuthState],
  authState => authState.isLoading
);

export const selectAuthError = createSelector([selectAuthState], authState => authState.error);
