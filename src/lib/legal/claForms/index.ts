/**
 * CLA Forms — Community Land Act 2016 Form Generators
 * Barrel index with static imports for Next.js compatibility.
 */

export { generateClaForm1 } from './claForm1';
export type { ClaForm1Data } from './claForm1';

export { generateClaForm2 } from './claForm2';
export type { ClaForm2Data } from './claForm2';

export { generateClaForm3 } from './claForm3';
export type { ClaForm3Data } from './claForm3';

export { generateClaForm4 } from './claForm4';
export type { ClaForm4Data } from './claForm4';

export { generateClaForm5 } from './claForm5';
export type { ClaForm5Data } from './claForm5';

export { generateClaForm6 } from './claForm6';
export type { ClaForm6Data } from './claForm6';

export { generateClaForm7 } from './claForm7';
export type { ClaForm7Data } from './claForm7';

import { generateClaForm1 } from './claForm1';
import { generateClaForm2 } from './claForm2';
import { generateClaForm3 } from './claForm3';
import { generateClaForm4 } from './claForm4';
import { generateClaForm5 } from './claForm5';
import { generateClaForm6 } from './claForm6';
import { generateClaForm7 } from './claForm7';

type FormGenerator = (data: never) => Uint8Array;

export const CLA_FORM_REGISTRY: Record<string, { generator: FormGenerator; description: string; claFormNumber: string }> = {
  cla_form_1: { generator: generateClaForm1, description: 'Community Land Registration Application', claFormNumber: 'CLA Form 1' },
  cla_form_2: { generator: generateClaForm2, description: 'Community Land Claim', claFormNumber: 'CLA Form 2' },
  cla_form_3: { generator: generateClaForm3, description: 'Community Land Boundary Description', claFormNumber: 'CLA Form 3' },
  cla_form_4: { generator: generateClaForm4, description: 'Community Land Committee Registration', claFormNumber: 'CLA Form 4' },
  cla_form_5: { generator: generateClaForm5, description: 'Customary Rights Recognition', claFormNumber: 'CLA Form 5' },
  cla_form_6: { generator: generateClaForm6, description: 'Community Land Interests / Entry in Register', claFormNumber: 'CLA Form 6' },
  cla_form_7: { generator: generateClaForm7, description: 'Community Land Lease Application (CLA Form 9)', claFormNumber: 'CLA Form 9' },
};
