// Profile sections and the labels their fields use. Shared by server and client code.
export const SECTIONS = [
  {
    id: "education",
    label: "Education",
    singular: "education",
    title: "Degree / program",
    subtitle: "School",
    details: "Details: coursework, awards, GPA (one per line)",
  },
  {
    id: "experience",
    label: "Experience",
    singular: "position",
    title: "Job title",
    subtitle: "Company",
    details: "What you did (one bullet per line)",
  },
  {
    id: "project",
    label: "Projects",
    singular: "project",
    title: "Project name",
    subtitle: "Course, team, or lab (optional)",
    details: "What you did and what came of it (one bullet per line)",
  },
  {
    id: "skill",
    label: "Skills",
    singular: "skill",
    title: "Skill",
    subtitle: "Category, e.g. Software",
    details: "",
  },
  {
    id: "story",
    label: "STAR stories",
    singular: "story",
    title: "Story title, e.g. 'Sensor calibration failure'",
    subtitle: "Related project or job (optional)",
    details: "Situation, Task, Action, Result",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export type Section = (typeof SECTIONS)[number];

export function isSection(value: unknown): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}
