import type { MemberPublic, EventPublic } from "@cba/types";

const focal = { headshot_focal_x: 50, headshot_focal_y: 50, professional_is_interests: false, is_active: true };

export const PLACEHOLDER_EXEC: MemberPublic[] = [
  { id: "1", name: "Fadi Ismail", email: "", role: "eboard", role_title: "President", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
  { id: "2", name: "Tatum McLaughlin", email: "", role: "eboard", role_title: "Vice President, Internal", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
  { id: "3", name: "Patrick Rushford", email: "", role: "eboard", role_title: "Vice President, External", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
  { id: "4", name: "Charles Huang", email: "", role: "eboard", role_title: "Vice President, Treasury", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
];

export const PLACEHOLDER_ANALYSTS: MemberPublic[] = [
  { id: "5", name: "Director of Recruitment", email: "", role: "director", role_title: "Director of Recruitment", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
  { id: "6", name: "Director of Professional Development", email: "", role: "director", role_title: "Director of Professional Development", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
  { id: "7", name: "Project Manager", email: "", role: "pm", role_title: "Project Manager", headshot_url: null, ...focal, bio: null, major: null, grad_year: null, hometown: null, campus_involvements: null, professional_experience: null, interests: null, linkedin_url: null, cohort_semester: "Spring 2026" },
];

export const PLACEHOLDER_EVENTS: EventPublic[] = [];
