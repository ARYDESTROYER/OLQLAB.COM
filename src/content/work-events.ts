export type WorkTone = "cognitive" | "personality" | "response" | "ink";

export type WorkImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  orientation?: "portrait";
  objectPosition?: string;
};

export type WorkEvent = {
  slug: string;
  index: string;
  eyebrow: string;
  title: string;
  dateTime: string;
  dateLabel: string;
  location: string;
  format: string;
  description: string;
  tone: WorkTone;
  layout: "single" | "diptych" | "mosaic";
  images: readonly WorkImage[];
};

export const WORK_IMAGES = {
  solutionMindsetCampus: {
    src: "/work/solution-mindset-campus.webp",
    width: 2400,
    height: 1527,
    alt: "Pratap Pawar facilitating a solution-mindset exercise with a student cohort gathered around him.",
    caption:
      "The facilitator works through a live prompt with participants in the room.",
    objectPosition: "50% 46%",
  },
  learningThroughAction: {
    src: "/work/learning-through-action.webp",
    width: 2400,
    height: 1600,
    alt: "Pratap Pawar guiding two participants through a hands-on stage exercise.",
    caption: "Participants work through a hands-on exercise with the facilitator.",
    objectPosition: "50% 42%",
  },
  facilitatedDemonstration: {
    src: "/work/facilitated-demonstration.webp",
    width: 2400,
    height: 1600,
    alt: "Pratap Pawar demonstrating a fire extinguisher to a large student group outdoors.",
    caption:
      "The group watches a demonstration before participants take a turn.",
    objectPosition: "50% 45%",
  },
  participantPractice: {
    src: "/work/participant-practice.webp",
    width: 1200,
    height: 1800,
    orientation: "portrait",
    alt: "A participant using a fire extinguisher while the cohort watches.",
    caption: "Participants move from watching to doing.",
  },
  offsiteOrientation: {
    src: "/work/offsite-orientation.webp",
    width: 2400,
    height: 1599,
    alt: "Pratap Pawar addressing participants gathered for an outdoor team exercise.",
    caption: "The group gathers for instructions before the outdoor exercises.",
  },
  offsiteResponse: {
    src: "/work/offsite-response.webp",
    width: 2000,
    height: 1332,
    alt: "A participant completing a throwing exercise while the cohort watches.",
    caption: "One participant takes a turn while the group observes.",
    objectPosition: "50% 52%",
  },
  offsiteTrust: {
    src: "/work/offsite-trust.webp",
    width: 2000,
    height: 1332,
    alt: "A participant leading a tug-of-war team during an outdoor leadership challenge.",
    caption: "A participant takes position at the front of a tug-of-war team.",
    objectPosition: "50% 52%",
  },
  offsiteCoordination: {
    src: "/work/offsite-coordination.webp",
    width: 2000,
    height: 1332,
    alt: "Two teams pulling in opposite directions during a facilitated outdoor challenge.",
    caption: "Two teams take part in a facilitated tug-of-war exercise.",
    objectPosition: "50% 52%",
  },
  offsiteCourage: {
    src: "/work/offsite-courage.webp",
    width: 2000,
    height: 1332,
    alt: "A participant crossing a prepared fire-walk path with facilitators nearby.",
    caption: "Facilitators stay nearby as a participant crosses the prepared path.",
    objectPosition: "50% 48%",
  },
  swayamCohort: {
    src: "/work/swayam-cohort.webp",
    width: 1600,
    height: 1200,
    alt: "Pratap Pawar standing with the Swayam cohort after a group session.",
    caption: "A cohort gathers at the end of a shared learning session.",
    objectPosition: "50% 45%",
  },
} as const satisfies Record<string, WorkImage>;

export const WORK_EVENTS = [
  {
    slug: "solution-mindset-lab",
    index: "01",
    eyebrow: "Campus leadership lab",
    title: "Solution mindset, made observable.",
    dateTime: "2024-07-15",
    dateLabel: "15 July 2024",
    location: "Kopargaon, Maharashtra",
    format: "Interactive campus workshop",
    description:
      "A campus cohort took part in a Solution Mindset session. Participants worked from a live prompt with the facilitator, moving between group discussion and demonstration.",
    tone: "cognitive",
    layout: "single",
    images: [WORK_IMAGES.solutionMindsetCampus],
  },
  {
    slug: "learning-through-action",
    index: "02",
    eyebrow: "Experiential workshop",
    title: "Learning moves from explanation to action.",
    dateTime: "2024-07-10",
    dateLabel: "10 July 2024",
    location: "India",
    format: "Demonstration and participant practice",
    description:
      "The facilitator demonstrated equipment use before inviting participants to try it in front of the group. The sequence moved from instruction and observation to hands-on practice.",
    tone: "response",
    layout: "diptych",
    images: [
      WORK_IMAGES.facilitatedDemonstration,
      WORK_IMAGES.participantPractice,
    ],
  },
  {
    slug: "experiential-leadership-offsite",
    index: "03",
    eyebrow: "Leadership off-site",
    title: "An outdoor challenge, seen together.",
    dateTime: "2023-04-06",
    dateLabel: "6 April 2023",
    location: "India",
    format: "Facilitated outdoor group exercises",
    description:
      "An outdoor cohort moved through group challenges including throwing, tug-of-war, and a supervised fire-walk. The photographs record instructions, individual turns, and the group watching one another.",
    tone: "personality",
    layout: "mosaic",
    images: [
      WORK_IMAGES.offsiteOrientation,
      WORK_IMAGES.offsiteResponse,
      WORK_IMAGES.offsiteTrust,
      WORK_IMAGES.offsiteCoordination,
      WORK_IMAGES.offsiteCourage,
    ],
  },
  {
    slug: "swayam-cohort",
    index: "04",
    eyebrow: "Cohort development",
    title: "A cohort, gathered after the session.",
    dateTime: "2023-01",
    dateLabel: "January 2023",
    location: "India",
    format: "Swayam cohort gathering",
    description:
      "A group portrait records the Swayam cohort together at the close of a shared session.",
    tone: "ink",
    layout: "single",
    images: [WORK_IMAGES.swayamCohort],
  },
] as const satisfies readonly WorkEvent[];
