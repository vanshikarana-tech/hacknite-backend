export interface WcagCriterion {
  id: string;
  name: string;
  principle: 'perceivable' | 'operable' | 'understandable' | 'robust';
  level: 'A' | 'AA' | 'AAA';
  description: string;
}

export const WCAG_CRITERIA: WcagCriterion[] = [
  { id: '1.1.1', name: 'Non-text Content', principle: 'perceivable', level: 'A', description: 'All non-text content has a text alternative.' },
  { id: '1.2.1', name: 'Audio-only and Video-only', principle: 'perceivable', level: 'A', description: 'Provide alternatives for time-based media.' },
  { id: '1.2.2', name: 'Captions (Prerecorded)', principle: 'perceivable', level: 'A', description: 'Captions for prerecorded audio content.' },
  { id: '1.3.1', name: 'Info and Relationships', principle: 'perceivable', level: 'A', description: 'Information and relationships are programmatically determinable.' },
  { id: '1.3.2', name: 'Meaningful Sequence', principle: 'perceivable', level: 'A', description: 'Reading sequence is meaningful.' },
  { id: '1.3.3', name: 'Sensory Characteristics', principle: 'perceivable', level: 'A', description: 'Instructions do not rely solely on sensory characteristics.' },
  { id: '1.4.1', name: 'Use of Color', principle: 'perceivable', level: 'A', description: 'Color is not used as the only visual means of conveying information.' },
  { id: '1.4.3', name: 'Contrast (Minimum)', principle: 'perceivable', level: 'AA', description: 'Text has a contrast ratio of at least 4.5:1.' },
  { id: '1.4.4', name: 'Resize Text', principle: 'perceivable', level: 'AA', description: 'Text can be resized up to 200% without loss of content.' },
  { id: '1.4.11', name: 'Non-text Contrast', principle: 'perceivable', level: 'AA', description: 'UI components have a contrast ratio of at least 3:1.' },
  { id: '2.1.1', name: 'Keyboard', principle: 'operable', level: 'A', description: 'All functionality is operable through a keyboard interface.' },
  { id: '2.1.2', name: 'No Keyboard Trap', principle: 'operable', level: 'A', description: 'Keyboard focus can be moved away from any component.' },
  { id: '2.2.1', name: 'Timing Adjustable', principle: 'operable', level: 'A', description: 'Time limits can be turned off, adjusted, or extended.' },
  { id: '2.3.1', name: 'Three Flashes or Below Threshold', principle: 'operable', level: 'A', description: 'No content flashes more than three times per second.' },
  { id: '2.4.1', name: 'Bypass Blocks', principle: 'operable', level: 'A', description: 'Skip navigation links are available.' },
  { id: '2.4.2', name: 'Page Titled', principle: 'operable', level: 'A', description: 'Web pages have descriptive titles.' },
  { id: '2.4.3', name: 'Focus Order', principle: 'operable', level: 'A', description: 'Focus order preserves meaning and operability.' },
  { id: '2.4.4', name: 'Link Purpose', principle: 'operable', level: 'A', description: 'Link purpose is determinable from the link text.' },
  { id: '2.4.7', name: 'Focus Visible', principle: 'operable', level: 'AA', description: 'Keyboard focus indicator is visible.' },
  { id: '3.1.1', name: 'Language of Page', principle: 'understandable', level: 'A', description: 'Default human language of the page is programmatically determinable.' },
  { id: '3.1.2', name: 'Language of Parts', principle: 'understandable', level: 'AA', description: 'Language of each passage can be programmatically determined.' },
  { id: '3.2.1', name: 'On Focus', principle: 'understandable', level: 'A', description: 'Receiving focus does not initiate a context change.' },
  { id: '3.2.2', name: 'On Input', principle: 'understandable', level: 'A', description: 'Changing a setting does not automatically change context.' },
  { id: '3.3.1', name: 'Error Identification', principle: 'understandable', level: 'A', description: 'Input errors are identified and described to the user.' },
  { id: '3.3.2', name: 'Labels or Instructions', principle: 'understandable', level: 'A', description: 'Labels or instructions are provided for user input.' },
  { id: '3.3.3', name: 'Error Suggestion', principle: 'understandable', level: 'AA', description: 'Error correction suggestions are provided when possible.' },
  { id: '4.1.1', name: 'Parsing', principle: 'robust', level: 'A', description: 'Markup can be parsed unambiguously.' },
  { id: '4.1.2', name: 'Name, Role, Value', principle: 'robust', level: 'A', description: 'Name, role, and value can be programmatically determined.' },
  { id: '4.1.3', name: 'Status Messages', principle: 'robust', level: 'AA', description: 'Status messages can be programmatically determined.' },
];

export function getCriterionById(id: string): WcagCriterion | undefined {
  return WCAG_CRITERIA.find((c) => c.id === id);
}
