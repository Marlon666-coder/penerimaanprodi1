/**
 * Program list for STATIC MODE (GitHub Pages / no server).
 * Keep this in sync with server/config/programs.js — same codes, names and
 * seedApplicants — so the app looks identical whether it runs on the Node
 * server or fully in the browser.
 *
 * To change programs when deploying statically, edit this file.
 */
export const PROGRAMS = [
  { code: 'CS', name: 'Computer Science', icon: 'cpu', description: 'Algorithms, artificial intelligence, systems and the theory behind modern computing.', seedApplicants: 50 },
  { code: 'IS', name: 'Information System', icon: 'network', description: 'Bridge business and technology: enterprise systems, analysis and digital transformation.', seedApplicants: 37 },
  { code: 'IT', name: 'Information Technology', icon: 'server', description: 'Infrastructure, cloud, networking and cyber security for connected organisations.', seedApplicants: 42 },
  { code: 'DB', name: 'Digital Business', icon: 'trending', description: 'E-commerce, digital marketing, fintech and tech-driven entrepreneurship.', seedApplicants: 28 },
  { code: 'DS', name: 'Data Science', icon: 'database', description: 'Statistics, machine learning and big-data engineering to turn data into decisions.', seedApplicants: 49 },
  { code: 'VCD', name: 'Visual Communication Design', icon: 'palette', description: 'Branding, UI/UX, motion graphics and visual storytelling for the digital era.', seedApplicants: 21 },
];
