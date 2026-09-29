/**
 * ============================================================
 *  PROGRAM LIST  —  edit this file to change the study programs
 * ============================================================
 * - `code` is the permanent identifier (do not change it once applicants exist).
 * - `capacity` is optional; when omitted PROGRAM_CAPACITY from .env is used (default 50).
 * - `icon` is a key from client/src/ui/icons.js
 * - `seedApplicants` = number of dummy applicants created in DEMO mode.
 *
 * Programs are synchronised into the database every time the server starts:
 * new codes are inserted, existing ones are updated, removed codes are hidden
 * (kept in the DB so historical applicants remain valid).
 */
export const PROGRAMS = [
  {
    code: 'CS',
    name: 'Computer Science',
    icon: 'cpu',
    description: 'Algorithms, artificial intelligence, systems and the theory behind modern computing.',
    seedApplicants: 50,
  },
  {
    code: 'IS',
    name: 'Information System',
    icon: 'network',
    description: 'Bridge business and technology: enterprise systems, analysis and digital transformation.',
    seedApplicants: 37,
  },
  {
    code: 'IT',
    name: 'Information Technology',
    icon: 'server',
    description: 'Infrastructure, cloud, networking and cyber security for connected organisations.',
    seedApplicants: 42,
  },
  {
    code: 'DB',
    name: 'Digital Business',
    icon: 'trending',
    description: 'E-commerce, digital marketing, fintech and tech-driven entrepreneurship.',
    seedApplicants: 28,
  },
  {
    code: 'DS',
    name: 'Data Science',
    icon: 'database',
    description: 'Statistics, machine learning and big-data engineering to turn data into decisions.',
    seedApplicants: 49,
  },
  {
    code: 'VCD',
    name: 'Visual Communication Design',
    icon: 'palette',
    description: 'Branding, UI/UX, motion graphics and visual storytelling for the digital era.',
    seedApplicants: 21,
  },
];
