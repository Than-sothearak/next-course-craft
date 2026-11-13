"use client";

import { createContext } from "react";
import { defaultCourseNavigationMode, type CourseNavigationMode } from "./navigation";

/** Popup editors inherit the course mode through portals and nested dialogs. */
export const CourseNavigationModeContext = createContext<CourseNavigationMode>(defaultCourseNavigationMode);
