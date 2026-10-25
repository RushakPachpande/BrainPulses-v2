import { createBrowserRouter, createRoutesFromElements } from 'react-router';
import { AppRoutes } from './app-routes';

// createRoutesFromElements only accepts <Route> elements, not a component that returns one.
export const appRouter = createBrowserRouter(createRoutesFromElements(AppRoutes()));
