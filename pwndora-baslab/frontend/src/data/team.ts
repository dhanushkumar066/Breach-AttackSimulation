/**
 * Project team shown on the executive welcome screen.
 *
 * `profileUrl` is intentionally left unset. These are real people, so no profile
 * link is invented here — add each member's own URL below and the CONNECT button
 * turns into a live link automatically. Without one it renders as a disabled
 * control rather than a link that goes nowhere.
 */

export interface TeamMember {
  initials: string;
  name: string;
  role: string;
  blurb: string;
  profileUrl?: string;
}

export const TEAM: TeamMember[] = [
  {
    initials: 'DK',
    name: 'Dhanush Kumar',
    role: 'Security Architect',
    blurb: 'Specializing in Cloud Infrastructure & Red Team Orchestration.',
  },
  {
    initials: 'AS',
    name: 'Aravind Sadasivan',
    role: 'Detection Engine Lead',
    blurb: 'Engineering high-fidelity Sigma and Yara rules for complex hunts.',
  },
  {
    initials: 'JB',
    name: 'Jayashree Babu',
    role: 'Content Developer',
    blurb: 'Architecting TTP playbooks mapped to the MITRE ATT&CK framework.',
  },
  {
    initials: 'GS',
    name: 'Gantha Swaroopan',
    role: 'Scoring Algorithm Dev',
    blurb: 'Developing risk-weighted metrics for security posture assessment.',
  },
];

export const PROJECT = {
  department: 'Department of AI & ML',
  codename: 'Project Mayhem',
  problemStatement: 'BSCDS26-EPME-02',
} as const;
