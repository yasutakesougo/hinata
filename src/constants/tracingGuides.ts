export interface StrokeGuide {
  id: number;
  start: { x: number; y: number };
  arrow: { x: number; y: number; rotate: string };
}

export interface TracingGuideData {
  guides: StrokeGuide[];
  keypoints: { x: number; y: number }[][];
}

export const TRACING_GUIDES: Record<string, TracingGuideData> = {
  'し': {
    guides: [
      { id: 1, start: { x: 120, y: 50 }, arrow: { x: 120, y: 120, rotate: 'rotate-90' } }
    ],
    keypoints: [
      [
        { x: 120, y: 50 },
        { x: 120, y: 190 },
        { x: 130, y: 215 },
        { x: 155, y: 220 },
        { x: 185, y: 200 }
      ]
    ]
  },
  'く': {
    guides: [
      { id: 1, start: { x: 75, y: 75 }, arrow: { x: 130, y: 105, rotate: 'rotate-30' } }
    ],
    keypoints: [
      [
        { x: 75, y: 75 },
        { x: 200, y: 140 },
        { x: 75, y: 205 }
      ]
    ]
  },
  'つ': {
    guides: [
      { id: 1, start: { x: 70, y: 90 }, arrow: { x: 130, y: 90, rotate: 'rotate-0' } }
    ],
    keypoints: [
      [
        { x: 70, y: 90 },
        { x: 200, y: 90 },
        { x: 210, y: 140 },
        { x: 180, y: 200 },
        { x: 120, y: 220 },
        { x: 60, y: 170 }
      ]
    ]
  },
  'へ': {
    guides: [
      { id: 1, start: { x: 60, y: 210 }, arrow: { x: 90, y: 160, rotate: '-rotate-45' } }
    ],
    keypoints: [
      [
        { x: 60, y: 210 },
        { x: 135, y: 95 },
        { x: 220, y: 210 }
      ]
    ]
  },
  'い': {
    guides: [
      { id: 1, start: { x: 90, y: 80 }, arrow: { x: 85, y: 130, rotate: 'rotate-90' } },
      { id: 2, start: { x: 190, y: 100 }, arrow: { x: 197, y: 140, rotate: 'rotate-75' } }
    ],
    keypoints: [
      [
        { x: 90, y: 80 },
        { x: 80, y: 170 },
        { x: 90, y: 205 },
        { x: 115, y: 180 }
      ],
      [
        { x: 190, y: 100 },
        { x: 205, y: 180 }
      ]
    ]
  }
};
