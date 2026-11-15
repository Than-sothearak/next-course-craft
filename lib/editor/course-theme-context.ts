"use client";

import { createContext } from "react";
import { defaultCourseTheme } from "./theme";

export const CourseThemeContext = createContext(defaultCourseTheme);
